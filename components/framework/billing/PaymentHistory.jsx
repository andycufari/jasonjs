'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/core/app';
import { useBillingTranslations } from '@/core/hooks/useBillingConfig';

/**
 * PaymentHistory Component
 *
 * Displays user's payment history with pagination support.
 * Supports dark mode, i18n, and load more functionality.
 *
 * @param {Object} props
 * @param {number} props.limit - Number of payments per page
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.compact - Use compact table design
 */
export default function PaymentHistory({
  limit = 10,
  className = '',
  compact = false,
}) {
  const app = useApp();
  const { t, language } = useBillingTranslations();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentLimit, setCurrentLimit] = useState(limit);

  const loadPayments = useCallback(async (loadLimit) => {
    try {
      console.log('[PaymentHistory] Loading payments, limit:', loadLimit);
      const data = await app.billing.getPayments(loadLimit);
      console.log('[PaymentHistory] Received data:', data);
      const paymentsList = data?.payments || [];
      setPayments(paymentsList);
      // If we got exactly the limit, there might be more
      setHasMore(paymentsList.length >= loadLimit);
    } catch (error) {
      console.error('[PaymentHistory] Failed to load payment history:', error);
      setPayments([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [app.billing]);

  useEffect(() => {
    // Always try to load payments - the API will check auth
    console.log('[PaymentHistory] useEffect triggered, isAuthenticated:', app.auth?.isAuthenticated);
    loadPayments(currentLimit);
  }, [currentLimit, loadPayments]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    setCurrentLimit(prev => prev + limit);
  };

  // Format date with locale
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const locale = language === 'es-AR' ? 'es-AR' : language === 'pt-BR' ? 'pt-BR' : 'en-US';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Status badge with dark mode support
  const getStatusBadge = (status) => {
    const badges = {
      succeeded: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      failed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
      pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
      refunded: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400',
    };
    return badges[status] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400';
  };

  // Translate status
  const getStatusText = (status) => {
    const statusMap = {
      succeeded: t('succeeded'),
      failed: t('failed'),
      pending: t('pending'),
      refunded: t('refunded'),
    };
    return statusMap[status] || status;
  };

  // Login required state - only show if explicitly not authenticated
  // Note: app.auth.isAuthenticated may be undefined initially
  if (app.auth?.isAuthenticated === false) {
    return (
      <div className={`payment-history-login ${className}`}>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">{t('loginRequired')}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={`payment-history-loading ${className}`}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-200 dark:bg-gray-800 h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (payments.length === 0) {
    return (
      <div className={`payment-history-empty ${className}`}>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-gray-600 dark:text-gray-400">{t('noPayments')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`payment-history ${className}`}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Desktop Table */}
        <div className={compact ? '' : 'hidden md:block'}>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('description')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('amount')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {payments.map((payment) => (
                <tr
                  key={payment.id || payment.paymentId}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatDate(payment.createdAt || payment.created_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    <div>{payment.description || '-'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 capitalize">
                      {payment.provider}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                    {app.billing.formatCurrency(payment.amount, payment.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadge(payment.status)}`}
                    >
                      {getStatusText(payment.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        {!compact && (
          <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {payments.map((payment) => (
              <div
                key={payment.id || payment.paymentId}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {payment.description || '-'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 capitalize">
                      {payment.provider}
                    </p>
                  </div>
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(payment.status)}`}
                  >
                    {getStatusText(payment.status)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(payment.createdAt || payment.created_at)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {app.billing.formatCurrency(payment.amount, payment.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Count + Load More */}
      <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('showingPayments', { count: payments.length })}
        </p>

        {hasMore && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('loading')}
              </span>
            ) : (
              t('loadMore')
            )}
          </button>
        )}
      </div>
    </div>
  );
}

PaymentHistory.displayName = 'PaymentHistory';
PaymentHistory.isFrameworkComponent = true;
