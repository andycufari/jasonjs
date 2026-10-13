// Meeting types: one bc_availability_rules row per (userId, meetingType).
// `meetingType` is the URL code (/meet/<code>); name/description are what people see.
// Price and duration always come from this row, never from the client.

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

const MAX_NAME = 80;
const MAX_DESCRIPTION = 600;

/** Accepts "text" or { es, en } and returns { es, en } with trimmed, capped strings. */
export function normalizeI18n(value, max) {
  const pick = (v) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  if (typeof value === 'string') return { es: pick(value), en: '' };
  if (!value || typeof value !== 'object') return { es: '', en: '' };
  return { es: pick(value.es), en: pick(value.en) };
}

export function normalizeName(value) { return normalizeI18n(value, MAX_NAME); }
export function normalizeDescription(value) { return normalizeI18n(value, MAX_DESCRIPTION); }

/** A type nobody may book: missing, or switched off in Settings. */
export function isBookable(rules) {
  return !!rules && rules.active !== false;
}

/** What the public widgets may see. Duration is hidden when the host chose so. */
export function publicType(rules) {
  return {
    meetingType: rules.meetingType,
    name: rules.name || { es: rules.meetingType, en: '' },
    description: rules.description || { es: '', en: '' },
    priceCents: rules.priceCents || 0,
    currency: rules.currency || 'USD',
    durationMinutes: rules.showDuration === false ? null : rules.durationMinutes,
    order: rules.order || 0,
  };
}

export async function fetchRules(database, userId, meetingType) {
  const result = await database.use('bc_availability_rules').fetch({
    filters: { userId, meetingType },
    limit: 1,
  });
  return Array.isArray(result) ? result[0] : (result?.data?.[0] || null);
}

/**
 * Bookings that hold their time slot. Newest start first, so a long history never
 * pushes upcoming bookings out of the limit.
 */
export async function fetchActiveBookings(database, userId, limit = 500) {
  const result = await database.use('bc_bookings').fetch({
    filters: { userId, status: 'confirmed' },
    sort: { startUtc: 'desc' },
    limit,
  });
  const rows = Array.isArray(result) ? result : (result?.data || []);
  return rows
    .filter(b => b.startUtc && b.endUtc)
    .map(b => ({ startUtc: new Date(b.startUtc).toISOString(), endUtc: new Date(b.endUtc).toISOString() }));
}

/**
 * Value of bc_bookings.slotLock while a booking holds its slot. A unique index on it
 * (partial: only string values) makes the second insert for the same host + start
 * fail at the database. Cleared (null) when the booking stops holding the slot.
 */
export function slotLockFor(userId, startUtc) {
  return `${userId}|${new Date(startUtc).toISOString()}`;
}

export function isDuplicateKeyError(err) {
  return err?.code === 11000 || /E11000|duplicate key/i.test(err?.message || '');
}
