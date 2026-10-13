// Billing hooks — called by the framework's payment webhooks for payments whose
// metadata.addon is 'booking-calendar' (see core/services/billing/hooks.js).
//
// Stripe may deliver the same event more than once and retries when a hook throws,
// so every hook is idempotent: it looks at the booking's current state first.

import { loadBookingEnv } from '../lib/env.js';
import { fetchAllBusy } from '../lib/googleClient.js';
import { isSlotStillAvailable } from '../lib/slotEngine.js';
import { confirmBooking } from '../lib/confirmBooking.js';
import { originFromDomain } from '../lib/publicOrigin.js';
import { idOf, updateOrThrow } from '../lib/db.js';
import {
  fetchRules, fetchActiveBookings, slotLockFor, isDuplicateKeyError, HOLD_MS,
} from '../lib/meetingTypes.js';

async function fetchBooking(database, bookingId) {
  if (!bookingId) return null;
  const result = await database.use('bc_bookings').fetch({ filters: { _id: String(bookingId) }, limit: 1 });
  return Array.isArray(result) ? result[0] : (result?.data?.[0] || null);
}

/**
 * The guest paid. Confirm the booking — unless the slot stopped being bookable while
 * they were paying, in which case the payment is refunded.
 */
export async function onPaymentSucceeded({ payment, provider, context }) {
  const { database, domain } = context;
  const bookings = database.use('bc_bookings');
  const booking = await fetchBooking(database, payment.metadata?.bookingId);

  if (!booking) {
    // Nothing a retry can fix. Loud, so the host can look at the payment in Stripe.
    console.error(`[booking-calendar] payment ${payment.id} for unknown booking ${payment.metadata?.bookingId}`);
    return;
  }
  if (booking.status === 'confirmed' || booking.status === 'refunded') return; // duplicate delivery

  const id = idOf(booking);
  const sameAmount = booking.amountCents === payment.amount
    && String(booking.currency || '').toLowerCase() === String(payment.currency || '').toLowerCase();
  if (!sameAmount) {
    console.error(`[booking-calendar] booking ${id}: paid ${payment.currency} ${payment.amount}, expected ${booking.currency} ${booking.amountCents} — NOT confirmed`);
    return;
  }

  // Record the payment before anything else: a paid hold is never released (holdsSlot),
  // so if confirming fails below and Stripe retries, the slot is still ours.
  if (!booking.paymentId) {
    await updateOrThrow(bookings, id, { paymentId: payment.id, paidAt: new Date() });
  }

  // The hold may have been released before the money arrived (guest abandoned and came
  // back, slow bank method). Take the slot again if nobody else did.
  if (booking.status !== 'pending_payment') {
    try {
      await updateOrThrow(bookings, id, {
        status: 'pending_payment',
        slotLock: slotLockFor(booking.userId, booking.startUtc),
      });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      return refund({ provider, bookings, id, payment, reason: 'slot taken by another booking' });
    }
  }

  const rules = await fetchRules(database, booking.userId, booking.meetingType);
  const connResult = await database.use('bc_connections').fetch({ filters: { userId: booking.userId } });
  const connections = Array.isArray(connResult) ? connResult : (connResult?.data || []);
  if (!rules || connections.length === 0) {
    throw new Error(`booking ${id}: meeting type or calendar connections missing — retry later`);
  }

  // The host's calendar may have filled up while the guest was paying.
  const env = await loadBookingEnv(domain);
  const start = new Date(booking.startUtc);
  const end = new Date(booking.endUtc);
  const busy = await fetchAllBusy({ // CALENDAR_UNAVAILABLE throws → Stripe retries
    database, connections, env,
    fromUtc: new Date(start.getTime() - 60 * 60 * 1000).toISOString(),
    toUtc: new Date(end.getTime() + 60 * 60 * 1000).toISOString(),
  });
  const existingBookings = await fetchActiveBookings(database, booking.userId, { excludeId: id });
  // Judge notice/advance as of when the slot was picked, not now — paying takes time.
  const pickedAt = booking.holdExpiresAt
    ? new Date(new Date(booking.holdExpiresAt).getTime() - HOLD_MS)
    : start;
  const stillFree = isSlotStillAvailable({
    rules, targetStartUtc: start.toISOString(), busy, existingBookings, nowUtc: pickedAt.toISOString(),
  });
  if (!stillFree) {
    return refund({ provider, bookings, id, payment, reason: 'host calendar no longer free' });
  }

  // Throws if Google refuses → Stripe retries; the paid hold keeps the slot meanwhile.
  await confirmBooking({
    database, domain, origin: originFromDomain(domain), booking, rules, connections, env,
  });
}

/** A delayed payment method failed: release the slot. */
export async function onPaymentFailed({ payment, context }) {
  const { database } = context;
  const booking = await fetchBooking(database, payment.metadata?.bookingId);
  if (!booking || booking.status !== 'pending_payment' || booking.paymentId) return;
  await updateOrThrow(database.use('bc_bookings'), idOf(booking), { status: 'payment_failed', slotLock: null });
}

/** Nobody paid before the checkout expired: release the slot. */
export async function onCheckoutExpired({ checkout, context }) {
  const { database } = context;
  const booking = await fetchBooking(database, checkout.metadata?.bookingId);
  if (!booking || booking.status !== 'pending_payment' || booking.paymentId) return;
  await updateOrThrow(database.use('bc_bookings'), idOf(booking), { status: 'expired', slotLock: null });
}

async function refund({ provider, bookings, id, payment, reason }) {
  console.warn(`[booking-calendar] booking ${id}: ${reason} — refunding ${payment.id}`);
  try {
    await provider.refundPayment(payment.id, { metadata: { bookingId: id, reason } });
  } catch (err) {
    // A retry after the refund went through but the row update didn't.
    if (err?.code !== 'charge_already_refunded') throw err;
  }
  await updateOrThrow(bookings, id, { status: 'refunded', slotLock: null });
}
