// app/api/data/[database]/schema/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getSite } from '@/core/sites/files';
import { resolveSite } from '@/core/sites/resolve';
import { getAllDatabases } from '@/core/sites/files.js';
import { getServerSession } from 'next-auth/next';
import { createAuthOptions } from '@/core/auth/options.js';
import { validateSecurity } from '@/core/security/fieldFilter.js';

// Cache for 1 hour by default
export const revalidate = 3600;

// In-memory cache for database configurations
const configCache = new Map();
const CACHE_TTL = 60000; // 1 minute cache

function getCachedConfig(host) {
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

// ⚠️ CRITICAL SECURITY: Database access validation
function validateDatabaseAccess(databaseName) {
  const FORBIDDEN_DATABASES = [
    'users',           // User database - only auth functions allowed
    'sites',           // Site configurations  
    'startups',        // Site records (legacy collection name)
    'admin',           // Admin data
    'system',          // System data
    'auth',            // Authentication data
    'sessions',        // Session data
    'config',          // Configuration data
    'settings',        // Settings data
    'secrets',         // Secret data
    'keys',            // API keys
    'tokens',          // Access tokens
    'logs',            // System logs
    'analytics',       // Analytics data
    'billing',         // Billing data
    'payments',        // Payment data
  ];
  
  // Block access to system/user databases from client-side
  if (FORBIDDEN_DATABASES.includes(databaseName.toLowerCase())) {
    throw new Error(`Access to '${databaseName}' database is restricted. Use server functions for user/system data.`);
  }
  
  // Additional check: databases starting with underscore are system databases
  if (databaseName.startsWith('_')) {
    throw new Error(`System databases (starting with _) are not accessible from client-side.`);
  }
}

// Handler for schema requests
async function handler(request, { params }) {
  try {
    // Await params for Next.js 15 compatibility
    const resolvedParams = await params;
    
    // 1. Validate domain and get host
    const host = await validateDomainAccess(request);
    
    // 2. Get domain configuration (with caching)
    let cachedData = getCachedConfig(host);
    let site, databases;
    
    if (cachedData) {
      ({ site, databases } = cachedData);
    } else {
      site = await getSite(host);
      if (!site) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
      }

      // Use getAllDatabases which supports both legacy (settings/database.json)
      // and new format (databases/*.json with class='database')
      databases = await getAllDatabases(host);
      if (!databases || Object.keys(databases).length === 0) {
        return NextResponse.json({ error: 'Databases not found' }, { status: 404 });
      }
      
      // Cache the configuration
      setCachedConfig(host, { site, databases });
    }
    
    // 3. Check if database exists
    if (!databases?.[resolvedParams.database]) {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    // 4. Get user session for security context
    const authOptions = await createAuthOptions({ host });
    const session = await getServerSession(authOptions);

    // 5. Validate database access
    validateDatabaseAccess(resolvedParams.database);

    // 6. Get the database configuration
    const databaseConfig = databases[resolvedParams.database];
    
    // 7. Validate security for read operations (schema is read-only)
    const security = validateSecurity(
      databaseConfig, 
      'GET',
      session
    );

    // 8. Return the schema directly from database config
    // Schema definitions should be available for form building regardless of data access permissions
    // Security filtering should only apply to actual data queries, not schema definitions
    const schema = databaseConfig.schema || {};
    
    // 9. Return schema information
    return NextResponse.json({ 
      schema: schema,
      database: resolvedParams.database,
      type: databaseConfig.type || 'unknown',
      security: {
        level: security.level,
        canRead: true, // User has read access if they reached this point
        canCreate: security.level !== 'none' && databaseConfig.security?.create?.level !== 'none',
        canUpdate: security.level !== 'none' && databaseConfig.security?.update?.level !== 'none',
        canDelete: security.level !== 'none' && databaseConfig.security?.delete?.level !== 'none'
      }
    });

  } catch (error) {
    console.error('Schema API Error:', error);
    
    // ⚠️ SECURITY: Never expose internal error details to client
    const isDev = process.env.NODE_ENV === 'development';
    
    // Sanitize error message
    let sanitizedMessage = 'Failed to fetch schema';
    
    if (isDev) {
      if (error.message?.includes('not found')) {
        sanitizedMessage = 'Database or schema not found';
      } else if (error.message?.includes('restricted')) {
        sanitizedMessage = 'Access to this database is restricted';
      }
    }
    
    return NextResponse.json({
      error: sanitizedMessage,
      code: 'SCHEMA_FETCH_FAILED'
    }, { 
      status: error.status || 500 
    });
  }
}

// Only support GET requests for schema
export const GET = handler;