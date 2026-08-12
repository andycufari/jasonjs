'use client';

import React, { useState } from 'react';
import { useApp } from '@/core/app';
import { useBillingTranslations } from '@/core/hooks/useBillingConfig';

/**
 * CreditsButton Component
 *
 * Dedicated button for purchasing credits via payment links or custom checkout.
 * Supports dark mode, i18n, and loading states.
 *
 * @param {Object} props
 * @param {string} props.creditPackId - Payment link ID from billing config (for predefined packs)
 * @param {number} props.amount - Custom amount in cents (for custom purchases)
 * @param {number} props.credits - Number of credits to display
 * @param {string} props.buttonText - Custom button text (overrides i18n)
 * @param {string} props.variant - Button variant (primary, secondary, default, success)
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.metadata - Additional metadata to attach
 * @param {string} props.currency - Currency code for custom amount
 *
 * @example
 * // Using predefined credit pack
 * <CreditsButton
 *   creditPackId="credits-100"
 *   credits={100}
 *   buttonText="Buy 100 Credits"
 * />
 *
 * @example
 * // Using custom amount
 * <CreditsButton
 *   amount={999}
 *   credits={50}
 *   currency="USD"
 * />
 */
export default function CreditsButton({
  creditPackId = null,
  amount = null,
  credits = null,
  buttonText = null,
  variant = 'primary',
  className = '',
  metadata = {},
  currency = 'USD',
}) {
  const app = useApp();
  const { t } = useBillingTranslations();
  const [isLoading, setIsLoading] = useState(false);

  const handlePurchase = async () => {
    // Check authentication
    if (!app.auth.isAuthenticated) {
      try {
        await app.auth.requireLogin({ message: t('loginRequired') });
      } catch {
        return; // User cancelled
      }
    }

    // Validate we have either creditPackId or amount
    if (!creditPackId && !amount) {
      app.ui.toast(t('somethingWentWrong'), { type: 'error' });
      return;
    }

    try {
      setIsLoading(true);

      let url;

      if (creditPackId) {
        // Use predefined payment link
        const result = await app.billing.createPaymentLink(creditPackId, {
          ...metadata,
          type: 'credits',
          credits: credits,
        });
        url = result.url;
      } else {
        // Use custom checkout
        const items = [{
          name: credits ? `${credits} ${t('credits')}` : t('credits'),
          amount: amount,
          quantity: 1,
          description: t('addCredits', { amount: credits || '' }),
        }];

        const result = await app.billing.createCustomCheckout(items, {
          currency,
          metadata: {
            ...metadata,
            type: 'credits',
            credits: credits,
          },
        });
        url = result.url;
      }

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
    if (credits) return t('addCredits', { amount: credits });
    return t('buyCredits');
  };

  return (
    <button
      onClick={handlePurchase}
      disabled={isLoading || (!creditPackId && !amount)}
      className={`
        credits-button py-3 px-6 rounded-lg font-semibold
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
        <span className="flex items-center justify-center gap-2">
          {/* Credits Icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {getButtonText()}
        </span>
      )}
    </button>
  );
}

CreditsButton.displayName = 'CreditsButton';
CreditsButton.isFrameworkComponent = true;
