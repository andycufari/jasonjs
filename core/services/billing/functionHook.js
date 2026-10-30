// Billing events for site functions. A checkout created with app.billing.checkout({ onPaid })
// carries metadata.function; the webhook runs that function of the site with
//
//   app.source === 'billing'   (an HTTP caller can't fake it)
//   app.params = { event: 'succeeded' | 'failed' | 'expired', provider, payment | checkout }
//
// The function answers like any other. A 4xx/5xx answer — or an exception — makes the webhook
// answer non-2xx, so the provider retries: the function must be idempotent (look at your own
// row's state before applying the payment).
//
// The function runs without a session: don't mark it `config.auth = true`.

export const FUNCTION_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const EVENTS = {
  onPaymentSucceeded: 'succeeded',
  onPaymentFailed: 'failed',
  onCheckoutExpired: 'expired',
};

async function defaultLedger(siteId) {
  const { createBillingDB } = await import('../../billing/db.js');
  return createBillingDB(siteId);
}

/**
 * @param {Object} opts
 * @param {string} opts.functionName - metadata.function
 * @param {string} opts.hook         - onPaymentSucceeded | onPaymentFailed | onCheckoutExpired
 * @param {Object} opts.payload      - { payment, provider } or { checkout, provider }
 * @param {Function} [opts.execute]  - runFunction wrapper (injectable for tests)
 * @param {Function} [opts.ledger]   - siteId → BillingDB (injectable for tests)
 * @returns {Promise<boolean>} true if the function ran, false if there was nothing to run
 */
export async function runFunctionBillingHook({ functionName, hook, siteId, domain, payload, execute, ledger = defaultLedger }) {
  if (!FUNCTION_NAME.test(functionName || '')) {
    console.warn(`[billing] ignoring invalid function name in payment metadata: ${functionName}`);
    return false;
  }
  const event = EVENTS[hook];
  if (!event) return false;
  if (!siteId || !domain) throw new Error(`[billing] ${functionName}.${event}: site unknown`);

  const obj = (payload && (payload.payment || payload.checkout)) || {};
  const ledgerId = obj.metadata?.ledger;
  // Bookkeeping only: a ledger failure never fails the webhook.
  const book = async (ok, error) => {
    if (!ledgerId) return;
    try {
      const db = await ledger(siteId);
      await db.markCheckout(ledgerId, { status: event, paymentId: payload?.payment?.id, event, ok, error });
    } catch (err) {
      console.error('[billing] ledger update failed:', err.message);
    }
  };

  const run = execute || (async ({ domain: d, functionName: name, params: p, source }) => {
    const { runFunction } = await import('@/core/functions/run.js');
    return runFunction(d, name, { params: p, source });
  });
  const { provider, ...rest } = payload || {};
  const params = JSON.parse(JSON.stringify({ event, provider: providerName(provider), ...rest }));

  // runFunction reports failures (throw, 404, 401, timeout) as a result, not a rejection
  const result = await run({ siteId: String(siteId), domain, functionName, params, source: 'billing' });

  // Retrying can't create a function that isn't there: log it and let the provider move on.
  if (result?.__STATUS__ === 404 && /^Function not found/.test(result?.error || '')) {
    console.error(`[billing] payment for ${domain} names function "${functionName}", which doesn't exist`);
    await book(false, `function ${functionName} not found`);
    return false;
  }

  const status = result?.__STATUS__ || (result?.error ? 500 : 200);
  if (status >= 400) {
    const message = `${functionName} answered ${status}${result?.error ? `: ${result.error}` : ''}`;
    await book(false, message);
    throw new Error(`[billing] ${message} (${event})`);
  }
  await book(true);
  return true;
}

/** The webhooks hand over provider instances; the function gets the name. */
export function providerName(provider) {
  if (!provider || typeof provider === 'string') return provider || null;
  if (provider.name) return provider.name;
  const ctor = provider.constructor?.name || '';
  if (/stripe/i.test(ctor)) return 'stripe';
  if (/mercado/i.test(ctor)) return 'mercadopago';
  return null;
}
