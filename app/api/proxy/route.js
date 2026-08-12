/**
 * Generic Asset Proxy - /api/proxy
 *
 * Proxies external assets (JS, CSS, fonts, WASM) through our domain to bypass CSP.
 * Simple pass-through with caching - no special handling needed.
 *
 * Usage: /api/proxy?url=https://example.com/script.js
 *
 * For assets that need special handling, use:
 * - /api/proxy/image - Images with Notion/AWS support, validation
 * - /api/proxy/audio - Audio with range requests, format detection
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Allowed file types for generic proxy
const ALLOWED_EXTENSIONS = [
  '.js', '.mjs',           // Scripts
  '.css',                   // Styles
  '.wasm', '.data',        // WebAssembly
  '.json',                  // Data
  '.woff', '.woff2', '.ttf', '.otf', '.eot'  // Fonts
];

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
  '.eot': 'application/vnd.ms-fontobject'
};

// In-memory cache
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Only allow HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only HTTPS URLs allowed' }, { status: 400 });
    }

    // Check extension
    const pathname = parsedUrl.pathname.toLowerCase();
    const extension = ALLOWED_EXTENSIONS.find(ext => pathname.endsWith(ext));

    if (!extension) {
      return NextResponse.json(
        { error: `File type not allowed. Use /api/proxy/image or /api/proxy/audio for media.` },
        { status: 400 }
      );
    }

    // Check cache
    const cached = cache.get(targetUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new NextResponse(cached.body, {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=3600',
          'X-Proxy-Cache': 'HIT'
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
    const contentType = CONTENT_TYPES[extension] || 'application/octet-stream';

    // Cache
    cache.set(targetUrl, {
      body: Buffer.from(body),
      contentType,
      timestamp: Date.now()
    });

    // Cleanup old entries
    if (cache.size > 100) {
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
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}
