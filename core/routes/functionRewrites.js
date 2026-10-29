// core/routes/functionRewrites.js
// Resolves function rewrites from settings/routes.json
// Edge Runtime compatible — uses fetch + in-memory cache to load route config

// In-memory cache: Map<domain, { routes, timestamp }>
const routeCache = new Map();
const CACHE_TTL = 60_000; // 60 seconds

// Track which domains already logged a fetch error to avoid log spam
const errorLoggedFor = new Set();

/**
 * Match a URL path against a route pattern with :param and * support
 * @param {string} pattern - Route pattern (e.g., "llm/:model", "api/v1/*")
 * @param {string} path - Actual URL path (e.g., "llm/gpt4")
 * @returns {Object|null} Extracted params or null if no match
 */
function matchPattern(pattern, path) {
  // Normalize: strip leading slashes
  const normalizedPattern = pattern.replace(/^\/+/, '');
  const normalizedPath = path.replace(/^\/+/, '');

  const patternParts = normalizedPattern.split('/');
  const pathParts = normalizedPath.split('/');

  // Check for wildcard at end
  const hasWildcard = patternParts[patternParts.length - 1] === '*';

  if (hasWildcard) {
    // Wildcard: path must have at least as many segments as pattern (minus the *)
    if (pathParts.length < patternParts.length - 1) {
      return null;
    }
  } else {
    // Exact segment count must match
    if (pathParts.length !== patternParts.length) {
      return null;
    }
  }

  const params = {};

  for (let i = 0; i < patternParts.length; i++) {
    const part = patternParts[i];

    if (part === '*') {
      // Wildcard captures remaining segments
      params['*'] = pathParts.slice(i).join('/');
      break;
    } else if (part.startsWith(':')) {
      // Dynamic parameter
      params[part.slice(1)] = pathParts[i];
    } else if (part !== pathParts[i]) {
      // Static segment mismatch
      return null;
    }
  }

  return params;
}

export const ROUTES_HOST_HEADER = 'x-jasonjs-routes-host';

/**
 * Where the middleware reaches its own server. Not request.nextUrl.origin: behind
 * Cloudflare it says https (X-Forwarded-Proto) while the port speaks plain http,
 * so the fetch died with "fetch failed" and no rewrite ever applied.
 */
export function internalOrigin(origin, envPort) {
  let port = '';
  try {
    const u = new URL(origin);
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) port = u.port;
  } catch {
    // no usable origin — fall back to the env port
  }
  return `http://127.0.0.1:${port || envPort || 3000}`;
}

/**
 * Which site /api/internal/routes answers for. The middleware's own request arrives
 * on localhost carrying the site in ROUTES_HOST_HEADER; anything from outside
 * comes with the site's real Host, and the header is ignored — no reading
 * another tenant's routes.
 */
export function routesHostFor(hostHeader, routesHostHeader, resolvedHost) {
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(hostHeader || '');
  return isLocal && routesHostHeader ? routesHostHeader : resolvedHost;
}

/**
 * Fetch function routes for a domain from the internal API
 * @param {string} origin - Request origin (e.g., "http://localhost:3000")
 * @param {string} host - Domain host header value
 * @returns {Promise<Object>} Map of pattern → { function: string }
 */
async function fetchFunctionRoutes(origin, host) {
  try {
    // fetch ignores a Host header (it sends the URL's host), so the site goes in a header of ours
    const res = await fetch(`${internalOrigin(origin, process.env.PORT)}/api/internal/routes`, {
      headers: { [ROUTES_HOST_HEADER]: host }
    });

    if (!res.ok) return {};

    const data = await res.json();
    // Clear error flag on success
    errorLoggedFor.delete(host);
    return data.functionRoutes || {};
  } catch (error) {
    // Only log once per domain to avoid spamming logs every cache cycle
    if (!errorLoggedFor.has(host)) {
      console.warn(`[functionRewrites] Could not fetch routes for ${host}: ${error.message}`);
      errorLoggedFor.add(host);
    }
    return {};
  }
}

/**
 * Get cached function routes for a domain, fetching if stale
 * @param {string} origin - Request origin
 * @param {string} host - Domain host
 * @returns {Promise<Object>} Function routes map
 */
async function getFunctionRoutes(origin, host) {
  const cached = routeCache.get(host);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.routes;
  }

  const routes = await fetchFunctionRoutes(origin, host);
  routeCache.set(host, { routes, timestamp: now });
  return routes;
}

/**
 * Check if a request path matches a function rewrite
 * @param {Request} request - The incoming request
 * @param {string} host - Resolved host
 * @returns {Promise<{ functionName: string, params: Object }|null>}
 */
export async function getFunctionRewrite(request, host) {
  const { pathname, origin } = request.nextUrl;

  // Normalize path (strip leading slash for matching)
  const path = pathname.replace(/^\/+/, '');

  // Skip empty paths
  if (!path) return null;

  const functionRoutes = await getFunctionRoutes(origin, host);

  // No function routes configured
  if (!functionRoutes || Object.keys(functionRoutes).length === 0) {
    return null;
  }

  // Try each function route pattern
  for (const [pattern, config] of Object.entries(functionRoutes)) {
    const params = matchPattern(pattern, path);
    if (params !== null) {
      return {
        functionName: config.function,
        params
      };
    }
  }

  return null;
}
