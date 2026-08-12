/**
 * API Configuration & Route Matching
 *
 * Handles loading api.json configuration and matching incoming requests
 * to configured API routes with support for:
 * - Exact matches: "webhook/stripe"
 * - Dynamic segments: "webhook/:type"
 * - Wildcards: "webhook/*"
 *
 * @module core/security/apiConfig
 */

import { getFile } from '@/core/sites/files.js';

/**
 * Default API configuration when no api.json exists
 *
 * NOTE: Rate limiting is handled globally by the HTTP middleware layer
 * (core/security/requestRateLimit.js). Users cannot configure rate limits
 * per-route - this protects the shared infrastructure from abuse.
 */
const DEFAULT_CONFIG = {
    routes: {}
};

/**
 * Load API configuration for a site.
 *
 * No second-tier cache here: getFile() already caches setting/api with a
 * lightweight updatedAt-based invalidation (see core/sites/files.js getFile).
 * Adding a stale 5-min TTL on top defeated that — newly added routes were
 * blocked until the wrapper cache expired, even though the file cache had
 * already picked up the change. Parsing a tiny JSON file is microseconds;
 * we do it on every call and let the file layer handle hot-path caching.
 *
 * @param {string} host - Site hostname
 * @param {boolean} isDev - Forwarded for symmetry; getFile reads it from
 *                          request context, so this arg is informational.
 * @returns {Promise<Object>} API configuration
 */
export async function getApiConfig(host, isDev = false) {
    try {
        const content = await getFile(host, 'setting', 'api');

        if (!content) {
            return DEFAULT_CONFIG;
        }

        const config = typeof content === 'string' ? JSON.parse(content) : content;

        const mergedConfig = {
            ...DEFAULT_CONFIG,
            routes: config?.routes || {}
        };

        // Strip rateLimit from each route - users cannot configure this
        for (const route of Object.values(mergedConfig.routes)) {
            delete route.rateLimit;
        }

        return mergedConfig;
    } catch (error) {
        console.log(`[API Config] Error loading api.json for ${host}:`, error.message);
        return DEFAULT_CONFIG;
    }
}

/**
 * Match a dynamic route pattern against a function name
 * Pattern: "webhook/:type" matches "webhook/stripe" with params { type: 'stripe' }
 *
 * @param {string} functionName - The function path to match (e.g., "webhook/stripe")
 * @param {string} pattern - The route pattern (e.g., "webhook/:type")
 * @returns {Object|null} Matched params or null if no match
 */
function matchDynamicRoute(functionName, pattern) {
    const fnParts = functionName.split('/');
    const patternParts = pattern.split('/');

    // Must have same number of segments
    if (fnParts.length !== patternParts.length) {
        return null;
    }

    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i];
        const fnPart = fnParts[i];

        if (patternPart.startsWith(':')) {
            // Dynamic segment - capture the value
            const paramName = patternPart.slice(1);
            params[paramName] = fnPart;
        } else if (patternPart !== fnPart) {
            // Static segment must match exactly
            return null;
        }
    }

    return params;
}

/**
 * Match a function name against configured routes
 * Priority order:
 * 1. Exact match
 * 2. Dynamic segment match (:param)
 * 3. Wildcard match (*)
 *
 * @param {string} functionName - The function path (e.g., "webhook/stripe/events")
 * @param {Object} routes - Routes configuration object
 * @returns {Object|null} { config, params } or null if no match
 */
export function matchRoute(functionName, routes) {
    if (!routes || typeof routes !== 'object') {
        return null;
    }

    // 1. Exact match (highest priority)
    if (routes[functionName]) {
        return {
            config: routes[functionName],
            params: {},
            matchType: 'exact',
            pattern: functionName
        };
    }

    // 2. Dynamic segment match (e.g., webhook/:type)
    // Sort by specificity - more segments = higher priority
    const dynamicPatterns = Object.entries(routes)
        .filter(([pattern]) => pattern.includes(':'))
        .sort((a, b) => b[0].split('/').length - a[0].split('/').length);

    for (const [pattern, config] of dynamicPatterns) {
        const params = matchDynamicRoute(functionName, pattern);
        if (params) {
            return {
                config,
                params,
                matchType: 'dynamic',
                pattern
            };
        }
    }

    // 3. Wildcard match (e.g., webhook/*)
    // Sort by specificity - longer base path = higher priority
    const wildcardPatterns = Object.entries(routes)
        .filter(([pattern]) => pattern.endsWith('/*'))
        .sort((a, b) => b[0].length - a[0].length);

    for (const [pattern, config] of wildcardPatterns) {
        const base = pattern.slice(0, -2); // Remove /*

        // Match if function starts with base path
        if (functionName === base || functionName.startsWith(base + '/')) {
            // Extract the wildcard portion
            const wildcardValue = functionName === base
                ? ''
                : functionName.slice(base.length + 1);

            return {
                config,
                params: { '*': wildcardValue },
                matchType: 'wildcard',
                pattern
            };
        }
    }

    // No match found
    return null;
}

