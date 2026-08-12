// app/api/billing/payment-link/route.js
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
 * Create a payment link for one-time payment
 * POST /api/billing/payment-link
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

    const { paymentLinkId, returnUrl, cancelUrl, metadata = {} } = await request.json();

    if (!paymentLinkId) {
      return NextResponse.json({ error: 'Payment link ID is required' }, { status: 400 });
    }

    // Get billing configuration (with env vars resolved)
    const billingConfig = await getBillingConfig(domain);
    if (!billingConfig) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 404 });
    }

    const { providerName, providerConfig } = getProviderConfig(billingConfig);

    // Find payment link configuration
    const paymentLinkConfig = providerConfig.paymentLinks?.find(pl => pl.id === paymentLinkId);
    if (!paymentLinkConfig) {
      return NextResponse.json({ error: `Payment link ${paymentLinkId} not found` }, { status: 404 });
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

    const paymentLink = await provider.createPaymentLink(
      customer.customerId,
      paymentLinkConfig.amount,
      paymentLinkConfig.description,
      {
        currency: paymentLinkConfig.currency || 'usd',
        returnUrl: returnUrl || `${url.origin}${providerConfig.returnUrl || '/billing/success'}`,
        cancelUrl: cancelUrl || `${url.origin}${providerConfig.cancelUrl || '/billing/canceled'}`,
        metadata: {
          ...metadata,
          paymentLinkId,
          userId: session.user.id,
          siteId,
        },
      }
    );

    return NextResponse.json({
      url: paymentLink.url,
      paymentId: paymentLink.id,
    });

  } catch (error) {
    console.error('Create payment link error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create payment link' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
