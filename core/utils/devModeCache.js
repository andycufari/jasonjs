/**
 * Redis-based Developer Mode Manager
 *
 * Stores dev mode state in Redis/shared cache for consistent behavior across:
 * - All server instances
 * - All layers (filesystem, page data, components)
 * - No cookie handling needed
 *
 * When dev=true: Stores in cache with 24h TTL
 * When dev=false: Removes from cache immediately
 *
 * Usage:
 * - Activate: ?dev=true (24 hour session)
 * - Deactivate: ?dev=false (immediate)
 * - Auto-refresh: Every page view extends the 24h window
 */

import { createCache, CacheTTL } from './cache.js';

const DEV_MODE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_NAME = 'DevMode';

/**
 * Get or create the dev mode cache instance
 * Uses createCache which handles singleton pattern (creates once, reuses after)
 */
function getDevModeCache() {
  // Explicitly use Redis if available (don't rely on auto-detection)
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
  const strategy = redisUrl ? 'redis' : 'memory';

  return createCache(CACHE_NAME, {
    strategy, // Explicitly set strategy
    ttl: CacheTTL.LONG, // 24 hours default
    respectDevMode: false, // Don't bypass this cache in dev mode!
    maxSize: 1000,
    keyPrefix: 'dev-mode'
  });
}

/**
 * Generate cache key for a site's dev mode (includes IP for security)
 * @param {string} domain - Site domain
 * @param {string|null} ipAddress - User IP address (from request)
 * @returns {string} Cache key
 */
function getDevModeKey(domain, ipAddress = null) {
  // Include IP address in key so dev mode is per-IP, not per-site
  // This prevents random visitors from disabling cache for everyone
  // Works for all sites (no auth required!)
  if (ipAddress) {
    // Sanitize IP for use in cache key
    const sanitizedIp = ipAddress.replace(/[^0-9a-f.:]/gi, '');
    return `dev-mode:${domain}:ip:${sanitizedIp}`;
  }
  // Fallback (should rarely happen)
  return `dev-mode:${domain}:unknown`;
}

/**
 * Check if dev mode is active for a domain and IP
 * @param {string} domain - Site domain
 * @param {string|null} ipAddress - User IP address
 * @returns {Promise<boolean>} True if dev mode is active for this IP
 */
export async function isDevModeActive(domain, ipAddress = null) {
  if (!domain) return false;

  try {
    const cache = getDevModeCache();

    // Safety check: if cache is null/undefined, return false
    if (!cache || typeof cache.get !== 'function') {
      console.warn('[DevModeCache] Cache not initialized, dev mode disabled');
      return false;
    }

    const key = getDevModeKey(domain, ipAddress);
    const data = await cache.get(key);

    if (!data) return false;

    // Check if expired (should auto-expire via TTL, but double-check)
    if (data.expires && Date.now() > data.expires) {
      await cache.delete(key);
      return false;
    }

    return data.enabled === true;
  } catch (error) {
    console.error('[DevModeCache] Error checking dev mode:', error);
    return false;
  }
}

/**
 * Enable dev mode for a domain and IP address
 * @param {string} domain - Site domain
 * @param {string|null} ipAddress - User IP address
 * @param {number} duration - Duration in milliseconds (default: 24h)
 * @returns {Promise<void>}
 */
export async function enableDevMode(domain, ipAddress = null, duration = DEV_MODE_DURATION) {
  if (!domain) return;

  try {
    const cache = getDevModeCache();

    // Safety check: if cache is null/undefined, skip
    if (!cache || typeof cache.set !== 'function') {
      console.warn('[DevModeCache] Cache not initialized, cannot enable dev mode');
      return;
    }

    const key = getDevModeKey(domain, ipAddress);

    const data = {
      enabled: true,
      domain,
      ipAddress: ipAddress || 'unknown',
      activatedAt: Date.now(),
      expires: Date.now() + duration
    };

    // Store with TTL (auto-expires after duration)
    await cache.set(key, data, duration);

    console.log(`[DevModeCache] Enabled for ${domain} / IP:${ipAddress || 'unknown'} (${Math.round(duration / 1000 / 60)} minutes)`);
  } catch (error) {
    console.error('[DevModeCache] Error enabling dev mode:', error);
  }
}

/**
 * Disable dev mode for a domain and IP address
 * @param {string} domain - Site domain
 * @param {string|null} ipAddress - User IP address
 * @returns {Promise<void>}
 */
export async function disableDevMode(domain, ipAddress = null) {
  if (!domain) return;

  try {
    const cache = getDevModeCache();

    // Safety check: if cache is null/undefined, skip
    if (!cache || typeof cache.delete !== 'function') {
      console.warn('[DevModeCache] Cache not initialized, cannot disable dev mode');
      return;
    }

    const key = getDevModeKey(domain, ipAddress);

    await cache.delete(key);

    console.log(`[DevModeCache] Disabled for ${domain} / IP:${ipAddress || 'unknown'}`);
  } catch (error) {
    console.error('[DevModeCache] Error disabling dev mode:', error);
  }
}

/**
 * Refresh dev mode session (extend TTL)
 * Useful for keeping dev mode active while actively developing
 * @param {string} domain - Site domain
 * @param {string|null} ipAddress - User IP address
 * @param {number} duration - New duration in milliseconds (default: 24h)
 * @returns {Promise<void>}
 */
export async function refreshDevMode(domain, ipAddress = null, duration = DEV_MODE_DURATION) {
  if (!domain) return;

  try {
    const isActive = await isDevModeActive(domain, ipAddress);
    if (isActive) {
      await enableDevMode(domain, ipAddress, duration);
    }
  } catch (error) {
    console.error('[DevModeCache] Error refreshing dev mode:', error);
  }
}

/**
 * Process dev mode from URL search parameters
 * Automatically enables/disables based on ?dev=true/false
 *
 * @param {string} domain - Site domain
 * @param {string|null} ipAddress - User IP address
 * @param {Object} searchParams - URL search parameters
 * @returns {Promise<Object>} { isDev: boolean, action: string }
 */
export async function processDevModeParams(domain, ipAddress = null, searchParams) {
  if (!domain) {
    return { isDev: false, action: 'no-domain' };
  }

  const devParam = searchParams?.dev || searchParams?.get?.('dev');
  const componentTest = searchParams?.c || searchParams?.get?.('c');

  // Explicit dev=true in URL
  if (devParam === 'true' || devParam === '1') {
    await enableDevMode(domain, ipAddress);
    return { isDev: true, action: 'enabled-by-url' };
  }

  // Explicit dev=false in URL (disable dev mode)
  if (devParam === 'false' || devParam === '0') {
    await disableDevMode(domain, ipAddress);
    return { isDev: false, action: 'disabled-by-url' };
  }

  // Component test mode (?c=ComponentName) auto-enables dev mode
  if (componentTest) {
    await enableDevMode(domain, ipAddress);
    return { isDev: true, action: 'enabled-by-component-test' };
  }

  // Check existing dev mode state
  const isActive = await isDevModeActive(domain, ipAddress);
  if (isActive) {
    // Auto-refresh on every page view to keep session alive
    await refreshDevMode(domain, ipAddress);
    return { isDev: true, action: 'active-session' };
  }

  return { isDev: false, action: 'inactive' };
}

/**
 * Get dev mode info for a domain and IP (for debugging)
 * @param {string} domain - Site domain
 * @param {string|null} ipAddress - User IP address
 * @returns {Promise<Object>} Dev mode information
 */
export async function getDevModeInfo(domain, ipAddress = null) {
  if (!domain) {
    return { active: false, error: 'No domain provided' };
  }

  try {
    const cache = getDevModeCache();

    // Safety check: if cache is null/undefined, return inactive
    if (!cache || typeof cache.get !== 'function') {
      return {
        active: false,
        error: 'Cache not initialized',
        domain,
        ipAddress: ipAddress || 'unknown',
        timestamp: Date.now()
      };
    }

    const key = getDevModeKey(domain, ipAddress);
    const data = await cache.get(key);

    if (!data) {
      return {
        active: false,
        domain,
        ipAddress: ipAddress || 'unknown',
        timestamp: Date.now()
      };
    }

    const remainingTime = data.expires - Date.now();

    return {
      active: data.enabled,
      domain: data.domain,
      ipAddress: data.ipAddress,
      activatedAt: data.activatedAt,
      expires: data.expires,
      remainingMinutes: Math.round(remainingTime / 1000 / 60),
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      active: false,
      error: error.message,
      domain,
      ipAddress: ipAddress || 'unknown',
      timestamp: Date.now()
    };
  }
}

/**
 * Clear all dev mode sessions (useful for cleanup)
 * @returns {Promise<number>} Number of sessions cleared
 */
export async function clearAllDevModeSessions() {
  try {
    const cache = getDevModeCache();
    // Clear the entire dev mode cache
    await cache.clear();
    console.log('[DevModeCache] Cleared all dev mode sessions');
    return 0; // Cache doesn't return count
  } catch (error) {
    console.error('[DevModeCache] Error clearing dev mode sessions:', error);
    return 0;
  }
}

// Export convenience object
export default {
  isActive: isDevModeActive,
  enable: enableDevMode,
  disable: disableDevMode,
  refresh: refreshDevMode,
  process: processDevModeParams,
  getInfo: getDevModeInfo,
  clearAll: clearAllDevModeSessions
};
