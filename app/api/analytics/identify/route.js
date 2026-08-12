// app/api/analytics/identify/route.js
// User identification endpoint with tenant isolation

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createAuthOptions } from '@/core/auth/options.js';
import { resolveSite } from '@/core/sites/resolve';
import analyticsTracker from '../../../../core/services/tracking/analytics.js';

/**
 * ANALYTICS USER IDENTIFICATION API
 * 
 * Secure user identification for analytics
 * Requires authentication and automatic tenant isolation
 */

export async function POST(request) {
  try {
    // 1. Get auth options for this domain
    const { host } = await resolveSite(request);
    const authOptions = await createAuthOptions({ host });
    
    // 2. Authentication required for user identification
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required for user identification' },
        { status: 401 }
      );
    }
    
    // Extract user ID
    const userId = session.user.id;
    
    // 2. Parse and validate request
    const body = await request.json();
    const { traits = {} } = body;
    
    // 3. Add server-side user context
    const serverTraits = {
      ...traits,
      $email: session.user.email,
      $name: session.user.name,
      $avatar: session.user.image,
      $identifiedAt: new Date().toISOString(),
      $serverIdentification: true
    };
    
    // 4. Identify the user - pass host and let analytics service resolve siteId
    console.log(`Analytics user identification for host ${host}: ${userId}`);
    
    const result = await analyticsTracker.identify(host, userId, serverTraits);
    
    return NextResponse.json({
      success: true,
      siteId: result.siteId,
      userId: result.userId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Analytics identification API error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'User identification failed',
        success: false 
      },
      { status: 500 }
    );
  }
}