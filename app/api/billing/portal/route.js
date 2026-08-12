// app/api/billing/portal/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSettings, getSite } from '@/core/sites/files';
import { createAuthOptions } from '@/core/auth/options';
import { getBillingConfig } from '@/core/services/billing/config';
import { getCustomer } from '@/core/services/billing/customer';
import { resolveSite } from '@/core/sites/resolve';
import Stripe from 'stripe';

/**
 * Create Stripe Customer Portal session
 * GET /api/billing/portal
 *
 * Redirects user to Stripe's hosted customer portal where they can:
 * - Update payment method
 * - View invoices
 * - Cancel subscription
 */
export async function GET(request) {
  try {
    const { host: domain } = await resolveSite(request);

    // Get auth settings and create auth options
    const authSettings = await getSettings(domain, 'auth');
    const authOptions = await createAuthOptions({ settings: { auth: authSettings } });
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Get billing config
    const billingConfig = await getBillingConfig(domain);
    if (!billingConfig?.stripe?.secretKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 404 });
    }

    // Get site configuration to extract siteId
    const site = await getSite(domain);
    const siteId = site?._id?.toString() || site?.siteId || domain;

    // Find customer record
    const customer = await getCustomer(siteId, session.user.id, 'stripe');

    if (!customer) {
      // No customer record - redirect to pricing page
      return NextResponse.redirect(new URL('/?billing=true', request.url));
    }

    // Initialize Stripe
    const stripe = new Stripe(billingConfig.stripe.secretKey);

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.customerId,
      return_url: `${request.headers.get('origin') || 'http://localhost:3000'}/app`,
    });

    // Redirect to Stripe portal
    return NextResponse.redirect(portalSession.url);

  } catch (error) {
    console.error('Billing portal error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create portal session' }, { status: 500 });
  }
}
