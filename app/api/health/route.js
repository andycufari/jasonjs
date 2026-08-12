// app/api/health/route.js
import { NextResponse } from 'next/server';

/**
 * Health check endpoint for load balancers and monitoring
 * Returns 200 OK without any site lookup or processing
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

// Support HEAD requests for health checks
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}
