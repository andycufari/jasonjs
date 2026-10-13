// Standalone (node tests/unit/stripe-provider-checkout.test.mjs) — no network, no jest.
// Guards the two reasons guest checkout with Stripe never worked, plus the event mapping
// the booking addon relies on.
import assert from 'node:assert/strict';
import StripeProvider from '../../core/services/billing/providers/stripe.js';

const provider = new StripeProvider({ secretKey: 'sk_test_dummy', returnUrl: '/ok', cancelUrl: '/no' });
let sent;
provider.stripe = {
  checkout: { sessions: { create: async (params) => { sent = params; return { id: 'cs_1', url: 'https://checkout' }; } } },
};

// 1. An email goes in customer_email (Stripe rejects it in `customer`); cus_… stays in customer.
await provider.createCustomCheckout('guest@example.com', [{ name: 'Consulta', amount: 7900 }], {
  expiresAt: new Date('2026-10-14T12:31:00Z'),
  clientReferenceId: 'b1',
  metadata: { addon: 'booking-calendar', bookingId: 'b1', domain: 'andy.cm64.io' },
});
assert.equal(sent.customer, undefined);
assert.equal(sent.customer_email, 'guest@example.com');
assert.equal(sent.expires_at, Math.floor(Date.parse('2026-10-14T12:31:00Z') / 1000));
assert.equal(sent.client_reference_id, 'b1');
assert.equal(sent.metadata.domain, 'andy.cm64.io');
assert.equal(sent.payment_intent_data.metadata.bookingId, 'b1', 'metadata mirrored on the PaymentIntent');

await provider.createCustomCheckout('cus_123', [{ name: 'x', amount: 100 }]);
assert.equal(sent.customer, 'cus_123');
assert.equal(sent.customer_email, undefined);

// Item names are capped at Stripe's 500-char metadata limit.
await provider.createCustomCheckout('a@b.co', Array.from({ length: 60 }, (_, i) => ({ name: `item number ${i}`, amount: 100 })));
assert.ok(sent.metadata.itemNames.length <= 500);

// 2. Webhook mapping.
const session = (over) => ({ data: { object: {
  id: 'cs_1', mode: 'payment', payment_intent: 'pi_1', amount_total: 7900, currency: 'usd',
  customer: null, customer_details: { email: 'guest@example.com' }, metadata: { bookingId: 'b1' }, ...over,
} } });

let ev = await provider.handleWebhookEvent({ type: 'checkout.session.completed', ...session({ payment_status: 'paid' }) });
assert.equal(ev.type, 'payment.succeeded');
assert.equal(ev.data.id, 'pi_1');
assert.equal(ev.data.email, 'guest@example.com');
assert.equal(ev.data.amount, 7900);

ev = await provider.handleWebhookEvent({ type: 'checkout.session.completed', ...session({ payment_status: 'unpaid' }) });
assert.equal(ev.type, 'payment.pending', 'a delayed method completes the session unpaid — not a payment yet');

ev = await provider.handleWebhookEvent({ type: 'checkout.session.async_payment_succeeded', ...session({ payment_status: 'paid' }) });
assert.equal(ev.type, 'payment.succeeded');

ev = await provider.handleWebhookEvent({ type: 'checkout.session.async_payment_failed', ...session({ payment_status: 'unpaid' }) });
assert.equal(ev.type, 'payment.failed');

ev = await provider.handleWebhookEvent({ type: 'checkout.session.expired', ...session({ status: 'expired' }) });
assert.equal(ev.type, 'checkout.expired');
assert.equal(ev.data.metadata.bookingId, 'b1');

ev = await provider.handleWebhookEvent({ type: 'checkout.session.completed', ...session({ mode: 'subscription' }) });
assert.equal(ev.type, 'checkout.completed', 'subscription checkouts unchanged');

console.log('stripe-provider-checkout: PASS');
process.exit(0);
