/**
 * Redis Utility Module
 *
 * Provides shared Redis connection for worker queues (BullMQ).
 * Uses IORedis-compatible connection required by BullMQ.
 *
 * @module core/utils/redis
 */

// BullMQ requires IORedis, not the node-redis client
// We'll use the connection config that BullMQ accepts

let redisConnection = null;
let connectionChecked = false;

/**
 * Check if Redis is available (REDIS_URL is set)
 * @returns {boolean}
 */
export function isRedisAvailable() {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
  return !!redisUrl;
}

/**
 * Get Redis connection configuration for BullMQ
 *
 * BullMQ uses IORedis internally, so we provide connection options
 * rather than a client instance.
 *
 * @returns {Object|null} Redis connection config or null if unavailable
 */
export function getRedisClient() {
  if (!isRedisAvailable()) {
    return null;
  }

  if (redisConnection) {
    return redisConnection;
  }

  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;

  try {
    // Parse the Redis URL
    const url = new URL(redisUrl);

    // Build IORedis-compatible connection config
    redisConnection = {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      maxRetriesPerRequest: null, // Required by BullMQ
    };

    // Add password if present
    if (url.password) {
      redisConnection.password = url.password;
    }

    // Add username if present (Redis 6+ ACL)
    if (url.username && url.username !== 'default') {
      redisConnection.username = url.username;
    }

    // Handle TLS for rediss:// URLs
    if (url.protocol === 'rediss:') {
      redisConnection.tls = {
        rejectUnauthorized: false // AWS ElastiCache compatibility
      };
    }

    console.log('[Redis] Connection configured for', url.hostname);

    return redisConnection;

  } catch (error) {
    console.error('[Redis] Failed to parse REDIS_URL:', error.message);
    return null;
  }
}

/**
 * Get raw Redis URL (for libraries that accept URL directly)
 * @returns {string|null}
 */
export function getRedisUrl() {
  return process.env.REDIS_URL || process.env.REDIS_URI || null;
}

/**
 * Reset connection (for testing)
 */
export function resetConnection() {
  redisConnection = null;
  connectionChecked = false;
}

export default {
  isRedisAvailable,
  getRedisClient,
  getRedisUrl,
  resetConnection
};
