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

/**
 * Fetch function routes for a domain from the internal API
 * @param {string} origin - Request origin (e.g., "http://localhost:3000")
 * @param {string} host - Domain host header value
 * @returns {Promise<Object>} Map of pattern → { function: string }
 */
async function fetchFunctionRoutes(origin, host) {
  try {
    const res = await fetch(`${origin}/api/internal/routes`, {
      headers: { host }
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
