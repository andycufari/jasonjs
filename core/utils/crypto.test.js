/**
 * Tests for schema-native field encryption.
 *
 * Run with: node core/utils/crypto.test.js
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  encryptField,
  decryptField,
  isEncryptedEnvelope,
  encryptFieldsForWrite,
  decryptFieldsForRead,
  assertNoEncryptedFieldInFilter,
  getEncryptionKey,
  _resetEncryptionKeyCache,
} from './crypto.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('✅ PASS: ' + msg); passed++; }
  else { console.error('❌ FAIL: ' + msg); failed++; }
}

function assertEqual(actual, expected, msg) {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertThrows(fn, matcher, msg) {
  let threw = false;
  let err = null;
  try { fn(); } catch (e) { threw = true; err = e; }
  if (!threw) { console.error('❌ FAIL: ' + msg + ' — did not throw'); failed++; return; }
  if (matcher && !matcher.test(err.message)) {
    console.error('❌ FAIL: ' + msg + ' — threw but message did not match: ' + err.message);
    failed++;
    return;
  }
  console.log('✅ PASS: ' + msg);
  passed++;
}

// Set a known key so tests are deterministic and don't auto-generate a file.
const TEST_KEY = crypto.randomBytes(32).toString('hex');
process.env.JASONJS_ENCRYPTION_KEY = TEST_KEY;
_resetEncryptionKeyCache();

console.log('\n=== encryption round-trip ===');
{
  const ct = encryptField('hello world');
  assert(isEncryptedEnvelope(ct), 'envelope is recognized');
  assert(ct.ct && ct.iv && ct.tag, 'envelope has ct/iv/tag');
  const pt = decryptField(ct);
  assertEqual(pt, 'hello world', 'string round-trip');
}

console.log('\n=== null and undefined handling ===');
{
  assertEqual(encryptField(null), null, 'null passes through encrypt');
  assertEqual(encryptField(undefined), undefined, 'undefined passes through encrypt');
  assertEqual(decryptField(null), null, 'null passes through decrypt');
  assertEqual(decryptField('plain-string'), 'plain-string', 'plain string passes through decrypt');
}

console.log('\n=== object (JSON) round-trip ===');
{
  const obj = { access_token: 'ya29.abc', scope: 'calendar' };
  const ct = encryptField(obj);
  assertEqual(ct.t, 'j', 'envelope marks JSON type');
  assertEqual(decryptField(ct), obj, 'object round-trip');
}

console.log('\n=== envelope is not a plain object match ===');
{
  assert(!isEncryptedEnvelope({ foo: 'bar' }), 'random object is not envelope');
  assert(!isEncryptedEnvelope('string'), 'string is not envelope');
  assert(!isEncryptedEnvelope(null), 'null is not envelope');
  assert(!isEncryptedEnvelope([1, 2, 3]), 'array is not envelope');
}

console.log('\n=== encryptFieldsForWrite ===');
{
  const schema = {
    userId: { type: 'string' },
    refreshToken: { type: 'string', encrypted: true },
    accessToken: { type: 'string', encrypted: true },
    label: { type: 'string' },
  };
  const doc = {
    userId: 'u1',
    refreshToken: 'secret-refresh',
    accessToken: 'secret-access',
    label: 'Andy personal',
  };
  const out = encryptFieldsForWrite(doc, schema);
  assertEqual(out.userId, 'u1', 'non-encrypted field untouched');
  assertEqual(out.label, 'Andy personal', 'non-encrypted field untouched');
  assert(isEncryptedEnvelope(out.refreshToken), 'refreshToken encrypted');
  assert(isEncryptedEnvelope(out.accessToken), 'accessToken encrypted');
  // Original doc not mutated
  assertEqual(doc.refreshToken, 'secret-refresh', 'input doc not mutated');
}

console.log('\n=== encryptFieldsForWrite is idempotent for already-encrypted fields ===');
{
  const schema = { token: { type: 'string', encrypted: true } };
  const once = encryptFieldsForWrite({ token: 'abc' }, schema);
  const twice = encryptFieldsForWrite(once, schema);
  assertEqual(twice.token, once.token, 'already-encrypted envelope not re-encrypted');
}

console.log('\n=== decryptFieldsForRead ===');
{
  const schema = {
    userId: { type: 'string' },
    refreshToken: { type: 'string', encrypted: true },
    label: { type: 'string' },
  };
  const encrypted = encryptFieldsForWrite({
    userId: 'u1',
    refreshToken: 'my-secret',
    label: 'Andy',
  }, schema);
  const decrypted = decryptFieldsForRead(encrypted, schema);
  assertEqual(decrypted.userId, 'u1', 'passthrough field unchanged on read');
  assertEqual(decrypted.refreshToken, 'my-secret', 'encrypted field decrypted');
  assertEqual(decrypted.label, 'Andy', 'other passthrough field unchanged');
}

console.log('\n=== decryptFieldsForRead tolerates missing/plain values ===');
{
  const schema = { token: { type: 'string', encrypted: true } };
  assertEqual(decryptFieldsForRead({ token: null }, schema).token, null, 'null stays null');
  assertEqual(decryptFieldsForRead({ otherField: 'x' }, schema).otherField, 'x', 'unrelated doc unchanged');
  // If a plain string somehow lives in an encrypted field (legacy data pre-migration),
  // decrypt should leave it alone rather than crash.
  assertEqual(decryptFieldsForRead({ token: 'plaintext-legacy' }, schema).token, 'plaintext-legacy',
    'plain string in encrypted field is passed through (legacy tolerance)');
}

console.log('\n=== query guard: reject encrypted fields in filters ===');
{
  const schema = { token: { type: 'string', encrypted: true }, userId: { type: 'string' } };
  assertThrows(
    () => assertNoEncryptedFieldInFilter({ token: 'abc' }, schema),
    /Cannot filter on encrypted field "token"/,
    'direct filter on encrypted field rejected'
  );
  assertThrows(
    () => assertNoEncryptedFieldInFilter({ $and: [{ token: 'abc' }] }, schema),
    /Cannot filter on encrypted field "token"/,
    '$and nested encrypted filter rejected'
  );
  assertThrows(
    () => assertNoEncryptedFieldInFilter({ $or: [{ userId: 'u1' }, { token: 'abc' }] }, schema),
    /Cannot filter on encrypted field "token"/,
    '$or nested encrypted filter rejected'
  );
  // Non-encrypted filter should pass through
  let threw = false;
  try { assertNoEncryptedFieldInFilter({ userId: 'u1' }, schema); } catch { threw = true; }
  assert(!threw, 'filter on non-encrypted field allowed');
}

console.log('\n=== key mismatch produces clear error ===');
{
  const ct = encryptField('secret');
  // Swap key
  process.env.JASONJS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  _resetEncryptionKeyCache();
  assertThrows(
    () => decryptField(ct),
    /encryption key may have changed/i,
    'decrypting with wrong key gives guidance about rotation'
  );
  // Restore
  process.env.JASONJS_ENCRYPTION_KEY = TEST_KEY;
  _resetEncryptionKeyCache();
}

console.log('\n=== key format validation ===');
{
  process.env.JASONJS_ENCRYPTION_KEY = 'too-short';
  _resetEncryptionKeyCache();
  assertThrows(
    () => getEncryptionKey(),
    /64 hex chars/,
    'short key rejected'
  );
  process.env.JASONJS_ENCRYPTION_KEY = TEST_KEY;
  _resetEncryptionKeyCache();
}

console.log('\n=== prod mode requires explicit key ===');
{
  const saved = process.env.NODE_ENV;
  const savedKey = process.env.JASONJS_ENCRYPTION_KEY;
  delete process.env.JASONJS_ENCRYPTION_KEY;
  process.env.NODE_ENV = 'production';
  _resetEncryptionKeyCache();
  assertThrows(
    () => getEncryptionKey(),
    /required in production/,
    'production without key throws'
  );
  process.env.NODE_ENV = saved;
  process.env.JASONJS_ENCRYPTION_KEY = savedKey;
  _resetEncryptionKeyCache();
}

console.log('\n=== IVs are unique per encryption call ===');
{
  const a = encryptField('same input');
  const b = encryptField('same input');
  assert(a.iv !== b.iv, 'IVs differ for same plaintext');
  assert(a.ct !== b.ct, 'ciphertexts differ for same plaintext (authenticated encryption)');
  assertEqual(decryptField(a), 'same input', 'both decrypt to same plaintext');
  assertEqual(decryptField(b), 'same input', 'both decrypt to same plaintext');
}

// Cleanup: ensure we didn't leave a key file behind if the test was run without env var
const keyFile = path.join(process.cwd(), '.jasonjs-encryption-key');
if (fs.existsSync(keyFile)) {
  try {
    const contents = fs.readFileSync(keyFile, 'utf8').trim();
    // Only remove if it's something we created (not user's real key).
    // We can't tell for sure, so skip removal — better to leave user data than delete.
  } catch {}
}

console.log('\n=== Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
