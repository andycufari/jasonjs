// Billing events for addons. A payment whose metadata names an addon (metadata.addon)
// is handed to that addon's hooks/billing.js, e.g.
//
//   export async function onPaymentSucceeded({ payment, provider, context }) { … }
//   export async function onPaymentFailed({ payment, provider, context }) { … }
//   export async function onCheckoutExpired({ checkout, provider, context }) { … }
//
// `context` is a server-side addon context for the site the payment belongs to
// (see core/addons/context.js). A hook that throws makes the webhook answer non-2xx,
// so the provider retries — hooks must be idempotent.

import { createAddonContext } from '@/core/addons/context';

const ADDON_NAME = /^[a-z0-9-]+$/;

/**
 * @returns {Promise<boolean>} true if a hook ran, false if the addon has none for this event
 */
export async function runAddonBillingHook({ addon, hook, domain, payload }) {
  if (!ADDON_NAME.test(addon || '')) {
    console.warn(`[billing] ignoring invalid addon name in payment metadata: ${addon}`);
    return false;
  }

  let hooks;
  try {
    hooks = await import(`@/addons/${addon}/hooks/billing.js`);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' || /Cannot find module/.test(err.message || '')) {
      console.warn(`[billing] addon ${addon} has no hooks/billing.js — ${hook} skipped`);
      return false;
    }
    throw err;
  }

  if (typeof hooks[hook] !== 'function') return false;

  const context = await createAddonContext({ host: domain, serverSideAccess: true });
  if (!context) throw new Error(`[billing] site not found for addon hook: ${domain}`);

  await hooks[hook]({ ...payload, context });
  return true;
}
