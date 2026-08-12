'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/core/app';
import { useBillingTranslations } from '@/core/hooks/useBillingConfig';

/**
 * SubscriptionStatus Component
 *
 * Displays current subscription status with features, cancel option, and styled confirmation.
 * Supports dark mode, i18n, and loading states.
 *
 * @param {Object} props
 * @param {boolean} props.showFeatures - Show plan features list
 * @param {boolean} props.showCancelButton - Show cancel subscription button
 * @param {boolean} props.showUpgradeButton - Show upgrade button
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onUpgrade - Callback when upgrade is clicked
 */
export default function SubscriptionStatus({
  showFeatures = true,
  showCancelButton = true,
  showUpgradeButton = false,
  className = '',
  onUpgrade = null,
}) {
  const app = useApp();
  const { t, language } = useBillingTranslations();
  const [subscription, setSubscription] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const loadSubscription = useCallback(async () => {
    try {
      // getSubscriptionStatus() returns flattened data directly:
      // { id, planId, planName, status, features, currentPeriodEnd, ... }
      const data = await app.billing.getSubscriptionStatus();

      if (data) {
        setSubscription(data);
        // Build plan object from flattened subscription data
        setPlan({
          id: data.planId,
          name: data.planName || data.planId,
          features: data.features || [],
          status: data.status,
        });
      } else {
        setSubscription(null);
        setPlan(null);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
      setSubscription(null);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [app.billing]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const handleCancel = async () => {
    setShowConfirmDialog(false);

    try {
      setCanceling(true);
      await app.billing.cancelSubscription({ immediately: false });
      app.ui.toast(t('subscriptionCanceled'), { type: 'success' });
      await loadSubscription();
    } catch (error) {
      app.ui.toast(error.message || t('somethingWentWrong'), { type: 'error' });
    } finally {
      setCanceling(false);
    }
  };

  // Format date with locale
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const locale = language === 'es-AR' ? 'es-AR' : language === 'pt-BR' ? 'pt-BR' : 'en-US';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get status display info
  const getStatusInfo = (status) => {
    const statusMap = {
      active: {
        text: t('active'),
        classes: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      },
      canceled: {
        text: t('canceled'),
        classes: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400',
      },
      past_due: {
        text: t('pastDue'),
        classes: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
      },
      trialing: {
        text: t('trialing'),
        classes: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
      },
    };
    return statusMap[status] || { text: status, classes: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400' };
  };

  // Loading state
  if (loading) {
    return (
      <div className={`subscription-status-loading ${className}`}>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-800 h-48 rounded-xl" />
      </div>
    );
  }

  // No subscription state
  if (!subscription || !plan) {
    return (
      <div className={`subscription-status-empty ${className}`}>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
          <svg
            className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{t('noActiveSubscription')}</p>
          <button
            onClick={() => onUpgrade?.()}
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            {t('viewPlans')}
          </button>
        </div>
      </div>
    );
  }

  const periodEnd = subscription.currentPeriodEnd;
  const isActive = subscription.status === 'active';
  const willCancel = subscription.cancelAtPeriodEnd;
  const statusInfo = getStatusInfo(subscription.status);

  return (
    <>
      <div className={`subscription-status bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h3>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${statusInfo.classes}`}>
                {statusInfo.text}
              </span>
              {willCancel && (
                <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                  {t('canceled')}
                </span>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {willCancel ? t('endsOn', { date: '' }).replace('{date}', '') : t('renewsOn', { date: '' }).replace('{date}', '')}
            </p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formatDate(periodEnd)}
            </p>
          </div>
        </div>

        {/* Features */}
        {showFeatures && plan.features && plan.features.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
              {t('includedFeatures')}
            </h4>
            <ul className="space-y-2">
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
                  <span className="text-gray-700 dark:text-gray-300 text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-wrap gap-3">
          {showUpgradeButton && onUpgrade && (
            <button
              onClick={onUpgrade}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
            >
              {t('upgrade')}
            </button>
          )}

          {showCancelButton && isActive && !willCancel && (
            <button
              onClick={() => setShowConfirmDialog(true)}
              disabled={canceling}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {canceling ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('processing')}
                </span>
              ) : (
                t('cancelSubscription')
              )}
            </button>
          )}
        </div>

        {/* Canceling notice */}
        {willCancel && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              {t('cancelNote')}
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
            onClick={() => setShowConfirmDialog(false)}
          />

          {/* Dialog */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('confirmCancel')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {t('confirmCancelMessage')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                {t('cancelNote')}
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  {t('keepSubscription')}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
                >
                  {t('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

SubscriptionStatus.displayName = 'SubscriptionStatus';
SubscriptionStatus.isFrameworkComponent = true;
