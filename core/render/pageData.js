// core/render/pageData.js
// Shared, cached page data fetching to prevent duplicate queries
// between generateMetadata() and renderPage()

import { loadPageDefinition } from '../render/loadPage';
import Database from '../db';
import { sanitizeData, decodeSafeEntities } from '../security/sanitize';
import { processTemplates } from './templates';
import { createCache, CacheStrategy, CacheTTL } from '../utils/cache.js';
import { replaceTemplateVars } from '../render/templateVars.js';

/**
 * Promise cache for deduplicating parallel requests
 * React's cache() doesn't work for parallel calls, so we use a Map
 */
const promiseCache = new Map();

/**
 * Persistent data cache for page data
 * This provides real caching beyond just promise deduplication
 */
const pageDataCache = createCache('PageData', {
  // strategy auto-detects Redis if REDIS_URL is set
  ttl: CacheTTL.SHORT, // 1 minute
  respectDevMode: true,
  maxSize: 100,
  keyPrefix: 'pagedata'
});

/**
 * Internal function that actually fetches and processes page data
 */
async function fetchPageData(params, searchParams, options = {}) {
  const { authenticatedUser = null } = options;

  // 1. Get base page configuration
  let page = await loadPageDefinition({ params, searchParams });

  if (!page) {
    return null;
  }

  // Handle special page types that don't need data fetching
  // These are error pages (site-not-found, page-not-found, page-error) that should pass through
  if (page.type === 'site-not-found' || page.type === 'page-not-found' || page.type === 'page-error') {
    return {
      page,
      dataContext: {},
      isDev: page.isDev || false
    };
  }

  // 2. Process dev mode BEFORE data fetching (needed for cache control)
  // This ensures dev mode works even for pages without fetch_data
  const resolvedSearchParams = await searchParams;
  const { processDevModeParams } = await import('../utils/devModeCache.js');
  const { headers } = await import('next/headers');
  const { getClientIp } = await import('../utils/getClientIp.js');

  // Get domain and client IP from headers
  const headersList = await headers();
  const domain = headersList.get('x-forwarded-host') || headersList.get('host') || '';
  const clientIp = getClientIp(headersList);

  // Process dev mode params (auto-enables/disables in Redis per IP)
  const devModeResult = await processDevModeParams(domain, clientIp, resolvedSearchParams);
  const isDevMode = devModeResult.isDev;

  // 3. Fetch data if required
  let dataContext = {};

  if (page.fetch_data) {
    const combinedParams = {
      ...page.params,
      ...resolvedSearchParams
    };

    const databaseContext = {
      session: authenticatedUser ? { user: authenticatedUser } : null,
      siteId: page.site_id || null,
      domain: domain, // For resolving site-specific env vars
      databaseSchemas: page.databaseSchemas || {},
      devMode: isDevMode // Pass dev mode to entire database context
    };

    const database = new Database(page.database, combinedParams, databaseContext);

    // Helper function to replace params in fetch config using unified utility
    const replaceParamsInConfig = (config) => {
      return replaceTemplateVars(config, {
        params: combinedParams,
        user: authenticatedUser
      });
    };

    if (Array.isArray(page.fetch_data)) {
      // Handle array of fetch configs
      for (const fetchConfig of page.fetch_data) {
        database.select(fetchConfig.database);

        // Replace params in fetch config before using
        const processedConfig = replaceParamsInConfig(fetchConfig);

        // Normalize query/filters field naming (support both for compatibility)
        if (processedConfig.query && !processedConfig.filters) {
          processedConfig.filters = processedConfig.query;
          delete processedConfig.query;
        }

        // Normalize orderBy to sort (consistency with fluent API: app.db.query().orderBy())
        if (processedConfig.orderBy && !processedConfig.sort) {
          processedConfig.sort = processedConfig.orderBy;
          delete processedConfig.orderBy;
        }

        // Handle join control from fetch config
        // Allow disabling joins with "join": false or "joins": false
        if (fetchConfig.join === false || fetchConfig.joins === false) {
          processedConfig.disableJoins = true;
        }

        // Check if search parameter is provided and use intelligent search method
        let fetchedData;
        if (processedConfig.search && processedConfig.search.trim().length > 0) {
          // Use intelligent search method (doesn't require text index)
          const limit = processedConfig.limit || 50;
          const filters = processedConfig.filters || {};
          const searchResults = await database.search(processedConfig.search, limit, filters);
          fetchedData = {
            success: true,
            data: searchResults
          };
        } else {
          // Use standard fetch for non-search queries
          fetchedData = await database.fetch(processedConfig);
        }

        const actualData = fetchedData.success ? fetchedData.data : [];
        const sanitizedData = sanitizeData(actualData);
        const decodedData = decodeSafeEntities(sanitizedData);
        const contextKey = fetchConfig.id ? fetchConfig.id : fetchConfig.database;

        if (fetchConfig.findOne === true) {
          dataContext[contextKey] = decodedData.length > 0 ? decodedData[0] : {};
        } else {
          dataContext[contextKey] = decodedData;
        }
      }
    } else if (page.fetch_data.database || page.fetch_data.type) {
      // Handle single fetch config (legacy format with database/type at root)
      const fetchConfig = page.fetch_data;
      database.select(fetchConfig.database);

      // Replace params in fetch config before using
      const processedConfig = replaceParamsInConfig(fetchConfig);

      // Normalize query/filters field naming (support both for compatibility)
      if (processedConfig.query && !processedConfig.filters) {
        processedConfig.filters = processedConfig.query;
        delete processedConfig.query;
      }

      // Normalize orderBy to sort (consistency with fluent API: app.db.query().orderBy())
      if (processedConfig.orderBy && !processedConfig.sort) {
        processedConfig.sort = processedConfig.orderBy;
        delete processedConfig.orderBy;
      }

      // Handle join control from fetch config
      // Allow disabling joins with "join": false or "joins": false
      if (fetchConfig.join === false || fetchConfig.joins === false) {
        processedConfig.disableJoins = true;
      }

      // Check if search parameter is provided and use intelligent search method
      let fetchedData;
      if (processedConfig.search && processedConfig.search.trim().length > 0) {
        // Use intelligent search method (doesn't require text index)
        const limit = processedConfig.limit || 50;
        const filters = processedConfig.filters || {};
        const searchResults = await database.search(processedConfig.search, limit, filters);
        fetchedData = {
          success: true,
          data: searchResults
        };
      } else {
        // Use standard fetch for non-search queries
        fetchedData = await database.fetch(processedConfig);
      }

      const actualData = fetchedData.success ? fetchedData.data : [];
      const sanitizedData = sanitizeData(actualData);
      const decodedData = decodeSafeEntities(sanitizedData);

      if (fetchConfig.findOne === true) {
        dataContext[fetchConfig.database] = decodedData.length > 0 ? decodedData[0] : {};
      } else {
        dataContext[fetchConfig.database] = decodedData;
      }
    } else {
      // Handle object with named data sources (new format)
      // { categories: { database: "...", query: {...} }, posts: {...} }
      for (const [dataKey, fetchConfig] of Object.entries(page.fetch_data)) {
        database.select(fetchConfig.database);

        // Replace params in fetch config before using
        const processedConfig = replaceParamsInConfig(fetchConfig);

        // Normalize query/filters field naming (support both for compatibility)
        if (processedConfig.query && !processedConfig.filters) {
          processedConfig.filters = processedConfig.query;
          delete processedConfig.query;
        }

        // Normalize orderBy to sort (consistency with fluent API: app.db.query().orderBy())
        if (processedConfig.orderBy && !processedConfig.sort) {
          processedConfig.sort = processedConfig.orderBy;
          delete processedConfig.orderBy;
        }

        // Handle join control from fetch config
        // Allow disabling joins with "join": false or "joins": false
        if (fetchConfig.join === false || fetchConfig.joins === false) {
          processedConfig.disableJoins = true;
        }

        // Check if search parameter is provided and use intelligent search method
        let fetchedData;
        if (processedConfig.search && processedConfig.search.trim().length > 0) {
          // Use intelligent search method (doesn't require text index)
          const limit = processedConfig.limit || 50;
          const filters = processedConfig.filters || {};
          const searchResults = await database.search(processedConfig.search, limit, filters);
          fetchedData = {
            success: true,
            data: searchResults
          };
        } else {
          // Use standard fetch for non-search queries
          fetchedData = await database.fetch(processedConfig);
        }

        // Debug: trace fetch result for troubleshooting
        if (isDevMode) {
          const dataType = fetchedData.data === null ? 'null' : Array.isArray(fetchedData.data) ? `array[${fetchedData.data.length}]` : typeof fetchedData.data;
          const hasBlocks = fetchedData.data?.blocks ? fetchedData.data.blocks.length : 'no blocks';
          console.log(`[pageData] fetch "${dataKey}": success=${fetchedData.success}, type=${dataType}, blocks=${hasBlocks}`);
          if (!fetchedData.success) {
            console.log(`[pageData] fetch error for "${dataKey}":`, fetchedData.error);
          }
        }

        const actualData = fetchedData.success ? fetchedData.data : [];
        const sanitizedData = sanitizeData(actualData);
        const decodedData = decodeSafeEntities(sanitizedData);

        // Use the named key from fetch_data object
        if (fetchConfig.findOne === true || fetchConfig.single === true) {
          // If decodedData is already a single object (e.g., fetchType: 'page'), use it directly
          // Otherwise, take the first element from the array
          if (Array.isArray(decodedData)) {
            dataContext[dataKey] = decodedData.length > 0 ? decodedData[0] : {};
          } else {
            dataContext[dataKey] = decodedData || {};
          }
        } else {
          dataContext[dataKey] = decodedData;
        }
      }
    }
  }

  // 4. Process all template variables ({{listing[0].title}}, etc.)
  page = processTemplates(page, dataContext);

  // 5. Return processed page, data context, and dev mode flag
  return {
    page,
    dataContext,
    isDev: isDevMode // Expose dev mode flag for downstream consumers
  };
}

/**
 * Public function that deduplicates parallel requests
 * Fetches and processes page data with template variable replacement.
 *
 * @param {Object} params - Next.js params object
 * @param {Object} searchParams - Next.js searchParams object
 * @param {Object} options - Additional options (e.g., authenticatedUser)
 * @returns {Promise<Object>} Processed page object with resolved templates
 */
export async function getPageData({ params, searchParams }, options = {}) {
  // Await params to get stable values for cache key
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;

  // Get domain for cache key isolation (CRITICAL FOR MULTI-TENANCY)
  const { resolveSite } = await import('../sites/resolve');
  const { host: domain } = await resolveSite();

  // Create stable cache key from serializable values
  // CRITICAL: Include domain to prevent cross-site cache pollution
  // Also include user ID to prevent auth/no-auth cache conflicts
  const cacheKey = JSON.stringify({
    domain: domain,
    slug: resolvedParams?.slug || [],
    search: resolvedSearch || {},
    userId: options.authenticatedUser?.id || null
  });

  // Check dev mode for cache bypass
  const isDev = resolvedSearch?.dev === 'true' || resolvedSearch?.dev === '1';

  // LAYER 1: Check persistent data cache first (fastest)
  const dataCacheKey = pageDataCache.generateKey(cacheKey);
  const cachedData = await pageDataCache.get(dataCacheKey, isDev);
  if (cachedData !== null) {
    return cachedData;
  }

  // LAYER 2: Check if we already have a pending promise for this key (parallel deduplication)
  // Skip promiseCache in dev mode — it can return stale promises from non-dev requests
  if (!isDev && promiseCache.has(cacheKey)) {
    return promiseCache.get(cacheKey);
  }

  // Safety valve: prevent unbounded growth of promiseCache
  if (promiseCache.size > 1000) {
    promiseCache.clear();
  }

  // LAYER 3: Create new promise and cache it
  const promise = fetchPageData(params, searchParams, options);
  if (!isDev) {
    promiseCache.set(cacheKey, promise);
  }

  // Wait for result
  const result = await promise;

  // Store in persistent cache (1 minute TTL)
  await pageDataCache.set(dataCacheKey, result, null, isDev);

  // Clean up promise cache after requests complete
  // EXTENDED from 100ms to 30 seconds to cover metadata + render cycle
  // This prevents double render when Next.js calls generateMetadata() and Page() in parallel
  setTimeout(() => {
    promiseCache.delete(cacheKey);
  }, 30000);  // 30 seconds - covers full render cycle

  return result;
}
