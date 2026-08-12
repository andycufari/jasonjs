import { NextResponse } from 'next/server';
import { resolveSite } from '@/core/sites/resolve';
import { getClientIpFromRequest } from '@/core/utils/getClientIp.js';
import { isDevModeActive, getDevModeInfo } from '@/core/utils/devModeCache.js';

/**
 * Dev Mode Debug Endpoint
 *
 * Helps diagnose why ?dev=true might not be working
 *
 * Usage: Visit this endpoint with ?dev=true to see debug info
 * Example: http://yoursite.com/api/dev-mode-debug?dev=true
 */

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const { host: domain } = await resolveSite(request);
    const clientIp = getClientIpFromRequest(request);
    const devParam = url.searchParams.get('dev');

    // Check current dev mode status
    const isActive = await isDevModeActive(domain, clientIp);
    const devInfo = await getDevModeInfo(domain, clientIp);

    // Get all cache instances and their stats
    const { getCache, getAllCaches } = await import('@/core/utils/cache.js');

    // Get all registered caches
    const allCacheStats = getAllCaches();

    // Also try to get specific caches
    const cacheNames = ['FileSystem', 'ComponentBundles', 'PageData', 'JasonDB', 'DevMode'];
    const cacheStats = {};

    for (const name of cacheNames) {
      const cache = getCache(name);
      if (cache) {
        cacheStats[name] = {
          ...cache.getStats(),
          respectDevMode: cache.config.respectDevMode,
          strategy: cache.config.strategy
        };
      } else {
        cacheStats[name] = { error: 'Cache not found in registry' };
      }
    }

    return NextResponse.json({
      success: true,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        MODE: process.env.MODE,
        REDIS_URL: process.env.REDIS_URL ? 'SET' : 'NOT SET'
      },
      request: {
        domain,
        clientIp: clientIp || 'NOT DETECTED',
        devParam,
        url: request.url,
        headers: {
          'x-forwarded-for': request.headers.get('x-forwarded-for'),
          'x-real-ip': request.headers.get('x-real-ip'),
          'cf-connecting-ip': request.headers.get('cf-connecting-ip')
        }
      },
      devMode: {
        isActive,
        info: devInfo,
        shouldBypassCache: isActive || process.env.NODE_ENV === 'development'
      },
      cacheStats,
      allCacheStats,
      instructions: {
        enable: 'Visit any page with ?dev=true',
        disable: 'Visit any page with ?dev=false',
        check: 'GET /api/dev-mode-debug',
        flush: 'POST /api/flush-cache?all=true'
      }
    });

  } catch (error) {
    console.error('[DevModeDebug] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
