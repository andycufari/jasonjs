// app/assets/[...path]/route.js
// Serves site assets: local mode reads sites/<domain>/assets/,
// adapter mode (CM64) resolves records that may live in S3

import { NextResponse } from 'next/server';
import { getFileSystem } from '@/core/sites/files.js';
import { resolveSite } from '@/core/sites/resolve';

// MIME type mapping
const MIME_TYPES = {
  // Images
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  'ico': 'image/x-icon',
  'bmp': 'image/bmp',
  'tiff': 'image/tiff',
  'tif': 'image/tiff',

  // Text/Code
  'css': 'text/css; charset=utf-8',
  'js': 'application/javascript; charset=utf-8',
  'mjs': 'application/javascript; charset=utf-8',
  'jsx': 'application/javascript; charset=utf-8',
  'ts': 'application/typescript; charset=utf-8',
  'tsx': 'application/typescript; charset=utf-8',
  'json': 'application/json; charset=utf-8',
  'html': 'text/html; charset=utf-8',
  'xml': 'application/xml; charset=utf-8',
  'txt': 'text/plain; charset=utf-8',
  'md': 'text/markdown; charset=utf-8',
  'yaml': 'text/yaml; charset=utf-8',
  'yml': 'text/yaml; charset=utf-8',

  // Fonts
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'ttf': 'font/ttf',
  'otf': 'font/otf',
  'eot': 'application/vnd.ms-fontobject',

  // Documents
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'zip': 'application/zip',
  'rar': 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  'tar': 'application/x-tar',
  'gz': 'application/gzip',

  // Media
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'ogg': 'video/ogg',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'flac': 'audio/flac',
  'm4a': 'audio/mp4',
  'aac': 'audio/aac',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'wmv': 'video/x-ms-wmv',
  'flv': 'video/x-flv',
  'mkv': 'video/x-matroska',
};

/**
 * Get MIME type from file extension
 */
function getMimeType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Generate ETag for content
 */
function generateETag(content, metadata = {}) {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5');

  if (typeof content === 'string') {
    hash.update(content);
  }

  if (metadata.s3Url) {
    hash.update(metadata.s3Url);
  }

  if (metadata.updatedAt) {
    hash.update(metadata.updatedAt);
  }

  return `"${hash.digest('hex')}"`;
}

/**
 * Get cache headers based on asset type and metadata
 */
function getCacheHeaders(asset, mimeType) {
  const headers = {};
  const hasCDN = !!process.env.NEXT_PUBLIC_ASSET_BASE_URL;

  // For S3 assets or minified files - aggressive caching
  if (asset.assetMetadata?.s3Url || asset.name?.includes('.min.')) {
    if (hasCDN) {
      // With CDN, we can cache more aggressively since CDN handles invalidation
      headers['Cache-Control'] = 'public, max-age=31536000, immutable'; // 1 year
    } else {
      // Without CDN, be more conservative
      headers['Cache-Control'] = 'public, max-age=2592000'; // 30 days
    }
  }
  // For editable text assets - moderate caching
  else if (asset.assetMetadata?.isEditable) {
    headers['Cache-Control'] = 'public, max-age=3600, must-revalidate'; // 1 hour
  }
  // For fonts - long caching
  else if (mimeType.startsWith('font/')) {
    headers['Cache-Control'] = 'public, max-age=31536000'; // 1 year
  }
  // For images and media - optimize based on CDN
  else if (mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
    if (hasCDN) {
      headers['Cache-Control'] = 'public, max-age=31536000'; // 1 year with CDN
    } else {
      headers['Cache-Control'] = 'public, max-age=86400'; // 24 hours without CDN
    }
  }
  // Default caching
  else {
    headers['Cache-Control'] = 'public, max-age=86400'; // 24 hours
  }

  // Add CDN-friendly headers
  if (hasCDN) {
    headers['Vary'] = 'Accept, Accept-Encoding';
    headers['X-CDN-Cache'] = 'MISS'; // CloudFront will override this
  }

  // Add ETag for conditional requests
  if (asset.content || asset.assetMetadata?.s3Url) {
    headers['ETag'] = generateETag(asset.content || '', asset.assetMetadata || {});
  }

  // Add Last-Modified if available
  if (asset.updatedAt) {
    headers['Last-Modified'] = new Date(asset.updatedAt).toUTCString();
  }

  return headers;
}

/**
 * Sanitize path to prevent directory traversal
 */
function sanitizePath(pathSegments) {
  return pathSegments
    .filter(segment => segment && segment !== '.' && segment !== '..')
    .map(segment => segment.replace(/[^a-zA-Z0-9._-]/g, '_'));
}

/**
 * Parse asset path into folder path and filename
 */
function parseAssetPath(pathArray) {
  if (!pathArray || pathArray.length === 0) {
    return { folderPath: '/', fileName: null };
  }

  const sanitized = sanitizePath(pathArray);

  // Last segment is the filename
  const fileName = sanitized[sanitized.length - 1];

  // Everything else is the folder path
  const folderPath = sanitized.length > 1
    ? '/' + sanitized.slice(0, -1).join('/')
    : '/';

  return { folderPath, fileName };
}

/**
 * Serve an asset from the local sites/<domain>/assets/ folder.
 * pathSegments have already been through sanitizePath, so traversal
 * segments are gone before they reach the filesystem.
 */
async function serveLocalAsset(request, host, folderPath, fileName) {
  const { join } = require('path');
  const { stat, readFile } = require('fs/promises');

  const sitesPath = process.env.SITES_PATH || './sites';
  const filePath = join(sitesPath, host, 'assets', folderPath, fileName);

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return new NextResponse('Asset not found', { status: 404 });
  }

  if (!fileStat.isFile()) {
    return new NextResponse('Asset not found', { status: 404 });
  }

  const mimeType = getMimeType(fileName);
  const etag = `"${fileStat.size.toString(16)}-${Math.floor(fileStat.mtimeMs).toString(16)}"`;

  const headers = {
    'Content-Type': mimeType,
    'Content-Length': String(fileStat.size),
    'Cache-Control': 'public, max-age=3600, must-revalidate',
    'ETag': etag,
    'Last-Modified': fileStat.mtime.toUTCString()
  };

  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  const content = await readFile(filePath);
  return new NextResponse(content, { status: 200, headers });
}

/**
 * Main GET handler for assets
 */
export async function GET(request, { params }) {
  try {
    // Await params for Next.js 15 compatibility
    const { path: pathArray } = await params;

    // Get the domain from the request
    const { host } = await resolveSite();

    if (!host) {
      return new NextResponse('Domain not found', { status: 400 });
    }

    // Parse the asset path
    const { folderPath, fileName } = parseAssetPath(pathArray);

    if (!fileName) {
      return new NextResponse('Asset path is required', { status: 400 });
    }

    console.log(`[Assets] Fetching asset: domain=${host}, path=${folderPath}, name=${fileName}`);

    // Get the file system manager
    const fileSystem = getFileSystem();

    // Fetch the asset via the registered adapter (remote storage)
    // Assets are stored with class='asset' in the remote files collection
    let asset = null;

    try {
      const adapter = fileSystem.getAdapter();

      if (adapter) {
        if (typeof adapter.getAsset !== 'function') {
          console.log('[Assets] Registered adapter does not support asset serving');
          return new NextResponse('Asset serving not supported by adapter', { status: 501 });
        }

        // Adapter resolves the site and returns only public, non-folder
        // asset records for this domain (or null when not found)
        asset = await adapter.getAsset(host, { folderPath, fileName });

        if (asset) {
          console.log(`[Assets] Found asset via adapter: ${asset.name}, has S3 URL: ${!!asset.assetMetadata?.s3Url}`);
        }
      } else {
        // Local mode: serve from sites/<domain>/assets/ (path already sanitized)
        return serveLocalAsset(request, host, folderPath, fileName);
      }
    } catch (dbError) {
      console.error('[Assets] Database error:', dbError);
      return new NextResponse('Database error', { status: 500 });
    }

    // Check if asset was found
    if (!asset) {
      // Asset either doesn't exist, is not public, or is not an asset class
      console.log(`[Assets] Asset not found or not public: ${folderPath}/${fileName}`);
      return new NextResponse('Asset not found', { status: 404 });
    }

    // Double-check the asset class (defense in depth)
    if (asset.class !== 'asset') {
      console.log(`[Assets] Rejected non-asset file: ${folderPath}/${fileName} (class: ${asset.class})`);
      return new NextResponse('Asset not found', { status: 404 });
    }

    // Don't serve folders
    if (asset.isFolder) {
      return new NextResponse('Cannot serve folders', { status: 403 });
    }

    // Get MIME type
    const mimeType = asset.assetMetadata?.mimeType || getMimeType(fileName);

    // Get cache headers
    const cacheHeaders = getCacheHeaders(asset, mimeType);

    // Check for conditional request (If-None-Match)
    const clientETag = request.headers.get('if-none-match');
    if (clientETag && cacheHeaders['ETag'] && clientETag === cacheHeaders['ETag']) {
      return new NextResponse(null, { status: 304, headers: cacheHeaders });
    }

    // Serve the asset based on storage type
    if (asset.assetMetadata?.s3Url) {
      // Get CDN URL if configured, otherwise use direct S3 URL
      let finalUrl = asset.assetMetadata.s3Url;

      // Check if we have CDN base URL configured
      const cdnBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL;
      if (cdnBaseUrl && asset.assetMetadata.s3Key) {
        // Replace S3 URL with CDN URL using the s3Key
        finalUrl = `${cdnBaseUrl}/${asset.assetMetadata.s3Key}`;
        console.log(`[Assets] Redirecting to CDN: ${finalUrl}`);
      } else if (cdnBaseUrl && !asset.assetMetadata.s3Key) {
        // Extract key from S3 URL for CDN
        try {
          const s3Url = new URL(asset.assetMetadata.s3Url);
          const s3Key = s3Url.pathname.substring(1); // Remove leading slash
          finalUrl = `${cdnBaseUrl}/${s3Key}`;
          console.log(`[Assets] Redirecting to CDN (extracted key): ${finalUrl}`);
        } catch (error) {
          console.warn(`[Assets] Could not parse S3 URL for CDN: ${asset.assetMetadata.s3Url}`);
          finalUrl = asset.assetMetadata.s3Url;
        }
      } else {
        console.log(`[Assets] Redirecting to S3 (no CDN configured): ${finalUrl}`);
      }

      // Handle query parameters for image optimization
      const url = new URL(request.url);
      const optimizationParams = new URLSearchParams();

      // Extract optimization parameters
      const width = url.searchParams.get('w') || url.searchParams.get('width');
      const height = url.searchParams.get('h') || url.searchParams.get('height');
      const quality = url.searchParams.get('q') || url.searchParams.get('quality');
      const format = url.searchParams.get('f') || url.searchParams.get('format');
      const fit = url.searchParams.get('fit') || url.searchParams.get('resize');

      // Add optimization parameters if CDN supports them
      if (cdnBaseUrl && (width || height || quality || format || fit)) {
        if (width) optimizationParams.set('w', width);
        if (height) optimizationParams.set('h', height);
        if (quality) optimizationParams.set('q', quality);
        if (format) optimizationParams.set('f', format);
        if (fit) optimizationParams.set('fit', fit);

        const queryString = optimizationParams.toString();
        if (queryString) {
          finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryString;
          console.log(`[Assets] CDN with optimizations: ${finalUrl}`);
        }
      }

      return NextResponse.redirect(finalUrl, {
        status: 301, // Permanent redirect for better caching
        headers: {
          ...cacheHeaders,
          'X-CDN-Enabled': cdnBaseUrl ? 'true' : 'false',
          'X-Asset-Source': cdnBaseUrl ? 'cdn' : 's3'
        }
      });
    } else if (asset.content) {
      // Asset content is stored directly in MongoDB
      console.log(`[Assets] Serving from MongoDB: ${fileName} (${mimeType})`);

      // For text-based assets, the content is stored as a string
      // For binary assets that were base64 encoded, we need to decode
      let responseBody = asset.content;

      // Check if content is base64 encoded (for small binary files stored in MongoDB)
      if (asset.assetMetadata?.encoding === 'base64') {
        responseBody = Buffer.from(asset.content, 'base64');
      }

      return new NextResponse(responseBody, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'X-Asset-Source': 'mongodb',
          ...cacheHeaders
        }
      });
    } else {
      // Asset has no content or S3 URL
      console.error(`[Assets] Asset has no content or S3 URL: ${fileName}`);
      return new NextResponse('Asset content not available', { status: 404 });
    }

  } catch (error) {
    console.error('[Assets] Unexpected error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

// Support HEAD requests for efficient caching checks
export async function HEAD(request, params) {
  const response = await GET(request, params);
  // Return headers only, no body
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers
  });
}