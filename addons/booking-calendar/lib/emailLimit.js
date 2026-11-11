// One guest, one meeting: how often the same email may book the same meeting type.
//
// andy.cm64.io/meet, 2026-11: one person booked the free intro twice in three days with the
// same email and missed both. Nothing checked the guest — only the time slot.
//
// Per meeting type (bc_availability_rules.emailLimit):
//   undefined  → default: free types { days: 7 }, paid types no limit
//   { days }   → the same email can't hold two bookings of this type less than `days` apart
//                (counted both ways from the requested start), nor two upcoming ones at once
//   false      → no limit
// Only bookings that hold their slot count (confirmed, or a paid hold in progress): a
// cancelled booking frees the guest to book again. A past confirmed one counts — showing up
// or not isn't recorded, so a no-show still blocks the window.

import { holdsSlot } from './meetingTypes.js';

export const DEFAULT_FREE_DAYS = 7;
const MAX_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Same inbox, same key: lowercase and trimmed; "+alias" dropped on every domain; dots
 * ignored on Gmail (googlemail.com is Gmail too).
 */
export function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  const clean = email.trim().toLowerCase();
  const at = clean.lastIndexOf('@');
  if (at <= 0) return clean;
  let local = clean.slice(0, at);
  let domain = clean.slice(at + 1);
  local = local.split('+')[0];
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}

const isPaid = (rules) => (rules?.priceCents || 0) > 0 || (rules?.priceArsCents || 0) > 0;

/** The limit in force for a meeting type: { days } or null (no limit). */
export function emailLimitFor(rules) {
  const v = rules?.emailLimit;
  if (v === false || v === null) return null;
  if (v && typeof v === 'object') {
    const days = Math.floor(Number(v.days));
    return Number.isFinite(days) && days > 0 ? { days: Math.min(days, MAX_DAYS) } : null;
  }
  return isPaid(rules) ? null : { days: DEFAULT_FREE_DAYS };
}

/** What availability/save stores: false, { days }, or undefined (= use the default). */
export function normalizeEmailLimit(value) {
  if (value === undefined) return undefined;
  if (value === false || value === null) return false;
  if (typeof value === 'object') {
    const days = Math.floor(Number(value.days));
    return Number.isFinite(days) && days > 0 ? { days: Math.min(days, MAX_DAYS) } : false;
  }
  return undefined;
}

/**
 * Pure check over this type's bookings.
 * @returns {null | { reason: 'upcoming'|'recent', existingStartUtc: string, nextAllowedUtc: string|null }}
 */
export function findEmailConflict({ limit, bookings, email, startUtc, now = new Date() }) {
  if (!limit) return null;
  const key = normalizeEmail(email);
  if (!key) return null;
  const start = new Date(startUtc).getTime();
  const windowMs = limit.days * DAY_MS;

  const mine = (bookings || [])
    .filter(b => holdsSlot(b, now))
    .filter(b => normalizeEmail(b.guestEmailKey || b.guestEmail) === key)
    .map(b => new Date(b.startUtc).getTime())
    .filter(t => Number.isFinite(t))
    .sort((a, b) => a - b);

  // Already has one coming up: one at a time, however far apart.
  const upcoming = mine.find(t => t > now.getTime());
  if (upcoming !== undefined) {
    return { reason: 'upcoming', existingStartUtc: new Date(upcoming).toISOString(), nextAllowedUtc: null };
  }
  // Had one recently: wait until the window has passed.
  const recent = mine.filter(t => Math.abs(t - start) < windowMs).pop();
  if (recent !== undefined) {
    return {
      reason: 'recent',
      existingStartUtc: new Date(recent).toISOString(),
      nextAllowedUtc: new Date(recent + windowMs).toISOString(),
    };
  }
  return null;
}

/** Reads this host + type's bookings and applies the limit. Same result as findEmailConflict. */
export async function checkEmailLimit(database, { userId, meetingType, rules, email, startUtc }) {
  const limit = emailLimitFor(rules);
  if (!limit) return null;
  const result = await database.use('bc_bookings').fetch({
    filters: { userId, meetingType },
    sort: { startUtc: 'desc' },
    limit: 1000,
  });
  const bookings = Array.isArray(result) ? result : (result?.data || []);
  return findEmailConflict({ limit, bookings, email, startUtc });
}
