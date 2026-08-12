'use client';

import React, { useState } from 'react';
import { useApp } from '@/core/app';
import { useBillingTranslations } from '@/core/hooks/useBillingConfig';

/**
 * CustomCheckoutButton Component
 *
 * Flexible payment button for custom/dynamic checkout with multiple items.
 * Supports dark mode, i18n, and loading states.
 *
 * @param {Object} props
 * @param {Array<Object>} props.items - Array of items to checkout
 * @param {string} props.items[].name - Item name
 * @param {number} props.items[].amount - Amount in cents (e.g., 2999 = $29.99)
 * @param {number} props.items[].quantity - Quantity (default: 1)
 * @param {string} props.items[].description - Item description (optional)
 * @param {string} props.buttonText - Custom button text (overrides i18n)
 * @param {string} props.variant - Button variant (primary, secondary, default, success)
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.currency - Currency code (usd, ars, etc.)
 * @param {string} props.returnUrl - Custom return URL (optional)
 * @param {string} props.cancelUrl - Custom cancel URL (optional)
 * @param {Object} props.metadata - Additional metadata to attach to payment
 * @param {Function} props.onBeforeCheckout - Callback before checkout (can prevent by returning false)
 * @param {boolean} props.showTotal - Show total amount in button
 *
 * @example
 * // Simple product checkout
 * <CustomCheckoutButton
 *   items={[{ name: "T-Shirt", amount: 2999, quantity: 2 }]}
 *   buttonText="Buy Now"
 * />
 *
 * @example
 * // Shopping cart checkout
 * <CustomCheckoutButton
 *   items={cartItems}
 *   buttonText="Checkout"
 *   variant="success"
 *   showTotal={true}
 * />
 */
export default function CustomCheckoutButton({
  items = [],
  buttonText = null,
  variant = 'primary',
  className = '',
  currency = 'USD',
  returnUrl,
  cancelUrl,
  metadata = {},
  onBeforeCheckout,
  showTotal = false,
}) {
  const app = useApp();
  const { t } = useBillingTranslations();
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    // Validate items
    if (!items || items.length === 0) {
      app.ui.toast(t('somethingWentWrong'), { type: 'error' });
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

    // Call onBeforeCheckout callback
    if (onBeforeCheckout) {
      try {
        const shouldContinue = await onBeforeCheckout(items);
        if (shouldContinue === false) {
          return;
        }
      } catch (error) {
        app.ui.toast(error.message || t('somethingWentWrong'), { type: 'error' });
        return;
      }
    }

    try {
      setIsLoading(true);
      const { url } = await app.billing.createCustomCheckout(items, {
        currency,
        returnUrl,
        cancelUrl,
        metadata,
      });
      window.location.href = url;
    } catch (error) {
      app.ui.toast(error.message || t('paymentFailed'), { type: 'error' });
      setIsLoading(false);
    }
  };

  // Calculate total for display
  const total = items.reduce((sum, item) => {
    return sum + (item.amount * (item.quantity || 1));
  }, 0);

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
    if (buttonText) {
      if (showTotal && total > 0) {
        return `${buttonText} - ${app.billing.formatCurrency(total, currency)}`;
      }
      return buttonText;
    }
    if (showTotal && total > 0) {
      return `${t('continueToPay')} - ${app.billing.formatCurrency(total, currency)}`;
    }
    return t('continueToPay');
  };

  const hasItems = items && items.length > 0;

  return (
    <button
      onClick={handleCheckout}
      disabled={!hasItems || isLoading}
      className={`
        custom-checkout-button py-3 px-6 rounded-lg font-semibold
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant] || variantClasses.primary}
        ${className}
      `}
      title={hasItems ? `Total: ${app.billing.formatCurrency(total, currency)}` : t('noPlansAvailable')}
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

CustomCheckoutButton.displayName = 'CustomCheckoutButton';
CustomCheckoutButton.isFrameworkComponent = true;
