// app/api/addons/[...path]/route.js
//
// Dynamic Addon API Router
// Routes requests to addon API handlers with auto-injected context
//
// Example: POST /api/addons/comments/submit
//   → Loads addons/comments/api/submit/route.js
//   → Injects { session, database, siteId, domain } into request.addonContext
//   → Executes POST handler

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { resolveSite } from '@/core/sites/resolve';
import { createAuthOptions } from '@/core/auth/options.js';
import { getSite, getAllDatabases } from '@/core/sites/files';
import Database from '@/core/db';

/**
 * Handle addon API requests
 * @param {Request} request - Next.js request object
 * @param {Object} params - Route params containing path array
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, PATCH)
 */
async function handleRequest(request, routeContext, method) {
  // Next.js 15: routeContext contains { params: Promise<{ path: string[] }> }
  const resolvedParams = await routeContext.params;
  const pathParts = resolvedParams?.path;

  if (!pathParts || pathParts.length === 0) {
    return NextResponse.json(
      { error: 'Addon name required' },
      { status: 400 }
    );
  }

  const [addonName, ...routeParts] = pathParts;

  // Build context (auto-injected into addon handlers)
  const { host } = await resolveSite(request);
  const site = await getSite(host);

  if (!site) {
    return NextResponse.json(
      { error: 'Site not found' },
      { status: 404 }
    );
  }

  const databases = await getAllDatabases(host);
  const authOptions = await createAuthOptions({ host });
  const session = await getServerSession(authOptions);

  const addonContext = {
    siteId: site._id || host,
    domain: host,
    userId: session?.user?.id || session?.user?.email || null,
    session,
    databaseSchemas: databases
  };

  // Create pre-configured database instance
  const database = new Database(databases, {}, addonContext);

  // Build route path (default to 'index' if no sub-route)
  const routePath = routeParts.length > 0 ? routeParts.join('/') : 'index';

  try {
    // Dynamically import addon handler
    // Note: Using template literal with @/ alias for webpack resolution
    const handlerModule = await import(`@/addons/${addonName}/api/${routePath}/route.js`);
    const handler = handlerModule[method];

    if (!handler) {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      );
    }

    // Inject context into request for handler access
    request.addonContext = { ...addonContext, database };

    return handler(request, { params: resolvedParams });
  } catch (error) {
    // Handle module not found (addon or route doesn't exist)
    if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
      console.error(`[Addon API] Route not found: ${addonName}/${routePath}`);
      return NextResponse.json(
        { error: `Addon route not found: ${addonName}/${routePath}` },
        { status: 404 }
      );
    }

    // Log and return generic error for other failures
    console.error(`[Addon API] Error in ${addonName}/${routePath}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export handlers for all HTTP methods
export const GET = (req, ctx) => handleRequest(req, ctx, 'GET');
export const POST = (req, ctx) => handleRequest(req, ctx, 'POST');
export const PUT = (req, ctx) => handleRequest(req, ctx, 'PUT');
export const DELETE = (req, ctx) => handleRequest(req, ctx, 'DELETE');
export const PATCH = (req, ctx) => handleRequest(req, ctx, 'PATCH');

// Handle CORS preflight
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
