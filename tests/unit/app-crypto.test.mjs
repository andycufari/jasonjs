// Standalone (node tests/unit/app-crypto.test.mjs) — no jest needed.
// app.crypto is how a sandboxed function mints keys and checks signatures.
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { createAppCrypto } from '../../core/functions/appCrypto.js';

const c = createAppCrypto();

// randomToken: 32 bytes hex by default, never repeats
const t = c.randomToken();
assert.match(t, /^[0-9a-f]{64}$/);
assert.notEqual(c.randomToken(), t);
assert.match(c.randomToken(16), /^[0-9a-f]{32}$/);
assert.match(c.randomToken(24, 'base64url'), /^[A-Za-z0-9_-]{32}$/);
for (const bad of [0, 1025, 1.5, 'x', -1]) {
  assert.throws(() => c.randomToken(bad), /1 to 1024/, `bytes ${bad}`);
}
assert.throws(() => c.randomToken(8, 'latin1'), /encoding/);

assert.match(c.uuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

// hash: sha256 hex by default, same as node
const sha = s => createHash('sha256').update(s).digest('hex');
assert.equal(c.hash('hola'), sha('hola'));
assert.equal(c.hash('hola', 'sha512'), createHash('sha512').update('hola').digest('hex'));
assert.equal(c.hash('hola', 'SHA-512'), c.hash('hola', 'sha512'), 'SHA-512 spelling');
assert.equal(c.hash('ñandú'), sha('ñandú'), 'utf8');
assert.equal(c.hash(42), sha('42'));
assert.throws(() => c.hash({ a: 1 }), /JSON.stringify/);
assert.throws(() => c.hash(undefined), /must be a string/);
assert.throws(() => c.hash('x', 'whirlpool'), /algorithm must be one of/);

// hmac: the usual webhook signature
assert.equal(c.hmac('secret', '{"id":1}'), createHmac('sha256', 'secret').update('{"id":1}').digest('hex'));
assert.equal(c.hmac('k', 'b', 'sha1', 'base64'), createHmac('sha1', 'k').update('b').digest('base64'));

// safeEqual
assert.equal(c.safeEqual('llm_abc', 'llm_abc'), true);
assert.equal(c.safeEqual('llm_abc', 'llm_abd'), false);
assert.equal(c.safeEqual('llm_abc', 'llm_ab'), false);
assert.equal(c.safeEqual('', ''), true);
assert.equal(c.safeEqual('a', null), false);
assert.equal(c.safeEqual(1, 1), false, 'strings only');

console.log('ok — app-crypto');
