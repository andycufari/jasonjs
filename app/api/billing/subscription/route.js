// app/api/billing/subscription/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSettings, getSite } from '@/core/sites/files';
import { resolveSite } from '@/core/sites/resolve';
import { createAuthOptions } from '@/core/auth/options';
import { getBillingConfig } from '@/core/services/billing/config';
import { getActiveSubscription, getUserPlan } from '@/core/services/billing/subscription';

/**
 * Get current user's subscription status
 * GET /api/billing/subscription
 *
 * Queries the billing_subscriptions shared collection to get the user's active subscription.
 * This data is synced from Stripe/MercadoPago via webhooks.
 */
export async function GET(request) {
  try {
    const { host: domain } = await resolveSite(request);

    // Get auth settings and create auth options
    const authSettings = await getSettings(domain, 'auth');
    const authOptions = await createAuthOptions({ settings: { auth: authSettings } });
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get billing config to check if billing is enabled
    const billingConfig = await getBillingConfig(domain);
    if (!billingConfig?.provider) {
      return NextResponse.json({ error: 'Billing not configured' }, { status: 404 });
    }

    // Get site configuration to extract siteId
    const site = await getSite(domain);
    const siteId = site?._id?.toString() || site?.siteId || domain;

    // Query actual subscription from shared billing collection
    const subscription = await getActiveSubscription(siteId, session.user.id);

    console.log(`[Subscription API] siteId=${siteId}, userId=${session.user.id}, found:`, subscription ? {
      id: subscription.subscriptionId,
      status: subscription.status,
      planId: subscription.planId,
    } : 'null');

    if (!subscription) {
      return NextResponse.json({
        subscription: null,
        plan: null,
        message: 'No active subscription'
      });
    }

    // Get plan details from billing config
    const userPlan = await getUserPlan(siteId, session.user.id, billingConfig);

    return NextResponse.json({
      subscription: {
        id: subscription.subscriptionId,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
        provider: subscription.provider,
      },
      plan: userPlan ? {
        id: userPlan.id,
        name: userPlan.name,
        features: userPlan.features || [],
        status: userPlan.status,
      } : null,
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ error: 'Failed to get subscription status' }, { status: 500 });
  }
}
