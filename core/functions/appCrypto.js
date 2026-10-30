/**
 * app.crypto for site functions — the sandbox has no crypto, Buffer or require(),
 * so a function couldn't mint an API key, a reset token or check a webhook signature.
 * Everything takes and returns strings; output is hex unless asked otherwise.
 * Passwords are not hashed here: app.auth handles them.
 */
import { randomBytes, randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';

// md5/sha1 only for interop (Gravatar, old webhook signatures) — never for secrets
const ALGORITHMS = ['sha256', 'sha384', 'sha512', 'sha1', 'md5'];
const ENCODINGS = ['hex', 'base64', 'base64url'];

function pick(value, allowed, fallback, what) {
  if (value === undefined || value === null) return fallback;
  const v = String(value).toLowerCase().replace('-', '');
  if (!allowed.includes(v)) {
    throw new Error(`app.crypto: ${what} must be one of ${allowed.join(', ')}`);
  }
  return v;
}

function text(input, what) {
  if (typeof input === 'string') return input;
  if (typeof input === 'number' || typeof input === 'boolean') return String(input);
  throw new Error(`app.crypto: ${what} must be a string (JSON.stringify objects first)`);
}

export function createAppCrypto() {
  return {
    // randomToken() → 64 hex chars (32 bytes). For API keys, invite codes, reset links.
    randomToken(bytes = 32, encoding) {
      const n = Number(bytes);
      if (!Number.isInteger(n) || n < 1 || n > 1024) {
        throw new Error('app.crypto: randomToken bytes must be an integer from 1 to 1024');
      }
      return randomBytes(n).toString(pick(encoding, ENCODINGS, 'hex', 'encoding'));
    },

    uuid() {
      return randomUUID();
    },

    // hash('text') → sha256 hex. hash('text', 'sha512').
    hash(input, algorithm, encoding) {
      return createHash(pick(algorithm, ALGORITHMS, 'sha256', 'algorithm'))
        .update(text(input, 'text'), 'utf8')
        .digest(pick(encoding, ENCODINGS, 'hex', 'encoding'));
    },

    // hmac(secret, body) → sha256 hex, the usual webhook signature
    hmac(secret, input, algorithm, encoding) {
      return createHmac(pick(algorithm, ALGORITHMS, 'sha256', 'algorithm'), text(secret, 'secret'))
        .update(text(input, 'text'), 'utf8')
        .digest(pick(encoding, ENCODINGS, 'hex', 'encoding'));
    },

    // Constant-time compare for tokens and signatures. Hashing both first gives
    // equal lengths, so the time doesn't leak how long the secret is.
    safeEqual(a, b) {
      if (typeof a !== 'string' || typeof b !== 'string') return false;
      const ha = createHash('sha256').update(a, 'utf8').digest();
      const hb = createHash('sha256').update(b, 'utf8').digest();
      return timingSafeEqual(ha, hb) && a.length === b.length;
    }
  };
}
