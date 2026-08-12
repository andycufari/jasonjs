/**
 * Base Provider Abstract Class
 *
 * Defines the unified API that all payment providers must implement.
 * This ensures consistent behavior across Stripe, MercadoPago, and future providers.
 */

export default class BaseProvider {
  constructor(config) {
    if (new.target === BaseProvider) {
      throw new Error('BaseProvider is abstract and cannot be instantiated directly');
    }

    this.config = config;
    this.name = this.constructor.name.replace('Provider', '').toLowerCase();
  }

  /**
   * Create a customer in the payment provider
   * @param {Object} customerData - Customer information
   * @param {string} customerData.email - Customer email
   * @param {string} customerData.name - Customer name
   * @param {Object} customerData.metadata - Additional metadata
   * @returns {Promise<{id: string, email: string}>} Created customer
   */
  async createCustomer(customerData) {
    throw new Error('createCustomer() must be implemented by provider');
  }

  /**
   * Get customer details from provider
   * @param {string} customerId - Provider's customer ID
   * @returns {Promise<Object>} Customer details
   */
  async getCustomer(customerId) {
    throw new Error('getCustomer() must be implemented by provider');
  }

  /**
   * Create a checkout session for subscription or one-time payment
   * @param {string} customerId - Provider's customer ID
   * @param {string} planId - Plan ID from billing config
   * @param {Object} options - Additional options
   * @param {string} options.returnUrl - Success URL
   * @param {string} options.cancelUrl - Cancel URL
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<{id: string, url: string}>} Checkout session with redirect URL
   */
  async createCheckoutSession(customerId, planId, options = {}) {
    throw new Error('createCheckoutSession() must be implemented by provider');
  }

  /**
   * Create a payment link for one-time payment
   * @param {string} customerId - Provider's customer ID
   * @param {number} amount - Amount in smallest currency unit (cents)
   * @param {string} description - Payment description
   * @param {Object} options - Additional options
   * @param {string} options.currency - Currency code (usd, ars, etc.)
   * @param {string} options.returnUrl - Success URL
   * @param {string} options.cancelUrl - Cancel URL
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<{id: string, url: string}>} Payment link
   */
  async createPaymentLink(customerId, amount, description, options = {}) {
    throw new Error('createPaymentLink() must be implemented by provider');
  }

  /**
   * Create a custom checkout session with line items
   * @param {string} customerId - Provider's customer ID
   * @param {Array<Object>} items - Line items for checkout
   * @param {string} items[].name - Item name
   * @param {number} items[].amount - Amount in smallest currency unit (cents)
   * @param {number} items[].quantity - Quantity
   * @param {string} items[].description - Item description (optional)
   * @param {Object} options - Additional options
   * @param {string} options.currency - Currency code (usd, ars, etc.)
   * @param {string} options.returnUrl - Success URL
   * @param {string} options.cancelUrl - Cancel URL
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<{id: string, url: string}>} Checkout session with redirect URL
   */
  async createCustomCheckout(customerId, items, options = {}) {
    throw new Error('createCustomCheckout() must be implemented by provider');
  }

  /**
   * Cancel a subscription
   * @param {string} subscriptionId - Provider's subscription ID
   * @param {Object} options - Cancellation options
   * @param {boolean} options.immediately - Cancel immediately vs at period end
   * @returns {Promise<{id: string, status: string}>} Updated subscription
   */
  async cancelSubscription(subscriptionId, options = {}) {
    throw new Error('cancelSubscription() must be implemented by provider');
  }

  /**
   * Get subscription details
   * @param {string} subscriptionId - Provider's subscription ID
   * @returns {Promise<Object>} Subscription details
   */
  async getSubscription(subscriptionId) {
    throw new Error('getSubscription() must be implemented by provider');
  }

  /**
   * Verify webhook signature and parse event
   * @param {Request} request - Incoming webhook request
   * @returns {Promise<Object>} Verified event object
   */
  async verifyWebhook(request) {
    throw new Error('verifyWebhook() must be implemented by provider');
  }

  /**
   * Handle webhook event and return normalized data
   * @param {Object} event - Verified webhook event
   * @returns {Promise<{type: string, data: Object}>} Normalized event data
   */
  async handleWebhookEvent(event) {
    throw new Error('handleWebhookEvent() must be implemented by provider');
  }

  /**
   * Normalize subscription data to common format
   * @param {Object} providerSubscription - Provider-specific subscription object
   * @returns {Object} Normalized subscription
   */
  normalizeSubscription(providerSubscription) {
    throw new Error('normalizeSubscription() must be implemented by provider');
  }

  /**
   * Normalize payment data to common format
   * @param {Object} providerPayment - Provider-specific payment object
   * @returns {Object} Normalized payment
   */
  normalizePayment(providerPayment) {
    throw new Error('normalizePayment() must be implemented by provider');
  }
}
