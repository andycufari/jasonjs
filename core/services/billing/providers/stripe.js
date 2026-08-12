/**
 * Stripe Provider Implementation
 *
 * Implements payment processing via Stripe Checkout Sessions and Payment Links.
 * Handles webhooks for subscription lifecycle events.
 */

import Stripe from 'stripe';
import BaseProvider from './base.js';

export default class StripeProvider extends BaseProvider {
  constructor(config) {
    super(config);

    if (!config.secretKey) {
      throw new Error('Stripe secretKey is required');
    }

    this.stripe = new Stripe(config.secretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    this.webhookSecret = config.webhookSecret;
  }

  /**
   * Create a customer in Stripe
   */
  async createCustomer(customerData) {
    const customer = await this.stripe.customers.create({
      email: customerData.email,
      name: customerData.name,
      metadata: customerData.metadata || {},
    });

    return {
      id: customer.id,
      email: customer.email,
    };
  }

  /**
   * Get customer details from Stripe
   */
  async getCustomer(customerId) {
    return await this.stripe.customers.retrieve(customerId);
  }

  /**
   * Create a Stripe Checkout Session for subscription
   *
   * @param {string} customerIdOrEmail - Stripe customer ID or email address
   * @param {string} planId - Plan ID from billing config
   * @param {Object} options - Checkout options
   */
  async createCheckoutSession(customerIdOrEmail, planId, options = {}) {
    const { returnUrl, cancelUrl, customerEmail, metadata = {} } = options;

    // Get plan configuration
    const plan = this.config.plans?.find(p => p.id === planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found in billing configuration`);
    }

    if (!plan.priceId) {
      throw new Error(`Plan ${planId} does not have a Stripe priceId configured`);
    }

    // Build checkout session params
    const sessionParams = {
      mode: 'subscription',
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: returnUrl || this.config.returnUrl,
      cancel_url: cancelUrl || this.config.cancelUrl,
      // Session metadata (for checkout.session.completed webhook)
      metadata: {
        ...metadata,
        planId,
      },
      // IMPORTANT: subscription_data.metadata gets copied to the Stripe Subscription object
      // This is what we need for customer.subscription.created/updated webhooks
      subscription_data: {
        metadata: {
          planId,
          ...metadata,
        },
      },
    };

    // If customerIdOrEmail looks like a Stripe customer ID (starts with cus_), use it
    // Otherwise, use customer_email to let Stripe create/find the customer
    if (customerIdOrEmail && customerIdOrEmail.startsWith('cus_')) {
      sessionParams.customer = customerIdOrEmail;
    } else if (customerEmail || customerIdOrEmail) {
      // Use email - Stripe will create customer automatically
      sessionParams.customer_email = customerEmail || customerIdOrEmail;
    }

    const session = await this.stripe.checkout.sessions.create(sessionParams);

    return {
      id: session.id,
      url: session.url,
    };
  }

  /**
   * Create a Stripe Payment Link or Checkout Session for one-time payment
   */
  async createPaymentLink(customerId, amount, description, options = {}) {
    const { currency = 'usd', returnUrl, cancelUrl, metadata = {} } = options;

    // For one-time payments, we'll create a checkout session with payment mode
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: description,
            },
            unit_amount: amount, // Amount in cents
          },
          quantity: 1,
        },
      ],
      success_url: returnUrl || this.config.returnUrl,
      cancel_url: cancelUrl || this.config.cancelUrl,
      metadata,
    });

    return {
      id: session.id,
      url: session.url,
    };
  }

  /**
   * Create a custom checkout session with line items
   */
  async createCustomCheckout(customerId, items, options = {}) {
    const { currency = 'usd', returnUrl, cancelUrl, metadata = {} } = options;

    // Transform items to Stripe line_items format
    const lineItems = items.map(item => ({
      price_data: {
        currency,
        product_data: {
          name: item.name,
          description: item.description,
        },
        unit_amount: item.amount, // Amount in cents
      },
      quantity: item.quantity || 1,
    }));

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: lineItems,
      success_url: returnUrl || this.config.returnUrl,
      cancel_url: cancelUrl || this.config.cancelUrl,
      metadata: {
        ...metadata,
        itemCount: items.length,
        itemNames: items.map(i => i.name).join(', '),
      },
    });

    return {
      id: session.id,
      url: session.url,
    };
  }

  /**
   * Cancel a Stripe subscription
   */
  async cancelSubscription(subscriptionId, options = {}) {
    const { immediately = false } = options;

    if (immediately) {
      // Cancel immediately
      const subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      return {
        id: subscription.id,
        status: subscription.status,
      };
    } else {
      // Cancel at period end
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    }
  }

  /**
   * Get Stripe subscription details
   */
  async getSubscription(subscriptionId) {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Verify Stripe webhook signature and parse event
   */
  async verifyWebhook(request) {
    const signature = request.headers.get('stripe-signature');
    const body = await request.text();

    if (!signature) {
      throw new Error('Missing Stripe signature');
    }

    if (!this.webhookSecret) {
      throw new Error('Stripe webhookSecret not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        this.webhookSecret
      );
      return event;
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }
  }

  /**
   * Handle Stripe webhook event and return normalized data
   */
  async handleWebhookEvent(event) {
    const { type, data } = event;

    switch (type) {
      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return {
          type: 'subscription.updated',
          data: this.normalizeSubscription(data.object),
        };

      case 'customer.subscription.deleted':
        return {
          type: 'subscription.deleted',
          data: this.normalizeSubscription(data.object),
        };

      // Payment events
      case 'invoice.payment_succeeded':
        return {
          type: 'payment.succeeded',
          data: this.normalizePayment(data.object),
        };

      case 'invoice.payment_failed':
        return {
          type: 'payment.failed',
          data: this.normalizePayment(data.object),
        };

      case 'checkout.session.completed':
        // Handle one-time payments
        if (data.object.mode === 'payment') {
          return {
            type: 'payment.succeeded',
            data: {
              id: data.object.payment_intent,
              customerId: data.object.customer,
              amount: data.object.amount_total,
              currency: data.object.currency,
              status: 'succeeded',
              description: 'One-time payment',
              metadata: data.object.metadata,
            },
          };
        }
        // For subscription checkouts, wait for subscription.created event
        return { type: 'checkout.completed', data: data.object };

      default:
        return { type: 'unknown', data: data.object };
    }
  }

  /**
   * Normalize Stripe subscription to common format
   */
  normalizeSubscription(stripeSubscription) {
    // Extract planId from metadata or from price metadata
    const planId = stripeSubscription.metadata?.planId ||
      stripeSubscription.items?.data[0]?.price?.metadata?.planId;

    return {
      id: stripeSubscription.id,
      customerId: stripeSubscription.customer,
      planId,
      status: stripeSubscription.status, // active, canceled, past_due, etc.
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      metadata: stripeSubscription.metadata,
    };
  }

  /**
   * Normalize Stripe payment (invoice) to common format
   */
  normalizePayment(stripeInvoice) {
    return {
      id: stripeInvoice.payment_intent || stripeInvoice.id,
      customerId: stripeInvoice.customer,
      subscriptionId: stripeInvoice.subscription,
      amount: stripeInvoice.amount_paid || stripeInvoice.amount_due,
      currency: stripeInvoice.currency,
      status: stripeInvoice.status === 'paid' ? 'succeeded' : stripeInvoice.status,
      description: stripeInvoice.description || 'Subscription payment',
      metadata: stripeInvoice.metadata,
    };
  }
}
