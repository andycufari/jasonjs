// Signed OAuth state token — anti-CSRF for the Google authorization flow.
// HMAC(secret, userId|nonce|exp) → short-lived, single-use via app.cache.

import crypto from 'crypto';

const STATE_TTL_SECONDS = 600; // 10 minutes

export function issueState(userId, label, secret) {
  const nonce = crypto.randomBytes(12).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS;
  const payload = `${userId}|${label || ''}|${nonce}|${exp}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  // base64url-encoded so it fits in a URL without escaping.
  const token = Buffer.from(`${payload}|${sig}`, 'utf8').toString('base64url');
  return { state: token, userId, label, exp, nonce };
}

export function verifyState(token, secret) {
  if (!token || typeof token !== 'string') return null;
  let decoded;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const parts = decoded.split('|');
  if (parts.length !== 5) return null;
  const [userId, label, nonce, expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  const payload = `${userId}|${label}|${nonce}|${exp}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!timingSafeEqual(sig, expected)) return null;
  return { userId, label, nonce, exp };
}

export function cacheKeyFor(nonce) {
  return `bc:oauth:${nonce}`;
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export { STATE_TTL_SECONDS };
