// components/system/billing/BillingSystemProvider.jsx - Server Component
import { getBillingContext } from '@/lib/billing-config';
import BillingProvider from '@/components/framework/billing/BillingProvider';

/**
 * BillingSystemProvider - Server-side wrapper for billing functionality
 *
 * This component:
 * 1. Runs on the server to read billing.json configuration
 * 2. Only renders BillingProvider if billing is configured
 * 3. Passes public config (no secrets) to the client
 *
 * Following the same pattern as AuthSystemProvider for consistency.
 */
export default async function BillingSystemProvider({ children }) {
  const { config, isConfigured } = await getBillingContext();

  // If billing is not configured, just render children
  // No BillingProvider means no billing modals, no overhead
  if (!isConfigured) {
    return <>{children}</>;
  }

  // Billing is configured - render BillingProvider which handles:
  // - Event listeners for billing.showPlans, billing.requirePlan, etc.
  // - Portal-based modal rendering
  return (
    <BillingProvider config={config}>
      {children}
    </BillingProvider>
  );
}

// Export the context getter for use in other server components
export { getBillingContext };
