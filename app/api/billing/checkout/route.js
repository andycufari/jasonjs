// app/api/billing/checkout/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSettings, getSite } from '@/core/sites/files';
import { resolveSite } from '@/core/sites/resolve';
import { createAuthOptions } from '@/core/auth/options';
import { getBillingConfig, getProviderConfig } from '@/core/services/billing/config';
import { getOrCreateCustomer } from '@/core/services/billing/customer';
import StripeProvider from '@/core/services/billing/providers/stripe';
import MercadoPagoProvider from '@/core/services/billing/providers/mercadopago';

/**
 * Create a checkout session for subscription
 * POST /api/billing/checkout
 *
 * Flow:
 * 1. Authenticate user
 * 2. Get billing config via fileSystem
 * 3. Find the plan
 * 4. Get or create customer (stores userId ↔ Stripe customerId mapping)
 * 5. Create checkout session with customer ID (not email)
 * 6. Return checkout URL
 */
export async function POST(request) {
  try {
    const url = new URL(request.url);
    const { host: domain } = await resolveSite(request);

    // Get auth settings and create auth options
    const authSettings = await getSettings(domain, 'auth');
    const authOptions = await createAuthOptions({ settings: { auth: authSettings } });
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse request body
    const { planId, returnUrl, cancelUrl, metadata = {} } = await request.json();

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Get billing configuration (with env vars resolved)
    const billingConfig = await getBillingConfig(domain);
    if (!billingConfig) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 404 });
    }

    // Get provider configuration
    const { providerName, providerConfig } = getProviderConfig(billingConfig);
    if (!providerConfig) {
      return NextResponse.json({ error: `Provider ${providerName} not configured` }, { status: 404 });
    }

    // Find the plan in config
    const plan = providerConfig.plans?.find(p => p.id === planId);
    if (!plan) {
      return NextResponse.json({ error: `Plan ${planId} not found` }, { status: 404 });
    }

    // Initialize provider
    let provider;
    if (providerName === 'stripe') {
      provider = new StripeProvider(providerConfig);
    } else if (providerName === 'mercadopago') {
      provider = new MercadoPagoProvider(providerConfig);
    } else {
      return NextResponse.json({ error: `Unsupported provider: ${providerName}` }, { status: 400 });
    }

    // Get site configuration to extract siteId
    const site = await getSite(domain);
    const siteId = site?._id?.toString() || site?.siteId || domain;

    // Get customer type from billing config (default: 'user')
    // 'user' = direct user billing
    // 'account' = account-based billing (future SaaS support)
    const customerType = billingConfig.customerType || 'user';

    // Get or create customer with proper userId ↔ customerId mapping
    // This stores the relationship in billing_customers shared collection
    const customer = await getOrCreateCustomer(siteId, provider, {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      customerType,
    });

    console.log(`Checkout: Using customer ${customer.customerId} for user ${session.user.id}`);

    // Create checkout session with ACTUAL customer ID (not email)
    // This ensures Stripe associates the subscription with the correct customer
    const checkoutSession = await provider.createCheckoutSession(
      customer.customerId, // Use the Stripe customer ID (cus_xxx)
      planId,
      {
        returnUrl: returnUrl
          ? `${url.origin}${returnUrl}`
          : `${url.origin}${providerConfig.returnUrl || '/billing/success'}`,
        cancelUrl: cancelUrl
          ? `${url.origin}${cancelUrl}`
          : `${url.origin}${providerConfig.cancelUrl || '/billing/canceled'}`,
        // Note: customerEmail not needed since we're using customer ID
        metadata: {
          ...metadata,
          userId: session.user.id,
          userEmail: session.user.email,
          siteId,
          planId,
        },
      }
    );

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
