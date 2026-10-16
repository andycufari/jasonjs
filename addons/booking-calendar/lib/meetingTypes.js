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

// ---- Questions: what each meeting type asks besides the base fields ---------------
// Base fields, the same for every type: name, email, subject (required), WhatsApp (optional).
// Each type adds its own: { key, label: {es,en}, type, options: [{es,en}], required }.

export const QUESTION_TYPES = ['text', 'textarea', 'select', 'url'];
const QUESTION_KEY_RE = /^[a-z0-9_-]{1,40}$/;
const MAX_QUESTIONS = 10;
const MAX_OPTIONS = 12;
const ANSWER_MAX = { text: 200, textarea: 2000, url: 500, select: 200 };

export function normalizeQuestions(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const q of value.slice(0, MAX_QUESTIONS)) {
    if (!q || typeof q !== 'object') continue;
    const key = typeof q.key === 'string' ? q.key.trim().toLowerCase() : '';
    if (!QUESTION_KEY_RE.test(key) || seen.has(key)) continue;
    const label = normalizeI18n(q.label, 200);
    if (!label.es && !label.en) continue;
    const type = QUESTION_TYPES.includes(q.type) ? q.type : 'text';
    const options = type === 'select'
      ? (Array.isArray(q.options) ? q.options : [])
          .map(o => normalizeI18n(o, 100))
          .filter(o => o.es || o.en)
          .slice(0, MAX_OPTIONS)
      : [];
    if (type === 'select' && options.length === 0) continue;
    seen.add(key);
    out.push({ key, label, type, options, required: q.required === true });
  }
  return out;
}

/**
 * Check the guest's answers against the type's questions.
 * Select answers arrive as the option's index; they're stored as its label (Spanish first),
 * and every answer keeps a snapshot of its question, so later edits to the type don't
 * rewrite what people answered.
 * @returns {{ answers: Array<{key,label,value}> } | { error: string }}
 */
export function validateAnswers(questions, raw) {
  const given = raw && typeof raw === 'object' ? raw : {};
  const answers = [];
  for (const q of questions || []) {
    const label = q.label?.es || q.label?.en || q.key;
    let value = given[q.key];
    if (q.type === 'select') {
      const idx = typeof value === 'number' ? value : (value === '' || value == null ? NaN : Number(value));
      const option = Number.isInteger(idx) ? q.options[idx] : undefined;
      value = option ? (option.es || option.en) : '';
    } else {
      value = typeof value === 'string' ? value.trim().slice(0, ANSWER_MAX[q.type] || 200) : '';
      if (value && q.type === 'url' && !/^https?:\/\/\S+$/i.test(value)) {
        return { error: `invalid_url:${q.key}` };
      }
    }
    if (!value) {
      if (q.required) return { error: `required:${q.key}` };
      continue;
    }
    answers.push({ key: q.key, label, value });
  }
  return { answers };
}

// ---- Host: whose calendar a public page books ------------------------------------

/**
 * The public widgets may omit userId: on a site with a single host (the usual case)
 * it's the one owner of the meeting types. With several hosts the page must say which.
 * @returns {Promise<string|null>}
 */
export async function resolveHostUserId(database, userId) {
  if (typeof userId === 'string' && userId.trim()) return userId.trim();
  const result = await database.use('bc_availability_rules').fetch({ filters: {}, limit: 200 });
  const rows = Array.isArray(result) ? result : (result?.data || []);
  const hosts = [...new Set(rows.map(r => r.userId).filter(Boolean))];
  return hosts.length === 1 ? hosts[0] : null;
}

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
    priceArsCents: rules.priceArsCents || 0, // MercadoPago, in pesos (0 = not offered)
    durationMinutes: rules.showDuration === false ? null : rules.durationMinutes,
    order: rules.order || 0,
    questions: Array.isArray(rules.questions) ? rules.questions : [],
    maxAdvanceDays: rules.maxAdvanceDays || 365, // same default as slotEngine
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
 * Paid types hold the slot while the guest pays. Stripe's minimum session life is
 * 30 minutes and the session expires with the hold, so nobody can pay for a slot that
 * was already released.
 */
export const HOLD_MS = 31 * 60 * 1000;

/** Does this booking keep its time slot taken? */
export function holdsSlot(b, now = new Date()) {
  if (b.status === 'confirmed') return true;
  if (b.status === 'pending_payment') {
    // Paid but not confirmed yet (e.g. Google failed, Stripe will retry): still taken.
    return !!b.paymentId || new Date(b.holdExpiresAt) > now;
  }
  return false;
}

/**
 * Bookings that hold their time slot. Newest start first, so a long history never
 * pushes upcoming bookings out of the limit.
 */
export async function fetchActiveBookings(database, userId, { limit = 500, excludeId = null } = {}) {
  const result = await database.use('bc_bookings').fetch({
    filters: { userId },
    sort: { startUtc: 'desc' },
    limit,
  });
  const now = new Date();
  const rows = Array.isArray(result) ? result : (result?.data || []);
  return rows
    .filter(b => b.startUtc && b.endUtc && holdsSlot(b, now))
    .filter(b => !excludeId || String(b._id || b.id) !== String(excludeId))
    .map(b => ({ startUtc: new Date(b.startUtc).toISOString(), endUtc: new Date(b.endUtc).toISOString() }));
}

/**
 * An unpaid hold past its expiry still owns slotLock until checkout.session.expired
 * arrives. If a new booking runs into it first, release it here.
 * @returns {Promise<boolean>} true if a stale hold was released
 */
export async function releaseStaleHold(database, slotLock) {
  const bookings = database.use('bc_bookings');
  const result = await bookings.fetch({ filters: { slotLock }, limit: 1 });
  const row = Array.isArray(result) ? result[0] : (result?.data?.[0] || null);
  // Only unpaid checkouts past their hold. A pending_verify row is a free booking
  // in flight (creating its Google event right now) — never steal its slot.
  if (!row || row.status !== 'pending_payment' || holdsSlot(row)) return false;
  await bookings.update(String(row._id || row.id), { status: 'expired', slotLock: null });
  return true;
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
