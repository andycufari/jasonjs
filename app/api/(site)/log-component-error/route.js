// app/api/(site)/log-component-error/route.js

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getSite } from '@/core/sites/files';
import { resolveSite } from '@/core/sites/resolve';
import { getServerSession } from 'next-auth/next';
import { createAuthOptions } from '@/core/auth/options.js';
import { logCompilationError } from '@/core/services/componentErrorLogger.js';

/**
 * Internal endpoint for logging client-side component compilation errors
 *
 * This endpoint receives errors from DynamicComponentLoader when compilation fails
 * and logs them to the Studio database using the existing appLog infrastructure.
 *
 * Security:
 * - Internal use only (called from DynamicComponentLoader)
 * - Only logs when dev mode is active (checked client-side before sending)
 * - Uses same security pattern as function execution route
 * - Logs to Studio database (function_logs collection)
 */

export async function POST(request) {
  try {
    // Get hostname from HTTP request (server-side, cannot be spoofed)
    const { host } = await resolveSite();

    // Look up site in database by hostname
    const site = await getSite(host);
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Extract siteId for database isolation
    const siteId = site._id ? site._id.toString() : null;
    if (!siteId) {
      return NextResponse.json({ error: 'Invalid site configuration' }, { status: 500 });
    }

    // Get session for authenticated user tracking
    const authOptions = await createAuthOptions({ host });
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    // Parse request body
    let errorData;
    try {
      errorData = await request.json();
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Validate required fields
    const { componentName, error, bundle, sessionId } = errorData;
    if (!componentName || !error) {
      return NextResponse.json({
        error: 'Missing required fields: componentName, error'
      }, { status: 400 });
    }

    // Log the compilation error using componentErrorLogger
    await logCompilationError(
      componentName,
      {
        message: error.message || 'Unknown error',
        stack: error.stack || ''
      },
      {
        hash: bundle?.hash,
        version: bundle?.version
      },
      {
        domain: host,
        siteId: siteId,
        userId: userId,
        sessionId: sessionId
      }
    );

    // Return success (fire-and-forget pattern)
    return NextResponse.json({ success: true });

  } catch (error) {
    // Log error but don't expose details to client
    console.error('Error logging component error:', error);

    // Return generic error (don't leak internal details)
    return NextResponse.json({
      error: 'Failed to log component error'
    }, { status: 500 });
  }
}
