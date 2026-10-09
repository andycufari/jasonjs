// Standalone (node tests/unit/redis-cache-shared-instance.test.mjs) — no jest needed.
// Reproduces the prod bug behind the booking OAuth `state_expired`: with REDIS_URL set
// (strategy auto-detected), createCache() stored 'memory' on the instance, so the second
// createCache() with the same name — from another route module — saw a "mismatch",
// disconnected the first client and built a new one. The route that set the value and
// the route that read it held different instances, one of them dead.
import assert from 'node:assert/strict';
import { createCache } from '../../core/utils/cache.js';

// Unreachable on purpose: we only need auto-detection to pick Redis. The real client
// fails to connect; a fake one is injected below.
process.env.REDIS_URL = 'redis://127.0.0.1:1';
delete process.env.REDIS_URI;

function fakeRedis() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async setEx(k, _ttl, v) { store.set(k, v); },
    async quit() {},
  };
}

// 1. Two modules, same name, no explicit strategy → the SAME instance.
const urlRoute = createCache('SharedInstanceTest', { ttl: 600_000, keyPrefix: 'bc:oauth' });
await urlRoute._ready; // real connect fails → redis = null
const fake = fakeRedis();
urlRoute.redis = fake;
urlRoute.isConnected = true;

const callbackRoute = createCache('SharedInstanceTest', { ttl: 600_000, keyPrefix: 'bc:oauth' });
assert.equal(callbackRoute, urlRoute, 'second createCache must reuse the instance, not recreate it');
assert.equal(urlRoute.isConnected, true, 'the first module\'s client must not be disconnected');

// 2. A value set from one module is readable from the other.
await urlRoute.set('bc:oauth:nonce1', { userId: 'u1' }, 600_000);
assert.deepEqual(await callbackRoute.get('bc:oauth:nonce1'), { userId: 'u1' });

// 3. set() right after creation waits for the connection instead of dropping the value.
const late = fakeRedis();
urlRoute.isConnected = false;
urlRoute.redis = null;
urlRoute._ready = new Promise(resolve => setTimeout(() => {
  urlRoute.redis = late;
  urlRoute.isConnected = true;
  resolve();
}, 30));
await urlRoute.set('bc:oauth:nonce2', { userId: 'u2' }, 600_000);
assert.equal(late.store.size, 1, 'set issued before the connection finished must not be dropped');

console.log('redis-cache-shared-instance: 3/3 PASS');
process.exit(0);
