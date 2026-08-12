// components/framework/index.js
// Professional UI Pattern Components

// State Components
export { default as LoadingCard } from './LoadingCard.jsx';
export { default as LoadingSpinner } from './LoadingSpinner.jsx';
export { default as ErrorCard } from './ErrorCard.jsx';
export { default as EmptyState } from './EmptyState.jsx';
export { default as SuccessCard } from './SuccessCard.jsx';

// Interaction Components
export { default as ConfirmDialog } from './ConfirmDialog.jsx';

// Utility Components
export { default as MarkdownView, MarkdownViewAsync } from './utils/MarkdownView.jsx';

// Legacy UI Components (use shadcn/ui instead)
export { default as Button } from './ui/Button.jsx';
export { default as Input } from './ui/Input.jsx';
export { default as Card } from './ui/Card.jsx';

// SEO Components (deprecated - use automatic SEO extraction instead)
// JasonSEO and SEO components have been removed
// SEO is now handled automatically by core/render/seo.js

// Billing Components (re-exported for convenience)
// For full billing functionality, import directly from '@/components/framework/billing'
export { BillingProvider, PricingTable, SubscribeButton, SubscriptionStatus, PaymentHistory } from './billing';
export { PaymentButton, CreditsButton, CustomCheckoutButton, BillingReturn } from './billing';
export { BillingModal, PlanSelectionModal } from './billing';