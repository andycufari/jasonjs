// core/auth/codeAttempts.js
// Attempt cap for the 6-digit codes (login, registration, email change).
//
// The per-IP limiter in rateLimit.js is not enough: /api/auth/callback/* never goes through it, and the
// IP comes from X-Forwarded-For, which the client can forge. This counter is keyed by email+type and lives
// in Mongo, so it holds across processes and does not depend on who the client claims to be.
//
// Every attempt is counted BEFORE the code is looked at, so even a thousand parallel requests get at most
// MAX_ATTEMPTS comparisons. Going over the cap invalidates the email's live codes: a new one must be
// requested, and the counter keeps running until the window expires.

const COLLECTION = 'auth_code_attempts';
export const MAX_ATTEMPTS = 6;
export const WINDOW_MS = 15 * 60 * 1000;

let indexReady = null;

function ensureIndex(db) {
  if (!indexReady) {
    indexReady = db.collection(COLLECTION)
      .createIndex({ windowStart: 1 }, { expireAfterSeconds: Math.ceil(WINDOW_MS / 1000) * 2 })
      .catch((err) => {
        indexReady = null;
        console.warn('[auth] code attempts: could not create TTL index:', err.message);
      });
  }
  return indexReady;
}

/**
 * Looks up a valid code, counting the attempt.
 *
 * @param {import('mongodb').Db} db
 * @param {{ email: string, code: string, type: string }} input
 * @returns {Promise<{ status: 'ok', record: object } | { status: 'invalid' } | { status: 'locked', retryAfter: number }>}
 *   `ok` does not mark the code as used: that is up to the caller.
 */
export async function checkVerificationCode(db, { email, code, type }) {
  const normalizedEmail = String(email).toLowerCase();
  const key = `${normalizedEmail}|${type}`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  await ensureIndex(db);

  // New doc or expired window → start at 1; otherwise add 1. Atomic.
  const expired = { $or: [{ $not: ['$windowStart'] }, { $lt: ['$windowStart', windowStart] }] };
  const counter = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: key },
    [{
      $set: {
        attempts: { $cond: [expired, 1, { $add: ['$attempts', 1] }] },
        windowStart: { $cond: [expired, now, '$windowStart'] },
      },
    }],
    { upsert: true, returnDocument: 'after' }
  );
  const doc = counter?.value !== undefined ? counter.value : counter; // driver 5 and 6

  if (!doc || doc.attempts > MAX_ATTEMPTS) {
    const retryAfter = doc?.windowStart
      ? Math.max(1, Math.ceil((doc.windowStart.getTime() + WINDOW_MS - now.getTime()) / 1000))
      : Math.ceil(WINDOW_MS / 1000);
    if (doc?.attempts === MAX_ATTEMPTS + 1) {
      // First time over the cap: the live codes stop working.
      await db.collection('verification_codes').updateMany(
        { email: normalizedEmail, type, used: false },
        { $set: { used: true, invalidatedAt: now, invalidatedReason: 'too-many-attempts' } }
      );
      console.warn(`[auth] code attempts: cap reached for ${type}, live codes invalidated`);
    }
    return { status: 'locked', retryAfter };
  }

  const record = await db.collection('verification_codes').findOne({
    email: normalizedEmail,
    code: String(code),
    type,
    used: false,
    expiresAt: { $gt: now },
  });

  if (!record) return { status: 'invalid' };
  return { status: 'ok', record };
}

/** After a successful login or verification the counter goes back to zero. */
export async function clearVerificationAttempts(db, { email, type }) {
  await db.collection(COLLECTION).deleteOne({ _id: `${String(email).toLowerCase()}|${type}` });
}
