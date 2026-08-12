// app/api/analytics/dashboard/route.js
// Analytics dashboard endpoint with tenant isolation

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createAuthOptions } from '@/core/auth/options.js';
import { resolveSite } from '@/core/sites/resolve';
import analyticsTracker from '../../../../core/services/tracking/analytics.js';

/**
 * ANALYTICS DASHBOARD API
 * 
 * Secure analytics dashboard data retrieval
 * Requires authentication and automatic tenant isolation
 */

export async function GET(request) {
  try {
    // 1. Get auth options for this domain
    const { host } = await resolveSite(request);
    const authOptions = await createAuthOptions({ host });
    
    // 2. Authentication required for dashboard access
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required for analytics dashboard' },
        { status: 401 }
      );
    }
    
    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days')) || 30;
    const type = searchParams.get('type') || 'overview';
    
    console.log(`Analytics dashboard request for host ${host}: ${type} (${days} days)`);
    
    let result;
    
    switch (type) {
      case 'overview':
        result = await analyticsTracker.getDashboard(host, days);
        break;
        
      case 'events':
        result = await analyticsTracker.getEvents(host, {
          startDate: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)),
          limit: 1000,
          sortBy: 'timestamp',
          sortOrder: -1
        });
        break;
        
      case 'funnel':
        const funnelName = searchParams.get('funnel');
        if (!funnelName) {
          return NextResponse.json(
            { error: 'Funnel name is required for funnel analysis' },
            { status: 400 }
          );
        }
        result = await analyticsTracker.getFunnelAnalysis(host, funnelName, days);
        break;
        
      default:
        return NextResponse.json(
          { error: `Unknown dashboard type: ${type}` },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      type,
      siteId: result.siteId, // Use siteId from result (resolved by analytics service)
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Analytics dashboard API error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Dashboard request failed',
        success: false 
      },
      { status: 500 }
    );
  }
}