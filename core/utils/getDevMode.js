/**
 * Centralized Dev Mode Detection
 *
 * Single source of truth for dev mode state across the entire framework.
 * Uses Redis-backed cache (devModeCache.js) to store dev mode state per domain + IP.
 *
 * Dev mode can be enabled via:
 * - URL parameter: ?dev=true or ?dev=1
 * - Persists for 24 hours in Redis cache
 * - Per-IP security (prevents random users from disabling cache for everyone)
 *
 * Usage:
 * ```javascript
 * import { getDevMode } from '@/core/utils/getDevMode.js';
 *
 * const isDev = await getDevMode(domain, clientIp);
 * if (isDev) {
 *   // Bypass all caches
 * }
 * ```
 */

import { isDevModeActive, processDevModeParams } from './devModeCache.js';

/**
 * Get current dev mode state for a domain + IP combination
 *
 * @param {string} domain - Domain to check dev mode for
 * @param {string|null} ipAddress - Client IP address (for security)
 * @returns {Promise<boolean>} True if dev mode is active
 */
export async function getDevMode(domain, ipAddress = null) {
  // Check NODE_ENV first (instant, no Redis call)
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Check Redis-based dev mode for this specific domain + IP
  if (domain) {
    return await isDevModeActive(domain, ipAddress);
  }

  return false;
}

/**
 * Process dev mode parameters from URL and update Redis cache
 * Use this in API routes and rendering pipeline to handle ?dev=true
 *
 * @param {string} domain - Domain
 * @param {string|null} ipAddress - Client IP address
 * @param {Object} searchParams - URL search parameters
 * @returns {Promise<Object>} { isDev: boolean, reason: string, cookieToSet: string|null }
 */
export async function processDevMode(domain, ipAddress, searchParams) {
  return await processDevModeParams(domain, ipAddress, searchParams);
}

/**
 * Simple check for dev mode (convenience wrapper)
 * Use this when you already have domain and IP
 *
 * @param {string} domain - Domain
 * @param {string|null} ipAddress - Client IP address
 * @returns {Promise<boolean>} True if dev mode is active
 */
export async function isDevMode(domain, ipAddress = null) {
  return await getDevMode(domain, ipAddress);
}

// Export for backward compatibility
export { isDevModeActive, processDevModeParams } from './devModeCache.js';

export default {
  get: getDevMode,
  process: processDevMode,
  isActive: isDevMode
};
