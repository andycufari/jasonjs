// app/api/billing/custom-checkout/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSettings, getSite } from '@/core/sites/files';
import { createAuthOptions } from '@/core/auth/options';
import { getOrCreateCustomer } from '@/core/services/billing/customer';
import { getBillingConfig, getProviderConfig } from '@/core/services/billing/config';
import StripeProvider from '@/core/services/billing/providers/stripe';
import MercadoPagoProvider from '@/core/services/billing/providers/mercadopago';
import { resolveSite } from '@/core/sites/resolve';

/**
 * Create a custom checkout session with dynamic line items
 * POST /api/billing/custom-checkout
 *
 * Body:
 * {
 *   items: [
 *     { name: "Product A", amount: 2999, quantity: 2, description: "Optional description" },
 *     { name: "Product B", amount: 1500, quantity: 1 }
 *   ],
 *   currency: "usd", // optional, defaults to provider config or usd/ars
 *   returnUrl: "/success", // optional
 *   cancelUrl: "/canceled", // optional
 *   metadata: {} // optional
 * }
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

    const { items, currency, returnUrl, cancelUrl, metadata = {} } = await request.json();

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required and must not be empty' }, { status: 400 });
    }

    // Validate each item
    for (const item of items) {
      if (!item.name || typeof item.name !== 'string') {
        return NextResponse.json({ error: 'Each item must have a name (string)' }, { status: 400 });
      }
      if (!item.amount || typeof item.amount !== 'number' || item.amount <= 0) {
        return NextResponse.json({ error: 'Each item must have a valid amount (positive number in cents)' }, { status: 400 });
      }
      if (item.quantity && (typeof item.quantity !== 'number' || item.quantity <= 0)) {
        return NextResponse.json({ error: 'Item quantity must be a positive number' }, { status: 400 });
      }
    }

    // Get billing configuration (with env vars resolved)
    const billingConfig = await getBillingConfig(domain);
    if (!billingConfig) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 404 });
    }

    const { providerName, providerConfig } = getProviderConfig(billingConfig);

    if (!providerConfig) {
      return NextResponse.json({ error: `Provider ${providerName} not configured` }, { status: 404 });
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
    const customerType = billingConfig.customerType || 'user';

    // Get or create customer with proper userId ↔ customerId mapping
    const customer = await getOrCreateCustomer(siteId, provider, {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      customerType,
    });

    // Determine currency - use provided, or default based on provider
    const checkoutCurrency = currency || (providerName === 'mercadopago' ? 'ARS' : 'USD');

    const checkoutSession = await provider.createCustomCheckout(
      customer.customerId,
      items,
      {
        currency: checkoutCurrency,
        returnUrl: returnUrl ? `${url.origin}${returnUrl}` : `${url.origin}${providerConfig.returnUrl || '/billing/success'}`,
        cancelUrl: cancelUrl ? `${url.origin}${cancelUrl}` : `${url.origin}${providerConfig.cancelUrl || '/billing/canceled'}`,
        metadata: {
          ...metadata,
          userId: session.user.id,
          siteId,
          customCheckout: true,
        },
      }
    );

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });

  } catch (error) {
    console.error('Create custom checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create custom checkout' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
