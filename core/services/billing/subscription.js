/**
 * Subscription Management Service
 *
 * Tracks subscription status locally and syncs with payment providers via webhooks.
 * Provides helpers for checking subscription access and features.
 *
 * SECURITY: These functions access SHARED billing collections.
 * They should ONLY be called from:
 * - API routes (/app/api/billing/*)
 * - Server-side core code
 * NEVER from client components or tenant code.
 */

import { createBillingDB } from '@/core/billing/db';

/**
 * Sync subscription from provider webhook event
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} userId - User ID
 * @param {Object} normalizedSubscription - Normalized subscription data from provider
 * @returns {Promise<Object>} Saved subscription record
 */
export async function syncSubscription(siteId, userId, normalizedSubscription) {
  const billingDb = createBillingDB(siteId);

  const {
    id,
    customerId,
    planId,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    metadata,
  } = normalizedSubscription;

  // Find provider from metadata
  const provider = metadata?.provider || 'stripe';

  const subscriptionData = {
    userId,
    provider,
    subscriptionId: id,
    customerId,
    planId,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: cancelAtPeriodEnd || false,
    metadata: metadata || {},
  };

  // Upsert subscription (create or update)
  const result = await billingDb.upsertSubscription(subscriptionData);

  console.log(`Synced subscription ${id} for user ${userId}: ${status}`);

  return result;
}

/**
 * Cancel subscription (mark as canceled in database)
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} subscriptionId - Provider's subscription ID
 * @returns {Promise<Object>} Updated subscription record
 */
export async function cancelSubscription(siteId, subscriptionId) {
  const billingDb = createBillingDB(siteId);

  const subscription = await billingDb.findSubscriptionById(subscriptionId);

  if (!subscription) {
    throw new Error(`Subscription ${subscriptionId} not found`);
  }

  const result = await billingDb.updateSubscription(subscriptionId, {
    status: 'canceled',
    canceledAt: new Date(),
  });

  console.log(`Canceled subscription ${subscriptionId}`);

  return result;
}

/**
 * Get user's active subscription
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} userId - User ID
 * @param {string} [providerName] - Optional provider filter
 * @returns {Promise<Object|null>} Active subscription or null
 */
export async function getActiveSubscription(siteId, userId, providerName = null) {
  const billingDb = createBillingDB(siteId);
  return billingDb.findActiveSubscription(userId, providerName);
}

/**
 * Get all user subscriptions
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of subscription records
 */
export async function getAllSubscriptions(siteId, userId) {
  const billingDb = createBillingDB(siteId);
  return billingDb.findAllSubscriptions(userId);
}

/**
 * Check if user has an active subscription for a specific plan
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} userId - User ID
 * @param {string} planId - Plan ID to check
 * @returns {Promise<boolean>} True if user has active subscription for plan
 */
export async function hasPlan(siteId, userId, planId) {
  const subscription = await getActiveSubscription(siteId, userId);

  if (!subscription || subscription.planId !== planId) {
    return false;
  }

  // Check that subscription is active and hasn't expired
  if (subscription.status !== 'active') {
    return false;
  }

  if (subscription.currentPeriodEnd) {
    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    return periodEnd > now;
  }

  return true;
}

/**
 * Get user's current plan with details
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} userId - User ID
 * @param {Object} billingConfig - Billing configuration with plan details
 * @returns {Promise<Object|null>} Plan details or null
 */
export async function getUserPlan(siteId, userId, billingConfig) {
  const subscription = await getActiveSubscription(siteId, userId);

  if (!subscription) {
    return null;
  }

  // Don't check expiry for incomplete subscriptions (payment still processing)
  // Only check expiry for active/past_due subscriptions
  if (subscription.status !== 'incomplete' && subscription.currentPeriodEnd) {
    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    if (periodEnd <= now) {
      return null; // Expired
    }
  }

  // Get plan details from billing config
  const providerConfig = billingConfig[subscription.provider];
  let planConfig = null;

  // Try to find plan by planId first
  if (subscription.planId) {
    planConfig = providerConfig?.plans?.find(p => p.id === subscription.planId);
  }

  // If planId is null (older subscriptions), return subscription info without plan details
  // The user still has an active subscription, we just don't know which plan
  const planId = subscription.planId || 'unknown';
  const planName = planConfig?.name || (subscription.planId ? subscription.planId : 'Subscription');

  return {
    id: planId,
    name: planName,
    status: subscription.status,
    features: planConfig?.features || [],
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    provider: subscription.provider,
    subscriptionId: subscription.subscriptionId,
  };
}

/**
 * Check if user has access to a specific feature
 *
 * @param {string} siteId - Site identifier for tenant isolation
 * @param {string} userId - User ID
 * @param {string} feature - Feature name to check
 * @param {Object} billingConfig - Billing configuration
 * @returns {Promise<boolean>} True if user has access to feature
 */
export async function hasFeature(siteId, userId, feature, billingConfig) {
  const userPlan = await getUserPlan(siteId, userId, billingConfig);

  if (!userPlan) {
    return false;
  }

  return userPlan.features.includes(feature);
}
