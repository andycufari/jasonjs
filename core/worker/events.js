// core/worker/events.js — framework lifecycle event hook (OSS shim)
//
// Background job processing lives in the CM64 addon (.cm64/). In the
// open-source runtime, emitWorkerEvent is a no-op unless a handler has been
// registered — the addon claims the hook at boot via registerWorkerEventHandler
// (called from its @cm64/register entry). Framework code can therefore emit
// lifecycle events unconditionally.

let handler = null;

/**
 * Register a handler for framework lifecycle events.
 * @param {(event: {siteId: string, domain: string, eventName: string, payload: object}) => Promise<void>} fn
 */
export function registerWorkerEventHandler(fn) {
  handler = fn;
}

export async function emitWorkerEvent(event) {
  if (!handler) return null;
  try {
    return await handler(event);
  } catch (error) {
    console.error('[workerEvents] handler failed:', error?.message);
    return null;
  }
}

export async function emitBatchEvents(events = []) {
  if (!handler) return null;
  return Promise.all(events.map((event) => emitWorkerEvent(event)));
}

export const FRAMEWORK_EVENTS = {
  // Authentication
  AUTH_SIGNUP: 'auth:signup',
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_PASSWORD_RESET: 'auth:password_reset',

  // User
  USER_UPDATED: 'user:updated',
  USER_DELETED: 'user:deleted',

  // Billing
  SUBSCRIPTION_CREATED: 'billing:subscription_created',
  SUBSCRIPTION_UPDATED: 'billing:subscription_updated',
  SUBSCRIPTION_CANCELLED: 'billing:subscription_cancelled',
  PAYMENT_SUCCEEDED: 'billing:payment_succeeded',
  PAYMENT_FAILED: 'billing:payment_failed',

  // Database (optional, can be enabled per-collection)
  DB_RECORD_CREATED: 'db:record_created',
  DB_RECORD_UPDATED: 'db:record_updated',
  DB_RECORD_DELETED: 'db:record_deleted'
};

export default {
  emitWorkerEvent,
  emitBatchEvents,
  registerWorkerEventHandler,
  FRAMEWORK_EVENTS
};
