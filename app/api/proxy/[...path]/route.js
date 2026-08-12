/**
 * Path-based Asset Proxy - /api/proxy/[...path]
 *
 * Proxies external assets using path-based URLs instead of query params.
 * This is needed for libraries like js-dos that concatenate paths to a prefix.
 *
 * Usage: /api/proxy/ext/v8.js-dos.com/latest/emulators.js
 *
 * The library can set pathPrefix to "/api/proxy/ext/v8.js-dos.com/latest/"
 * and then request "emulators.js" which becomes:
 * /api/proxy/ext/v8.js-dos.com/latest/emulators.js
 *
 * Format: /api/proxy/ext/{domain}/{path}
 * - "ext" prefix indicates external HTTPS URL
 * - Avoids Next.js URL normalization issues with https://
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Content type mapping
const CONTENT_TYPES = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

// In-memory cache
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function GET(request, context) {
  try {
    // In Next.js 15+, params must be awaited before accessing properties
    const { path: pathSegments } = await context.params;

    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 });
    }

    let targetUrl;

    // Check for "ext" prefix format: /api/proxy/ext/domain.com/path
    if (pathSegments[0] === 'ext') {
      // Format: ['ext', 'v8.js-dos.com', 'latest', 'emulators.js']
      // Reconstruct: https://v8.js-dos.com/latest/emulators.js
      const [, domain, ...rest] = pathSegments;
      if (!domain) {
        return NextResponse.json({ error: 'Missing domain after ext/' }, { status: 400 });
      }
      targetUrl = `https://${domain}/${rest.join('/')}`;
    } else {
      // Legacy format: try to handle https://domain/path (may not work due to Next.js normalization)
      // Path looks like: ['https:', 'v8.js-dos.com', 'latest', 'emulators.js']
      targetUrl = pathSegments.join('/');
      // Fix the protocol (https: becomes https:/)
      targetUrl = targetUrl.replace(/^(https?):\/+/, '$1://');
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL: ' + targetUrl }, { status: 400 });
    }

    // Only allow HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only HTTPS URLs allowed' }, { status: 400 });
    }

    // Get extension for content type
    const pathname = parsedUrl.pathname.toLowerCase();
    const extension = Object.keys(CONTENT_TYPES).find(ext => pathname.endsWith(ext));

    // Check cache
    const cached = cache.get(targetUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new NextResponse(cached.body, {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=3600',
          'X-Proxy-Cache': 'HIT',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Fetch the asset
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'JasonJS-Proxy/1.0',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: response.status }
      );
    }

    const body = await response.arrayBuffer();
    const contentType = extension
      ? CONTENT_TYPES[extension]
      : response.headers.get('content-type') || 'application/octet-stream';

    // Cache
    cache.set(targetUrl, {
      body: Buffer.from(body),
      contentType,
      timestamp: Date.now()
    });

    // Cleanup old entries
    if (cache.size > 200) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Proxy-Cache': 'MISS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      }
    });

  } catch (error) {
    console.error('Path proxy error:', error);
    return NextResponse.json({ error: 'Proxy failed: ' + error.message }, { status: 500 });
  }
}
