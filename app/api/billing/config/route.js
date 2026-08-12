// app/api/billing/config/route.js
import { NextResponse } from 'next/server';
import { resolveSite } from '@/core/sites/resolve';
import { getBillingConfig, getPublicBillingConfig } from '@/core/services/billing/config';

/**
 * Get public billing configuration
 * GET /api/billing/config
 *
 * Returns only public-safe data (no secrets):
 * - Provider name
 * - Plans (id, name, price, features - NO priceId)
 * - Publishable keys (safe for client-side)
 */
export async function GET(request) {
  try {
    const { host: domain } = await resolveSite(request);

    // Get billing config via fileSystem abstraction
    const billingConfig = await getBillingConfig(domain);
    if (!billingConfig) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 404 });
    }

    // Filter to public-safe data only (no secrets)
    const publicConfig = getPublicBillingConfig(billingConfig);
    if (!publicConfig) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 404 });
    }

    return NextResponse.json(publicConfig, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Get billing config error:', error);
    return NextResponse.json({ error: 'Failed to get billing config' }, { status: 500 });
  }
}
