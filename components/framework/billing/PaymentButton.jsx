'use client';

import React, { useState } from 'react';
import { useApp } from '@/core/app';
import { useBillingTranslations } from '@/core/hooks/useBillingConfig';

/**
 * PaymentButton Component
 *
 * Button for one-time payments using preconfigured payment links.
 * Supports dark mode, i18n, and loading states.
 *
 * @param {Object} props
 * @param {string} props.paymentLinkId - Payment link ID from billing config
 * @param {string} props.buttonText - Custom button text (overrides i18n)
 * @param {string} props.variant - Button variant (primary, secondary, default, success)
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.metadata - Additional metadata to attach to payment
 * @param {boolean} props.showAmount - Show payment amount in button
 * @param {number} props.amount - Amount to display (in cents) if showAmount is true
 * @param {string} props.currency - Currency code for amount display
 */
export default function PaymentButton({
  paymentLinkId,
  buttonText = null,
  variant = 'primary',
  className = '',
  metadata = {},
  showAmount = false,
  amount = null,
  currency = 'USD',
}) {
  const app = useApp();
  const { t } = useBillingTranslations();
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    // Check authentication
    if (!app.auth.isAuthenticated) {
      try {
        await app.auth.requireLogin({ message: t('loginRequired') });
      } catch {
        return; // User cancelled
      }
    }

    // Validate payment link ID
    if (!paymentLinkId) {
      app.ui.toast(t('somethingWentWrong'), { type: 'error' });
      return;
    }

    try {
      setIsLoading(true);
      const { url } = await app.billing.createPaymentLink(paymentLinkId, metadata);
      window.location.href = url;
    } catch (error) {
      app.ui.toast(error.message || t('paymentFailed'), { type: 'error' });
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
    if (showAmount && amount) {
      return `${t('payNow')} - ${app.billing.formatCurrency(amount, currency)}`;
    }
    return t('payNow');
  };

  return (
    <button
      onClick={handlePayment}
      disabled={isLoading}
      className={`
        payment-button py-3 px-6 rounded-lg font-semibold
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
  );
}

PaymentButton.displayName = 'PaymentButton';
PaymentButton.isFrameworkComponent = true;
