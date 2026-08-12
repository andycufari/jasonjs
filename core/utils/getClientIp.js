/**
 * Extract client IP address from request headers
 * Handles various proxy/CDN headers (Cloudflare, proxies, load balancers)
 *
 * @param {Object} headers - Next.js headers object or HeadersList
 * @returns {string|null} IP address or null if not found
 */
export function getClientIp(headers) {
  if (!headers) return null;

  try {
    // Handle Next.js headers() API
    const getHeader = (name) => {
      if (typeof headers.get === 'function') {
        return headers.get(name);
      }
      // Fallback for plain object
      return headers[name];
    };

    // Priority order for IP extraction
    const ipSources = [
      'cf-connecting-ip',      // Cloudflare
      'x-real-ip',             // Nginx proxy
      'x-forwarded-for',       // Standard proxy header
      'x-client-ip',           // Apache
      'x-cluster-client-ip',   // Rackspace LB
      'x-forwarded',           // General
      'forwarded-for',         // RFC 7239
      'forwarded'              // RFC 7239
    ];

    for (const source of ipSources) {
      const value = getHeader(source);
      if (value) {
        // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2)
        // Use the first one (client IP)
        let ip = value.split(',')[0].trim();

        // Handle IPv6-mapped IPv4 addresses (::ffff:127.0.0.1 → 127.0.0.1)
        if (ip.startsWith('::ffff:')) {
          ip = ip.substring(7);
        }

        if (ip && isValidIp(ip)) {
          return ip;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[getClientIp] Error extracting IP:', error);
    return null;
  }
}

/**
 * Basic IP validation
 * @param {string} ip - IP address to validate
 * @returns {boolean} True if valid IP format
 */
function isValidIp(ip) {
  if (!ip) return false;

  // IPv4 regex (basic)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

  // IPv6 regex (basic)
  const ipv6Regex = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Get client IP from Next.js request object
 * @param {Object} request - Next.js request object
 * @returns {string|null} IP address or null
 */
export function getClientIpFromRequest(request) {
  if (!request) return null;

  try {
    // Try request.headers first
    if (request.headers) {
      return getClientIp(request.headers);
    }

    // Try request.ip (some environments)
    if (request.ip) {
      return request.ip;
    }

    return null;
  } catch (error) {
    console.error('[getClientIpFromRequest] Error:', error);
    return null;
  }
}

export default {
  getClientIp,
  getClientIpFromRequest
};
