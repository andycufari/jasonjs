'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/core/app';
import { useBillingConfig, useBillingTranslations } from '@/core/hooks/useBillingConfig';

/**
 * PlanSelectionModal Component
 *
 * Modal that displays all available plans for subscription selection.
 * Supports dark mode, i18n, and current plan highlighting.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback when modal closes
 * @param {string} props.currentPlanId - Current plan ID to highlight
 * @param {Function} props.onSelectPlan - Callback when plan is selected
 * @param {string} props.highlightPlan - Plan ID to show as recommended
 * @param {string} props.className - Additional CSS classes
 */
export default function PlanSelectionModal({
  isOpen,
  onClose,
  currentPlanId = null,
  onSelectPlan = null,
  highlightPlan = null,
  className = '',
}) {
  const app = useApp();
  const { t } = useBillingTranslations();
  const { plans, subscription, loading, getConfigStatus } = useBillingConfig();
  const [mounted, setMounted] = useState(false);
  const [selectingPlan, setSelectingPlan] = useState(null);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Handle plan selection
  const handleSelectPlan = async (planId) => {
    console.log('[PlanSelectionModal] Plan selected:', planId);

    if (onSelectPlan) {
      setSelectingPlan(planId);
      try {
        await onSelectPlan(planId);
      } finally {
        setSelectingPlan(null);
      }
      return;
    }

    // Default behavior: create checkout session
    // Only prompt login if not already authenticated
    if (!app?.auth?.isAuthenticated) {
      console.log('[PlanSelectionModal] User not authenticated, showing login');
      try {
        await app.auth.requireLogin({ message: t('loginRequired') });
      } catch (error) {
        console.log('[PlanSelectionModal] Login cancelled:', error);
        return;
      }
    }

    try {
      setSelectingPlan(planId);
      console.log('[PlanSelectionModal] Creating checkout session for plan:', planId);
      const result = await app.billing.createCheckoutSession(planId);
      console.log('[PlanSelectionModal] Checkout session created:', result);
      if (result?.url) {
        window.location.href = result.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('[PlanSelectionModal] Checkout error:', error);
      app.ui.toast(error.message || t('somethingWentWrong'), { type: 'error' });
      setSelectingPlan(null);
    }
  };

  // Determine current plan
  const activePlanId = currentPlanId || subscription?.subscription?.planId || subscription?.planId;

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`
            relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl
            max-w-4xl w-full max-h-[90vh] overflow-hidden
            border border-gray-200 dark:border-gray-700
            ${className}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('selectPlan')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('choosePlan')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {loading ? (
              <div className="animate-pulse flex justify-center">
                <div className="h-64 w-full max-w-md bg-gray-200 dark:bg-gray-800 rounded-xl" />
              </div>
            ) : getConfigStatus().status !== 'ready' ? (
              <div className="text-center py-12">
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
                    {getConfigStatus().message}
                  </p>
                </div>
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">{t('noPlansAvailable')}</p>
              </div>
            ) : (
              <div className={`
                grid gap-4 lg:gap-6
                ${plans.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : ''}
                ${plans.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl mx-auto' : ''}
                ${plans.length >= 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : ''}
              `}>
                {plans.map((plan) => {
                  const isCurrentPlan = plan.id === activePlanId;
                  const isHighlighted = plan.popular || plan.id === highlightPlan;
                  const isFree = plan.price === 0;
                  const isSelecting = selectingPlan === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className={`
                        relative rounded-xl border p-5 transition-all duration-200
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
                      {/* Badges */}
                      {isHighlighted && !isCurrentPlan && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                          <span className="inline-block bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                            {t('popular')}
                          </span>
                        </div>
                      )}
                      {isCurrentPlan && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                          <span className="inline-block bg-green-500 dark:bg-green-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                            {t('currentPlan')}
                          </span>
                        </div>
                      )}

                      {/* Plan Info */}
                      <div className="pt-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {plan.name}
                        </h3>
                        {plan.description && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {plan.description}
                          </p>
                        )}
                      </div>

                      {/* Price */}
                      <div className="mt-4">
                        <div className="flex items-baseline">
                          <span className="text-3xl font-bold text-gray-900 dark:text-white">
                            {isFree
                              ? t('free')
                              : app.billing.formatCurrency(plan.price * 100, plan.currency)
                            }
                          </span>
                          {plan.interval && !isFree && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                              {plan.interval === 'month' ? t('perMonth') : t('perYear')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Features (compact) */}
                      {plan.features && plan.features.length > 0 && (
                        <ul className="mt-4 space-y-1.5">
                          {plan.features.slice(0, 4).map((feature, idx) => (
                            <li key={idx} className="flex items-start text-sm">
                              <svg
                                className="w-4 h-4 text-green-500 dark:text-green-400 mr-1.5 flex-shrink-0 mt-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-gray-600 dark:text-gray-400 line-clamp-1">
                                {feature}
                              </span>
                            </li>
                          ))}
                          {plan.features.length > 4 && (
                            <li className="text-sm text-gray-500 dark:text-gray-500 pl-5">
                              +{plan.features.length - 4} more
                            </li>
                          )}
                        </ul>
                      )}

                      {/* Select Button */}
                      <button
                        onClick={() => handleSelectPlan(plan.id)}
                        disabled={isCurrentPlan || isSelecting}
                        className={`
                          mt-4 w-full py-2.5 px-4 rounded-lg font-semibold text-sm
                          transition-all duration-200
                          disabled:cursor-not-allowed
                          ${isCurrentPlan
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            : isFree
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            : isHighlighted
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md'
                            : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                          }
                          ${isSelecting ? 'opacity-70' : ''}
                        `}
                      >
                        {isSelecting ? (
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
                        ) : activePlanId ? (
                          t('upgrade')
                        ) : (
                          t('subscribe')
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

PlanSelectionModal.displayName = 'PlanSelectionModal';
PlanSelectionModal.isFrameworkComponent = true;
