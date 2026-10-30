// Standalone (node --import ./tests/unit/support/alias-loader.mjs tests/unit/billing-function-checkout.test.mjs).
// app.billing.checkout: a site function sells something at its own price and names the function
// that applies the payment (onPaid); the webhook runs that function with app.source 'billing'.
import assert from 'node:assert/strict';
import { createFunctionBilling } from '../../core/services/billing/functionCheckout.js';
import { runFunctionBillingHook, providerName } from '../../core/services/billing/functionHook.js';

const calls = [];
const stub = (name) => ({
  name,
  async createCustomCheckout(email, items, options) {
    calls.push({ name, email, items, options });
    return name === 'stripe' ? { id: 'cs_1', url: 'https://checkout.stripe.com/x' } : { id: 'pref_1', url: 'https://mp/x' };
  },
  async refundPayment(id) {
    if (id === 'done') { const e = new Error('already'); e.code = 'charge_already_refunded'; throw e; }
    return { id: 're_' + id, status: 'succeeded' };
  },
});
const billing = (cfg) => createFunctionBilling({
  siteId: { toString: () => 'site1' }, domain: 'andy.cm64.io',
  loadBilling: async () => cfg, makeProvider: async (name) => stub(name),
});
const both = billing({ stripe: { secretKey: 'sk' }, mercadopago: { accessToken: 'mp', statementDescriptor: 'ANDY' } });
const base = {
  email: 'ana@example.com', items: [{ name: 'Taller', description: 'Sáb 14/11', amount: 5500000 }],
  onPaid: 'tallerPagado', reference: 'ins1', returnUrl: 'https://andy.cm64.io/t?ok', cancelUrl: 'https://andy.cm64.io/t',
};
const rejects = (p, re, msg) => assert.rejects(p, e => re.test(e.message), msg);

// providers(): the ones with keys
assert.deepEqual(await both.providers(), ['stripe', 'mercadopago']);
assert.deepEqual(await billing({ stripe: { secretKey: 'sk' } }).providers(), ['stripe']);
assert.deepEqual(await billing(null).providers(), []);

// Stripe: our metadata wins, reference → client_reference_id, currency lowercase
let r = await both.checkout({ ...base, provider: 'stripe', currency: 'USD', metadata: { codigo: 'CAT', n: 2 } });
assert.deepEqual(r, { provider: 'stripe', id: 'cs_1', url: 'https://checkout.stripe.com/x' });
let c = calls.pop();
assert.equal(c.email, 'ana@example.com');
assert.equal(c.items[0].amount, 5500000);
assert.equal(c.options.currency, 'usd');
assert.equal(c.options.clientReferenceId, 'ins1');
assert.deepEqual(c.options.metadata, { codigo: 'CAT', n: '2', function: 'tallerPagado', domain: 'andy.cm64.io', siteId: 'site1', reference: 'ins1' });

// MercadoPago: the checkout names this site's webhook, instant methods only, currency uppercase
r = await both.checkout({ ...base, provider: 'mercadopago', currency: 'ars' });
c = calls.pop();
assert.equal(r.url, 'https://mp/x');
assert.equal(c.options.currency, 'ARS');
assert.equal(c.options.externalReference, 'ins1');
assert.equal(c.options.notificationUrl, 'https://andy.cm64.io/api/billing/webhook/mercadopago?source_news=webhooks');
assert.equal(c.options.instantOnly, true);
assert.equal(c.options.statementDescriptor, 'ANDY');
assert.equal(c.options.metadata.function, 'tallerPagado');

// Validation: nothing reaches the provider
await rejects(both.checkout({ ...base, onPaid: '' }), /onPaid/, 'onPaid is required');
await rejects(both.checkout({ ...base, onPaid: '../x' }), /onPaid/, 'onPaid must be a function name');
await rejects(both.checkout({ ...base, items: [] }), /items/, 'at least one item');
await rejects(both.checkout({ ...base, items: [{ name: 'x', amount: 55.5 }] }), /cents/, 'amount in integer cents');
await rejects(both.checkout({ ...base, items: [{ name: 'x', amount: 0 }] }), /cents/, 'amount > 0');
await rejects(both.checkout({ ...base, returnUrl: '' }), /returnUrl/, 'return urls required');
await rejects(both.checkout({ ...base, metadata: { function: 'otra' } }), /reserved/, "metadata can't override function");
await rejects(both.checkout({ ...base, metadata: { domain: 'evil.com' } }), /reserved/, "metadata can't reroute the webhook");
await rejects(both.checkout({ ...base, provider: 'paypal' }), /provider/, 'unknown provider');
await rejects(billing({ stripe: { secretKey: 'sk' } }).checkout({ ...base, provider: 'mercadopago' }), /not configured/, 'provider without keys');
assert.equal(calls.length, 0, 'no provider call on invalid input');

// refund: through the provider; a second refund is not an error
assert.deepEqual(await both.refund({ provider: 'stripe', paymentId: 'pi_1' }), { id: 're_pi_1', status: 'succeeded' });
assert.deepEqual(await both.refund({ provider: 'mercadopago', paymentId: 'done' }), { status: 'already_refunded' });
await rejects(both.refund({ provider: 'stripe' }), /paymentId/);

// ----- the webhook side: runFunctionBillingHook -----
const runs = [];
const exec = (answer) => async (opts) => { runs.push(opts); if (answer instanceof Error) throw answer; return answer; };
const payment = { id: 'pi_1', amount: 5500000, currency: 'ars', metadata: { function: 'tallerPagado', reference: 'ins1' } };

assert.equal(await runFunctionBillingHook({
  functionName: 'tallerPagado', hook: 'onPaymentSucceeded', siteId: 'site1', domain: 'andy.cm64.io',
  payload: { payment, provider: stub('mercadopago') }, execute: exec({ __STATUS__: 200, ok: true }),
}), true);
let run = runs.pop();
assert.equal(run.functionName, 'tallerPagado');
assert.equal(run.source, 'billing', 'runs as billing (an HTTP caller cannot fake it)');
assert.equal(run.siteId, 'site1');
assert.deepEqual(run.params, { event: 'succeeded', provider: 'mercadopago', payment }, 'provider arrives as its name');

await runFunctionBillingHook({
  functionName: 'tallerPagado', hook: 'onCheckoutExpired', siteId: 'site1', domain: 'andy.cm64.io',
  payload: { checkout: { id: 'cs_1' }, provider: stub('stripe') }, execute: exec({ __STATUS__: 200 }),
});
assert.deepEqual(runs.pop().params, { event: 'expired', provider: 'stripe', checkout: { id: 'cs_1' } });

await assert.rejects(runFunctionBillingHook({
  functionName: 'tallerPagado', hook: 'onPaymentFailed', siteId: 's', domain: 'd',
  payload: { payment }, execute: exec({ __STATUS__: 500, error: 'db down' }),
}), /answered 500/, 'a 5xx answer throws, so the webhook answers 500 and the provider retries');

assert.equal(await runFunctionBillingHook({
  functionName: 'noExiste', hook: 'onPaymentSucceeded', siteId: 's', domain: 'd',
  payload: { payment }, execute: exec({ __STATUS__: 404, error: 'Function not found: noExiste' }),
}), false, "a missing function isn't retried forever");

await assert.rejects(runFunctionBillingHook({
  functionName: 'tallerPagado', hook: 'onPaymentSucceeded', siteId: 's', domain: 'd',
  payload: { payment }, execute: exec({ error: 'timeout' }),
}), /answered 500/, 'runFunction reports failures as a result: an error without status counts as 500');

runs.length = 0;
assert.equal(await runFunctionBillingHook({
  functionName: '../../etc', hook: 'onPaymentSucceeded', siteId: 's', domain: 'd', payload: { payment }, execute: exec({}),
}), false, 'invalid function name: ignored');
assert.equal(runs.length, 0);

assert.equal(providerName({ name: 'stripe' }), 'stripe');
assert.equal(providerName('mercadopago'), 'mercadopago');
assert.equal(providerName(null), null);

console.log('billing-function-checkout: PASS');
