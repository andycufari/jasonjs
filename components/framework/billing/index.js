/**
 * JasonJS Framework - Billing Components
 *
 * Core Components:
 * - BillingProvider: Global provider for programmatic billing UI (add to layout)
 * - PricingTable: Display plans with subscribe buttons
 * - SubscribeButton: Subscribe to specific plan or open modal
 * - SubscriptionStatus: Show current subscription
 * - PaymentHistory: Payment history with pagination
 *
 * Payment Components:
 * - PaymentButton: One-time payment button
 * - CreditsButton: Purchase credits
 * - CustomCheckoutButton: Shopping cart checkout
 * - BillingReturn: Success/cancel page handler
 *
 * Modal Components:
 * - BillingModal: Full billing management modal
 * - PlanSelectionModal: Plan selection modal
 *
 * Hooks:
 * - useBillingConfig: Access billing data in components
 * - useBillingTranslations: i18n for billing UI
 */

// Core provider - add to layout for programmatic API
export { default as BillingProvider } from './BillingProvider';

// Display components
export { default as PricingTable } from './PricingTable';
export { default as SubscriptionStatus } from './SubscriptionStatus';
export { default as PaymentHistory } from './PaymentHistory';

// Action components
export { default as SubscribeButton } from './SubscribeButton';
export { default as PaymentButton } from './PaymentButton';
export { default as CreditsButton } from './CreditsButton';
export { default as CustomCheckoutButton } from './CustomCheckoutButton';

// Return page handler
export { default as BillingReturn } from './BillingReturn';

// Modal components
export { default as BillingModal } from './BillingModal';
export { default as PlanSelectionModal } from './PlanSelectionModal';

// Hooks - re-export from core
export { useBillingConfig, useBillingTranslations } from '@/core/hooks/useBillingConfig';
