// app/api/data/[database]/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Database from '@/core/db';
import { getSite } from '@/core/sites/files';
import { sanitizeData } from '@/core/security/sanitize';
import { getFile } from '@/core/sites/files.js';
import { getServerSession } from 'next-auth/next';
import { resolveSite } from '@/core/sites/resolve';
import { createAuthOptions } from '@/core/auth/options.js';
import { validateSecurity } from '@/core/security/fieldFilter.js';
import { getAllDatabases } from '@/core/sites/files.js';
import appLog, { setSiteContext } from '@/core/utils/appLog.js';
import { getFileSystem } from '@/core/sites/files.js';

// Server-side request timeout to prevent hanging queries from blocking resources
const REQUEST_TIMEOUT = 20000; // 20 seconds (slightly longer than client timeout)


// Cache for 1 hour by default, can be overridden by database config
export const revalidate = 3600;

// In-memory cache for database configurations
const configCache = new Map();
const CACHE_TTL = 60000; // 60 seconds cache (1 minute for good performance)

function getCachedConfig(host, bypassCache = false) {
  if (bypassCache) return null; // Bypass cache if requested

  const cached = configCache.get(host);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedConfig(host, data) {
  configCache.set(host, {
    data,
    timestamp: Date.now()
  });
}

function clearCachedConfig(host) {
  configCache.delete(host);
}

// Utility to validate domain access
async function validateDomainAccess(request) {
  const headersList = await headers();
  const { host } = await resolveSite(request);
  const origin = headersList.get('origin');

  // Validate origin matches host
  const allowedOrigin = `https://${host}`;
  if (origin && origin !== allowedOrigin && origin !== 'http://localhost:3000') {
    throw new Error('Invalid origin');
  }

  return host;
}

// Note: validateSecurity function moved to core/security/fieldFilter.js

// Database access validation (tenant isolation handled by siteId prefix in Database class)
function validateDatabaseAccess(databaseName, session) {
  if (databaseName.startsWith('_')) {
    throw new Error(`System databases are not accessible from client-side.`);
  }
}

// Note: validateSecurityLevel function moved to core/security/fieldFilter.js

// ⚠️ CRITICAL SECURITY: Remove client-controlled site/tenant fields
function sanitizeClientData(data) {
  if (!data || typeof data !== 'object') return data;
  
  // Fields that client should NEVER control (INPUT sanitization)
  const FORBIDDEN_FIELDS = [
    'siteId', 'site_id', 'tenantId', 'tenant_id',
    'userId', 'user_id', // These should come from session only
    'createdBy', 'created_by', // Server sets this, client can't override
    'domain', 'host',
    '_id', 'id', // Don't let client override IDs in create operations
    'isAdmin', 'role', 'roles', 'permissions' // Security fields
  ];
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeClientData(item));
  }
  
  // Remove forbidden fields from object
  const sanitized = { ...data };
  FORBIDDEN_FIELDS.forEach(field => delete sanitized[field]);
  
  return sanitized;
}

// Note: filterFields function moved to core/security/fieldFilter.js

/**
 * Log database errors to functionLogs for developer visibility
 * @param {Object} context - Request context (siteId, database, etc.)
 * @param {Error} error - The error that occurred
 * @param {number} duration - Request duration in ms
 */
async function logDatabaseError(context, error, duration) {
  try {
    const adapter = getFileSystem().getAdapter();
    if (typeof adapter?.saveFunctionLog !== 'function') {
      // Local mode (or adapter without log persistence): terminal logging only
      return;
    }
    await adapter.saveFunctionLog({
      siteId: context.siteId,
      functionName: `database.${context.database}.${context.method}`,
      level: 'error',
      message: error.message,
      executionContext: {
        method: context.method,
        database: context.database,
        duration,
        isTimeout: error.message.includes('timeout')
      },
      stack: error.stack
    });
  } catch (logError) {
    // Don't let logging failures break the response
    console.error('[Database API] Failed to log error:', logError.message);
  }
}

/**
 * Execute handler with timeout protection
 * @param {Function} fn - Async function to execute
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} Result or timeout error
 */
function withTimeout(fn, timeout) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Server request timeout after ${timeout}ms`)), timeout)
    )
  ]);
}

// Main handler for all methods
async function handler(request, { params }) {
  const startTime = Date.now();
  let requestContext = { method: request.method, database: null, siteId: null };

  try {
    // Await params for Next.js 15 compatibility
    const resolvedParams = await params;
    requestContext.database = resolvedParams.database;
    
    // 1. Validate domain and get host
    const host = await validateDomainAccess(request);
    //console.log("Host: ", host);

    // Check for cache bypass (dev mode or _nocache param)
    const url = new URL(request.url);
    const bypassCache = url.searchParams.get('_nocache') === 'true' ||
                        url.searchParams.get('dev') === 'true';

    // 2. Get domain configuration (with caching)
    let cachedData = getCachedConfig(host, bypassCache);
    let site, databases;
    
    if (cachedData) {
      ({ site, databases } = cachedData);
    } else {
      site = await getSite(host);
      if(!site) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
      }

      // Use getAllDatabases which supports both legacy (settings/database.json)
      // and new format (databases/*.json with class='database')
      databases = await getAllDatabases(host);
      if (!databases || Object.keys(databases).length === 0) {
        return NextResponse.json({ error: 'Databases not found' }, { status: 404 });
      }

      // Cache the configuration (only if not bypassing cache)
      if (!bypassCache) {
        setCachedConfig(host, { site, databases });
      }
    }
    if (!databases?.[resolvedParams.database]) {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    // 3. Get user session using server-side auth
    const authOptions = await createAuthOptions({ host });
    const session = await getServerSession(authOptions);

    // ⚠️ CRITICAL SECURITY: Validate database access
    validateDatabaseAccess(resolvedParams.database, session);

    // 4. Initialize database handler with context
    // ⚠️ SECURITY: Server always controls siteId - client cannot modify
    const context = {
      siteId: site._id || host, // FIXED: Server-controlled, not from client
      domain: host, // Add domain for logging
      userId: session?.user?.id || null,
      session: session, // Pass full session for internal security filtering
      databaseSchemas: databases // Required for join resolution in search operations
    };

    // Update request context for error logging
    requestContext.siteId = context.siteId;

    // Set site context for AppLog system
    setSiteContext(context.siteId, context.domain, context.userId);

    const database = new Database(databases, resolvedParams, context);
    
    
    // 5. Validate security rules
    // For search operations, treat as read operation for security validation
    let isSearchOperation = false;
    if (request.method === 'POST') {
      try {
        const clonedBody = await request.clone().json();
        isSearchOperation = clonedBody?.operation === 'search';
      } catch (e) {
        // Body might not be JSON or empty - that's okay, it's not a search operation
      }
    }
    
    const operationMethod = isSearchOperation ? 'GET' : request.method;
    const security = validateSecurity(
      databases[resolvedParams.database], 
      operationMethod,
      session
    );


    database.select(resolvedParams.database);

    // 6. Process request based on method
    let result;
    const body = request.method !== 'GET' ? await request.json() : null;

    switch (request.method) {
      case 'GET':
        const searchParams = Object.fromEntries(request.nextUrl.searchParams);

        // Handle both old format and new fluid API format
        let queryConfig = searchParams;

        // If we have complex query params (JSON), parse them
        if (searchParams.filters) {
          try {
            queryConfig.filters = JSON.parse(searchParams.filters);
          } catch (e) {
            // If parsing fails, use as-is
          }
        }

        if (searchParams.sort) {
          try {
            queryConfig.sort = JSON.parse(searchParams.sort);
          } catch (e) {
            // If parsing fails, use as-is
          }
        }

        // Pass through join options from client-side QueryBuilder
        if (searchParams.disableJoins !== undefined) {
          queryConfig.disableJoins = searchParams.disableJoins === 'true';
        }
        if (searchParams.customJoins) {
          try {
            queryConfig.customJoins = JSON.parse(searchParams.customJoins);
          } catch (e) {
            // If parsing fails, ignore
          }
        }

        // ⚠️ SECURITY: Only add siteId filter if database uses multi-tenancy
        // This database doesn't use siteId fields, so skip tenant isolation
        if (!queryConfig.filters) queryConfig.filters = {};
        // queryConfig.filters.siteId = context.siteId; // Disabled for this database

        // Check if we need to return total count (for server-side pagination)
        const needsCount = searchParams.limit && searchParams.skip !== undefined;

        result = await database.fetch(queryConfig);

        // If pagination params are present, also get total count
        if (needsCount) {
          const countResult = await database.count(queryConfig.filters || {});
          if (countResult.success) {
            result.total = countResult.data;
          }
        }
        break;
      
      case 'POST':
        if (!body) throw new Error('Request body required');
        
        // Check if this is a search operation
        if (body.operation === 'search') {
          // Handle search operation
          const { searchTerm, limit = 10, filters = {} } = body;

          if (!searchTerm || typeof searchTerm !== 'string') {
            throw new Error('Search term is required and must be a string');
          }

          // Sanitize filters
          const sanitizedFilters = sanitizeClientData(filters);

          result = await database.search(searchTerm, limit, sanitizedFilters);
        } else {
          // Handle regular create operation
          // Client now sends data directly (no { data } wrapper)
          let createData = body;

          // ⚠️ SECURITY: Remove forbidden fields from client data
          createData = sanitizeClientData(createData);

          // Server adds the controlled fields
          // createData.siteId = context.siteId; // Disabled for this database
          if (context.userId) {
            createData.created_by = context.userId;  // Use created_by consistently
          }
          createData.createdAt = new Date();

          // Pass data directly to database.create (not wrapped)
          result = await database.create(createData);

          // Clear config cache to ensure fresh data on next request
          clearCachedConfig(host);
        }
        break;

      case 'PUT':
        if (!body?.id) throw new Error('Record ID required');

        // ⚠️ SECURITY: Remove forbidden fields from client data
        let updateData = sanitizeClientData(body.data);
        // NOTE: Ownership validation and tracking fields (updated_by, updated_at) are now auto-handled in Database class

        // Clean API: update(id, data) - Security validation now in Database class
        result = await database.update(body.id, updateData);

        // Clear config cache to ensure fresh data on next request
        clearCachedConfig(host);
        break;

      case 'DELETE':
        if (!body?.id) throw new Error('Record ID required');

        // Clean API: delete(id) - Ownership validation now in Database class
        result = await database.delete(body.id);

        // Clear config cache to ensure fresh data on next request
        clearCachedConfig(host);
        break;

      default:
        return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // 7. Extract data from result format
    let responseData = result;
    
    // Handle enhanced Database result format { success, error, data }
    if (result && typeof result === 'object' && 'success' in result) {
      if (!result.success) {
        throw new Error(result.error || 'Database operation failed');
      }
      responseData = result.data;
    }
    
    // 8. Security field filtering is already applied by the Database class
    // (see core/database.js applySecurityFiltering call in fetch/search methods)
    // No need to re-apply here — doing so causes duplicate validation and
    // can trigger false "Authentication required" errors for public-read databases.

    // 9. Sanitize and return data
    // Pass the database schema so rich_text fields aren't HTML-escaped
    const databaseSchema = databases[resolvedParams.database]?.schema;
    const sanitizedResult = sanitizeData(responseData, databaseSchema);

    // Build response with optional total count for server-side pagination
    const response = { data: sanitizedResult };
    if (result && result.total !== undefined) {
      response.total = result.total;
    }

    return NextResponse.json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Data API Error:', error);

    // Log error to functionLogs for developer visibility (async, don't wait)
    if (requestContext.siteId) {
      logDatabaseError(requestContext, error, duration).catch(() => {
        // Silently ignore logging failures
      });
    }

    // ⚠️ SECURITY: Never expose internal error details to client
    // This prevents database query leakage and other sensitive information
    const isDev = process.env.NODE_ENV === 'development';

    // Sanitize error message - remove sensitive details
    let sanitizedMessage = 'Operation failed';
    let statusCode = error.status || 500;

    // Handle timeout errors specifically
    if (error.message?.includes('timeout')) {
      sanitizedMessage = 'Request timed out';
      statusCode = 504; // Gateway Timeout
    } else if (isDev) {
      // In development, provide more context but still sanitize
      if (error.message?.includes('Authentication required')) {
        sanitizedMessage = 'Authentication required';
        statusCode = 401;
      } else if (error.message?.includes('Not authorized')) {
        sanitizedMessage = 'Not authorized';
        statusCode = 403;
      } else if (error.message?.includes('not found')) {
        sanitizedMessage = 'Resource not found';
        statusCode = 404;
      } else if (error.message?.includes('validation') || error.message?.includes('Invalid')) {
        sanitizedMessage = 'Validation error';
        statusCode = 400;
      } else if (error.message?.includes('Database') || error.message?.includes('collection')) {
        sanitizedMessage = 'Database operation failed';
      } else {
        sanitizedMessage = 'Operation failed';
      }
    }

    return NextResponse.json({
      error: sanitizedMessage,
      code: error.code || 'OPERATION_FAILED',
      data: [] // Return empty array for graceful degradation
    }, {
      status: statusCode
    });
  }
}

// Export handler for all methods
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;