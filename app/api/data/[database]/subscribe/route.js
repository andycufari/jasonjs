// app/api/data/[database]/subscribe/route.js
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Database from '@/core/db';
import { getAllDatabases } from '@/core/sites/files.js';
import { getServerSession } from 'next-auth';
import { createAuthOptions } from '@/core/auth/options';
import { resolveSite } from '@/core/sites/resolve';
import { loadPageDefinition } from '@/core/render/loadPage';

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

// Validate security rules for subscriptions
async function validateSubscriptionSecurity(database, session) {
  const security = database.security?.read;
  
  if (!security) return true; // No security rules means allow all

  switch (security.level) {
    case 'authenticated':
      if (!session) throw new Error('Authentication required');
      break;
    case 'owner':
      if (!session?.user?.id) throw new Error('Owner authentication required');
      break;
    case 'admin':
      if (!session?.user?.role || session.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      break;
  }

  return security;
}

// Handle GET requests for Server-Sent Events
export async function GET(request, { params }) {
  try {
    // Await params for NextJS 15 compatibility
    const resolvedParams = await params;
    
    // 1. Validate domain and get host
    const host = await validateDomainAccess(request);
    
    // 2. Get authentication options
    // For API routes, create a default pageData since loadPageDefinition might return null for auth pages
    const authOptions = await createAuthOptions({
      domain: host,
      auth: {
        providers: {
          credentials: { enabled: true }
        }
      }
    });

    const session = await getServerSession(authOptions);

    // 3. Get database configuration via the unified file system
    // (merges databases/*.json with legacy settings/database.json,
    //  from the local sites/ folder or the registered adapter)
    const databases = await getAllDatabases(host);

    if (!databases || Object.keys(databases).length === 0) {
      return NextResponse.json({ error: 'Database configuration not found' }, { status: 404 });
    }

    if (!databases?.[resolvedParams.database]) {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    // 4. Validate security rules
    await validateSubscriptionSecurity(databases[resolvedParams.database], session);

    // 5. Check if database supports real-time subscriptions
    const databaseConfig = databases[resolvedParams.database];
    if (databaseConfig.type !== 'mongodb') {
      return NextResponse.json({ 
        error: 'Real-time subscriptions only supported for MongoDB databases' 
      }, { status: 400 });
    }

    // 6. Initialize database handler
    const database = new Database(databases, resolvedParams);
    database.select(resolvedParams.database);

    // 7. Extract subscription filters from query parameters
    const url = new URL(request.url);
    const filters = {};
    
    // Extract filter_* parameters
    url.searchParams.forEach((value, key) => {
      if (key.startsWith('filter_')) {
        const filterKey = key.replace('filter_', '');
        filters[filterKey] = value;
      }
    });

    console.log('Starting subscription with filters:', filters);

    // 8. Create Server-Sent Events stream
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection confirmation
        controller.enqueue(`data: ${JSON.stringify({
          type: 'connected',
          timestamp: new Date().toISOString()
        })}\n\n`);

        // Create subscription
        database.subscribe(filters, (change) => {
          try {
            const eventData = `data: ${JSON.stringify(change)}\n\n`;
            controller.enqueue(eventData);
          } catch (error) {
            console.error('Error sending change event:', error);
          }
        }).then(subscription => {
          // Store subscription for cleanup
          controller.subscription = subscription;
        }).catch(error => {
          console.error('Subscription error:', error);
          controller.enqueue(`data: ${JSON.stringify({
            type: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
          })}\n\n`);
        });
      },
      
      cancel() {
        // Cleanup subscription when client disconnects
        if (this.subscription) {
          this.subscription.unsubscribe().catch(console.error);
        }
        console.log('Subscription cancelled');
      }
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('Subscription API Error:', error);
    
    // Return safe error message
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json({
      error: isDev ? error.message : 'Subscription failed',
      code: error.code || 'SUBSCRIPTION_ERROR'
    }, { 
      status: error.status || 500 
    });
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control',
    },
  });
}