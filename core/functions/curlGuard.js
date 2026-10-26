/**
 * Guard for app.CURL / utils.sendWebhook: domain allowlist + SSRF blocks.
 *
 * No imports on purpose, so tests/unit/curl-guard.test.mjs can load it with
 * plain node (the '@/' aliases only resolve under Next).
 *
 * @module core/functions/curlGuard
 */

/**
 * Check if hostname is an internal/private IP address
 */
export function isInternalIP(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }

  const ipv4Regex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
  const match = hostname.match(ipv4Regex);

  if (match) {
    const [, a, b] = match.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
  }

  if (hostname.includes(':')) {
    if (hostname.toLowerCase().startsWith('fc') || hostname.toLowerCase().startsWith('fd')) {
      return true;
    }
    if (hostname.toLowerCase().startsWith('fe80')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if URL is a cloud metadata endpoint
 */
export function isCloudMetadataEndpoint(url) {
  const lowerUrl = String(url).toLowerCase();
  if (lowerUrl.includes('169.254.169.254')) return true;
  if (lowerUrl.includes('metadata.google.internal')) return true;
  return false;
}

/**
 * Domains app.CURL may call.
 *
 * `settings` is what getAllSettings() returns: one key per setting FILE
 * ({ general: {...}, api: {...} }). Two places are read and merged:
 *  - settings.general.allowedExternalDomains → the documented one (settings/general.json)
 *  - settings.allowedExternalDomains → legacy: a setting file named
 *    `allowedExternalDomains` whose content is the array (or a flat settings.json)
 *
 * @param {Object} settings
 * @returns {string[]} lowercased, deduplicated domains
 */
export function getAllowedExternalDomains(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  const sources = [s.general?.allowedExternalDomains, s.allowedExternalDomains];

  const domains = [];
  for (const source of sources) {
    const list = Array.isArray(source) ? source : typeof source === 'string' ? [source] : [];
    for (const entry of list) {
      if (typeof entry !== 'string') continue;
      const domain = entry.trim().toLowerCase();
      if (domain && !domains.includes(domain)) domains.push(domain);
    }
  }
  return domains;
}

/**
 * Validate a URL for app.CURL. Returns the error message, or null if it may be requested.
 *
 * @param {string} url
 * @param {Object} settings - what getAllSettings() returns
 * @returns {string|null}
 */
export function checkCurlUrl(url, settings) {
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch {
    return 'Invalid URL format';
  }

  if (isInternalIP(urlObj.hostname)) {
    return 'Direct IP addresses are not allowed. Please use domain names and add them to your allowed domains list.';
  }

  if (isCloudMetadataEndpoint(url)) {
    return 'Access to cloud metadata endpoints is not allowed for security reasons';
  }

  if (urlObj.protocol !== 'https:') {
    return 'Only HTTPS URLs are allowed for security reasons';
  }

  const allowedDomains = getAllowedExternalDomains(settings);

  if (allowedDomains.length === 0) {
    return 'No external domains configured. Add them to settings/general.json: ' +
      '{ "allowedExternalDomains": ["api.example.com"] }';
  }

  const isAllowed = allowedDomains.some(domain => {
    if (domain.startsWith('*.')) {
      const baseDomain = domain.slice(2);
      return urlObj.hostname.endsWith(baseDomain);
    }
    return urlObj.hostname === domain;
  });

  if (!isAllowed) {
    return `Domain "${urlObj.hostname}" is not in the allowed domains list. ` +
      `Current allowed domains: ${allowedDomains.join(', ')}. ` +
      'Add it to "allowedExternalDomains" in settings/general.json to use this API.';
  }

  const internalPatterns = [
    /\.local$/, /\.internal$/, /\.lan$/, /^localhost/,
    /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./
  ];

  for (const pattern of internalPatterns) {
    if (pattern.test(urlObj.hostname)) {
      return `Domain "${urlObj.hostname}" appears to be an internal domain and is not allowed`;
    }
  }

  return null;
}
