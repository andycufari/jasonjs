// Standalone (node --import ./tests/unit/support/alias-loader.mjs tests/unit/billing-function-checkout.test.mjs).
// app.billing.checkout: a site function sells something at its own price and names the function
// that applies the payment (onPaid); the webhook runs that function with app.source 'billing'.
import assert from 'node:assert/strict';
import { createFunctionBilling } from '../../core/services/billing/functionCheckout.js';
import { runFunctionBillingHook, providerName } from '../../core/services/billing/functionHook.js';
import { signTestCheckout, verifyTestCheckout, simulatedPayment } from '../../core/services/billing/testCheckout.js';

process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret';
const booked = [];
const fakeLedger = async (siteId) => ({
  recordCheckout: async (d) => { booked.push({ op: 'record', siteId, ...d }); },
  markCheckout: async (id, u) => { booked.push({ op: 'mark', id, ...u }); },
  markRefunded: async (pid) => { booked.push({ op: 'refunded', pid }); },
  listCheckouts: async (o) => [{ ledgerId: 'chk_1', o }],
});

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
const billing = (cfg, isAdmin = false) => createFunctionBilling({
  siteId: { toString: () => 'site1' }, domain: 'andy.cm64.io', isAdmin,
  loadBilling: async () => cfg, makeProvider: async (name) => stub(name), ledger: fakeLedger,
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
const ledgerId = c.options.metadata.ledger;
assert.match(ledgerId, /^chk_/);
assert.deepEqual(c.options.metadata, { codigo: 'CAT', n: '2', function: 'tallerPagado', domain: 'andy.cm64.io', siteId: 'site1', ledger: ledgerId, reference: 'ins1' });
let rec = booked.pop();
assert.deepEqual({ op: rec.op, ledgerId: rec.ledgerId, provider: rec.provider, checkoutId: rec.checkoutId, amountCents: rec.amountCents, currency: rec.currency, reference: rec.reference, test: rec.test },
  { op: 'record', ledgerId, provider: 'stripe', checkoutId: 'cs_1', amountCents: 5500000, currency: 'USD', reference: 'ins1', test: false }, 'every checkout lands in the ledger');

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
await rejects(both.checkout({ ...base, metadata: { simulated: 'true' } }), /reserved/, "metadata can't fake a simulated payment");
await rejects(both.checkout({ ...base, provider: 'paypal' }), /provider/, 'unknown provider');
await rejects(billing({ stripe: { secretKey: 'sk' } }).checkout({ ...base, provider: 'mercadopago' }), /not configured/, 'provider without keys');
assert.equal(calls.length, 0, 'no provider call on invalid input');
booked.length = 0;

// ----- test mode: admins only, no provider, no keys -----
assert.deepEqual(await billing({ stripe: { secretKey: 'sk' } }, true).providers(), ['stripe', 'test'], "an admin also gets 'test'");
await rejects(both.checkout({ ...base, provider: 'test' }), /admins only/, 'a visitor cannot use the test provider');
const admin = billing(null, true);
r = await admin.checkout({ ...base, provider: 'test', currency: 'ars' });
assert.equal(r.provider, 'test');
assert.match(r.id, /^test_cs_/);
assert.ok(r.url.startsWith('https://andy.cm64.io/api/billing/test-checkout?t='), 'the url is the framework test page');
assert.equal(calls.length, 0, 'no provider involved');
const tok = decodeURIComponent(r.url.split('?t=')[1]);
const td = verifyTestCheckout(tok);
assert.equal(td.functionName, 'tallerPagado');
assert.equal(td.amount, 5500000);
assert.equal(td.currency, 'ARS');
assert.equal(td.metadata.simulated, 'true');
assert.equal(td.metadata.reference, 'ins1');
assert.equal(booked.pop().test, true, 'test checkouts are in the ledger, flagged');
assert.equal(verifyTestCheckout(tok.slice(0, -2) + 'xx'), null, 'a tampered token is rejected');
assert.equal(verifyTestCheckout(tok, { now: Date.now() + 2 * 3600e3 }), null, 'an expired token is rejected');
assert.equal(verifyTestCheckout(signTestCheckout({ a: 1 }, { key: 'other' })), null, 'a token signed with another key is rejected');
const sim = simulatedPayment(td, 'succeeded');
assert.equal(sim.simulated, true);
assert.equal(sim.amount, 5500000);
assert.equal(sim.currency, 'ars');
assert.equal(sim.metadata.reference, 'ins1');

// payments(): admin only
await rejects(both.payments(), /admin only/);
assert.equal((await admin.payments({ limit: 5 }))[0].ledgerId, 'chk_1');

// refund: through the provider; a second refund is not an error
assert.deepEqual(await both.refund({ provider: 'stripe', paymentId: 'pi_1' }), { id: 're_pi_1', status: 'succeeded' });
assert.deepEqual(await both.refund({ provider: 'mercadopago', paymentId: 'done' }), { status: 'already_refunded' });
assert.deepEqual(booked.slice(-2).map(b => b.op), ['refunded', 'refunded'], 'refunds land in the ledger');
assert.equal((await admin.refund({ provider: 'test', paymentId: 'test_pay_1' })).status, 'simulated');
await rejects(both.refund({ provider: 'stripe' }), /paymentId/);

// ----- the webhook side: runFunctionBillingHook -----
const runs = [];
const exec = (answer) => async (opts) => { runs.push(opts); if (answer instanceof Error) throw answer; return answer; };
const payment = { id: 'pi_1', amount: 5500000, currency: 'ars', metadata: { function: 'tallerPagado', reference: 'ins1', ledger: 'chk_9' } };

assert.equal(await runFunctionBillingHook({
  functionName: 'tallerPagado', hook: 'onPaymentSucceeded', siteId: 'site1', domain: 'andy.cm64.io',
  payload: { payment, provider: stub('mercadopago') }, ledger: fakeLedger, execute: exec({ __STATUS__: 200, ok: true }), ledger: fakeLedger,
}), true);
let run = runs.pop();
assert.equal(run.functionName, 'tallerPagado');
assert.equal(run.source, 'billing', 'runs as billing (an HTTP caller cannot fake it)');
assert.equal(run.siteId, 'site1');
assert.deepEqual(run.params, { event: 'succeeded', provider: 'mercadopago', payment }, 'provider arrives as its name');
let mark = booked.pop();
assert.deepEqual({ op: mark.op, id: mark.id, status: mark.status, paymentId: mark.paymentId, ok: mark.ok }, { op: 'mark', id: 'chk_9', status: 'succeeded', paymentId: 'pi_1', ok: true });

await runFunctionBillingHook({
  functionName: 'tallerPagado', hook: 'onCheckoutExpired', siteId: 'site1', domain: 'andy.cm64.io',
  payload: { checkout: { id: 'cs_1' }, provider: stub('stripe') }, ledger: fakeLedger, execute: exec({ __STATUS__: 200 }),
});
assert.deepEqual(runs.pop().params, { event: 'expired', provider: 'stripe', checkout: { id: 'cs_1' } });

await assert.rejects(runFunctionBillingHook({
  functionName: 'tallerPagado', hook: 'onPaymentFailed', siteId: 's', domain: 'd',
  payload: { payment }, ledger: fakeLedger, execute: exec({ __STATUS__: 500, error: 'db down' }), ledger: fakeLedger,
}), /answered 500/, 'a 5xx answer throws, so the webhook answers 500 and the provider retries');
mark = booked.pop();
assert.equal(mark.ok, false);
assert.match(mark.error, /answered 500: db down/, 'the ledger keeps why the handler failed');

assert.equal(await runFunctionBillingHook({
  functionName: 'noExiste', hook: 'onPaymentSucceeded', siteId: 's', domain: 'd',
  payload: { payment }, ledger: fakeLedger, execute: exec({ __STATUS__: 404, error: 'Function not found: noExiste' }),
}), false, "a missing function isn't retried forever");

await assert.rejects(runFunctionBillingHook({
  functionName: 'tallerPagado', hook: 'onPaymentSucceeded', siteId: 's', domain: 'd',
  payload: { payment }, ledger: fakeLedger, execute: exec({ error: 'timeout' }),
}), /answered 500/, 'runFunction reports failures as a result: an error without status counts as 500');

runs.length = 0;
assert.equal(await runFunctionBillingHook({
  functionName: '../../etc', hook: 'onPaymentSucceeded', siteId: 's', domain: 'd', payload: { payment }, ledger: fakeLedger, execute: exec({}),
}), false, 'invalid function name: ignored');
assert.equal(runs.length, 0);

assert.equal(providerName({ name: 'stripe' }), 'stripe');
assert.equal(providerName('mercadopago'), 'mercadopago');
assert.equal(providerName(null), null);

console.log('billing-function-checkout: PASS');
