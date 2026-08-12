'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/core/app';
import { useSearchParams } from 'next/navigation';
import { useBillingTranslations } from '@/core/hooks/useBillingConfig';

/**
 * BillingReturn Component
 *
 * Handles success/cancel redirect pages for payments and subscriptions.
 * Supports dark mode, i18n, and auto-redirect with countdown.
 *
 * @param {Object} props
 * @param {string} props.successMessage - Custom success message (overrides i18n)
 * @param {string} props.errorMessage - Custom error message (overrides i18n)
 * @param {string} props.redirectUrl - URL to redirect to after delay
 * @param {number} props.redirectDelay - Delay in milliseconds before redirect
 * @param {string} props.className - Additional CSS classes
 */
export default function BillingReturn({
  successMessage = null,
  errorMessage = null,
  redirectUrl = '/',
  redirectDelay = 3000,
  className = '',
}) {
  const app = useApp();
  const { t } = useBillingTranslations();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [countdown, setCountdown] = useState(Math.ceil(redirectDelay / 1000));

  useEffect(() => {
    // Determine status from URL parameters
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const sessionId = searchParams.get('session_id');

    if (success === 'true' || sessionId) {
      setStatus('success');
      app.ui.toast(successMessage || t('paymentSuccessful'), { type: 'success' });
    } else if (canceled === 'true') {
      setStatus('canceled');
      app.ui.toast(errorMessage || t('paymentCanceled'), { type: 'error' });
    } else {
      setStatus('error');
    }

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Redirect after delay
    const redirectTimeout = setTimeout(() => {
      window.location.href = redirectUrl;
    }, redirectDelay);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(redirectTimeout);
    };
  }, [searchParams, successMessage, errorMessage, redirectUrl, redirectDelay, t, app.ui]);

  const renderContent = () => {
    switch (status) {
      case 'success':
        return (
          <div className="text-center">
            {/* Success Icon */}
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-500 dark:text-green-400"
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
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('paymentSuccessful').replace('!', '')}!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {successMessage || t('paymentSuccessful')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {t('redirectingIn', { seconds: countdown })}
            </p>
          </div>
        );

      case 'canceled':
      case 'error':
        return (
          <div className="text-center">
            {/* Error/Cancel Icon */}
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-500 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {status === 'canceled' ? t('paymentCanceled').replace('was ', '').replace(' cancelado', '') : t('somethingWentWrong')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {errorMessage || t('paymentCanceled')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {t('redirectingIn', { seconds: countdown })}
            </p>
          </div>
        );

      default:
        return (
          <div className="text-center">
            {/* Loading Spinner */}
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">{t('processing')}</p>
          </div>
        );
    }
  };

  return (
    <div className={`billing-return min-h-[400px] flex items-center justify-center ${className}`}>
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
        {renderContent()}

        <div className="mt-6 text-center">
          <a
            href={redirectUrl}
            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
          >
            {t('clickHereIfNotRedirected')}
          </a>
        </div>
      </div>
    </div>
  );
}

BillingReturn.displayName = 'BillingReturn';
BillingReturn.isFrameworkComponent = true;
