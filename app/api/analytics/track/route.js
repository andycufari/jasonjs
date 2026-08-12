// app/api/analytics/track/route.js
// Analytics tracking endpoint with tenant isolation

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createAuthOptions } from '@/core/auth/options.js';
import { resolveSite } from '@/core/sites/resolve';
import analyticsTracker from '../../../../core/services/tracking/analytics.js';

/**
 * ANALYTICS TRACKING API
 * 
 * Secure server-side analytics event tracking
 * Automatic tenant isolation using siteId from session
 */

export async function POST(request) {
  try {
    // 1. Get auth options for this domain
    const { host } = await resolveSite(request);
    const authOptions = await createAuthOptions({ host });
    
    // 2. Authentication check (optional - can track anonymous events)
    const session = await getServerSession(authOptions);
    
    // Extract user context
    let userId = null;
    
    if (session?.user) {
      userId = session.user.id;
    }
    
    // 3. Parse and validate request
    const body = await request.json();
    const { event, properties = {} } = body;
    
    if (!event) {
      return NextResponse.json(
        { error: 'Event name is required' },
        { status: 400 }
      );
    }
    
    // 4. Track the event - pass host and let analytics service resolve siteId.
    // Tier 2 path: user-initiated events via app.analytics.track().
    // We intentionally do NOT add $ip, $userAgent, or $serverTimestamp here.
    // Client properties flow through as-is; userId comes from the session.
    const result = await analyticsTracker.track(
      host,
      event,
      properties,
      userId
    );
    
    return NextResponse.json({
      success: true,
      eventId: result.eventId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Analytics tracking API error:', error);
    
    // ⚠️ SECURITY: Never expose internal error details to client
    const isDev = process.env.NODE_ENV === 'development';
    const sanitizedMessage = isDev ? 'Analytics tracking failed' : 'Operation failed';
    
    return NextResponse.json(
      { 
        error: sanitizedMessage,
        success: false 
      },
      { status: 500 }
    );
  }
}

