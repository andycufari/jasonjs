// lib/billing-config.js - Server-side billing context for components
//
// Uses fileSystem abstraction via core/services/billing/config.js

import { resolveSite } from '@/core/sites/resolve';
import { getBillingConfig, getPublicBillingConfig } from '@/core/services/billing/config';

/**
 * Get billing context for server components
 * Returns only public-safe config (no secrets)
 */
export async function getBillingContext() {
  if (typeof window !== 'undefined') {
    throw new Error('getBillingContext should only be called server-side');
  }

  const { host: domain } = await resolveSite();

  try {
    const billingConfig = await getBillingConfig(domain);

    if (!billingConfig?.provider) {
      return { config: null, isConfigured: false, domain };
    }

    // Return only public-safe data
    return {
      config: getPublicBillingConfig(billingConfig),
      isConfigured: true,
      domain
    };
  } catch (error) {
    console.debug('Billing not configured for domain:', domain);
    return { config: null, isConfigured: false, domain };
  }
}
