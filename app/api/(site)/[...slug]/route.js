// app/api/(site)/[...slug]/route.js
//
// HTTP Route Handler for Tenant Functions
// This is a thin wrapper that handles HTTP-specific logic and delegates
// function execution to the core execution engine.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { getSite, getEnv } from '@/core/sites/files';
import { resolveSite } from '@/core/sites/resolve';
import { getServerSession } from 'next-auth/next';
import { createAuthOptions } from '@/core/auth/options.js';
import { getAllSettings, getAllDatabases } from '@/core/sites/files.js';
import { validateApiAccess, getCorsHeaders } from '@/core/security/apiAccess.js';
import { createErrorResponse } from '@/core/utils/apiError.js';
import { runFunction } from '@/core/functions/run.js';
import { convertStatusToHttpCode } from '@/core/functions/appContext.js';
import { decodeSafeEntities } from '@/core/security/sanitize.js';

// Allowed origins for Studio IDE requests
const STUDIO_ORIGINS = [
    'https://build.cm64.io',
    'https://www.startupstudio.build',
    // Dev mode - allow studio.local:3044 (CM64 Studio dev server)
    ...(process.env.NODE_ENV === 'development' ? ['http://studio.local:3044'] : [])
];

/**
 * Validate Studio IDE authentication
 * @param {Headers} headersList - Request headers
 * @param {string} host - Target site domain
 * @returns {Object} { isStudioRequest: boolean, isValid: boolean, error: string|null }
 */
async function validateStudioAuth(headersList, host) {
    const origin = headersList.get('origin');

    // Not a studio request if origin doesn't match
    const isStudioOrigin = origin && STUDIO_ORIGINS.some(allowed =>
        origin === allowed || origin.startsWith(allowed)
    );

    if (!isStudioOrigin) {
        return { isStudioRequest: false, isValid: true, error: null };
    }

    // Studio request detected - require X-Studio-Secret header
    const providedSecret = headersList.get('x-studio-secret');
    if (!providedSecret) {
        return {
            isStudioRequest: true,
            isValid: false,
            error: 'Missing X-Studio-Secret header'
        };
    }

    // Get the configured secret for this site
    const configuredSecret = await getEnv(host, 'STUDIO_API_SECRET');

    if (!configuredSecret) {
        return {
            isStudioRequest: true,
            isValid: false,
            error: 'STUDIO_API_SECRET not configured for this site'
        };
    }

    // Constant-time comparison to prevent timing attacks
    try {
        const secretsMatch = providedSecret.length === configuredSecret.length &&
            crypto.timingSafeEqual(
                Buffer.from(providedSecret),
                Buffer.from(configuredSecret)
            );

        if (!secretsMatch) {
            return {
                isStudioRequest: true,
                isValid: false,
                error: 'Invalid Studio API secret'
            };
        }
    } catch {
        return {
            isStudioRequest: true,
            isValid: false,
            error: 'Invalid Studio API secret'
        };
    }

    return { isStudioRequest: true, isValid: true, error: null };
}

export async function GET(request, { params }) {
    return handleRequest(request, params, 'GET');
}

export async function POST(request, { params }) {
    return handleRequest(request, params, 'POST');
}

export async function PUT(request, { params }) {
    return handleRequest(request, params, 'PUT');
}

export async function DELETE(request, { params }) {
    return handleRequest(request, params, 'DELETE');
}

export async function PATCH(request, { params }) {
    return handleRequest(request, params, 'PATCH');
}

/**
 * Handle CORS preflight requests
 * Supports both Studio IDE and configured external API origins
 */
export async function OPTIONS(request, { params: paramsPromise }) {
    const headersList = await headers();
    const origin = headersList.get('origin');

    // 1. Allow CORS for Studio origins
    if (origin && STUDIO_ORIGINS.some(allowed => origin === allowed)) {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Studio-Secret',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    // 2. Check api.json config for external origins
    if (origin) {
        try {
            const { host } = await resolveSite();
            const params = await paramsPromise;
            const functionName = params.slug.join('/');

            // Validate API access (will check origin against config)
            const apiAccess = await validateApiAccess(
                headersList,
                host,
                functionName
            );

            if (apiAccess.allowed && apiAccess.corsOrigin) {
                const corsHeaders = getCorsHeaders(apiAccess);
                return new NextResponse(null, {
                    status: 204,
                    headers: {
                        ...corsHeaders,
                        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
                    },
                });
            }
        } catch (error) {
            // Log but don't fail - just return empty OPTIONS response
            console.error('[API OPTIONS] Error checking api.json config:', error.message);
        }
    }

    // Default: No CORS headers (same-origin only)
    return new NextResponse(null, { status: 204 });
}


async function handleRequest(request, paramsPromise, method) {
    // Await params for Next.js 15 compatibility
    const params = await paramsPromise;

    // 🔒 SECURITY CHAIN OF TRUST:
    // 1. Get hostname from HTTP request (server-side, cannot be spoofed)
    const { host } = await resolveSite();

    // Get dev mode status from centralized library
    const { getClientIp } = await import('@/core/utils/getClientIp.js');
    const headersList = await headers();
    const clientIp = getClientIp(headersList);
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);

    // 🔒 STUDIO IDE AUTHENTICATION
    // Validate if request is from Studio IDE and has valid API secret
    const studioAuth = await validateStudioAuth(headersList, host);
    if (studioAuth.isStudioRequest && !studioAuth.isValid) {
        return NextResponse.json(
            { error: studioAuth.error },
            { status: 401 }
        );
    }

    // Process dev mode (handles ?dev=true and Redis cache)
    const { processDevMode } = await import('@/core/utils/getDevMode.js');
    const devModeResult = await processDevMode(host, clientIp, searchParams);

    try {
        // 2. Look up site in database by hostname (server-side database query)
        const site = await getSite(host);
        if (!site) {
            console.log(`[Studio API Debug] Site not found for host: ${host}`);
            return NextResponse.json({ error: 'Site not found' }, { status: 404 });
        }

        const functionName = params.slug.join('/');

        // 🔒 API ACCESS CONTROL
        // Validate origin and API keys based on api.json config
        // Studio requests bypass this check (handled above)
        if (!studioAuth.isStudioRequest) {
            const apiAccess = await validateApiAccess(
                headersList,
                host,
                functionName,
                devModeResult?.isDev || false
            );

            if (!apiAccess.allowed) {
                const response = NextResponse.json(
                    { error: apiAccess.error },
                    { status: apiAccess.status || 403 }
                );

                // Add CORS headers if this was a valid external request
                if (apiAccess.corsOrigin) {
                    const corsHeaders = getCorsHeaders(apiAccess);
                    Object.entries(corsHeaders).forEach(([key, value]) => {
                        response.headers.set(key, value);
                    });
                }

                return response;
            }

            // Store access info for later use (CORS headers, route params)
            request.apiAccess = apiAccess;
        }

        // Parse request body for POST/PUT requests
        let requestParams = {};
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            try {
                const bodyText = await request.text();
                if (bodyText) {
                    requestParams = JSON.parse(bodyText);
                }
            } catch (error) {
                if (request.headers.get('content-type')?.includes('application/json')) {
                    console.warn(`[API] JSON parse error for ${request.nextUrl.pathname}: ${error.message}`);
                }
                requestParams = {};
            }
        }

        // Load tenant context
        const databaseConfig = await getAllDatabases(host) || site.database || { waitlist: { type: 'jason', config: {} } };
        const settings = await getAllSettings(host) || {};

        // Get session for authentication context
        // Use timeout to prevent auth pipeline from hanging the entire request
        // (public API functions don't need auth — session is optional)
        let session = null;
        try {
            const AUTH_TIMEOUT_MS = 8000; // 8 seconds max for auth
            session = await Promise.race([
                (async () => {
                    const authOpts = await createAuthOptions({ host });
                    return await getServerSession(authOpts);
                })(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Auth timeout')), AUTH_TIMEOUT_MS)
                )
            ]);
        } catch (authError) {
            console.warn(`[Function API] Auth failed/timed out for "${host}": ${authError.message}. Proceeding without session.`);
        }

        // Execute function using the native ES module runner
        const result = await runFunction(host, functionName, {
            params: { ...requestParams, ...searchParams },
            body: requestParams,
            query: searchParams,
            headers: headersList,
            session,
            method,
            request,
            source: 'http',
            isStudioRequest: studioAuth.isStudioRequest && studioAuth.isValid,
            databaseConfig,
            settings
        });

        // Helper to add CORS and rate limit headers
        const addResponseHeaders = (response) => {
            // Studio CORS headers
            if (studioAuth.isStudioRequest) {
                const origin = headersList.get('origin');
                if (origin && STUDIO_ORIGINS.includes(origin)) {
                    response.headers.set('Access-Control-Allow-Origin', origin);
                    response.headers.set('Access-Control-Allow-Credentials', 'true');
                }
            }

            // External API CORS headers (from api.json config)
            if (request.apiAccess?.corsOrigin) {
                const corsHeaders = getCorsHeaders(request.apiAccess);
                Object.entries(corsHeaders).forEach(([key, value]) => {
                    response.headers.set(key, value);
                });
            }

            return response;
        };

        // If the result is already a NextResponse, return it directly
        if (result instanceof NextResponse) {
            return addResponseHeaders(result);
        }

        // If the result is undefined/null, return success
        if (result === undefined || result === null) {
            return addResponseHeaders(NextResponse.json({ success: true }));
        }

        // Decode safe HTML entities for API responses
        // Execution engine sanitizes strings (XSS protection for browser rendering),
        // but API JSON responses should return clean text — clients handle their own escaping
        const decodeResult = (obj) => (obj && typeof obj === 'object') ? decodeSafeEntities(obj) : obj;

        // Check if result has custom status code (from app.return())
        if (result && typeof result === 'object' && '__STATUS__' in result) {
            const { __STATUS__, __CONTENT_TYPE__, __RAW_BODY__, ...data } = result;
            // Support raw content types (text/plain, text/html, etc.)
            if (__CONTENT_TYPE__) {
                return addResponseHeaders(new NextResponse(__RAW_BODY__, {
                    status: __STATUS__,
                    headers: { 'Content-Type': __CONTENT_TYPE__ }
                }));
            }
            return addResponseHeaders(NextResponse.json(decodeResult(data), { status: __STATUS__ }));
        }

        // Check if result has a status property (from direct function returns)
        if (result && typeof result === 'object' && 'status' in result) {
            const { status, ...data } = result;
            const statusCode = convertStatusToHttpCode(status);
            return addResponseHeaders(NextResponse.json(decodeResult(data), { status: statusCode }));
        }

        // Otherwise, wrap it in a NextResponse with 200 status
        return addResponseHeaders(NextResponse.json(decodeResult(result)));
    } catch (error) {
        // Use centralized error sanitization to prevent leaking internal details.
        // Include tenant context so we can track down which function failed.
        const errorContext = {
            type: 'function',
            host,
            functionName: params?.slug?.join('/') || 'unknown',
            method,
            ip: clientIp
        };
        console.error(
            `[function-error] host=${errorContext.host} function=${errorContext.functionName} method=${errorContext.method}: ${error?.message || error}`,
            error?.stack
        );
        return createErrorResponse(error, { context: errorContext });
    }
}