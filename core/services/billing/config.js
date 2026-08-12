/**
 * Billing Configuration Utilities
 *
 * Server-side only - handles loading and resolving billing configuration
 * with environment variable substitution.
 *
 * Uses the unified fileSystem abstraction:
 * - getSettings(domain, 'billing') for billing config
 * - getSettings(domain, '.env') for environment variables
 */

import { getSettings } from '@/core/sites/files';
import { replaceTemplateVars } from '@/core/render/templateVars';

/**
 * Common billing environment variable names to resolve
 */
const BILLING_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'MERCADOPAGO_ACCESS_TOKEN',
  'MERCADOPAGO_PUBLIC_KEY'
];

/**
 * Load and resolve billing configuration for a domain
 *
 * @param {string} domain - Site domain
 * @returns {Promise<Object|null>} Resolved billing config or null if not configured
 */
export async function getBillingConfig(domain) {
  // Get only the billing setting file (not all settings)
  const billingConfig = await getSettings(domain, 'billing');

  if (!billingConfig) {
    return null;
  }

  // Get only the .env setting file for secrets
  const envSettings = await getSettings(domain, '.env') || {};

  // Build env object from site-specific .env settings
  const siteEnv = {};
  for (const varName of BILLING_ENV_VARS) {
    if (envSettings[varName]) {
      siteEnv[varName] = envSettings[varName];
    }
  }

  // Resolve [[env.X]] placeholders and return
  return replaceTemplateVars(billingConfig, { env: siteEnv });
}

/**
 * Get provider configuration from billing config
 *
 * @param {Object} billingConfig - Full billing configuration
 * @returns {Object} { providerName, providerConfig }
 */
export function getProviderConfig(billingConfig) {
  const providerName = billingConfig?.provider || 'stripe';
  const providerConfig = billingConfig?.[providerName];

  return { providerName, providerConfig };
}

/**
 * Get public billing configuration (safe to expose to client)
 *
 * Filters out sensitive data like secret keys, only returns:
 * - Plan details (id, name, price, features)
 * - Payment link details (id, amount, description)
 * - Publishable keys (safe for client-side Stripe.js)
 *
 * @param {Object} billingConfig - Full billing configuration
 * @returns {Object} Public-safe billing configuration
 */
export function getPublicBillingConfig(billingConfig) {
  if (!billingConfig?.provider) {
    return null;
  }

  const providerName = billingConfig.provider;
  const providerConfig = billingConfig[providerName];

  if (!providerConfig) {
    return null;
  }

  const publicConfig = {
    provider: providerName,
    plans: providerConfig.plans?.map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      interval: plan.interval,
      features: plan.features || [],
      description: plan.description,
      popular: plan.popular || false,
      // ❌ priceId: NOT EXPOSED (server-side only)
      // ❌ secretKey: NOT EXPOSED
    })) || [],
    paymentLinks: providerConfig.paymentLinks?.map(link => ({
      id: link.id,
      amount: link.amount,
      currency: link.currency,
      description: link.description,
    })) || [],
  };

  // Add publishable key if using Stripe (safe to expose)
  if (providerName === 'stripe' && providerConfig.publishableKey) {
    publicConfig.publishableKey = providerConfig.publishableKey;
  }

  // Add public key if using MercadoPago (safe to expose)
  if (providerName === 'mercadopago' && providerConfig.publicKey) {
    publicConfig.publicKey = providerConfig.publicKey;
  }

  return publicConfig;
}
