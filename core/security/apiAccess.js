/**
 * API Access Validation
 *
 * Validates incoming API requests based on:
 * - Same-origin policy (always allowed)
 * - Configured public routes in api.json
 * - Origin allowlist
 * - API key authentication
 *
 * NOTE: Rate limiting is handled globally by the HTTP middleware layer
 * (core/security/requestRateLimit.js). This module only handles access control.
 *
 * @module core/security/apiAccess
 */

import crypto from 'crypto';
import { getApiConfig, matchRoute } from './apiConfig.js';
import { getEnv } from '@/core/sites/files.js';
import { defaultDomain } from '@/core/sites/resolve.js';

/**
 * Check if the request is from the same origin
 *
 * Uses multiple signals to determine origin:
 * 1. Sec-Fetch-Site header (most reliable, set by all modern browsers)
 * 2. Origin header (set on cross-origin requests by browsers)
 * 3. Referer header (fallback for older clients)
 *
 * SECURITY: Requests with NO origin signals (no Sec-Fetch-Site, no Origin,
 * no Referer) are treated as EXTERNAL. This prevents non-browser clients
 * (cURL, Postman, scripts) from bypassing API access controls.
 *
 * @param {Headers} headersList - Full request headers
 * @param {string} host - Site hostname (may be DEFAULT_DOMAIN in dev)
 * @returns {boolean} True only if we have positive evidence of same-origin
 */
function isSameOrigin(headersList, host) {
    // SIGNAL 1: Sec-Fetch-Site (most reliable — browsers always set this)
    // Values: "same-origin", "same-site", "cross-site", "none" (address bar/bookmarks)
    const secFetchSite = headersList.get('sec-fetch-site');

    if (secFetchSite) {
        // "same-origin" = exact same origin (scheme + host + port)
        // "none" = direct navigation (address bar, bookmark, typed URL)
        // Both are safe — the request originates from the user's own browser on the same site
        return secFetchSite === 'same-origin' || secFetchSite === 'none';
    }

    // SIGNAL 2: Origin header (browsers set this on POST/PUT/DELETE and cross-origin requests)
    const origin = headersList.get('origin');

    if (origin) {
        return isOriginMatchingHost(origin, host);
    }

    // SIGNAL 3: Referer header (older browsers, or GET requests that don't send Origin)
    const referer = headersList.get('referer');

    if (referer) {
        try {
            const refererUrl = new URL(referer);
            return isHostMatching(refererUrl.hostname, host);
        } catch {
            return false;
        }
    }

    // NO SIGNALS: Treat as external (cURL, Postman, server-to-server, scripts)
    // This is the key security fix — previously this returned true
    return false;
}

/**
 * Check if an Origin header value matches the site host
 * @param {string} origin - Origin header value
 * @param {string} host - Site hostname
 * @returns {boolean}
 */
function isOriginMatchingHost(origin, host) {
    try {
        const originUrl = new URL(origin);
        return isHostMatching(originUrl.hostname, host);
    } catch {
        return false;
    }
}

/**
 * Check if a hostname matches the site host, including localhost dev variants
 * @param {string} hostname - Hostname to check
 * @param {string} host - Site hostname (may be DEFAULT_DOMAIN in dev)
 * @returns {boolean}
 */
function isHostMatching(hostname, host) {
    // Exact match
    if (hostname === host) {
        return true;
    }

    // Allow localhost variants when host was resolved from DEFAULT_DOMAIN
    // This covers both dev mode (npm run dev) and local production builds (npm start)
    // where the browser runs on localhost but resolveSite() resolves to DEFAULT_DOMAIN
    const isLocalhostHostname =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.local');

    if (isLocalhostHostname && host === defaultDomain()) {
        return true;
    }

    return false;
}

/**
 * Check if origin matches any allowed origin pattern
 *
 * @param {string} origin - Request origin
 * @param {string[]} allowedOrigins - List of allowed origins
 * @returns {boolean} True if origin is allowed
 */
function isOriginAllowed(origin, allowedOrigins) {
    if (!allowedOrigins || allowedOrigins.length === 0) {
        return false;
    }

    // Wildcard allows all origins
    if (allowedOrigins.includes('*')) {
        return true;
    }

    try {
        const originUrl = new URL(origin);

        return allowedOrigins.some(allowed => {
            // Exact match
            if (origin === allowed) {
                return true;
            }

            // Origin starts with allowed (handles with/without trailing slash)
            if (origin.startsWith(allowed) || allowed.startsWith(origin)) {
                return true;
            }

            // Wildcard subdomain match (e.g., "*.stripe.com")
            if (allowed.startsWith('*.')) {
                const baseDomain = allowed.slice(2);
                return originUrl.hostname === baseDomain ||
                    originUrl.hostname.endsWith('.' + baseDomain);
            }

            // Try matching just the hostname
            try {
                const allowedUrl = new URL(allowed.startsWith('http') ? allowed : `https://${allowed}`);
                return originUrl.hostname === allowedUrl.hostname;
            } catch {
                return false;
            }
        });
    } catch {
        return false;
    }
}

/**
 * Resolve environment placeholder in a string
 * Handles [[env.VARIABLE_NAME]] syntax
 *
 * @param {string} value - String that may contain [[env.X]] placeholder
 * @param {string} host - Site hostname for env resolution
 * @returns {Promise<string>} Resolved value
 */
async function resolveEnvPlaceholder(value, host) {
    if (!value || typeof value !== 'string') return value;

    // Match [[env.VARIABLE_NAME]]
    const match = value.match(/^\[\[env\.(\w+)\]\]$/);
    if (match) {
        const envVar = match[1];
        const resolved = await getEnv(host, envVar);
        return resolved || value; // Return original if not found
    }

    return value;
}

/**
 * Validate API key using constant-time comparison
 *
 * @param {string} providedKey - Key from X-API-Key header
 * @param {string[]} validKeys - List of valid keys (may contain env placeholders)
 * @param {string} host - Site hostname for env resolution
 * @returns {Promise<boolean>} True if key is valid
 */
async function validateApiKey(providedKey, validKeys, host) {
    if (!providedKey || !validKeys || validKeys.length === 0) {
        return false;
    }

    // Resolve any environment placeholders in keys
    const resolvedKeys = await Promise.all(
        validKeys.map(key => resolveEnvPlaceholder(key, host))
    );

    // Constant-time comparison for each valid key
    for (const validKey of resolvedKeys) {
        if (!validKey) continue;

        try {
            // Keys must be same length for timingSafeEqual
            if (providedKey.length === validKey.length) {
                const isEqual = crypto.timingSafeEqual(
                    Buffer.from(providedKey),
                    Buffer.from(validKey)
                );
                if (isEqual) {
                    return true;
                }
            }
        } catch {
            // Continue checking other keys
            continue;
        }
    }

    return false;
}


/**
 * Validate API access for a request
 *
 * NOTE: Rate limiting is handled by the global HTTP middleware (requestRateLimit.js).
 * This function only validates access control (origin, API keys, public routes).
 *
 * @param {Headers} headersList - Request headers
 * @param {string} host - Site hostname
 * @param {string} functionName - Function path (e.g., "webhook/stripe")
 * @returns {Promise<Object>} Access validation result
 */
export async function validateApiAccess(headersList, host, functionName, isDev = false) {
    const origin = headersList.get('origin');
    const apiKey = headersList.get('x-api-key');

    // STEP 1: Same-origin requests are always allowed
    // Uses Sec-Fetch-Site, Origin, and Referer headers for detection
    if (isSameOrigin(headersList, host)) {
        const apiConfig = await getApiConfig(host, isDev);
        const match = matchRoute(functionName, apiConfig.routes);

        return {
            allowed: true,
            source: 'same-origin',
            routeParams: match?.params || {}
        };
    }

    // STEP 2: External request - load API configuration
    const apiConfig = await getApiConfig(host, isDev);

    if (!apiConfig.routes || Object.keys(apiConfig.routes).length === 0) {
        return {
            allowed: false,
            error: 'External API access not configured',
            hint: 'Requests without browser origin headers (curl, Postman, server-to-server) are external. To allow them, declare this route in settings/api.json — see docs/settings/api.md.',
            status: 403
        };
    }

    // STEP 3: Match route pattern
    const match = matchRoute(functionName, apiConfig.routes);

    if (!match) {
        return {
            allowed: false,
            error: 'Endpoint not found',
            status: 404
        };
    }

    // STEP 4: Check if route is public
    if (!match.config.public) {
        return {
            allowed: false,
            error: 'Endpoint not public',
            status: 403
        };
    }

    // STEP 5: Validate origin
    const origins = match.config.origins || [];

    if (origins.length > 0 && !isOriginAllowed(origin, origins)) {
        return {
            allowed: false,
            error: 'Origin not allowed',
            status: 403
        };
    }

    // STEP 6: Validate API key (if required)
    const keys = match.config.keys || [];

    if (keys.length > 0) {
        if (!apiKey) {
            return {
                allowed: false,
                error: 'API key required',
                status: 401
            };
        }

        const keyValid = await validateApiKey(apiKey, keys, host);

        if (!keyValid) {
            return {
                allowed: false,
                error: 'Invalid API key',
                status: 401
            };
        }
    }

    // SUCCESS: All checks passed
    return {
        allowed: true,
        source: 'external',
        corsOrigin: origin,
        routeParams: match.params,
        matchType: match.matchType,
        pattern: match.pattern
    };
}

/**
 * Get CORS headers for an allowed external request
 *
 * @param {Object} apiAccess - Result from validateApiAccess
 * @returns {Object} CORS headers object
 */
export function getCorsHeaders(apiAccess) {
    if (!apiAccess.allowed || !apiAccess.corsOrigin) {
        return {};
    }

    return {
        'Access-Control-Allow-Origin': apiAccess.corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    };
}

