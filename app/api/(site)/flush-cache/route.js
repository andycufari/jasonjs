import { NextResponse } from 'next/server';
import { getAllCaches, clearAllCaches, getCache } from '../../../../core/utils/cache.js';
import { getFileSystem } from '../../../../core/sites/files.js';

/**
 * Cache flush API endpoint
 * Provides manual cache invalidation for the unified cache system
 * (FileSystem, JasonDB, PageData, ...)
 *
 * Query parameters:
 * - domain: Flush cache entries for specific domain
 * - component: Flush cache entries for specific component
 * - site: Flush cache entries for specific site (alias of domain)
 * - all: Flush all caches (set to 'true')
 */

/**
 * Get CORS headers
 * Only allows requests from startupstudio.build domain
 */
function getCorsHeaders(origin) {
  const allowedOrigins = [
    'https://build.cm64.io',
    'http://localhost:3044', // For local development
  ];

  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowed => origin?.startsWith(allowed));

  if (isAllowed) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    };
  }

  return {};
}

/**
 * Collect statistics from all registered unified caches
 * (getAllCaches already returns { name: stats } for every registered cache)
 */
function getAllCacheStats() {
  return getAllCaches();
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}
export async function POST(request) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');
    const component = url.searchParams.get('component');
    const site = url.searchParams.get('site');
    const all = url.searchParams.get('all');

    let result = { cleared: 0, message: 'No action taken' };

    if (all === 'true') {
      // Clear all unified caches (FileSystem, JasonDB, PageData, etc.)
      await clearAllCaches();

      result = {
        cleared: 'all',
        message: 'Cleared all caches (filesystem, database, pagedata)'
      };
    } else if (domain || site) {
      // Clear cache entries for a specific domain/site
      const target = domain || site;
      const cleared = await getFileSystem().invalidateDomainCache(target);
      result = {
        cleared,
        message: `Cleared ${cleared} cache entries for domain: ${target}`
      };
    } else if (component) {
      // Clear cache entries for a specific component across all domains
      const fileSystemCache = getCache('FileSystem');
      const cleared = fileSystemCache ? await fileSystemCache.invalidate(component) : 0;
      result = {
        cleared,
        message: `Cleared ${cleared} cache entries for component: ${component}`
      };
    } else {
      // Nothing to sweep manually — unified caches are TTL-managed
      result = {
        cleared: 0,
        message: 'No action taken (caches are TTL-managed; pass all/domain/component)'
      };
    }

    // Get updated cache stats
    const stats = getAllCacheStats();

    return NextResponse.json({
      success: true,
      ...result,
      stats
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Cache flush error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

/**
 * Get cache statistics
 */
export async function GET(request) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const stats = getAllCacheStats();

    return NextResponse.json({
      success: true,
      stats,
      endpoints: {
        clearAll: 'POST /api/flush-cache?all=true',
        clearDomain: 'POST /api/flush-cache?domain=example.com',
        clearComponent: 'POST /api/flush-cache?component=ComponentName',
        clearSite: 'POST /api/flush-cache?site=siteId'
      }
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}
