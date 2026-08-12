/**
 * MercadoPago Provider Implementation
 *
 * Implements payment processing via MercadoPago Preferences and Subscriptions.
 * Handles IPN/webhooks for payment notifications.
 */

import { MercadoPagoConfig, Payment, Preference, PreApproval, Customer } from 'mercadopago';
import BaseProvider from './base.js';

export default class MercadoPagoProvider extends BaseProvider {
  constructor(config) {
    super(config);

    if (!config.accessToken) {
      throw new Error('MercadoPago accessToken is required');
    }

    // Initialize MercadoPago SDK
    this.client = new MercadoPagoConfig({
      accessToken: config.accessToken,
    });

    this.payment = new Payment(this.client);
    this.preference = new Preference(this.client);
    this.preApproval = new PreApproval(this.client);
    this.customer = new Customer(this.client);
  }

  /**
   * Create a customer in MercadoPago
   */
  async createCustomer(customerData) {
    const customer = await this.customer.create({
      body: {
        email: customerData.email,
        first_name: customerData.name?.split(' ')[0] || '',
        last_name: customerData.name?.split(' ').slice(1).join(' ') || '',
        description: `Customer for ${customerData.email}`,
        metadata: customerData.metadata || {},
      },
    });

    return {
      id: customer.id,
      email: customer.email,
    };
  }

  /**
   * Get customer details from MercadoPago
   */
  async getCustomer(customerId) {
    return await this.customer.get({ customerId });
  }

  /**
   * Create a MercadoPago Preference for subscription (PreApproval)
   */
  async createCheckoutSession(customerId, planId, options = {}) {
    const { returnUrl, cancelUrl, metadata = {} } = options;

    // Get plan configuration
    const plan = this.config.plans?.find(p => p.id === planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found in billing configuration`);
    }

    if (!plan.autoRecurring) {
      throw new Error(`Plan ${planId} does not have autoRecurring configuration for MercadoPago`);
    }

    // Create subscription (PreApproval)
    const preApproval = await this.preApproval.create({
      body: {
        reason: plan.reason || plan.name,
        payer_email: customerId, // MercadoPago uses email as identifier
        auto_recurring: {
          frequency: plan.autoRecurring.frequency,
          frequency_type: plan.autoRecurring.frequencyType, // months, days
          transaction_amount: plan.autoRecurring.transactionAmount,
          currency_id: plan.autoRecurring.currencyId || 'ARS',
          start_date: new Date().toISOString(),
          end_date: plan.autoRecurring.endDate || null,
        },
        back_url: returnUrl || this.config.returnUrl,
        metadata: {
          ...metadata,
          planId,
        },
      },
    });

    return {
      id: preApproval.id,
      url: preApproval.init_point,
    };
  }

  /**
   * Create a MercadoPago Preference for one-time payment
   */
  async createPaymentLink(customerId, amount, description, options = {}) {
    const { currency = 'ARS', returnUrl, cancelUrl, metadata = {} } = options;

    // Create payment preference
    const preference = await this.preference.create({
      body: {
        items: [
          {
            title: description,
            quantity: 1,
            unit_price: amount / 100, // MercadoPago uses decimal amounts, not cents
            currency_id: currency.toUpperCase(),
          },
        ],
        payer: {
          email: customerId,
        },
        back_urls: {
          success: returnUrl || this.config.returnUrl,
          failure: cancelUrl || this.config.cancelUrl,
          pending: returnUrl || this.config.returnUrl,
        },
        auto_return: 'approved',
        metadata,
      },
    });

    return {
      id: preference.id,
      url: preference.init_point,
    };
  }

  /**
   * Create a custom checkout with line items
   */
  async createCustomCheckout(customerId, items, options = {}) {
    const { currency = 'ARS', returnUrl, cancelUrl, metadata = {} } = options;

    // Transform items to MercadoPago items format
    const mpItems = items.map(item => ({
      title: item.name,
      description: item.description || '',
      quantity: item.quantity || 1,
      unit_price: item.amount / 100, // MercadoPago uses decimal amounts, not cents
      currency_id: currency.toUpperCase(),
    }));

    // Create payment preference
    const preference = await this.preference.create({
      body: {
        items: mpItems,
        payer: {
          email: customerId,
        },
        back_urls: {
          success: returnUrl || this.config.returnUrl,
          failure: cancelUrl || this.config.cancelUrl,
          pending: returnUrl || this.config.returnUrl,
        },
        auto_return: 'approved',
        metadata: {
          ...metadata,
          itemCount: items.length,
          itemNames: items.map(i => i.name).join(', '),
        },
      },
    });

    return {
      id: preference.id,
      url: preference.init_point,
    };
  }

  /**
   * Cancel a MercadoPago subscription (PreApproval)
   */
  async cancelSubscription(subscriptionId, options = {}) {
    const { immediately = false } = options;

    // Update PreApproval status to cancelled
    const preApproval = await this.preApproval.update({
      id: subscriptionId,
      body: {
        status: 'cancelled',
      },
    });

    return {
      id: preApproval.id,
      status: preApproval.status,
    };
  }

  /**
   * Get MercadoPago subscription (PreApproval) details
   */
  async getSubscription(subscriptionId) {
    return await this.preApproval.get({ id: subscriptionId });
  }

  /**
   * Verify MercadoPago webhook/IPN notification
   */
  async verifyWebhook(request) {
    // MercadoPago sends notifications as query params and body
    const url = new URL(request.url);
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    const id = url.searchParams.get('id');

    if (!topic || !id) {
      throw new Error('Invalid MercadoPago notification: missing topic or id');
    }

    // Fetch the resource from MercadoPago to verify authenticity
    let data;
    switch (topic) {
      case 'payment':
        data = await this.payment.get({ id });
        break;
      case 'preapproval':
      case 'subscription_preapproval':
        data = await this.preApproval.get({ id });
        break;
      default:
        throw new Error(`Unknown MercadoPago notification topic: ${topic}`);
    }

    return {
      type: topic,
      id,
      data,
    };
  }

  /**
   * Handle MercadoPago webhook event and return normalized data
   */
  async handleWebhookEvent(event) {
    const { type, data } = event;

    switch (type) {
      case 'preapproval':
      case 'subscription_preapproval':
        // Subscription events
        if (data.status === 'authorized' || data.status === 'paused') {
          return {
            type: 'subscription.updated',
            data: this.normalizeSubscription(data),
          };
        } else if (data.status === 'cancelled') {
          return {
            type: 'subscription.deleted',
            data: this.normalizeSubscription(data),
          };
        }
        break;

      case 'payment':
        // Payment events
        if (data.status === 'approved') {
          return {
            type: 'payment.succeeded',
            data: this.normalizePayment(data),
          };
        } else if (data.status === 'rejected' || data.status === 'cancelled') {
          return {
            type: 'payment.failed',
            data: this.normalizePayment(data),
          };
        }
        break;

      default:
        return { type: 'unknown', data };
    }

    return { type: 'unknown', data };
  }

  /**
   * Normalize MercadoPago PreApproval to common subscription format
   */
  normalizeSubscription(mpPreApproval) {
    // Map MercadoPago status to common status
    let status;
    switch (mpPreApproval.status) {
      case 'authorized':
        status = 'active';
        break;
      case 'paused':
        status = 'paused';
        break;
      case 'cancelled':
        status = 'canceled';
        break;
      default:
        status = mpPreApproval.status;
    }

    // Extract planId from metadata
    const planId = mpPreApproval.metadata?.planId;

    // Calculate current period end (next payment date)
    const currentPeriodEnd = mpPreApproval.next_payment_date
      ? new Date(mpPreApproval.next_payment_date)
      : null;

    return {
      id: mpPreApproval.id,
      customerId: mpPreApproval.payer_email,
      planId,
      status,
      currentPeriodStart: new Date(mpPreApproval.date_created),
      currentPeriodEnd,
      cancelAtPeriodEnd: false, // MercadoPago cancels immediately
      metadata: mpPreApproval.metadata,
    };
  }

  /**
   * Normalize MercadoPago Payment to common format
   */
  normalizePayment(mpPayment) {
    // Map MercadoPago status to common status
    let status;
    switch (mpPayment.status) {
      case 'approved':
        status = 'succeeded';
        break;
      case 'pending':
      case 'in_process':
      case 'in_mediation':
        status = 'pending';
        break;
      case 'rejected':
      case 'cancelled':
      case 'refunded':
      case 'charged_back':
        status = 'failed';
        break;
      default:
        status = mpPayment.status;
    }

    return {
      id: mpPayment.id.toString(),
      customerId: mpPayment.payer?.email,
      subscriptionId: mpPayment.metadata?.preapproval_id,
      amount: Math.round(mpPayment.transaction_amount * 100), // Convert to cents
      currency: mpPayment.currency_id.toLowerCase(),
      status,
      description: mpPayment.description || 'Payment',
      metadata: mpPayment.metadata,
    };
  }
}
