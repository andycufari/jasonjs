// components/plugins/notion-blog/utils/mediaProxy.js
// Notion media proxy utilities

/**
 * Check if a URL is from Notion's secured sources
 */
export function isNotionSecuredUrl(url) {
  if (!url) return false;
  return url.includes('s3.us-west-2.amazonaws.com') ||
         url.includes('prod-files-secure.s3') ||
         url.includes('s3.amazonaws.com') ||
         url.includes('notion.so') ||
         url.includes('file.notion.so');
}

/**
 * Check if URL is already a proxy URL (to avoid double transformation)
 */
export function isAlreadyProxyUrl(url) {
  if (!url) return false;
  return url.startsWith('/api/proxy/image?url=') ||
         url.startsWith('/api/proxy/audio?url=');
}

/**
 * Decode HTML entities from URL
 */
export function decodeHtmlEntities(url) {
  if (!url) return '';
  return url.replace(/&amp;/g, '&')
           .replace(/&quot;/g, '"')
           .replace(/&lt;/g, '<')
           .replace(/&gt;/g, '>')
           .replace(/&#x2F;/g, '/');
}

/**
 * Prepare URL for image proxy
 */
export function prepareImageProxyUrl(url) {
  const decodedUrl = decodeHtmlEntities(url);
  return `/api/proxy/image?url=${encodeURIComponent(decodedUrl)}`;
}

/**
 * Prepare URL for audio proxy
 */
export function prepareAudioProxyUrl(url) {
  const decodedUrl = decodeHtmlEntities(url);
  return `/api/proxy/audio?url=${encodeURIComponent(decodedUrl)}`;
}

/**
 * Main function to process media URL for Notion sources
 * Automatically detects if proxy is needed and applies appropriate transformation
 */
export function processNotionMediaUrl(url, mediaType = 'image') {
  if (!url) return '';

  // If already proxied, return as-is
  if (isAlreadyProxyUrl(url)) {
    return url;
  }

  // If it's a Notion secured URL, proxy it
  if (isNotionSecuredUrl(url)) {
    return mediaType === 'audio' ? prepareAudioProxyUrl(url) : prepareImageProxyUrl(url);
  }

  // Otherwise, return as-is
  return url;
}
