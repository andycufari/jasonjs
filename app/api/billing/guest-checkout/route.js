// app/api/billing/guest-checkout/route.js
import { NextResponse } from 'next/server';
import { getSite } from '@/core/sites/files';
import { getBillingConfig, getProviderConfig } from '@/core/services/billing/config';
import StripeProvider from '@/core/services/billing/providers/stripe';
import MercadoPagoProvider from '@/core/services/billing/providers/mercadopago';
import { resolveSite } from '@/core/sites/resolve';

/**
 * Guest (anonymous) one-time checkout with dynamic line items.
 * POST /api/billing/guest-checkout
 *
 * No login required. The buyer's email is provided in the body and used as the
 * payment-provider customer identifier (MercadoPago uses email as payer id).
 * An `orderId` links the resulting payment back to the app's own order, so the
 * webhook can mark that order paid via a worker event (no userId needed).
 *
 * Body:
 * {
 *   items: [ { name, amount (cents), quantity?, description? } ],
 *   email: "buyer@example.com",   // REQUIRED — buyer email (payer)
 *   orderId: "PI-12345",          // REQUIRED — your app's order id, echoed in metadata
 *   currency: "ARS",              // optional, defaults by provider (MP -> ARS)
 *   returnUrl: "/confirmation",   // optional
 *   cancelUrl: "/checkout",       // optional
 *   metadata: {}                  // optional extra metadata
 * }
 */
export async function POST(request) {
  try {
    const url = new URL(request.url);
    const { host: domain } = await resolveSite(request);

    const { items, email, orderId, currency, returnUrl, cancelUrl, metadata = {} } = await request.json();

    // Email is required — it's the payer identity for the provider
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email is required for guest checkout' }, { status: 400 });
    }

    // orderId is required — it's how the webhook links the payment back to the order
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId is required for guest checkout' }, { status: 400 });
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required and must not be empty' }, { status: 400 });
    }
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

    // Resolve billing config + provider
    const billingConfig = await getBillingConfig(domain);
    if (!billingConfig) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 404 });
    }
    const { providerName, providerConfig } = getProviderConfig(billingConfig);
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

    // Site id (for metadata + webhook routing)
    const site = await getSite(domain);
    const siteId = site?._id?.toString() || site?.siteId || domain;

    const checkoutCurrency = currency || (providerName === 'mercadopago' ? 'ARS' : 'USD');

    // No getOrCreateCustomer: pass the buyer email straight through as the
    // provider customer identifier. MercadoPago uses payer.email; Stripe accepts
    // an email-only customer for one-time Checkout sessions.
    const checkoutSession = await provider.createCustomCheckout(
      email,
      items,
      {
        currency: checkoutCurrency,
        returnUrl: returnUrl ? `${url.origin}${returnUrl}` : `${url.origin}${providerConfig.returnUrl || '/'}`,
        cancelUrl: cancelUrl ? `${url.origin}${cancelUrl}` : `${url.origin}${providerConfig.cancelUrl || '/'}`,
        metadata: {
          ...metadata,
          orderId,
          guest: true,
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
    console.error('Guest checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create guest checkout' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
