'use client';

import React, { useState } from 'react';
import { useApp } from '@/core/app';
import { useBillingTranslations, useBillingConfig } from '@/core/hooks/useBillingConfig';

/**
 * SubscribeButton Component
 *
 * Subscription button that either:
 * - Opens a plan selection modal (if no planId provided)
 * - Creates checkout directly (if planId provided)
 *
 * Supports dark mode, i18n, and loading states.
 *
 * @param {Object} props
 * @param {string} props.planId - Plan ID from billing config (optional - opens modal if not provided)
 * @param {string} props.buttonText - Custom button text (overrides i18n)
 * @param {string} props.variant - Button variant (primary, secondary, default, success)
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.metadata - Additional metadata to attach to subscription
 * @param {boolean} props.showPlanName - Show plan name in button text
 * @param {Function} props.onOpenModal - Callback when modal should open (for external modal control)
 */
export default function SubscribeButton({
  planId = null,
  buttonText = null,
  variant = 'primary',
  className = '',
  metadata = {},
  showPlanName = false,
  onOpenModal = null,
}) {
  const app = useApp();
  const { t } = useBillingTranslations();
  const { getPlan } = useBillingConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Get plan details if planId is provided
  const plan = planId ? getPlan(planId) : null;

  const handleClick = async () => {
    // If no planId, trigger modal opening
    if (!planId) {
      if (onOpenModal) {
        onOpenModal();
      } else {
        setShowModal(true);
      }
      return;
    }

    // Check authentication
    if (!app.auth.isAuthenticated) {
      try {
        await app.auth.requireLogin({ message: t('loginRequired') });
      } catch {
        return; // User cancelled
      }
    }

    // Create checkout session
    try {
      setIsLoading(true);
      const { url } = await app.billing.createCheckoutSession(planId, { metadata });
      window.location.href = url;
    } catch (error) {
      app.ui.toast(error.message || t('somethingWentWrong'), { type: 'error' });
      setIsLoading(false);
    }
  };

  // Handle plan selection from modal
  const handlePlanSelect = async (selectedPlanId) => {
    setShowModal(false);

    // Check authentication
    if (!app.auth.isAuthenticated) {
      try {
        await app.auth.requireLogin({ message: t('loginRequired') });
      } catch {
        return;
      }
    }

    try {
      setIsLoading(true);
      const { url } = await app.billing.createCheckoutSession(selectedPlanId, { metadata });
      window.location.href = url;
    } catch (error) {
      app.ui.toast(error.message || t('somethingWentWrong'), { type: 'error' });
      setIsLoading(false);
    }
  };

  // Variant classes with dark mode support
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700',
    default: 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100',
    success: 'bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-500',
  };

  // Determine button text
  const getButtonText = () => {
    if (isLoading) return t('processing');
    if (buttonText) return buttonText;
    if (!planId) return t('viewPlans');
    if (showPlanName && plan?.name) return t('subscribeTo', { plan: plan.name });
    return t('subscribe');
  };

  // Lazy load PlanSelectionModal only when needed
  const PlanSelectionModal = showModal
    ? require('./PlanSelectionModal').default
    : null;

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`
          subscribe-button py-3 px-6 rounded-lg font-semibold
          transition-all duration-200
          disabled:opacity-70 disabled:cursor-not-allowed
          ${variantClasses[variant] || variantClasses.primary}
          ${className}
        `}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {getButtonText()}
          </span>
        ) : (
          getButtonText()
        )}
      </button>

      {/* Plan Selection Modal - only rendered when showModal is true */}
      {showModal && PlanSelectionModal && (
        <PlanSelectionModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSelectPlan={handlePlanSelect}
        />
      )}
    </>
  );
}

SubscribeButton.displayName = 'SubscribeButton';
SubscribeButton.isFrameworkComponent = true;
