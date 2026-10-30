// app/api/billing/webhook/stripe/route.js
import { NextResponse } from 'next/server';
import { getSite } from '@/core/sites/files';
import { getBillingConfig } from '@/core/services/billing/config';
import StripeProvider from '@/core/services/billing/providers/stripe';
import { syncSubscription } from '@/core/services/billing/subscription';
import { recordPayment } from '@/core/services/billing/payment';
import {
  getCustomerByProviderId,
  createCustomerFromWebhook,
} from '@/core/services/billing/customer';
import { resolveSite } from '@/core/sites/resolve';
import { emitWorkerEvent } from '@/core/worker/events';
import { resolveStripeTarget } from '@/core/services/billing/stripeHub';
import { runBillingHandler, hasBillingHandler } from '@/core/services/billing/hooks';

/**
 * Stripe webhook handler
 * POST /api/billing/webhook/stripe
 *
 * One endpoint per Stripe account can serve every site that charges with it: events
 * carrying metadata.domain of another site are routed there (see stripeHub.js).
 *
 * Handles:
 * - checkout.session.completed: Creates customer record if missing (fallback)
 * - customer.subscription.created/updated/deleted: Syncs subscription to database
 * - invoice.payment_succeeded/failed: Records payment history
 * - one-time payments with metadata.addon → that addon's hooks/billing.js;
 *   with metadata.function (app.billing.checkout) → that site function
 * - one-time guest payments (metadata.guest + orderId) → worker event, like MercadoPago
 * - checkout.session.expired → addon hook (release whatever the checkout was holding)
 */
export async function POST(request) {
  try {
    const { host: receivingDomain } = await resolveSite(request);

    // Get site configuration (contains siteId)
    const receivingSite = await getSite(receivingDomain);
    if (!receivingSite) {
      console.error('Stripe webhook - site not found:', receivingDomain);
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get billing configuration (with env vars resolved)
    const billingConfig = await getBillingConfig(receivingDomain);
    if (!billingConfig?.stripe) {
      console.error('Stripe webhook - stripe not configured');
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 404 });
    }

    // Initialize Stripe provider
    const receivingProvider = new StripeProvider(billingConfig.stripe);

    // Verify webhook signature
    let verifiedEvent;
    try {
      verifiedEvent = await receivingProvider.verifyWebhook(request);
    } catch (error) {
      console.error('Stripe webhook verification failed:', error.message);
      return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
    }

    // Route to the site the event belongs to (this one, unless metadata says otherwise).
    let target;
    try {
      target = await resolveStripeTarget({
        event: verifiedEvent, receivingDomain, receivingSite, receivingProvider,
        receivingConfig: billingConfig.stripe,
      });
    } catch (error) {
      console.error(`Stripe webhook - routing ${verifiedEvent.id} failed:`, error.message);
      return NextResponse.json({ error: 'Routing failed' }, { status: 500 });
    }
    if (target.drop) {
      console.warn(`Stripe webhook - dropped ${verifiedEvent.type} ${verifiedEvent.id}: ${target.drop}`);
      return NextResponse.json({ received: true });
    }

    const { domain, site, provider, event } = target;
    console.log(`Stripe webhook received: ${event.type}${domain !== receivingDomain ? ` → routed to ${domain}` : ''}`);

    // Handle the event
    const normalizedEvent = await provider.handleWebhookEvent(event);

    // Extract siteId from site config (handles both database mode and standalone mode)
    const siteId = site._id?.toString() || site.siteId || domain;

    // Helper function to find or recover customer
    async function findOrRecoverCustomer(customerId) {
      // Try local lookup first (uses shared billing_customers collection)
      let localCustomer = await getCustomerByProviderId(siteId, customerId, 'stripe');

      if (localCustomer) {
        return localCustomer;
      }

      // FALLBACK: Check Stripe customer metadata for userId
      console.log(`Customer ${customerId} not found locally, checking Stripe metadata...`);
      try {
        const stripeCustomer = await provider.getCustomer(customerId);
        const userId = stripeCustomer.metadata?.userId;

        if (userId) {
          // Create missing customer record from Stripe metadata
          localCustomer = await createCustomerFromWebhook(siteId, {
            customerId,
            userId,
            email: stripeCustomer.email,
            customerType: stripeCustomer.metadata?.customerType || 'user',
            providerName: 'stripe',
            metadata: {
              recoveredFromStripe: true,
              stripeMetadata: stripeCustomer.metadata,
            },
          });

          console.log(`Recovered customer from Stripe metadata: ${customerId} -> ${userId}`);
          return localCustomer;
        }
      } catch (err) {
        console.error('Failed to recover customer from Stripe:', err.message);
      }

      return null;
    }

    // Process different event types
    switch (normalizedEvent.type) {
      // Handle checkout completion - create customer record if missing (fallback)
      case 'checkout.completed': {
        const checkoutSession = normalizedEvent.data;
        const stripeCustomerId = checkoutSession.customer;
        const userId = checkoutSession.metadata?.userId;

        console.log(`Checkout completed: session=${checkoutSession.id}, customer=${stripeCustomerId}`);

        if (!stripeCustomerId) {
          console.warn('Checkout session has no customer ID');
          break;
        }

        // Check if customer record already exists (uses shared billing_customers collection)
        let localCustomer = await getCustomerByProviderId(siteId, stripeCustomerId, 'stripe');

        if (!localCustomer && userId) {
          // FALLBACK: Create customer record from checkout metadata
          console.log(`Creating customer record from checkout: ${stripeCustomerId} -> ${userId}`);

          await createCustomerFromWebhook(siteId, {
            customerId: stripeCustomerId,
            userId,
            email: checkoutSession.customer_email || checkoutSession.customer_details?.email,
            customerType: checkoutSession.metadata?.customerType || 'user',
            providerName: 'stripe',
            metadata: {
              checkoutSessionId: checkoutSession.id,
              siteId: checkoutSession.metadata?.siteId,
            },
          });

          console.log(`Customer record created from checkout webhook`);
        } else if (localCustomer) {
          console.log(`Customer record already exists for ${stripeCustomerId}`);
        } else {
          console.warn(`Cannot create customer record: no userId in checkout metadata`);
        }
        break;
      }

      // Handle subscription events
      case 'subscription.updated':
      case 'subscription.deleted': {
        const subscription = normalizedEvent.data;

        // Find the local customer record to get userId
        const localCustomer = await findOrRecoverCustomer(subscription.customerId);

        if (!localCustomer) {
          console.warn(`Stripe webhook - could not find or recover customer: ${subscription.customerId}`);
          // Don't break - we'll log but continue to return 200
          break;
        }

        // Sync subscription to shared billing_subscriptions collection
        await syncSubscription(siteId, localCustomer.userId, {
          ...subscription,
          metadata: { ...subscription.metadata, provider: 'stripe' }
        });

        console.log(`Subscription ${normalizedEvent.type} synced for user ${localCustomer.userId}`);
        break;
      }

      // Handle payment events
      case 'payment.succeeded':
      case 'payment.failed': {
        const payment = normalizedEvent.data;

        // ADDON or FUNCTION payment: the addon (metadata.addon) or site function
        // (metadata.function, from app.billing.checkout) applies it — e.g. confirms a booking.
        // A failing handler answers 500 so Stripe retries — the money may already be taken.
        if (hasBillingHandler(payment.metadata)) {
          const hook = normalizedEvent.type === 'payment.succeeded' ? 'onPaymentSucceeded' : 'onPaymentFailed';
          const handler = payment.metadata.addon || payment.metadata.function;
          try {
            await runBillingHandler({
              metadata: payment.metadata, hook, domain, siteId, payload: { payment, provider },
            });
          } catch (error) {
            console.error(`Stripe webhook - ${handler}.${hook} failed for ${payment.id}:`, error);
            return NextResponse.json({ error: 'Billing handler failed' }, { status: 500 });
          }
          break;
        }

        // GUEST one-time payment: no billing_customer / userId. Linked to the app's own
        // order via metadata.orderId — same worker event as the MercadoPago webhook.
        const orderId = payment.metadata?.orderId;
        const isGuest = payment.metadata?.guest === true || payment.metadata?.guest === 'true';
        if (isGuest && orderId) {
          const eventName = normalizedEvent.type === 'payment.succeeded'
            ? 'billing:guest_payment_succeeded'
            : 'billing:guest_payment_failed';
          await emitWorkerEvent({
            siteId,
            domain,
            eventName,
            payload: {
              orderId,
              status: payment.status,        // 'succeeded' | 'failed'
              paymentId: payment.id,
              amount: payment.amount,        // cents
              currency: payment.currency,
              email: payment.email,
              metadata: payment.metadata,
            },
          });
          console.log(`Guest ${normalizedEvent.type} emitted for order ${orderId} (payment ${payment.id})`);
          break;
        }

        // Find userId from customer
        const localCustomer = await findOrRecoverCustomer(payment.customerId);

        if (!localCustomer) {
          console.warn(`Stripe webhook - could not find or recover customer for payment: ${payment.customerId}`);
          break;
        }

        // Record payment to shared billing_payments collection
        await recordPayment(siteId, localCustomer.userId, {
          ...payment,
          metadata: { ...payment.metadata, provider: 'stripe' }
        });

        console.log(`Payment ${payment.status} recorded for user ${localCustomer.userId}`);
        break;
      }

      // Delayed payment method: the money isn't there yet (async_payment_* follows).
      case 'payment.pending':
        console.log(`Payment pending for session ${normalizedEvent.data.sessionId}`);
        break;

      // A checkout nobody paid: let the addon / function release whatever it was holding.
      case 'checkout.expired': {
        const checkout = normalizedEvent.data;
        if (hasBillingHandler(checkout.metadata)) {
          try {
            await runBillingHandler({
              metadata: checkout.metadata, hook: 'onCheckoutExpired', domain, siteId, payload: { checkout, provider },
            });
          } catch (error) {
            console.error(`Stripe webhook - ${checkout.metadata.addon || checkout.metadata.function}.onCheckoutExpired failed:`, error);
            return NextResponse.json({ error: 'Billing handler failed' }, { status: 500 });
          }
        }
        break;
      }

      default:
        console.log('Unhandled Stripe event type:', normalizedEvent.type);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Stripe webhook error:', error);
    // Still return 200 to avoid webhook retries for unrecoverable errors
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}

// Disable body parsing for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
