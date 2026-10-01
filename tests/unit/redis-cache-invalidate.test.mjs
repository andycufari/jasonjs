// Standalone (node tests/unit/redis-cache-invalidate.test.mjs) — no jest needed.
// Reproduces the prod bug: on a Redis CLUSTER (ElastiCache/Valkey), a multi-key
// DEL whose keys hash to different slots fails with CROSSSLOT, so invalidate()
// deleted nothing and reads stayed stale until the TTL expired.
import assert from 'node:assert/strict';
import { createCache, CacheStrategy } from '../../core/utils/cache.js';

delete process.env.REDIS_URL; delete process.env.REDIS_URI;

function fakeClusterRedis(keys) {
  const store = new Map(keys.map(k => [k, '1']));
  return {
    store,
    async *scanIterator({ MATCH }) {
      const re = new RegExp('^' + MATCH.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      yield [...store.keys()].filter(k => re.test(k));
    },
    async del(k) {
      const list = Array.isArray(k) ? k : [k];
      if (list.length > 1) throw new Error("CROSSSLOT Keys in request don't hash to the same slot");
      return store.delete(list[0]) ? 1 : 0;
    },
  };
}

const cache = createCache('JasonDBTest', { strategy: CacheStrategy.REDIS, keyPrefix: 'jasondb' });
await new Promise(r => setTimeout(r, 50)); // let _initRedis() finish (no URL → disabled)

const site = '67ad3804c03bd9c0659041be';
const keys = [
  `jasondb:${site}:lotes_v2:query:aaa`,
  `jasondb:${site}:lotes_v2:query:bbb`,
  `jasondb:${site}:lotes_v2:query:ccc`,
  `jasondb:${site}:insumos:query:ddd`,   // other collection: must survive
];
cache.redis = fakeClusterRedis(keys);
cache.isConnected = true;

const n = await cache.invalidate(`${site}:lotes_v2`);
assert.equal(n, 3, `expected 3 invalidated, got ${n}`);
assert.deepEqual([...cache.redis.store.keys()], [`jasondb:${site}:insumos:query:ddd`]);

// single matching key must keep working too
cache.redis = fakeClusterRedis([`jasondb:${site}:reporte:query:x`]);
assert.equal(await cache.invalidate(`${site}:reporte`), 1);

// more than one flush batch (100) — every matching key goes, nothing else
const many = Array.from({ length: 250 }, (_, i) => `jasondb:${site}:movimientos:query:${i}`);
cache.redis = fakeClusterRedis([...many, `jasondb:${site}:operarios:query:z`]);
assert.equal(await cache.invalidate(`${site}:movimientos`), 250);
assert.equal(cache.redis.store.size, 1);

// one key failing must not stop the others
cache.redis = fakeClusterRedis([`jasondb:${site}:reporte:query:a`, `jasondb:${site}:reporte:query:b`]);
const realDel = cache.redis.del.bind(cache.redis);
cache.redis.del = async (k) => { if (k.endsWith(':a')) throw new Error('boom'); return realDel(k); };
assert.equal(await cache.invalidate(`${site}:reporte`), 1);
assert.deepEqual([...cache.redis.store.keys()], [`jasondb:${site}:reporte:query:a`]);

console.log('ok — redis-cache-invalidate');
process.exit(0);
