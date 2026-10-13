// POST /api/addons/booking-calendar/bookings/create
// Body: { userId?, meetingType?, startUtc, guestName, guestEmail, subject, whatsapp?, answers?,
//         guestNotes?, timezoneGuest?, returnPath? }
// userId may be omitted on a single-host site. answers = { questionKey: value } for the
// type's questions (select → option index).
//
// Flow:
//   1. Validate inputs; the meeting type must exist and be active.
//   2. Re-verify the slot against live freebusy of EVERY connection (fails closed).
//   3. Insert a row carrying slotLock — the unique index on slotLock rejects a
//      concurrent booking of the same host + start right here, at the DB.
//   4a. Free type: Google event on the primary connection → confirmed → host notified.
//   4b. Paid type: the row holds the slot for HOLD_MS while the guest pays on Stripe;
//       hooks/billing.js confirms it when the payment arrives. Returns { checkoutUrl }.

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { loadBookingEnv } from '../../../lib/env.js';
import { fetchAllBusy } from '../../../lib/googleClient.js';
import { isSlotStillAvailable } from '../../../lib/slotEngine.js';
import { publicOrigin } from '../../../lib/publicOrigin.js';
import { confirmBooking } from '../../../lib/confirmBooking.js';
import { createBookingCheckout } from '../../../lib/payments.js';
import { idOf, updateOrThrow } from '../../../lib/db.js';
import {
  fetchRules, isBookable, fetchActiveBookings, slotLockFor, isDuplicateKeyError,
  releaseStaleHold, HOLD_MS, resolveHostUserId, validateAnswers,
} from '../../../lib/meetingTypes.js';

export async function POST(request) {
  try {
    const { database, domain, siteId } = request.addonContext;
    const body = await request.json().catch(() => ({}));

    const {
      meetingType = 'default', startUtc,
      guestName, guestEmail, guestNotes = '', timezoneGuest = 'UTC', returnPath = '/',
    } = body;
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : '';

    if (!startUtc || !guestName || !guestEmail || !subject) {
      return NextResponse.json({ error: 'startUtc, guestName, guestEmail, subject required' }, { status: 400 });
    }
    if (!isEmail(guestEmail)) {
      return NextResponse.json({ error: 'guestEmail invalid' }, { status: 400 });
    }
    if (!isIsoDate(startUtc)) {
      return NextResponse.json({ error: 'startUtc must be ISO 8601' }, { status: 400 });
    }
    if (guestName.length > 120 || guestNotes.length > 2000 || subject.length > 200) {
      return NextResponse.json({ error: 'Name, subject or notes too long' }, { status: 400 });
    }
    if (whatsapp && !/^\+?[\d\s().-]{6,30}$/.test(whatsapp)) {
      return NextResponse.json({ error: 'whatsapp_invalid' }, { status: 400 });
    }

    const userId = await resolveHostUserId(database, body.userId);
    const rules = userId ? await fetchRules(database, userId, meetingType) : null;
    if (!isBookable(rules)) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const checked = validateAnswers(rules.questions, body.answers);
    if (checked.error) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    const isPaid = (rules.priceCents || 0) > 0;

    const startDt = new Date(startUtc);
    const endDt = new Date(startDt.getTime() + (rules.durationMinutes || 30) * 60 * 1000);

    // Pull host's connections.
    const connResult = await database.use('bc_connections').fetch({ filters: { userId } });
    const connections = Array.isArray(connResult) ? connResult : (connResult?.data || []);
    if (connections.length === 0) {
      return NextResponse.json({ error: 'Host has no connected calendars' }, { status: 409 });
    }

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

    // Insert the booking row. slotLock makes a concurrent booking of the same start
    // fail here. (Overlapping bookings with DIFFERENT starts are caught by the check
    // above, not by the index — the window for that race is the few ms in between.)
    const bookings = database.use('bc_bookings');
    const slotLock = slotLockFor(userId, startDt);
    const row = {
      userId,
      meetingType,
      guestName,
      guestEmail,
      guestNotes,
      subject,
      whatsapp,
      answers: checked.answers,
      startUtc: startDt,
      endUtc: endDt,
      timezoneGuest,
      status: isPaid ? 'pending_payment' : 'pending_verify',
      cancelToken: crypto.randomBytes(16).toString('hex'),
      slotLock,
      ...(isPaid ? {
        holdExpiresAt: new Date(Date.now() + HOLD_MS),
        amountCents: rules.priceCents,
        currency: rules.currency || 'USD',
      } : {}),
    };

    let inserted;
    try {
      inserted = await bookings.add(row);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // Taken — unless by an unpaid checkout past its hold, which we can release.
      if (!(await releaseStaleHold(database, slotLock))) {
        return NextResponse.json({ error: 'Slot no longer available' }, { status: 409 });
      }
      try {
        inserted = await bookings.add(row);
      } catch (retryErr) {
        if (isDuplicateKeyError(retryErr)) {
          return NextResponse.json({ error: 'Slot no longer available' }, { status: 409 });
        }
        throw retryErr;
      }
    }
    const bookingId = idOf(inserted);
    const booking = { ...row, _id: bookingId };
    const origin = publicOrigin(request);

    if (isPaid) {
      const back = `${origin}${safePath(returnPath)}`;
      const sep = back.includes('?') ? '&' : '?';
      let checkout;
      try {
        checkout = await createBookingCheckout({
          domain, siteId, booking, rules,
          returnUrl: `${back}${sep}paid=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${back}${sep}released=${bookingId}&t=${row.cancelToken}`,
        });
      } catch (err) {
        await bookings.delete(bookingId).catch(() => {});
        if (err.code === 'PAYMENT_NOT_CONFIGURED') {
          return NextResponse.json({ error: 'payment_unavailable' }, { status: 503 });
        }
        console.error('[booking-calendar] checkout creation failed:', err);
        return NextResponse.json({ error: 'payment_unavailable' }, { status: 502 });
      }
      await updateOrThrow(bookings, bookingId, { stripeSessionId: checkout.sessionId });
      return NextResponse.json({ bookingId, checkoutUrl: checkout.url });
    }

    let confirmed;
    try {
      confirmed = await confirmBooking({ database, domain, origin, booking, rules, connections, env });
    } catch (err) {
      // Could not create the event — roll back the row (releases the slot).
      await bookings.delete(bookingId).catch(() => {});
      if (err.code === 'EVENT_INSERT_FAILED') {
        return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 502 });
      }
      throw err;
    }

    return NextResponse.json({ bookingId, meetLink: confirmed.meetLink, cancelUrl: confirmed.cancelUrl });
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

/** Only a same-site path: never let the client choose where Stripe sends the guest. */
function safePath(p) {
  return typeof p === 'string' && /^\/(?!\/)[^\s\\]*$/.test(p) ? p.split('?')[0] : '/';
}

function isEmail(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function isIsoDate(s) { return typeof s === 'string' && !Number.isNaN(Date.parse(s)); }
