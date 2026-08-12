'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/core/app';
import { useBillingConfig, useBillingTranslations } from '@/core/hooks/useBillingConfig';

/**
 * PricingTable Component
 *
 * Displays pricing plans in a responsive grid layout with subscribe buttons.
 * Supports dark mode, i18n, and shows current plan badge.
 *
 * @param {Object} props
 * @param {boolean} props.showInterval - Show billing interval (monthly/yearly)
 * @param {string} props.highlightPlan - Plan ID to highlight as popular
 * @param {string} props.buttonText - Custom text for subscribe buttons (overrides i18n)
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onSubscribe - Optional callback when plan is selected
 */
export default function PricingTable({
  showInterval = true,
  highlightPlan = null,
  buttonText = null,
  className = '',
  onSubscribe = null,
}) {
  const app = useApp();
  const { t } = useBillingTranslations();
  const {
    plans,
    subscription,
    loading,
    error,
    isConfigured,
    getConfigStatus,
  } = useBillingConfig();

  const [subscribingPlan, setSubscribingPlan] = useState(null);

  const handleSubscribe = async (planId) => {
    // If custom handler provided, use it
    if (onSubscribe) {
      onSubscribe(planId);
      return;
    }

    if (!app.auth.isAuthenticated) {
      try {
        await app.auth.requireLogin({ message: t('loginRequired') });
      } catch {
        return; // User cancelled
      }
    }

    try {
      setSubscribingPlan(planId);
      const { url } = await app.billing.createCheckoutSession(planId);
      window.location.href = url;
    } catch (error) {
      app.ui.toast(error.message || t('somethingWentWrong'), { type: 'error' });
      setSubscribingPlan(null);
    }
  };

  // Loading skeleton with dark mode support
  if (loading) {
    return (
      <div className={`pricing-table-loading ${className}`}>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-96 rounded-xl bg-gray-200 dark:bg-gray-800"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error or not configured state
  const configStatus = getConfigStatus();
  if (configStatus.status !== 'ready' && configStatus.status !== 'loading') {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="max-w-md mx-auto">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('billingNotConfigured')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {configStatus.message}
          </p>
        </div>
      </div>
    );
  }

  // No plans available
  if (!plans || plans.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">
          {t('noPlansAvailable')}
        </p>
      </div>
    );
  }

  return (
    <div className={`pricing-table ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {plans.map((plan) => {
          const isHighlighted = plan.popular || plan.id === highlightPlan;
          const isCurrentPlan = subscription?.subscription?.planId === plan.id ||
                               subscription?.planId === plan.id;
          const isFree = plan.price === 0;
          const isSubscribing = subscribingPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`
                pricing-plan relative rounded-xl border p-6 transition-all duration-200
                ${isHighlighted
                  ? 'border-primary shadow-lg ring-2 ring-primary/20 dark:ring-primary/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
                ${isCurrentPlan
                  ? 'bg-primary/5 dark:bg-primary/10'
                  : 'bg-white dark:bg-gray-900'
                }
              `}
            >
              {/* Popular Badge */}
              {isHighlighted && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-block bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                    {t('popular')}
                  </span>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-block bg-green-500 dark:bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                    {t('currentPlan')}
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-4 pt-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {plan.name}
                </h3>
                {plan.description && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {plan.description}
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    {isFree
                      ? t('free')
                      : app.billing.formatCurrency(plan.price * 100, plan.currency)
                    }
                  </span>
                  {showInterval && plan.interval && !isFree && (
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      {plan.interval === 'month' ? t('perMonth') : t('perYear')}
                    </span>
                  )}
                </div>
              </div>

              {/* Features List */}
              {plan.features && plan.features.length > 0 && (
                <ul className="mb-6 space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <svg
                        className="w-5 h-5 text-green-500 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-gray-700 dark:text-gray-300 text-sm">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Subscribe Button */}
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={isCurrentPlan || isSubscribing}
                className={`
                  w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200
                  disabled:cursor-not-allowed
                  ${isCurrentPlan
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    : isFree
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    : isHighlighted
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg'
                    : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                  }
                  ${isSubscribing ? 'opacity-70' : ''}
                `}
              >
                {isSubscribing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('processing')}
                  </span>
                ) : isCurrentPlan ? (
                  t('currentPlan')
                ) : isFree ? (
                  t('getStarted')
                ) : (
                  buttonText || t('subscribe')
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

PricingTable.displayName = 'PricingTable';
PricingTable.isFrameworkComponent = true;
