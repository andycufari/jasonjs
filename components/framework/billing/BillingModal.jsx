'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/core/app';
import { useBillingConfig, useBillingTranslations } from '@/core/hooks/useBillingConfig';
import SubscriptionStatus from './SubscriptionStatus';
import PlanSelectionModal from './PlanSelectionModal';

/**
 * BillingModal Component
 *
 * Full billing management modal with tabs for plan, history, and settings.
 * Similar pattern to UserProfile modal.
 *
 * @param {Object} props
 * @param {boolean} props.isModal - Whether rendered in modal mode
 * @param {Function} props.onClose - Callback when modal closes
 * @param {string} props.className - Additional CSS classes
 */
export default function BillingModal({
  isModal = true,
  onClose = null,
  className = '',
}) {
  const app = useApp();
  const { t } = useBillingTranslations();
  const { subscription, isSubscribed, refetch } = useBillingConfig();

  const [activeTab, setActiveTab] = useState('plan');
  const [mounted, setMounted] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle escape key
  useEffect(() => {
    if (!isModal) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isModal, onClose]);

  // Handle upgrade click
  const handleUpgrade = useCallback(() => {
    setShowPlanModal(true);
  }, []);

  // Handle plan selection from modal
  const handlePlanSelect = useCallback(async (planId) => {
    setShowPlanModal(false);

    if (!app.auth.isAuthenticated) {
      try {
        await app.auth.requireLogin({ message: t('loginRequired') });
      } catch {
        return;
      }
    }

    try {
      const { url } = await app.billing.createCheckoutSession(planId);
      window.location.href = url;
    } catch (error) {
      setMessage({ type: 'error', text: error.message || t('somethingWentWrong') });
    }
  }, [app.auth, app.billing, t]);

  // Tabs configuration - simplified to Plan and Settings (History available via Stripe portal)
  const tabs = [
    {
      id: 'plan',
      label: t('plan'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: t('settings'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'plan':
        return (
          <div className="space-y-6">
            <SubscriptionStatus
              showFeatures={true}
              showCancelButton={true}
              showUpgradeButton={true}
              onUpgrade={handleUpgrade}
              className="shadow-none border-0 p-0"
            />
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('settings')}
            </h3>

            {/* Manage Billing Link */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {t('manageInStripe')}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('updatePaymentMethod')}
                  </p>
                </div>
                <a
                  href="/api/billing/portal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {t('manageInStripe')}
                </a>
              </div>
            </div>

            {/* View Invoices */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {t('viewInvoices')}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    View and download your invoices
                  </p>
                </div>
                <a
                  href="/api/billing/portal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('viewInvoices')}
                </a>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const content = (
    <div className={`billing-modal bg-white dark:bg-gray-900 ${isModal ? 'rounded-2xl shadow-2xl' : ''} ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('managePlan')}
        </h2>
        {isModal && onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mx-6 mt-4 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium
                transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto max-h-[60vh]">
        {renderTabContent()}
      </div>

      {/* Plan Selection Modal */}
      <PlanSelectionModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSelectPlan={handlePlanSelect}
        currentPlanId={subscription?.subscription?.planId || subscription?.planId}
      />
    </div>
  );

  // Render in portal for modal mode
  if (isModal && mounted) {
    return createPortal(
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
          onClick={onClose}
        />

        {/* Modal Container */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative max-w-2xl w-full max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Non-modal render
  return content;
}

BillingModal.displayName = 'BillingModal';
BillingModal.isFrameworkComponent = true;
