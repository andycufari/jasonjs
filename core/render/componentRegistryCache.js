// core/render/componentRegistryCache.js
// Shared component registry cache between metadata and renderPage

import { cache } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('ComponentRegistry');

/**
 * Generate cache key from page configuration
 */
function generateCacheKey(page, isDev) {
  // In dev mode, use timestamp to bypass cache
  if (isDev) {
    return `dev_${Date.now()}`;
  }

  // Create stable cache key from page components
  const components = page.components || [];
  const componentNames = extractComponentNames(components);
  const key = `${page.site_id || 'default'}_${page.version || 'latest'}_${componentNames.join(',')}`;

  return key;
}

/**
 * Extract component names from page structure
 */
function extractComponentNames(components) {
  const names = new Set();

  function extract(item) {
    if (Array.isArray(item)) {
      item.forEach(extract);
    } else if (typeof item === 'object' && item !== null) {
      if (item.component && typeof item.component === 'string') {
        names.add(item.component);
      }
      if (Array.isArray(item.components)) {
        item.components.forEach(extract);
      }
    }
  }

  extract(components);
  return Array.from(names).sort();
}

/**
 * Internal cached component loader
 * Uses React's cache() to share registry between metadata and renderPage
 */
const getComponentsInternal = cache(async (cacheKey, page, getComponentsFn) => {
  logger.debug(`Loading component registry`, { cacheKey });

  const startTime = Date.now();
  const registry = await getComponentsFn(page);
  const duration = Date.now() - startTime;

  logger.perf('Component registry loaded', duration);

  return registry;
});

/**
 * Get cached component registry
 * Shared between generateMetadata() and renderPage() to avoid duplicate loading
 *
 * @param {Object} page - Page configuration
 * @param {Function} getComponentsFn - Function to load components (from components.js)
 * @param {boolean} isDev - Development mode flag
 * @returns {Object} Component registry
 */
export async function getCachedComponentRegistry(page, getComponentsFn, isDev = false) {
  const cacheKey = generateCacheKey(page, isDev);

  if (isDev) {
    logger.debug('Dev mode: bypassing component registry cache');
  }

  return getComponentsInternal(cacheKey, page, getComponentsFn);
}

export default getCachedComponentRegistry;
