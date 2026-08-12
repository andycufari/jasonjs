/**
 * Unified Cache Utility for JasonJS Framework
 *
 * Provides centralized caching following the logger.js pattern for consistency.
 * Supports multiple strategies (MEMORY, REACT) with unified API.
 *
 * Features:
 * - Deterministic cache key generation
 * - TTL (time-to-live) expiration
 * - LRU (least recently used) eviction
 * - Dev mode bypass
 * - Statistics tracking
 * - Pattern-based invalidation
 *
 * Usage:
 *   import { createCache, CacheStrategy, CacheTTL } from '@/core/utils/cache';
 *
 *   const myCache = createCache('CacheName', {
 *     strategy: CacheStrategy.MEMORY,
 *     ttl: CacheTTL.DEFAULT,        // Use centralized TTL constants
 *     respectDevMode: true,
 *     maxSize: 1000,
 *     keyPrefix: 'prefix'
 *   });
 *
 *   const key = myCache.generateKey('operation', param1, param2);
 *   const cached = await myCache.get(key, isDev);
 *   if (!cached) {
 *     const data = await expensiveOperation();
 *     await myCache.set(key, data, null, isDev);
 *   }
 */

import crypto from 'crypto';
import { cache as reactCache } from 'react';
import { createLogger } from './logger.js';

const logger = createLogger('Cache');

/**
 * Cache TTL (Time-To-Live) Configuration
 * Centralized cache expiration settings
 */
export const CacheTTL = {
  // Default TTL for general-purpose caches
  DEFAULT: 5 * 60 * 1000,           // 5 minutes

  // Component bundle cache TTL
  BUNDLE_PROD: 60 * 60 * 1000,      // 1 hour in production
  BUNDLE_DEV: 60 * 1000,            // 1 minute in development

  // FileSystem cache TTL
  FILESYSTEM: 5 * 60 * 1000,        // 5 minutes

  // Session/Auth cache TTL
  SESSION: 15 * 60 * 1000,          // 15 minutes

  // Client-side cache TTL
  CLIENT: 60 * 60 * 1000,           // 1 hour

  // Short-lived cache
  SHORT: 60 * 1000,                 // 1 minute

  // Long-lived cache
  LONG: 24 * 60 * 60 * 1000,        // 24 hours
};

/**
 * Cache strategies
 */
export const CacheStrategy = {
  MEMORY: 'memory',   // Global Map-based cache (persistent across requests)
  REACT: 'react',     // React cache() wrapper (per-request deduplication)
  REDIS: 'redis',     // Redis-based cache (distributed, persistent)
  NONE: 'none'        // No-op for testing
};

/**
 * Global registry of all cache instances for monitoring
 * Using globalThis to ensure singleton across Next.js module contexts
 * (different API routes, edge functions, etc. get separate module instances)
 */
if (!globalThis.__jasonjs_cache_registry__) {
  globalThis.__jasonjs_cache_registry__ = new Map();
}
const cacheRegistry = globalThis.__jasonjs_cache_registry__;

/**
 * Base Cache Manager class
 */
class CacheManager {
  constructor(name, config = {}) {
    this.name = name;
    this.config = {
      strategy: config.strategy || CacheStrategy.MEMORY,
      ttl: config.ttl || CacheTTL.DEFAULT,
      respectDevMode: config.respectDevMode !== false,
      maxSize: config.maxSize || 1000,
      keyPrefix: config.keyPrefix || name.toLowerCase()
    };

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      evictions: 0
    };

    // Register this cache instance
    cacheRegistry.set(name, this);
  }

  /**
   * Generate deterministic cache key from parts
   * @param {...any} parts - Key parts (strings, numbers, objects)
   * @returns {string} Cache key
   */
  generateKey(...parts) {
    const keyParts = parts.map(part => {
      if (part === null || part === undefined) {
        return 'null';
      }
      if (typeof part === 'object') {
        return this._hashObject(part);
      }
      return String(part);
    });

    return `${this.config.keyPrefix}:${keyParts.join(':')}`;
  }

  /**
   * Hash an object for cache key generation
   * @param {Object} obj - Object to hash
   * @returns {string} MD5 hash
   */
  _hashObject(obj) {
    try {
      // Sort keys for deterministic hashing
      const sortedObj = this._sortObject(obj);
      const jsonStr = JSON.stringify(sortedObj);
      return crypto.createHash('md5').update(jsonStr).digest('hex').substring(0, 8);
    } catch (error) {
      logger.warn('Error hashing object for cache key', error);
      return 'hash-error';
    }
  }

  /**
   * Sort object keys recursively for deterministic hashing
   * @param {any} obj - Object to sort
   * @returns {any} Sorted object
   */
  _sortObject(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this._sortObject(item));
    }

    return Object.keys(obj)
      .sort()
      .reduce((result, key) => {
        result[key] = this._sortObject(obj[key]);
        return result;
      }, {});
  }

  /**
   * Check if cache should be bypassed
   * @param {boolean} isDev - Development mode flag
   * @returns {boolean} True if should bypass cache
   */
  _shouldBypassCache(isDev) {
    return this.config.respectDevMode && isDev;
  }

  /**
   * Get statistics for this cache
   * @returns {Object} Statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : '0.00';

    return {
      name: this.name,
      strategy: this.config.strategy,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      invalidations: this.stats.invalidations,
      evictions: this.stats.evictions,
      hitRate: `${hitRate}%`,
      total
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      evictions: 0
    };
  }

  // Abstract methods to be implemented by subclasses
  async get(key, isDev) {
    throw new Error('get() must be implemented by subclass');
  }

  async set(key, data, ttl, isDev) {
    throw new Error('set() must be implemented by subclass');
  }

  async invalidate(pattern) {
    throw new Error('invalidate() must be implemented by subclass');
  }

  async clear() {
    throw new Error('clear() must be implemented by subclass');
  }
}

/**
 * Memory Cache Implementation
 * Global Map-based cache that persists across requests
 */
class MemoryCache extends CacheManager {
  constructor(name, config) {
    super(name, config);
    this.cache = new Map();
    this.accessOrder = new Map(); // Track access time for LRU

    // Start cleanup interval
    this._startCleanupInterval();
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @param {boolean} isDev - Development mode flag
   * @returns {Promise<any>} Cached value or null
   */
  async get(key, isDev = false) {
    if (this._shouldBypassCache(isDev)) {
      // Enhanced logging for dev mode bypass
      console.log(`🔄 [${this.name}] Cache BYPASSED (dev mode)`, {
        key,
        isDev,
        respectDevMode: this.config.respectDevMode,
        timestamp: new Date().toISOString()
      });
      logger.debug(`[${this.name}] Cache bypassed (dev mode)`, { key });
      this.stats.misses++;
      return null;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      logger.debug(`[${this.name}] Cache miss`, { key });
      return null;
    }

    // Check TTL
    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.misses++;
      logger.debug(`[${this.name}] Cache expired`, { key, age: `${age}ms`, ttl: `${entry.ttl}ms` });
      return null;
    }

    // Update access time for LRU
    this.accessOrder.set(key, now);
    entry.hits++;
    this.stats.hits++;

    // Log cache hits with dev mode info
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ [${this.name}] Cache HIT`, {
        key: key.substring(0, 60) + '...',
        age: `${age}ms`,
        hits: entry.hits,
        isDev,
        bypassed: false
      });
    }

    logger.debug(`[${this.name}] Cache hit`, { key, age: `${age}ms`, hits: entry.hits });
    return entry.data;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live (ms), null uses default
   * @param {boolean} isDev - Development mode flag
   */
  async set(key, data, ttl = null, isDev = false) {
    if (this._shouldBypassCache(isDev)) {
      // Silent bypass in dev mode - don't spam logs
      return;
    }

    const now = Date.now();
    const entryTtl = ttl !== null ? ttl : this.config.ttl;

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: entryTtl,
      hits: 0
    });

    this.accessOrder.set(key, now);
    this.stats.sets++;

    logger.debug(`[${this.name}] Cache set`, { key, ttl: `${entryTtl}ms` });

    // Enforce size limit with LRU eviction
    this._enforceSize();
  }

  /**
   * Invalidate cache entries by pattern
   * @param {string} pattern - Pattern to match keys
   * @returns {Promise<number>} Number of invalidated entries
   */
  async invalidate(pattern) {
    let count = 0;

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        count++;
      }
    }

    this.stats.invalidations += count;
    logger.debug(`[${this.name}] Invalidated ${count} entries`, { pattern });

    return count;
  }

  /**
   * Clear all cache entries
   * @returns {Promise<number>} Number of cleared entries
   */
  async clear() {
    const count = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.resetStats();

    logger.debug(`[${this.name}] Cleared ${count} entries`);
    return count;
  }

  /**
   * Enforce maximum cache size using LRU eviction
   */
  _enforceSize() {
    if (this.cache.size <= this.config.maxSize) {
      return;
    }

    // Sort keys by access time (oldest first)
    const sortedKeys = Array.from(this.accessOrder.entries())
      .sort((a, b) => a[1] - b[1])
      .map(entry => entry[0]);

    // Remove oldest entries
    const toRemove = this.cache.size - this.config.maxSize;
    for (let i = 0; i < toRemove && i < sortedKeys.length; i++) {
      const key = sortedKeys[i];
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.evictions++;
    }

    if (toRemove > 0) {
      logger.debug(`[${this.name}] LRU evicted ${toRemove} entries`, {
        size: this.cache.size,
        maxSize: this.config.maxSize
      });
    }
  }

  /**
   * Start cleanup interval for expired entries
   */
  _startCleanupInterval() {
    // Run cleanup every 5 minutes
    const interval = 5 * 60 * 1000;

    setInterval(() => {
      this._cleanupExpired();
    }, interval);
  }

  /**
   * Clean up expired entries
   */
  _cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`[${this.name}] Cleanup removed ${cleaned} expired entries`);
    }
  }
}

/**
 * React Cache Implementation
 * Uses React's cache() API for per-request deduplication
 */
class ReactCacheImpl extends CacheManager {
  constructor(name, config) {
    super(name, config);

    // Create cached function wrapper
    this.cachedFn = reactCache(async (key, data) => {
      return data;
    });

    // Map to store pending operations
    this.pendingOps = new Map();
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @param {boolean} isDev - Development mode flag
   * @returns {Promise<any>} Cached value or null
   */
  async get(key, isDev = false) {
    // React cache doesn't support bypass, so we modify the key
    if (this._shouldBypassCache(isDev)) {
      const devKey = `${key}:${Date.now()}`;
      this.stats.misses++;
      logger.debug(`[${this.name}] Cache bypassed (dev mode)`, { key: devKey });
      return null;
    }

    // Check if we have data for this key
    if (!this.pendingOps.has(key)) {
      this.stats.misses++;
      logger.debug(`[${this.name}] Cache miss`, { key });
      return null;
    }

    this.stats.hits++;
    logger.debug(`[${this.name}] Cache hit`, { key });

    // Retrieve from React cache
    try {
      return await this.cachedFn(key, this.pendingOps.get(key));
    } catch (error) {
      logger.warn(`[${this.name}] Error retrieving from React cache`, { key, error });
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Not used (React cache manages lifecycle)
   * @param {boolean} isDev - Development mode flag
   */
  async set(key, data, ttl = null, isDev = false) {
    if (this._shouldBypassCache(isDev)) {
      // Silent bypass in dev mode - don't spam logs
      return;
    }

    // Store data reference
    this.pendingOps.set(key, data);
    this.stats.sets++;

    logger.debug(`[${this.name}] Cache set`, { key });

    // Pre-warm the React cache
    try {
      await this.cachedFn(key, data);
    } catch (error) {
      logger.warn(`[${this.name}] Error pre-warming React cache`, { key, error });
    }
  }

  /**
   * Invalidate cache entries by pattern
   * Note: React cache doesn't support manual invalidation
   * Entries automatically cleared at end of request
   */
  async invalidate(pattern) {
    let count = 0;

    for (const key of this.pendingOps.keys()) {
      if (key.includes(pattern)) {
        this.pendingOps.delete(key);
        count++;
      }
    }

    this.stats.invalidations += count;
    logger.debug(`[${this.name}] Invalidated ${count} pending ops`, { pattern });

    return count;
  }

  /**
   * Clear all cache entries
   */
  async clear() {
    const count = this.pendingOps.size;
    this.pendingOps.clear();
    this.resetStats();

    logger.debug(`[${this.name}] Cleared ${count} pending ops`);
    return count;
  }
}

/**
 * No-op Cache Implementation for testing
 */
class NoOpCache extends CacheManager {
  async get(key, isDev = false) {
    this.stats.misses++;
    return null;
  }

  async set(key, data, ttl = null, isDev = false) {
    this.stats.sets++;
  }

  async invalidate(pattern) {
    return 0;
  }

  async clear() {
    return 0;
  }
}

/**
 * Redis Cache Implementation
 * Uses Redis for distributed, persistent caching across server instances
 */
class RedisCache extends CacheManager {
  constructor(name, config) {
    super(name, config);
    this.redis = null;
    this.isConnected = false;
    this._initRedis();
  }

  /**
   * Initialize Redis connection
   */
  async _initRedis() {
    try {
      // Dynamic import to avoid bundling Redis in client
      const { createClient } = await import('redis');

      const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
      if (!redisUrl) {
        logger.warn(`[${this.name}] No REDIS_URL found, Redis cache disabled`);
        return;
      }

      // Parse Redis URL to check for TLS
      const isSecure = redisUrl.startsWith('rediss://');

      // Build socket config
      const socketConfig = {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            logger.error(`[${this.name}] Redis connection failed after 3 retries`);
            return false; // Stop retrying
          }
          return Math.min(retries * 100, 3000); // Exponential backoff
        }
      };

      // Only add TLS config if using rediss:// and need custom settings
      // For AWS ElastiCache, the rediss:// URL is enough, but we need to allow self-signed certs
      if (isSecure) {
        socketConfig.tls = true;
        socketConfig.rejectUnauthorized = false; // AWS ElastiCache compatibility
      }

      this.redis = createClient({
        url: redisUrl,
        socket: socketConfig
      });

      this.redis.on('error', (err) => {
        // Only log Redis errors if explicitly configured (not auto-detected)
        // This prevents noise when REDIS_URL is set but Redis isn't actually running
        const isExplicitlyConfigured = config.strategy === CacheStrategy.REDIS;
        if (isExplicitlyConfigured) {
          logger.error(`[${this.name}] Redis error:`, err);
        } else {
          logger.debug(`[${this.name}] Redis error (auto-detected, falling back to memory):`, err?.message);
        }
        this.isConnected = false;
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        logger.info(`[${this.name}] Redis connected`);
      });

      // Try to connect with timeout - don't block if Redis is unavailable
      try {
        const connectPromise = this.redis.connect();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        );

        await Promise.race([connectPromise, timeoutPromise]);
      } catch (error) {
        logger.warn(`[${this.name}] Redis connection failed, falling back to memory cache:`, error?.message);
        this.redis = null;
        this.isConnected = false;
      }
    } catch (error) {
      logger.error(`[${this.name}] Failed to initialize Redis:`, error);
      this.redis = null;
      this.isConnected = false;
    }
  }

  /**
   * Get value from Redis cache
   */
  async get(key, isDev = false) {
    if (this._shouldBypassCache(isDev)) {
      this.stats.misses++;
      return null;
    }

    if (!this.isConnected || !this.redis) {
      this.stats.misses++;
      return null;
    }

    try {
      const value = await this.redis.get(key);

      if (!value) {
        this.stats.misses++;
        logger.debug(`[${this.name}] Cache miss`, { key });
        return null;
      }

      // Parse JSON
      const parsed = JSON.parse(value);
      this.stats.hits++;
      logger.debug(`[${this.name}] Cache hit`, { key });

      return parsed;
    } catch (error) {
      logger.warn(`[${this.name}] Redis get error:`, { key, error: error?.message || String(error) });
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in Redis cache
   */
  async set(key, data, ttl = null, isDev = false) {
    if (this._shouldBypassCache(isDev)) {
      return;
    }

    if (!this.isConnected || !this.redis) {
      return;
    }

    try {
      const entryTtl = ttl !== null ? ttl : this.config.ttl;
      const serialized = JSON.stringify(data);

      // Set with TTL (in seconds)
      await this.redis.setEx(key, Math.floor(entryTtl / 1000), serialized);

      this.stats.sets++;
      logger.debug(`[${this.name}] Cache set`, { key, ttl: `${entryTtl}ms` });
    } catch (error) {
      logger.warn(`[${this.name}] Redis set error:`, { key, error: error?.message || String(error) });
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidate(pattern) {
    if (!this.isConnected || !this.redis) {
      return 0;
    }

    try {
      // Use SCAN to find matching keys and batch delete them
      let count = 0;
      const matchPattern = `*${pattern}*`;
      let keysToDelete = [];

      // node-redis v4 scanIterator may yield individual strings OR arrays of strings
      // depending on version. Normalize both into keysToDelete.
      for await (const chunk of this.redis.scanIterator({ MATCH: matchPattern, COUNT: 100 })) {
        if (!chunk) continue;
        if (Array.isArray(chunk)) {
          for (const k of chunk) if (k) keysToDelete.push(k);
        } else {
          keysToDelete.push(chunk);
        }

        // Delete in batches to avoid command length issues
        if (keysToDelete.length >= 1000) {
          await this.redis.del(keysToDelete);
          count += keysToDelete.length;
          keysToDelete = [];
        }
      }

      // Delete remaining keys — guard against empty array
      if (keysToDelete.length > 0) {
        await this.redis.del(keysToDelete);
        count += keysToDelete.length;
      }

      this.stats.invalidations += count;
      logger.debug(`[${this.name}] Invalidated ${count} entries`, { pattern });

      return count;
    } catch (error) {
      logger.warn(`[${this.name}] Redis invalidate error:`, { pattern, error: error?.message || String(error) });
      return 0;
    }
  }

  /**
   * Clear all cache entries (WARNING: Flushes entire Redis DB)
   */
  async clear() {
    if (!this.isConnected || !this.redis) {
      return 0;
    }

    try {
      // Note: This flushes the entire Redis database
      // In production, you might want to use key prefixes instead
      await this.redis.flushDb();
      this.resetStats();

      logger.debug(`[${this.name}] Cleared all entries`);
      return 1;
    } catch (error) {
      logger.warn(`[${this.name}] Redis clear error:`, error);
      return 0;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      logger.info(`[${this.name}] Redis disconnected`);
    }
  }
}

/**
 * Create a cache instance (singleton pattern - reuses existing instances)
 * @param {string} name - Cache name
 * @param {Object} config - Cache configuration
 * @returns {CacheManager} Cache instance
 */
export function createCache(name, config = {}) {
  // Auto-detect Redis if REDIS_URL is present and no strategy specified
  let strategy = config.strategy;
  if (!strategy) {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
    strategy = redisUrl ? CacheStrategy.REDIS : CacheStrategy.MEMORY;
    logger.info(`Auto-detected cache strategy for ${name}`, {
      strategy,
      hasRedisUrl: !!redisUrl,
      redisUrl: redisUrl ? 'set' : 'not set'
    });
  }

  // Check if cache already exists (singleton pattern)
  const existingCache = cacheRegistry.get(name);
  if (existingCache) {
    // Verify the existing cache matches the desired strategy
    if (existingCache.config.strategy === strategy) {
      logger.debug(`Reusing existing cache: ${name}`, { strategy: existingCache.config.strategy });
      return existingCache;
    } else {
      // Strategy mismatch - recreate cache with new strategy
      logger.warn(`Cache strategy mismatch for ${name}, recreating`, {
        existing: existingCache.config.strategy,
        desired: strategy
      });
      // Clean up old cache connections if needed (fire and forget)
      if (existingCache.disconnect && typeof existingCache.disconnect === 'function') {
        existingCache.disconnect().catch(e => {
          logger.warn(`Failed to disconnect old cache: ${name}`, e);
        });
      }
      cacheRegistry.delete(name);
      // Continue to create new cache below
    }
  }

  logger.info(`Creating NEW cache: ${name}`, { strategy });

  switch (strategy) {
    case CacheStrategy.MEMORY:
      return new MemoryCache(name, config);
    case CacheStrategy.REACT:
      return new ReactCacheImpl(name, config);
    case CacheStrategy.REDIS:
      return new RedisCache(name, config);
    case CacheStrategy.NONE:
      return new NoOpCache(name, config);
    default:
      logger.warn(`Unknown cache strategy: ${strategy}, using MEMORY`);
      return new MemoryCache(name, config);
  }
}

/**
 * Get all registered cache instances
 * @returns {Map} Map of cache names to instances
 */
export function getAllCaches() {
  const stats = {};

  for (const [name, cache] of cacheRegistry.entries()) {
    stats[name] = cache.getStats();
  }

  return stats;
}

/**
 * Get a specific cache instance by name
 * @param {string} name - Cache name
 * @returns {CacheManager|null} Cache instance or null
 */
export function getCache(name) {
  return cacheRegistry.get(name) || null;
}

/**
 * Clear all caches
 * @returns {Promise<Object>} Map of cache names to cleared count
 */
export async function clearAllCaches() {
  const results = {};

  for (const [name, cache] of cacheRegistry.entries()) {
    results[name] = await cache.clear();
  }

  logger.info('Cleared all caches', results);
  return results;
}

// Export default for convenience
export default {
  createCache,
  CacheStrategy,
  getAllCaches,
  getCache,
  clearAllCaches
};
