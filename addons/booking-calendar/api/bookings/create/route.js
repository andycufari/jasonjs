// POST /api/addons/booking-calendar/bookings/create
// Body: { userId, meetingType?, startUtc, guestName, guestEmail, guestNotes?, timezoneGuest? }
//
// Flow:
//   1. Validate inputs.
//   2. Re-verify slot via slotEngine (fresh freebusy) — prevents stale-client bookings.
//   3. Insert pending_verify row (partial unique index will catch concurrent duplicates).
//   4. Insert Google event on primary connection.
//   5. Update row to confirmed (fills in googleEventId, meetLink).
//   6. Notify host by email (best-effort).
//
// If step 4 succeeds but step 5's unique-index check fires (concurrent booking),
// we delete the Google event to compensate.

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { loadBookingEnv } from '../../../lib/env.js';
import {
  makeCalendarForConnection,
  fetchConnectionBusy,
  insertEvent,
  deleteEvent,
} from '../../../lib/googleClient.js';
import { isSlotStillAvailable } from '../../../lib/slotEngine.js';
import { notifyHostOfBooking } from '../../../lib/notify.js';

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

    const rulesResult = await database.use('bc_availability_rules').fetch({
      filters: { userId, meetingType },
      limit: 1,
    });
    const rules = Array.isArray(rulesResult) ? rulesResult[0] : (rulesResult?.data?.[0] || null);
    if (!rules) {
      return NextResponse.json({ error: 'No availability configured for host' }, { status: 404 });
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

    // Re-verify slot freshness: pull live freebusy across every connection and ask the engine.
    const busyArrays = await Promise.all(
      connections.map(async (conn) => {
        try {
          const { calendar } = makeCalendarForConnection({
            database, connection: conn,
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            redirectUri: env.GOOGLE_REDIRECT_URI,
          });
          return await fetchConnectionBusy({
            calendar, connection: conn,
            fromUtc: new Date(startDt.getTime() - 60 * 60 * 1000).toISOString(),
            toUtc: new Date(endDt.getTime() + 60 * 60 * 1000).toISOString(),
          });
        } catch {
          return [];
        }
      })
    );
    const busy = busyArrays.flat();

    // Defense-in-depth: local confirmed bookings around this time.
    const bookingsResult = await database.use('bc_bookings').fetch({
      filters: { userId, status: 'confirmed' },
      limit: 50,
    });
    const existingBookings = (Array.isArray(bookingsResult) ? bookingsResult : (bookingsResult?.data || []))
      .filter(b => b.startUtc && b.endUtc)
      .map(b => ({ startUtc: new Date(b.startUtc).toISOString(), endUtc: new Date(b.endUtc).toISOString() }));

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

    // Insert pending booking row.
    const bookings = database.use('bc_bookings');
    const cancelToken = crypto.randomBytes(16).toString('hex');
    const pending = await bookings.add({
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
    });
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
      const title = (rules.eventTitleTemplate || '{guestName} ↔ Host')
        .replace('{guestName}', guestName);
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
      // Could not create event — roll back pending row.
      await bookings.delete(bookingId).catch(() => {});
      console.error('[booking-calendar] insertEvent failed:', err);
      return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 502 });
    }

    // Flip to confirmed. A partial unique index on (userId, startUtc) where status=confirmed
    // means if another booking raced us, this update will reject.
    try {
      await bookings.update(bookingId, {
        status: 'confirmed',
        googleEventId: eventResult.eventId,
        googleCalendarId: primary.writeCalendarId || 'primary',
        meetLink: eventResult.meetLink || eventResult.hangoutLink || null,
      });
    } catch (err) {
      // Compensate: someone else got the slot first.
      try {
        const { calendar } = makeCalendarForConnection({
          database, connection: primary,
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri: env.GOOGLE_REDIRECT_URI,
        });
        await deleteEvent({ calendar, calendarId: primary.writeCalendarId || 'primary', eventId: eventResult.eventId });
      } catch {}
      await bookings.delete(bookingId).catch(() => {});
      console.warn('[booking-calendar] race compensation: slot taken concurrently');
      return NextResponse.json({ error: 'Slot no longer available' }, { status: 409 });
    }

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
  return new URL(`/api/addons/booking-calendar/bookings/cancel?token=${token}`, request.url).toString();
}

function isEmail(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function isIsoDate(s) { return typeof s === 'string' && !Number.isNaN(Date.parse(s)); }
