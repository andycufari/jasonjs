/**
 * Payment Recording Service
 *
 * Records payment transactions from provider webhooks.
 * Provides helpers for querying payment history.
 *
 * SECURITY: These functions access SHARED billing collections.
 * They should ONLY be called from:
 * - API routes (/app/api/billing/*)
 * - Server-side core code
 * NEVER from client components or tenant code.
 */

import { createBillingDB } from '@/core/billing/db';

/**
 * Record a payment from provider webhook
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} userId - User ID
 * @param {Object} normalizedPayment - Normalized payment data from provider
 * @returns {Promise<Object>} Saved payment record
 */
export async function recordPayment(siteId, userId, normalizedPayment) {
  const billingDb = createBillingDB(siteId);

  const {
    id,
    customerId,
    subscriptionId,
    amount,
    currency,
    status,
    description,
    metadata,
  } = normalizedPayment;

  // Find provider from metadata or default to stripe
  const provider = metadata?.provider || 'stripe';

  // Check if payment already recorded (avoid duplicates)
  const exists = await billingDb.paymentExists(id);
  if (exists) {
    console.log(`Payment ${id} already recorded, skipping`);
    return null;
  }

  // Record new payment
  const paymentData = {
    userId,
    provider,
    paymentId: id,
    customerId,
    subscriptionId: subscriptionId || null,
    amount,
    currency: currency?.toLowerCase() || 'usd',
    status,
    description: description || 'Payment',
    metadata: metadata || {},
  };

  const result = await billingDb.recordPayment(paymentData);

  console.log(`Recorded ${status} payment ${id} for user ${userId}: ${amount} ${currency}`);

  return result;
}

/**
 * Get user's payment history
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} userId - User ID
 * @param {number} limit - Max number of payments to return
 * @returns {Promise<Array>} Array of payment records
 */
export async function getPayments(siteId, userId, limit = 50) {
  const billingDb = createBillingDB(siteId);
  return billingDb.getPaymentHistory(userId, limit);
}
