// Standalone (node tests/unit/mercadopago-provider.test.mjs) — no network, no jest.
// What the booking addon needs from MercadoPago: a checkout that holds a slot (expires,
// instant methods only, our id as external_reference, its own webhook URL), refunds,
// and a webhook that understands both notification formats.
import assert from 'node:assert/strict';
import MercadoPagoProvider from '../../core/services/billing/providers/mercadopago.js';

const provider = new MercadoPagoProvider({ accessToken: 'TEST-dummy', returnUrl: '/ok', cancelUrl: '/no' });
let sent;
provider.preference = {
  create: async ({ body }) => { sent = body; return { id: 'pref_1', init_point: 'https://mp/checkout' }; },
  update: async (args) => { sent = args; return {}; },
};

// 1. Checkout for a booking.
const out = await provider.createCustomCheckout('guest@example.com', [{ name: 'Consulta', amount: 7900000 }], {
  currency: 'ARS',
  returnUrl: 'https://andy.cm64.io/meet/consulta?paid=b1&s=tok',
  cancelUrl: 'https://andy.cm64.io/meet/consulta?released=b1&t=c',
  externalReference: 'b1',
  notificationUrl: 'https://andy.cm64.io/api/billing/webhook/mercadopago?source_news=webhooks',
  expiresAt: new Date('2026-10-14T12:31:00Z'),
  instantOnly: true,
  metadata: { addon: 'booking-calendar', bookingId: 'b1' },
});
assert.deepEqual(out, { id: 'pref_1', url: 'https://mp/checkout' });
assert.equal(sent.items[0].unit_price, 79000, 'MercadoPago takes decimal amounts, not cents');
assert.equal(sent.items[0].currency_id, 'ARS');
assert.equal(sent.payer.email, 'guest@example.com');
assert.equal(sent.external_reference, 'b1');
assert.match(sent.notification_url, /webhook\/mercadopago/);
assert.equal(sent.expires, true);
assert.equal(sent.expiration_date_to, '2026-10-14T12:31:00.000Z');
assert.equal(sent.binary_mode, true);
assert.deepEqual(sent.payment_methods.excluded_payment_types.map(t => t.id), ['ticket', 'atm']);
assert.equal(sent.back_urls.success, 'https://andy.cm64.io/meet/consulta?paid=b1&s=tok');
assert.equal(sent.metadata.addon, 'booking-calendar');

// Without the options the preference stays as before (RentalSun's guest checkout).
await provider.createCustomCheckout('a@b.co', [{ name: 'x', amount: 100 }]);
for (const k of ['external_reference', 'notification_url', 'expires', 'binary_mode', 'payment_methods']) {
  assert.equal(sent[k], undefined, `${k} only when asked`);
}

await provider.expireCheckout('pref_1');
assert.equal(sent.id, 'pref_1');
assert.equal(sent.updatePreferenceRequest.expires, true);

// 2. Webhook: both formats; the payment is always fetched again with our token.
const payments = {
  '11': { id: 11, status: 'approved', transaction_amount: 79000, currency_id: 'ARS',
    payer: { email: 'guest@example.com' }, external_reference: 'b1',
    metadata: { addon: 'booking-calendar', booking_id: 'b1' } },
  '12': { id: 12, status: 'in_process', transaction_amount: 10, currency_id: 'ARS', metadata: {} },
  '13': { id: 13, status: 'rejected', transaction_amount: 10, currency_id: 'ARS', metadata: {} },
};
provider.payment = { get: async ({ id }) => { if (!payments[id]) throw new Error('404'); return payments[id]; } };

const req = (query, body) => new Request(`https://andy.cm64.io/api/billing/webhook/mercadopago${query}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
});

let ev = await provider.verifyWebhook(req('?topic=payment&id=11'));          // IPN
assert.equal(ev.data.id, 11);
ev = await provider.verifyWebhook(req('?data.id=11&type=payment'));          // Webhooks
assert.equal(ev.data.id, 11);
ev = await provider.verifyWebhook(req('?source_news=webhooks', { type: 'payment', action: 'payment.updated', data: { id: '11' } }));
assert.equal(ev.data.id, 11, 'id from the JSON body');
ev = await provider.verifyWebhook(req('?topic=merchant_order&id=99'));
assert.equal(ev.data, null, 'merchant_order is acknowledged, not an error');
assert.equal((await provider.handleWebhookEvent(ev)).type, 'unknown');
await assert.rejects(provider.verifyWebhook(req('')), /missing topic or id/);
await assert.rejects(provider.verifyWebhook(req('?topic=payment&id=404')), 'a forged id fails the re-fetch');

let n = await provider.handleWebhookEvent(await provider.verifyWebhook(req('?topic=payment&id=11')));
assert.equal(n.type, 'payment.succeeded');
assert.equal(n.data.amount, 7900000, 'back to cents');
assert.equal(n.data.currency, 'ars');
assert.equal(n.data.externalReference, 'b1');
assert.equal(n.data.email, 'guest@example.com');
assert.equal(n.data.metadata.booking_id, 'b1');
n = await provider.handleWebhookEvent(await provider.verifyWebhook(req('?topic=payment&id=12')));
assert.equal(n.type, 'payment.pending', 'in_process is neither paid nor failed');
n = await provider.handleWebhookEvent(await provider.verifyWebhook(req('?topic=payment&id=13')));
assert.equal(n.type, 'payment.failed');

// 3. Refunds: full; one that already went through is not an error.
let refunded = [];
provider.paymentRefund = { total: async ({ payment_id }) => { refunded.push(payment_id); return { id: 5, status: 'approved' }; } };
assert.deepEqual(await provider.refundPayment(11), { id: '5', status: 'approved' });
assert.deepEqual(refunded, ['11']);

provider.paymentRefund = { total: async () => { throw new Error('already refunded'); } };
payments['11'].status = 'refunded';
assert.equal((await provider.refundPayment(11)).status, 'already_refunded');
payments['11'].status = 'approved';
await assert.rejects(provider.refundPayment(11), /already refunded/, 'other failures still throw');

console.log('mercadopago-provider: PASS');
