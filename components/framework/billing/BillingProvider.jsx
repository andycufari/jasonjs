'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useApp } from '@/core/hooks/useApp';
import PlanSelectionModal from './PlanSelectionModal';
import BillingModal from './BillingModal';

/**
 * BillingProvider Component
 *
 * Client-side provider that listens to billing events and renders modals.
 * This component is automatically included by BillingSystemProvider when
 * billing is configured - developers don't need to add it manually.
 *
 * Events handled:
 * - billing.showPlans - Opens plan selection modal
 * - billing.showBillingModal - Opens full billing modal
 * - billing.requirePlan - Shows upgrade flow if user doesn't have plan
 *
 * @example
 * // Developers just use the API - modals appear automatically
 * const planId = await app.billing.showPlans();
 * await app.billing.requirePlan('pro');
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @param {Object} props.config - Billing config from server (public data only)
 */
export default function BillingProvider({ children, config }) {
  const app = useApp();
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  // Modal states
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showRequirePlanModal, setShowRequirePlanModal] = useState(false);

  // Modal options
  const [plansOptions, setPlansOptions] = useState({});
  const [billingOptions, setBillingOptions] = useState({});
  const [requirePlanOptions, setRequirePlanOptions] = useState({});

  // Promise resolvers for async API
  const [plansResolver, setPlansResolver] = useState(null);
  const [billingResolver, setBillingResolver] = useState(null);
  const [requirePlanResolver, setRequirePlanResolver] = useState(null);

  // Handle plan selection from modal
  const handlePlanSelect = useCallback(async (planId) => {
    console.log('[BillingProvider] Plan selected:', planId);

    // Call custom callback if provided
    if (plansOptions.onSelect) {
      plansOptions.onSelect(planId);
    }

    // For requirePlan flow, redirect to checkout
    if (requirePlanResolver) {
      try {
        // Check auth first - only prompt if not authenticated
        if (!isAuthenticated) {
          await app.auth.requireLogin({
            message: requirePlanOptions.message || 'Sign in to subscribe'
          });
        }

        // Create checkout and redirect
        console.log('[BillingProvider] Creating checkout for requirePlan flow, user:', session?.user?.email);
        const { url } = await app.billing.createCheckoutSession(planId);
        window.location.href = url;

        // Don't resolve yet - page will redirect
      } catch (error) {
        console.error('[BillingProvider] requirePlan checkout error:', error);
        requirePlanResolver.reject(error);
        setRequirePlanResolver(null);
        setShowRequirePlanModal(false);
        setShowPlansModal(false);
      }
      return;
    }

    // For showPlans flow - create checkout and redirect
    if (plansResolver) {
      try {
        // Check auth first - only prompt if not authenticated
        if (!isAuthenticated) {
          console.log('[BillingProvider] User not authenticated, showing login');
          await app.auth.requireLogin({
            message: 'Sign in to subscribe'
          });
        }

        // Create checkout and redirect
        console.log('[BillingProvider] Creating checkout for showPlans flow, user:', session?.user?.email);
        const result = await app.billing.createCheckoutSession(planId);
        console.log('[BillingProvider] Checkout result:', result);

        if (result?.url) {
          window.location.href = result.url;
        } else {
          throw new Error('No checkout URL returned');
        }

        // Resolve with planId (though page will redirect)
        plansResolver(planId);
      } catch (error) {
        console.error('[BillingProvider] showPlans checkout error:', error);
        app.ui.toast(error.message || 'Failed to create checkout', { type: 'error' });
        plansResolver(null);
      } finally {
        setPlansResolver(null);
        setShowPlansModal(false);
      }
      return;
    }

    // No resolver - just close modal
    setShowPlansModal(false);
  }, [app, plansOptions, plansResolver, requirePlanResolver, requirePlanOptions, isAuthenticated, session]);

  // Handle modal close
  const handlePlansClose = useCallback(() => {
    if (plansOptions.onClose) {
      plansOptions.onClose();
    }

    // Resolve with null for showPlans
    if (plansResolver) {
      plansResolver(null);
      setPlansResolver(null);
    }

    // Reject for requirePlan (user cancelled)
    if (requirePlanResolver) {
      requirePlanResolver.reject(new Error('User cancelled'));
      setRequirePlanResolver(null);
    }

    setShowPlansModal(false);
    setShowRequirePlanModal(false);
  }, [plansOptions, plansResolver, requirePlanResolver]);

  const handleBillingClose = useCallback(() => {
    if (billingOptions.onClose) {
      billingOptions.onClose();
    }

    if (billingResolver) {
      billingResolver();
      setBillingResolver(null);
    }

    setShowBillingModal(false);
  }, [billingOptions, billingResolver]);

  // Listen to billing events from app.billing API
  useEffect(() => {
    if (!app?.events) return;

    // billing:showPlans event - triggered by app.billing.showPlans()
    const unsubShowPlans = app.events.on('billing:showPlans', (data) => {
      setPlansOptions(data.options || {});
      setPlansResolver(() => data.resolve);
      setShowPlansModal(true);
    });

    // billing:showBillingModal event - triggered by app.billing.showBillingModal()
    const unsubShowBilling = app.events.on('billing:showBillingModal', (data) => {
      setBillingOptions(data.options || {});
      setBillingResolver(() => data.resolve);
      setShowBillingModal(true);
    });

    // billing:requirePlan event - triggered by app.billing.requirePlan()
    const unsubRequirePlan = app.events.on('billing:requirePlan', (data) => {
      setRequirePlanOptions(data.options || {});
      setRequirePlanResolver({ resolve: data.resolve, reject: data.reject });
      setShowRequirePlanModal(true);
      setShowPlansModal(true); // Use plans modal with special handling
    });

    return () => {
      unsubShowPlans();
      unsubShowBilling();
      unsubRequirePlan();
    };
  }, [app]);

  return (
    <>
      {children}

      {/* Plan Selection Modal - rendered via portal */}
      <PlanSelectionModal
        isOpen={showPlansModal}
        onClose={handlePlansClose}
        onSelectPlan={handlePlanSelect}
        highlightPlan={plansOptions.highlightPlan}
        currentPlanId={requirePlanOptions.currentSubscription?.planId}
      />

      {/* Full Billing Modal - rendered via portal */}
      {showBillingModal && (
        <BillingModal
          isModal={true}
          onClose={handleBillingClose}
        />
      )}

      {/* Require Plan Message Overlay */}
      {showRequirePlanModal && requirePlanOptions.message && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 pointer-events-none">
          <div className="bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-lg pointer-events-auto">
            <p className="text-sm font-medium">{requirePlanOptions.message}</p>
          </div>
        </div>
      )}
    </>
  );
}

BillingProvider.displayName = 'BillingProvider';
BillingProvider.isFrameworkComponent = true;
