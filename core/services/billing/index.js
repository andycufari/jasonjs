/**
 * Billing Service - Client Side
 *
 * Main entry point for billing functionality on the client.
 * Provides client-side API for payment operations via fetch().
 *
 * NOTE: Server-side services (customer.js, subscription.js, payment.js)
 * should be imported directly in API routes, NOT from this file.
 * Those services use MongoDB directly and cannot run on the client.
 */

'use client';

/**
 * Create a checkout session for subscription
 *
 * @param {string} planId - Plan ID from billing config
 * @param {Object} options - Additional options
 * @returns {Promise<{url: string}>} Checkout session URL
 */
export async function createCheckoutSession(planId, options = {}) {
  const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  return await response.json();
}

/**
 * Create a payment link for one-time payment
 *
 * @param {string} paymentLinkId - Payment link ID from billing config
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<{url: string}>} Payment link URL
 */
export async function createPaymentLink(paymentLinkId, metadata = {}) {
  const response = await fetch('/api/billing/payment-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentLinkId, metadata }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create payment link');
  }

  return await response.json();
}

/**
 * Create a custom checkout session with dynamic line items
 *
 * @param {Array<Object>} items - Array of items to checkout
 * @param {string} items[].name - Item name
 * @param {number} items[].amount - Amount in cents (e.g., 2999 = $29.99)
 * @param {number} items[].quantity - Quantity (default: 1)
 * @param {string} items[].description - Item description (optional)
 * @param {Object} options - Additional options
 * @param {string} options.currency - Currency code (usd, ars, etc.)
 * @param {string} options.returnUrl - Custom return URL
 * @param {string} options.cancelUrl - Custom cancel URL
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<{url: string}>} Checkout session URL
 *
 * @example
 * // Shopping cart checkout
 * await createCustomCheckout([
 *   { name: "T-Shirt", amount: 2999, quantity: 2 },
 *   { name: "Hat", amount: 1500, quantity: 1 }
 * ], { currency: 'USD' });
 *
 * @example
 * // Single product
 * await createCustomCheckout([
 *   { name: "Premium Course", amount: 9999, quantity: 1, description: "Complete web dev course" }
 * ]);
 */
export async function createCustomCheckout(items, options = {}) {
  const response = await fetch('/api/billing/custom-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create custom checkout');
  }

  return await response.json();
}

/**
 * Create a GUEST (anonymous, no-login) one-time checkout with line items.
 *
 * For carts / one-off purchases where the buyer is NOT logged in. The buyer's
 * email identifies the payer; `orderId` links the payment back to your own
 * order so the billing webhook can mark it paid via a worker event.
 *
 * @param {Array<Object>} items - [{ name, amount (in CENTS), quantity?, description? }]
 * @param {Object} options
 * @param {string} options.email - REQUIRED — buyer email (payer)
 * @param {string} options.orderId - REQUIRED — your app's order id (echoed to webhook)
 * @param {string} [options.currency] - Currency code (defaults: MercadoPago -> ARS)
 * @param {string} [options.returnUrl] - Return URL after success
 * @param {string} [options.cancelUrl] - Return URL on cancel
 * @param {Object} [options.metadata] - Extra metadata forwarded to the provider
 * @returns {Promise<{url: string, sessionId: string}>} Redirect the user to `url`.
 *
 * @example
 * const { url } = await app.billing.guestCheckout(
 *   [{ name: 'Order #PI-123', amount: 1500000, quantity: 1 }], // amount in CENTS
 *   { email: form.email, orderId: 'PI-123', currency: 'ARS' }
 * );
 * window.location.href = url;
 */
export async function guestCheckout(items, options = {}) {
  const response = await fetch('/api/billing/guest-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'Failed to create guest checkout');
  }

  return await response.json();
}

/**
 * Get current user's subscription status
 *
 * @returns {Promise<Object|null>} Flattened subscription details or null
 *
 * Response structure:
 * {
 *   id: 'sub_xxx',           // Subscription ID
 *   planId: 'basic',         // Plan ID from config
 *   planName: 'Basic Plan',  // Plan display name
 *   status: 'active',        // active, trialing, incomplete, past_due, canceled
 *   features: ['feature1'],  // Plan features
 *   currentPeriodEnd: Date,  // When subscription renews/ends
 *   cancelAtPeriodEnd: bool, // If canceling at period end
 *   provider: 'stripe',      // Payment provider
 * }
 */
export async function getSubscriptionStatus() {
  const response = await fetch('/api/billing/subscription');

  if (!response.ok) {
    if (response.status === 404) {
      return null; // No subscription
    }
    throw new Error('Failed to get subscription status');
  }

  const data = await response.json();

  // Return null if no subscription
  if (!data.subscription) {
    return null;
  }

  // Flatten the response for easier consumption
  return {
    id: data.subscription.id,
    planId: data.subscription.planId,
    planName: data.plan?.name || data.subscription.planId || 'Subscription',
    status: data.subscription.status,
    features: data.plan?.features || [],
    currentPeriodStart: data.subscription.currentPeriodStart,
    currentPeriodEnd: data.subscription.currentPeriodEnd,
    cancelAtPeriodEnd: data.subscription.cancelAtPeriodEnd,
    provider: data.subscription.provider,
    // Include raw data for advanced use
    _raw: data,
  };
}

/**
 * Cancel current user's subscription
 *
 * @param {Object} options - Cancellation options
 * @param {boolean} options.immediately - Cancel immediately vs at period end
 * @returns {Promise<{success: boolean}>} Cancellation result
 */
export async function cancelSubscription(options = {}) {
  const response = await fetch('/api/billing/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel subscription');
  }

  return await response.json();
}

/**
 * Get payment history
 *
 * @param {number} limit - Max number of payments to return
 * @returns {Promise<Array>} Array of payment records
 */
export async function getPayments(limit = 10) {
  const response = await fetch(`/api/billing/payments?limit=${limit}`);

  if (!response.ok) {
    throw new Error('Failed to get payment history');
  }

  return await response.json();
}

/**
 * Get public billing configuration (publishable keys only)
 *
 * @returns {Promise<Object>} Public billing config
 */
export async function getPublicConfig() {
  const response = await fetch('/api/billing/config');

  if (!response.ok) {
    throw new Error('Failed to get billing configuration');
  }

  return await response.json();
}

/**
 * Check if user has a specific plan (client-side helper)
 * Note: This requires subscription data to be available in app context
 *
 * @param {string} planId - Plan ID to check
 * @param {Object} subscription - Subscription object from context
 * @returns {boolean} True if user has the plan
 */
export function hasPlan(planId, subscription) {
  if (!subscription) return false;

  // Check that subscription is active and matches planId
  if (subscription.planId !== planId || subscription.status !== 'active') {
    return false;
  }

  // Check that subscription hasn't expired
  if (subscription.currentPeriodEnd) {
    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    return periodEnd > now;
  }

  return true;
}

/**
 * Get user's current plan details (client-side helper)
 *
 * @param {Object} subscription - Subscription object from context
 * @param {Object} billingConfig - Billing configuration
 * @returns {Object|null} Plan details or null
 */
export function getUserPlan(subscription, billingConfig) {
  if (!subscription || subscription.status !== 'active') {
    return null;
  }

  // Check if subscription is still valid (not expired)
  if (subscription.currentPeriodEnd) {
    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    if (periodEnd <= now) {
      return null; // Expired
    }
  }

  // Get plan details from billing config
  const provider = billingConfig[subscription.provider];
  const planConfig = provider?.plans?.find(p => p.id === subscription.planId);

  return {
    id: subscription.planId,
    name: planConfig?.name || subscription.planId,
    status: subscription.status,
    features: planConfig?.features || [],
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    provider: subscription.provider,
  };
}

/**
 * Format currency amount for display
 *
 * @param {number} amount - Amount in smallest currency unit (cents)
 * @param {string} currency - Currency code (USD, ARS, etc.)
 * @param {string} locale - Optional locale for formatting
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'USD', locale = 'en-US') {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Convert from cents to dollars
  return formatter.format(amount / 100);
}
