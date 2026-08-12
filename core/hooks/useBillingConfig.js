'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/core/hooks/useApp';

/**
 * Detect language from browser or HTML lang attribute
 */
function detectBrowserLanguage() {
  if (typeof window === 'undefined') return 'en';

  // Try to get from HTML lang attribute (full code like es-AR)
  const htmlLang = document.documentElement.lang;
  if (htmlLang) {
    return htmlLang;
  }

  // Fallback to browser language
  const browserLang = navigator?.language;
  return browserLang || 'en';
}

/**
 * Check if billing is enabled for the current site
 * Uses server-injected flag to avoid unnecessary API calls
 */
function isBillingEnabled() {
  if (typeof window === 'undefined') return false;
  return window.__JASONJS_BILLING_ENABLED__ === true;
}

/**
 * Hook to load billing configuration and subscription status
 * Provides plans, pricing, and current subscription state
 *
 * IMPORTANT: This hook checks if billing is configured for the site BEFORE
 * making any API calls. If billing is not configured (no settings/billing.json),
 * no API calls are made and an empty config is returned immediately.
 *
 * @param {string} language - Optional language code (e.g., 'en', 'es-AR', 'pt-BR')
 */
export function useBillingConfig(language = null) {
  const app = useApp();

  // Check if billing is enabled for this site (set by server during SSR)
  const billingEnabled = isBillingEnabled();

  // Default empty config for when billing is not enabled
  const emptyConfig = {
    plans: [],
    paymentLinks: [],
    provider: null,
    enabled: false
  };

  const [billingConfig, setBillingConfig] = useState(billingEnabled ? null : emptyConfig);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(billingEnabled); // Only loading if billing is enabled
  const [error, setError] = useState(null);

  // Determine language to use
  const lang = language || detectBrowserLanguage();

  const loadBillingData = useCallback(async () => {
    // Skip API calls entirely if billing is not configured for this site
    if (!billingEnabled) {
      setBillingConfig(emptyConfig);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Helper to fetch and flatten subscription data
      const fetchSubscription = async () => {
        try {
          // Use app.billing if available (already flattens response)
          if (app?.billing?.getSubscriptionStatus) {
            return await app.billing.getSubscriptionStatus();
          }
          // Fallback: fetch directly and flatten
          const response = await fetch('/api/billing/subscription');
          if (!response.ok) return null;
          const data = await response.json();
          if (!data.subscription) return null;
          // Flatten the response
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
          };
        } catch {
          return null;
        }
      };

      // Fetch billing config and subscription in parallel
      const [configResult, subscriptionResult] = await Promise.allSettled([
        app?.billing?.getPublicConfig?.() || fetch('/api/billing/config').then(r => r.json()),
        fetchSubscription()
      ]);

      // Handle config result - billing is optional, don't throw if not configured
      if (configResult.status === 'fulfilled') {
        const configData = configResult.value;
        if (configData && !configData.error) {
          setBillingConfig(configData);
        } else {
          // Billing not configured - this is OK, just set empty config
          setBillingConfig(emptyConfig);
        }
      } else {
        // Failed to fetch - billing probably not configured
        setBillingConfig(emptyConfig);
      }

      // Handle subscription result (optional - may not have active subscription)
      if (subscriptionResult.status === 'fulfilled' && subscriptionResult.value) {
        const subData = subscriptionResult.value;
        if (subData && !subData.error) {
          setSubscription(subData);
        }
      }

    } catch (err) {
      // Don't log as error - billing is optional
      // Only log if it's an unexpected error (not just "not configured")
      if (!err.message?.includes('billing') && !err.message?.includes('config')) {
        console.warn('useBillingConfig:', err.message);
      }

      // Set fallback config - billing just not available
      setBillingConfig(emptyConfig);
    } finally {
      setLoading(false);
    }
  }, [app, billingEnabled]);

  // Load data on mount - only if billing is enabled
  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    loadBillingData();
  }, [loadBillingData]);

  // Helper: Get plan by ID
  const getPlan = useCallback((planId) => {
    if (!billingConfig?.plans) return null;
    return billingConfig.plans.find(p => p.id === planId);
  }, [billingConfig]);

  // Valid subscription statuses (payment processing, trial, active, grace period)
  const validStatuses = ['active', 'trialing', 'incomplete', 'past_due'];

  // Helper: Check if user has specific plan
  // subscription from getSubscriptionStatus() is now flattened: { planId, status, ... }
  const hasPlan = useCallback((planId) => {
    if (!subscription?.planId) return false;
    return subscription.planId === planId && validStatuses.includes(subscription.status);
  }, [subscription]);

  // Helper: Get current plan details
  // Returns { id, name, features } or null
  const currentPlan = subscription ? {
    id: subscription.planId,
    name: subscription.planName,
    features: subscription.features || [],
  } : null;

  // Helper: Check if subscription is active (or processing payment)
  const isSubscribed = validStatuses.includes(subscription?.status);

  // Helper: Check if subscription is canceling
  const isCanceling = subscription?.cancelAtPeriodEnd === true;

  // Helper: Check if billing is properly configured
  // Returns false immediately if billing is not enabled for this site
  const isConfigured = useCallback(() => {
    if (!billingEnabled) return false;
    return billingConfig?.provider && !billingConfig?.error && (billingConfig?.plans?.length > 0 || billingConfig?.paymentLinks?.length > 0);
  }, [billingConfig, billingEnabled]);

  // Helper: Get configuration status message
  const getConfigStatus = useCallback(() => {
    // Early return if billing is not enabled for this site
    if (!billingEnabled) return { status: 'not_configured', message: 'Billing not enabled for this site' };
    if (loading) return { status: 'loading', message: 'Loading billing configuration...' };
    if (error) return { status: 'error', message: error };
    if (!billingConfig?.provider) return { status: 'not_configured', message: 'Billing provider not configured' };
    if (billingConfig?.error) return { status: 'error', message: billingConfig.error };
    if (!billingConfig?.plans?.length && !billingConfig?.paymentLinks?.length) {
      return { status: 'incomplete', message: 'No plans or payment links configured' };
    }
    return { status: 'ready', message: 'Billing configured' };
  }, [loading, error, billingConfig, billingEnabled]);

  return {
    // Data
    billingConfig,
    subscription,
    plans: billingConfig?.plans || [],
    paymentLinks: billingConfig?.paymentLinks || [],
    provider: billingConfig?.provider || null,

    // State
    loading,
    error,
    language: lang,

    // Actions
    refetch,

    // Helpers
    getPlan,
    hasPlan,
    currentPlan,
    isSubscribed,
    isCanceling,
    isConfigured,
    getConfigStatus,
  };
}

/**
 * Hook to manage billing translations
 * Returns translation function bound to current language
 */
export function useBillingTranslations(language = null) {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    if (language) {
      setLang(language);
    } else if (typeof document !== 'undefined') {
      const htmlLang = document.documentElement.lang || 'en';
      setLang(htmlLang);
    }
  }, [language]);

  // Dynamically import translations to avoid bundle bloat
  const [translations, setTranslations] = useState(null);

  useEffect(() => {
    import('@/components/framework/billing/i18n/translations')
      .then(module => {
        setTranslations(module);
      })
      .catch(err => {
        console.error('Failed to load billing translations:', err);
      });
  }, []);

  const t = useCallback((key, replacements = {}) => {
    if (!translations) return key;
    return translations.t(key, lang, replacements);
  }, [translations, lang]);

  return { t, language: lang };
}

export default useBillingConfig;
