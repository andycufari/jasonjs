/**
 * Tests for Unified Cache Utility
 *
 * Run with: node --experimental-modules core/utils/cache.test.js
 * Or: npm test core/utils/cache.test.js
 */

import { createCache, CacheStrategy, getAllCaches, clearAllCaches } from './cache.js';

// Simple test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  assert(passed, `${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test Suite
async function runTests() {
  console.log('\n🧪 Testing Unified Cache Utility\n');
  console.log('=' .repeat(60));

  // Test 1: Create MEMORY cache
  console.log('\n📦 Test 1: Create MEMORY cache');
  const memCache = createCache('TestMemory', {
    strategy: CacheStrategy.MEMORY,
    ttl: 5000,
    maxSize: 10
  });
  assert(memCache !== null, 'Memory cache created');
  assert(memCache.config.strategy === CacheStrategy.MEMORY, 'Strategy is MEMORY');

  // Test 2: Cache key generation
  console.log('\n🔑 Test 2: Cache key generation');
  const key1 = memCache.generateKey('user', '123', 'profile');
  const key2 = memCache.generateKey('user', '123', 'profile');
  assertEqual(key1, key2, 'Same params generate same key');
  assert(key1.startsWith('testmemory:'), 'Key has correct prefix');

  // Test 3: Object hashing
  console.log('\n#️⃣ Test 3: Object hashing');
  const objKey1 = memCache.generateKey({ id: 1, name: 'test' });
  const objKey2 = memCache.generateKey({ name: 'test', id: 1 }); // Different order
  assertEqual(objKey1, objKey2, 'Object hashing is deterministic (order-independent)');

  // Test 4: Set and Get
  console.log('\n💾 Test 4: Set and Get');
  await memCache.set('test-key', { data: 'test-value' });
  const cached = await memCache.get('test-key');
  assertEqual(cached, { data: 'test-value' }, 'Retrieved cached value');

  // Test 5: Cache miss
  console.log('\n🔍 Test 5: Cache miss');
  const missed = await memCache.get('non-existent-key');
  assertEqual(missed, null, 'Non-existent key returns null');

  // Test 6: Dev mode bypass
  console.log('\n🔧 Test 6: Dev mode bypass');
  await memCache.set('dev-test', 'value', null, false); // Set in prod mode
  const prodGet = await memCache.get('dev-test', false); // Get in prod mode
  const devGet = await memCache.get('dev-test', true); // Get in dev mode
  assertEqual(prodGet, 'value', 'Prod mode retrieves value');
  assertEqual(devGet, null, 'Dev mode bypasses cache');

  // Test 7: TTL expiration
  console.log('\n⏰ Test 7: TTL expiration');
  const shortCache = createCache('TestTTL', {
    strategy: CacheStrategy.MEMORY,
    ttl: 100 // 100ms
  });
  await shortCache.set('ttl-test', 'expire-me');
  const before = await shortCache.get('ttl-test');
  await sleep(150); // Wait for expiration
  const after = await shortCache.get('ttl-test');
  assertEqual(before, 'expire-me', 'Value exists before expiration');
  assertEqual(after, null, 'Value expired after TTL');

  // Test 8: Custom TTL
  console.log('\n🕒 Test 8: Custom TTL override');
  await memCache.set('custom-ttl', 'value', 200); // Custom 200ms TTL
  const immediate = await memCache.get('custom-ttl');
  await sleep(250);
  const afterCustom = await memCache.get('custom-ttl');
  assertEqual(immediate, 'value', 'Value exists immediately');
  assertEqual(afterCustom, null, 'Value expired after custom TTL');

  // Test 9: LRU Eviction
  console.log('\n♻️ Test 9: LRU eviction');
  const lruCache = createCache('TestLRU', {
    strategy: CacheStrategy.MEMORY,
    maxSize: 3
  });
  await lruCache.set('key1', 'value1');
  await lruCache.set('key2', 'value2');
  await lruCache.set('key3', 'value3');
  await lruCache.get('key1'); // Access key1 (make it recently used)
  await sleep(10); // Small delay to ensure different access times
  await lruCache.set('key4', 'value4'); // Should evict key2 (least recently used)

  const key1Exists = await lruCache.get('key1');
  const key2Exists = await lruCache.get('key2');
  const key3Exists = await lruCache.get('key3');
  const key4Exists = await lruCache.get('key4');

  assert(key1Exists !== null, 'Recently accessed key1 not evicted');
  assert(key2Exists === null, 'Least recently used key2 evicted');
  assert(key3Exists !== null, 'key3 not evicted');
  assert(key4Exists !== null, 'New key4 added');

  // Test 10: Pattern invalidation
  console.log('\n🗑️ Test 10: Pattern invalidation');
  const invCache = createCache('TestInvalidate', {
    strategy: CacheStrategy.MEMORY
  });
  await invCache.set('user:123', 'data1');
  await invCache.set('user:456', 'data2');
  await invCache.set('post:789', 'data3');

  const invalidated = await invCache.invalidate('user:');
  assertEqual(invalidated, 2, 'Invalidated 2 user entries');

  const user123 = await invCache.get('user:123');
  const post789 = await invCache.get('post:789');
  assertEqual(user123, null, 'Invalidated user:123');
  assertEqual(post789, 'data3', 'post:789 still exists');

  // Test 11: Clear cache
  console.log('\n🧹 Test 11: Clear cache');
  await memCache.set('clear-test-1', 'value1');
  await memCache.set('clear-test-2', 'value2');
  const cleared = await memCache.clear();
  const afterClear = await memCache.get('clear-test-1');
  assert(cleared >= 0, `Cleared ${cleared} entries`);
  assertEqual(afterClear, null, 'Cache empty after clear');

  // Test 12: Statistics
  console.log('\n📊 Test 12: Statistics tracking');
  const statsCache = createCache('TestStats', {
    strategy: CacheStrategy.MEMORY
  });

  // Reset stats first
  statsCache.resetStats();

  await statsCache.set('stat-key', 'value'); // 1 set
  await statsCache.get('stat-key'); // 1 hit
  await statsCache.get('stat-key'); // 1 hit
  await statsCache.get('missing-key'); // 1 miss

  const stats = statsCache.getStats();
  assertEqual(stats.sets, 1, 'Tracked 1 set');
  assertEqual(stats.hits, 2, 'Tracked 2 hits');
  assertEqual(stats.misses, 1, 'Tracked 1 miss');
  assert(stats.hitRate === '66.67%', `Hit rate calculated correctly: ${stats.hitRate}`);

  // Test 13: Get all caches
  console.log('\n📋 Test 13: Get all caches');
  const allCaches = getAllCaches();
  assert(Object.keys(allCaches).length > 0, 'Retrieved multiple caches');
  assert(allCaches.TestMemory !== undefined, 'TestMemory cache exists in registry');

  // Test 14: Clear all caches
  console.log('\n🗑️ Test 14: Clear all caches');
  const clearResults = await clearAllCaches();
  assert(Object.keys(clearResults).length > 0, 'Cleared multiple caches');

  // Test 15: REACT strategy (basic test)
  console.log('\n⚛️ Test 15: REACT cache strategy');
  const reactCache = createCache('TestReact', {
    strategy: CacheStrategy.REACT
  });
  assert(reactCache !== null, 'React cache created');
  assert(reactCache.config.strategy === CacheStrategy.REACT, 'Strategy is REACT');

  await reactCache.set('react-key', 'react-value');
  const reactGet = await reactCache.get('react-key');
  assertEqual(reactGet, 'react-value', 'React cache stores and retrieves');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n📈 Test Results: ${testsPassed} passed, ${testsFailed} failed\n`);

  if (testsFailed === 0) {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed!\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
