// core/databases/notion/imageCache.js
//
// Shared, on-disk cache for Notion media (images/audio) fetched through
// /api/proxy/image and /api/proxy/audio.
//
// WHY THIS EXISTS
// ---------------
// Notion serves files behind AWS S3 *presigned* URLs that expire after 1 hour
// (X-Amz-Expires=3600). The signature baked into a rendered page is frozen at
// render time, so once it expires the URL 403s. To survive that, the proxy
// caches the raw bytes keyed on the *signature-stripped* URL (getNormalizedUrl),
// which is stable across signatures.
//
// The cache key logic MUST be identical between the proxy route and the
// render-time warmer (core/databases/notion/index.js), otherwise the warmer
// writes to a key the proxy never reads. Keeping both on this module is the
// only thing that guarantees they agree — do not fork this logic.
import { existsSync, mkdirSync } from 'fs';
import { writeFile, readFile, stat } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const CACHE_DIR = path.join(process.cwd(), '.image-cache');

// Ensure cache directory exists (best-effort; failures are non-fatal).
if (!existsSync(CACHE_DIR)) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create image cache directory:', error);
  }
}

// Strip AWS/Notion signature params so the same underlying file maps to one
// stable cache key regardless of which presigned URL delivered it.
export function getNormalizedUrl(url) {
  try {
    const parsedUrl = new URL(url);

    if (
      url.includes('amazonaws.com') ||
      url.includes('prod-files-secure.s3') ||
      url.includes('notion.so')
    ) {
      const signatureParams = [
        'X-Amz-Signature',
        'X-Amz-Date',
        'X-Amz-SignedHeaders',
        'X-Amz-Expires',
        'X-Amz-Algorithm',
        'X-Amz-Credential',
        'X-Amz-Security-Token',
      ];
      signatureParams.forEach((param) => parsedUrl.searchParams.delete(param));
      return parsedUrl.origin + parsedUrl.pathname;
    }

    return url;
  } catch (e) {
    console.warn('Error normalizing URL:', e);
    return url;
  }
}

export function getCacheKey(url) {
  return crypto.createHash('md5').update(getNormalizedUrl(url)).digest('hex');
}

export function getCachePath(url) {
  return path.join(CACHE_DIR, getCacheKey(url));
}

// Read cached bytes for a URL. Returns { cacheHit, data, contentType }.
export async function getFromCache(url) {
  try {
    const cachePath = getCachePath(url);
    await stat(cachePath); // throws if missing

    let contentType = 'image/jpeg';
    try {
      const metadata = JSON.parse(await readFile(`${cachePath}.meta`, 'utf8'));
      contentType = metadata.contentType;
    } catch (e) {
      // Missing metadata → fall back to default content type.
    }

    const data = await readFile(cachePath);
    return { data, contentType, cacheHit: true };
  } catch (error) {
    return { cacheHit: false };
  }
}

// Does a cache entry already exist for this URL? (cheap stat, no read)
export async function isCached(url) {
  try {
    await stat(getCachePath(url));
    return true;
  } catch {
    return false;
  }
}

export async function saveToCache(url, data, contentType) {
  try {
    const cachePath = getCachePath(url);
    await writeFile(cachePath, data);
    await writeFile(
      `${cachePath}.meta`,
      JSON.stringify({
        url: getNormalizedUrl(url),
        contentType,
        cachedAt: new Date().toISOString(),
      })
    );
    return true;
  } catch (error) {
    console.error('Failed to cache media:', error);
    return false;
  }
}

// Minimal magic-number check so we never cache an error page as an "image".
export function isValidImage(data, contentType) {
  if (!data || data.length < 4) return false;
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return true; // PNG
  if (data[0] === 0xff && data[1] === 0xd8) return true; // JPEG
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return true; // GIF
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) return true; // WEBP (RIFF)
  if (contentType === 'image/svg+xml' || contentType === 'application/svg+xml') {
    const svgString = data.toString('utf8', 0, Math.min(data.length, 1000));
    return svgString.includes('<svg') || svgString.includes('<?xml');
  }
  return false;
}
