// app/api/billing/cancel/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSettings, getSite } from '@/core/sites/files';
import { createAuthOptions } from '@/core/auth/options';
import { getBillingConfig } from '@/core/services/billing/config';
import { getActiveSubscription } from '@/core/services/billing/subscription';
import StripeProvider from '@/core/services/billing/providers/stripe';
import MercadoPagoProvider from '@/core/services/billing/providers/mercadopago';
import { resolveSite } from '@/core/sites/resolve';

/**
 * Cancel current user's subscription
 * POST /api/billing/cancel
 */
export async function POST(request) {
  try {
    const { host: domain } = await resolveSite(request);

    // Get auth settings and create auth options
    const authSettings = await getSettings(domain, 'auth');
    const authOptions = await createAuthOptions({ settings: { auth: authSettings } });
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { immediately = false } = await request.json();

    // Get billing configuration (with env vars resolved)
    const billingConfig = await getBillingConfig(domain);
    if (!billingConfig) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 404 });
    }

    // Get site configuration to extract siteId
    const site = await getSite(domain);
    const siteId = site?._id?.toString() || site?.siteId || domain;

    // Get active subscription from shared billing collection
    const subscription = await getActiveSubscription(siteId, session.user.id);

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 404 });
    }

    // Initialize provider
    const providerName = subscription.provider;
    const providerConfig = billingConfig[providerName];

    if (!providerConfig) {
      return NextResponse.json({ error: `Provider ${providerName} not configured` }, { status: 404 });
    }

    let provider;
    if (providerName === 'stripe') {
      provider = new StripeProvider(providerConfig);
    } else if (providerName === 'mercadopago') {
      provider = new MercadoPagoProvider(providerConfig);
    } else {
      return NextResponse.json({ error: `Unsupported provider: ${providerName}` }, { status: 400 });
    }

    // Cancel subscription in provider
    const result = await provider.cancelSubscription(subscription.subscriptionId, { immediately });

    // Update will happen via webhook, but we can return immediate result
    return NextResponse.json({
      success: true,
      message: immediately ? 'Subscription canceled immediately' : 'Subscription will cancel at period end',
      subscription: {
        id: result.id,
        status: result.status,
        cancelAtPeriodEnd: result.cancelAtPeriodEnd,
      },
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ error: error.message || 'Failed to cancel subscription' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
