// POST /api/addons/booking-calendar/bookings/create
// Body: { userId, meetingType?, startUtc, guestName, guestEmail, guestNotes?, timezoneGuest? }
//
// Flow:
//   1. Validate inputs; the meeting type must exist and be active.
//   2. Paid types need checkout — not wired yet, so refuse (never book a paid slot for free).
//   3. Re-verify the slot against live freebusy of EVERY connection (fails closed).
//   4. Insert a pending_verify row carrying slotLock — the unique index on slotLock
//      rejects a concurrent booking of the same host + start right here, at the DB.
//   5. Insert the Google event on the primary connection; on failure, delete the row.
//   6. Flip the row to confirmed (googleEventId, meetLink) and notify the host (best-effort).

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { loadBookingEnv } from '../../../lib/env.js';
import { makeCalendarForConnection, fetchAllBusy, insertEvent } from '../../../lib/googleClient.js';
import { isSlotStillAvailable } from '../../../lib/slotEngine.js';
import { notifyHostOfBooking } from '../../../lib/notify.js';
import { publicOrigin } from '../../../lib/publicOrigin.js';
import {
  fetchRules, isBookable, fetchActiveBookings, slotLockFor, isDuplicateKeyError,
} from '../../../lib/meetingTypes.js';

export async function POST(request) {
  try {
    const { database, domain } = request.addonContext;
    const body = await request.json().catch(() => ({}));

    const {
      userId, meetingType = 'default', startUtc,
      guestName, guestEmail, guestNotes = '', timezoneGuest = 'UTC',
    } = body;

    if (!userId || !startUtc || !guestName || !guestEmail) {
      return NextResponse.json({ error: 'userId, startUtc, guestName, guestEmail required' }, { status: 400 });
    }
    if (!isEmail(guestEmail)) {
      return NextResponse.json({ error: 'guestEmail invalid' }, { status: 400 });
    }
    if (!isIsoDate(startUtc)) {
      return NextResponse.json({ error: 'startUtc must be ISO 8601' }, { status: 400 });
    }
    if (guestName.length > 120 || guestNotes.length > 2000) {
      return NextResponse.json({ error: 'Name or notes too long' }, { status: 400 });
    }

    const rules = await fetchRules(database, userId, meetingType);
    if (!isBookable(rules)) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if ((rules.priceCents || 0) > 0) {
      return NextResponse.json({ error: 'payment_required' }, { status: 402 });
    }

    const startDt = new Date(startUtc);
    const endDt = new Date(startDt.getTime() + (rules.durationMinutes || 30) * 60 * 1000);
    const endUtc = endDt.toISOString();

    // Pull host's connections.
    const connResult = await database.use('bc_connections').fetch({ filters: { userId } });
    const connections = Array.isArray(connResult) ? connResult : (connResult?.data || []);
    if (connections.length === 0) {
      return NextResponse.json({ error: 'Host has no connected calendars' }, { status: 409 });
    }
    const primary = connections.find(c => c.isPrimary) || connections[0];

    const env = await loadBookingEnv(domain);

    // Re-verify slot freshness against live freebusy across every connection.
    const busy = await fetchAllBusy({
      database, connections, env,
      fromUtc: new Date(startDt.getTime() - 60 * 60 * 1000).toISOString(),
      toUtc: new Date(endDt.getTime() + 60 * 60 * 1000).toISOString(),
    });
    const existingBookings = await fetchActiveBookings(database, userId);

    const stillAvailable = isSlotStillAvailable({
      rules,
      targetStartUtc: startDt.toISOString(),
      busy,
      existingBookings,
      nowUtc: new Date().toISOString(),
    });
    if (!stillAvailable) {
      return NextResponse.json({ error: 'Slot no longer available' }, { status: 409 });
    }

    // Insert pending booking row. slotLock makes a concurrent booking of the same start
    // fail here. (Overlapping bookings with DIFFERENT starts are caught by the check
    // above, not by the index — the window for that race is the few ms in between.)
    const bookings = database.use('bc_bookings');
    const cancelToken = crypto.randomBytes(16).toString('hex');
    let pending;
    try {
      pending = await bookings.add({
        userId,
        meetingType,
        guestName,
        guestEmail,
        guestNotes,
        startUtc: startDt,
        endUtc: endDt,
        timezoneGuest,
        status: 'pending_verify',
        cancelToken,
        slotLock: slotLockFor(userId, startDt),
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        return NextResponse.json({ error: 'Slot no longer available' }, { status: 409 });
      }
      throw err;
    }
    const bookingId = pending._id || pending.id;

    // Insert Google event on primary.
    let eventResult;
    try {
      const { calendar } = makeCalendarForConnection({
        database, connection: primary,
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: env.GOOGLE_REDIRECT_URI,
      });
      const typeName = rules.name?.es || rules.name?.en || meetingType;
      const title = (rules.eventTitleTemplate || '{guestName} · {type}')
        .replace('{guestName}', guestName)
        .replace('{type}', typeName);
      eventResult = await insertEvent({
        calendar,
        calendarId: primary.writeCalendarId || 'primary',
        summary: title,
        description: buildEventDescription({ guestName, guestEmail, guestNotes, cancelUrl: cancelUrlFor(request, cancelToken) }),
        startUtc: startDt.toISOString(),
        endUtc: endUtc,
        attendees: [{ email: guestEmail, displayName: guestName }],
        guestTimezone: timezoneGuest,
      });
    } catch (err) {
      // Could not create event — roll back pending row (releases the slot).
      await bookings.delete(bookingId).catch(() => {});
      console.error('[booking-calendar] insertEvent failed:', err);
      return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 502 });
    }

    await bookings.update(bookingId, {
      status: 'confirmed',
      googleEventId: eventResult.eventId,
      googleCalendarId: primary.writeCalendarId || 'primary',
      meetLink: eventResult.meetLink || eventResult.hangoutLink || null,
    });

    // Host notification (best-effort).
    if (primary.googleAccountEmail) {
      await notifyHostOfBooking({
        domain,
        hostEmail: primary.googleAccountEmail,
        booking: {
          guestName, guestEmail, guestNotes,
          startUtc: startDt.toISOString(), timezoneGuest,
          meetLink: eventResult.meetLink,
        },
      });
    }

    return NextResponse.json({
      bookingId,
      meetLink: eventResult.meetLink,
      cancelUrl: cancelUrlFor(request, cancelToken),
    });
  } catch (err) {
    if (err.code === 'CALENDAR_UNAVAILABLE') {
      return NextResponse.json({ error: 'calendar_unavailable' }, { status: 503 });
    }
    if (err.code === 'ADDON_ENV_MISSING') {
      return NextResponse.json({ error: 'Addon not configured', missing: err.missing }, { status: 503 });
    }
    console.error('[booking-calendar] bookings/create error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function buildEventDescription({ guestName, guestEmail, guestNotes, cancelUrl }) {
  const lines = [
    `Guest: ${guestName} <${guestEmail}>`,
  ];
  if (guestNotes) lines.push('', 'Notes:', guestNotes);
  lines.push('', `Cancel: ${cancelUrl}`);
  return lines.join('\n');
}

function cancelUrlFor(request, token) {
  return new URL(`/api/addons/booking-calendar/bookings/cancel?token=${token}`, publicOrigin(request)).toString();
}

function isEmail(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function isIsoDate(s) { return typeof s === 'string' && !Number.isNaN(Date.parse(s)); }
