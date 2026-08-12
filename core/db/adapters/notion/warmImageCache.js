// core/databases/notion/warmImageCache.js
//
// Downloads Notion media into the proxy's on-disk cache AT RENDER TIME, while
// the presigned S3 signature is still fresh (we've just fetched the blocks, so
// the URLs are seconds old). This guarantees the proxy cache is warm before any
// visitor arrives, so the 1-hour signature expiry can never produce a blank
// image — the proxy serves cached bytes regardless of the frozen signature.
//
// It walks RAW Notion blocks/page objects (not transformed ones) so it can find
// every `*.file.url` no matter which block/property type carries it.
import { getFromCache, saveToCache, isValidImage } from './imageCache';

const isNotionSecuredUrl = (url) =>
  typeof url === 'string' &&
  (url.includes('s3.us-west-2.amazonaws.com') ||
    url.includes('prod-files-secure.s3') ||
    url.includes('s3.amazonaws.com') ||
    url.includes('file.notion.so'));

// Recursively collect every Notion-secured file URL in an arbitrary object.
function collectSignedUrls(node, out) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) collectSignedUrls(item, out);
    return;
  }

  // Notion file objects look like { type: 'file', file: { url, expiry_time } }.
  if (node.file && typeof node.file.url === 'string' && isNotionSecuredUrl(node.file.url)) {
    out.add(node.file.url);
  }

  for (const key of Object.keys(node)) {
    const value = node[key];
    if (value && typeof value === 'object') collectSignedUrls(value, out);
  }
}

async function warmOne(url) {
  try {
    // Already have bytes for this file's stable (signature-stripped) key.
    const cached = await getFromCache(url);
    if (cached.cacheHit) return;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StartupStudio/1.0)', Accept: 'image/*,*/*' },
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!response.ok) {
      console.warn(`warmImageCache: fetch ${response.status} for ${url.slice(0, 80)}`);
      return;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    // Only cache real image bytes for image types; audio/other pass through
    // (content-type-gated so we don't reject valid audio via image magic checks).
    const isImageType = contentType.startsWith('image/');
    if (isImageType && !isValidImage(buffer, contentType)) {
      console.warn(`warmImageCache: not a valid image for ${url.slice(0, 80)}`);
      return;
    }

    await saveToCache(url, buffer, contentType);
  } catch (error) {
    console.warn('warmImageCache: error warming', url.slice(0, 80), error?.message);
  }
}

// Fire-and-forget: warm the cache for every signed URL found in `sources`
// (raw blocks array, page object, or any mix). Bounded concurrency so a
// media-heavy page doesn't open hundreds of sockets at once.
export async function warmImageCache(...sources) {
  const urls = new Set();
  for (const source of sources) collectSignedUrls(source, urls);
  if (urls.size === 0) return;

  const list = [...urls];
  const CONCURRENCY = 6;
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    await Promise.all(list.slice(i, i + CONCURRENCY).map(warmOne));
  }
}
