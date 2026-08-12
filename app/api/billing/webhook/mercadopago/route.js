// app/api/billing/webhook/mercadopago/route.js
import { NextResponse } from 'next/server';
import { getSite } from '@/core/sites/files';
import { getBillingConfig } from '@/core/services/billing/config';
import MercadoPagoProvider from '@/core/services/billing/providers/mercadopago';
import { syncSubscription } from '@/core/services/billing/subscription';
import { recordPayment } from '@/core/services/billing/payment';
import {
  getCustomerByProviderId,
  getCustomerByEmail,
  createCustomerFromWebhook,
} from '@/core/services/billing/customer';
import { resolveSite } from '@/core/sites/resolve';
import { emitWorkerEvent } from '@/core/worker/events';

/**
 * MercadoPago webhook/IPN handler
 * POST /api/billing/webhook/mercadopago
 *
 * Handles:
 * - payment.created/approved: Records payment and syncs subscription
 * - subscription events: Syncs subscription status to database
 */
export async function POST(request) {
  try {
    const { host: domain } = await resolveSite(request);

    // Get site configuration (contains siteId)
    const site = await getSite(domain);
    if (!site) {
      console.error('MercadoPago webhook - site not found:', domain);
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get billing configuration (with env vars resolved)
    const billingConfig = await getBillingConfig(domain);
    if (!billingConfig?.mercadopago) {
      console.error('MercadoPago webhook - mercadopago not configured');
      return NextResponse.json({ error: 'MercadoPago not configured' }, { status: 404 });
    }

    // Initialize MercadoPago provider
    const provider = new MercadoPagoProvider(billingConfig.mercadopago);

    // Verify and fetch webhook data
    let event;
    try {
      event = await provider.verifyWebhook(request);
    } catch (error) {
      console.error('MercadoPago webhook verification failed:', error.message);
      return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
    }

    console.log(`MercadoPago webhook received: ${event.type} - ID: ${event.id}`);

    // Handle the event
    const normalizedEvent = await provider.handleWebhookEvent(event);

    // Extract siteId from site config (handles both database mode and standalone mode)
    const siteId = site._id?.toString() || site.siteId || domain;

    // Helper function to find or recover customer
    // MercadoPago uses email-based customer identification
    async function findOrRecoverCustomer(customerId, email) {
      // Try local lookup by customerId first (uses shared billing_customers collection)
      let localCustomer = await getCustomerByProviderId(siteId, customerId, 'mercadopago');

      if (localCustomer) {
        return localCustomer;
      }

      // Try lookup by email as fallback (MercadoPago often uses email as ID)
      if (email) {
        localCustomer = await getCustomerByEmail(siteId, email, 'mercadopago');
        if (localCustomer) {
          console.log(`Found MercadoPago customer by email: ${email}`);
          return localCustomer;
        }
      }

      // FALLBACK: Try to get customer info from MercadoPago
      console.log(`Customer ${customerId} not found locally, checking MercadoPago...`);
      try {
        const mpCustomer = await provider.getCustomer(customerId);
        const userId = mpCustomer?.metadata?.userId;

        if (userId) {
          // Create missing customer record from MercadoPago data
          localCustomer = await createCustomerFromWebhook(siteId, {
            customerId,
            userId,
            email: mpCustomer.email || email,
            customerType: mpCustomer.metadata?.customerType || 'user',
            providerName: 'mercadopago',
            metadata: {
              recoveredFromMercadoPago: true,
              mpMetadata: mpCustomer.metadata,
            },
          });

          console.log(`Recovered customer from MercadoPago: ${customerId} -> ${userId}`);
          return localCustomer;
        }
      } catch (err) {
        console.error('Failed to recover customer from MercadoPago:', err.message);
      }

      return null;
    }

    // Process different event types
    switch (normalizedEvent.type) {
      case 'subscription.updated':
      case 'subscription.deleted': {
        const subscription = normalizedEvent.data;

        // Find userId from customer
        const localCustomer = await findOrRecoverCustomer(
          subscription.customerId,
          subscription.payerEmail
        );

        if (!localCustomer) {
          console.warn(`MercadoPago webhook - could not find or recover customer: ${subscription.customerId}`);
          break;
        }

        // Sync subscription to shared billing_subscriptions collection
        await syncSubscription(siteId, localCustomer.userId, {
          ...subscription,
          metadata: { ...subscription.metadata, provider: 'mercadopago' }
        });

        console.log(`Subscription ${normalizedEvent.type} synced for user ${localCustomer.userId}`);
        break;
      }

      case 'payment.succeeded':
      case 'payment.failed': {
        const payment = normalizedEvent.data;

        // GUEST one-time payment: anonymous checkout has no billing_customer / userId.
        // It is linked to the app's own order via metadata.orderId. Emit a worker
        // event so the site can mark its order paid (handler in the site's workers.json).
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
              email: payment.customerId,
              metadata: payment.metadata,
            },
          });
          console.log(`Guest ${normalizedEvent.type} emitted for order ${orderId} (payment ${payment.id})`);
          break;
        }

        // Find userId from customer
        const localCustomer = await findOrRecoverCustomer(
          payment.customerId,
          payment.payerEmail
        );

        if (!localCustomer) {
          console.warn(`MercadoPago webhook - could not find or recover customer for payment: ${payment.customerId}`);
          break;
        }

        // Record payment to shared billing_payments collection
        await recordPayment(siteId, localCustomer.userId, {
          ...payment,
          metadata: { ...payment.metadata, provider: 'mercadopago' }
        });

        console.log(`Payment ${payment.status} recorded for user ${localCustomer.userId}`);
        break;
      }

      default:
        console.log('Unhandled MercadoPago event type:', normalizedEvent.type);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('MercadoPago webhook error:', error);
    // Still return 200 to avoid webhook retries for unrecoverable errors
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}

// GET handler for MercadoPago webhook verification
export async function GET(request) {
  // MercadoPago sometimes sends GET requests for webhook verification
  return NextResponse.json({ status: 'ok' });
}
