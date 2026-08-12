/**
 * Field-level encryption primitive for JasonJS.
 *
 * Powers `encrypted: true` on schema fields. Addons never call this directly —
 * the DB adapters encrypt on write and decrypt on read transparently.
 *
 * Key resolution order:
 *   1. process.env.JASONJS_ENCRYPTION_KEY (64 hex chars, required in prod)
 *   2. Dev-only: .jasonjs-encryption-key at cwd (auto-generated on first run)
 *
 * Losing the key loses all encrypted data. Rotation requires re-encrypting
 * every affected row (see scripts/rotate-encryption-key.js).
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const KEY_FILENAME = '.jasonjs-encryption-key';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const ENVELOPE_VERSION = 1;

let cachedKey = null;

export function getEncryptionKey() {
  if (cachedKey) return cachedKey;

  const envKey = process.env.JASONJS_ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length !== KEY_BYTES * 2 || !/^[0-9a-f]+$/i.test(envKey)) {
      throw new Error(`JASONJS_ENCRYPTION_KEY must be ${KEY_BYTES * 2} hex chars`);
    }
    cachedKey = Buffer.from(envKey, 'hex');
    return cachedKey;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JASONJS_ENCRYPTION_KEY is required in production. Set a 64-hex-char value in your environment.');
  }

  const keyFile = path.join(process.cwd(), KEY_FILENAME);
  if (fs.existsSync(keyFile)) {
    const hex = fs.readFileSync(keyFile, 'utf8').trim();
    cachedKey = Buffer.from(hex, 'hex');
    return cachedKey;
  }

  const generated = crypto.randomBytes(KEY_BYTES);
  fs.writeFileSync(keyFile, generated.toString('hex'), { mode: 0o600 });
  appendToGitignore(keyFile);
  console.warn('');
  console.warn('⚠️  JasonJS: auto-generated encryption key at ' + KEY_FILENAME);
  console.warn('⚠️  Back this up. Losing it loses all encrypted data.');
  console.warn('⚠️  For production, set JASONJS_ENCRYPTION_KEY=<64-hex> in your env.');
  console.warn('');
  cachedKey = generated;
  return cachedKey;
}

function appendToGitignore(keyFile) {
  try {
    const gitignore = path.join(process.cwd(), '.gitignore');
    const entry = path.basename(keyFile);
    if (!fs.existsSync(gitignore)) return;
    const current = fs.readFileSync(gitignore, 'utf8');
    if (current.split('\n').some(l => l.trim() === entry)) return;
    const suffix = current.endsWith('\n') ? '' : '\n';
    fs.appendFileSync(gitignore, suffix + '\n# JasonJS encryption key (dev auto-generated) — never commit\n' + entry + '\n');
  } catch {
    // Non-fatal — user should add manually if we can't.
  }
}

export function encryptField(plaintext) {
  if (plaintext == null) return plaintext;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const serialized = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const ct = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    __enc: ENVELOPE_VERSION,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64'),
    t: typeof plaintext === 'string' ? 's' : 'j',
  };
}

export function decryptField(value) {
  if (!isEncryptedEnvelope(value)) return value;
  const iv = Buffer.from(value.iv, 'base64');
  const tag = Buffer.from(value.tag, 'base64');
  const ct = Buffer.from(value.ct, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  let plaintext;
  try {
    plaintext = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch (err) {
    throw new Error('JasonJS: failed to decrypt encrypted field. The encryption key may have changed. Rotate using scripts/rotate-encryption-key.js or restore the original key.');
  }
  return value.t === 'j' ? JSON.parse(plaintext) : plaintext;
}

export function isEncryptedEnvelope(value) {
  return value != null
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.__enc === ENVELOPE_VERSION
    && typeof value.iv === 'string'
    && typeof value.tag === 'string'
    && typeof value.ct === 'string';
}

export function encryptFieldsForWrite(doc, schema) {
  if (!doc || !schema) return doc;
  const out = { ...doc };
  for (const [field, config] of Object.entries(schema)) {
    if (config && config.encrypted && out[field] != null && !isEncryptedEnvelope(out[field])) {
      out[field] = encryptField(out[field]);
    }
  }
  return out;
}

export function decryptFieldsForRead(doc, schema) {
  if (!doc || !schema) return doc;
  const out = { ...doc };
  for (const [field, config] of Object.entries(schema)) {
    if (config && config.encrypted && isEncryptedEnvelope(out[field])) {
      out[field] = decryptField(out[field]);
    }
  }
  return out;
}

export function schemaHasEncryptedField(schema, field) {
  return !!(schema && schema[field] && schema[field].encrypted);
}

export function assertNoEncryptedFieldInFilter(filter, schema) {
  if (!filter || !schema) return;
  if (typeof filter !== 'object') return;
  for (const key of Object.keys(filter)) {
    if (key === '$and' || key === '$or' || key === '$nor') {
      const arr = Array.isArray(filter[key]) ? filter[key] : [];
      for (const sub of arr) assertNoEncryptedFieldInFilter(sub, schema);
      continue;
    }
    if (schemaHasEncryptedField(schema, key)) {
      throw new Error(`Cannot filter on encrypted field "${key}". Encrypted fields support write/read only.`);
    }
  }
}

// Test-only helper to reset cached key between tests.
export function _resetEncryptionKeyCache() {
  cachedKey = null;
}
