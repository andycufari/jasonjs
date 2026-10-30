// Test mode for app.billing.checkout: provider 'test' — admins only.
//
// No provider is involved. The checkout URL is /api/billing/test-checkout?t=<signed token>; the page
// offers "Pay" and "Decline", and runs the site's onPaid handler exactly like a real webhook would,
// with provider 'test' and payment.simulated === true. A site can test its whole flow (rows, mails,
// capacity, panel) without money. The token is signed with the auth secret and expires.

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const TTL_MS = 60 * 60 * 1000;

function secret() {
  const s = process.env.NEXTAUTH_SECRET || process.env.WEBAPP_AUTH_SECRET;
  if (!s) throw Object.assign(new Error('Test checkout needs NEXTAUTH_SECRET'), { code: 'PAYMENT_NOT_CONFIGURED' });
  return s;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (body, key) => createHmac('sha256', key).update('test-checkout.' + body).digest('base64url');

export function newTestId(prefix) {
  return `${prefix}_${randomBytes(9).toString('base64url')}`;
}

/**
 * @param {Object} data - { domain, siteId, functionName, reference, amount, currency, email, items,
 *                          metadata, returnUrl, cancelUrl, checkoutId }
 */
export function signTestCheckout(data, { key = secret(), now = Date.now() } = {}) {
  const body = b64(JSON.stringify({ ...data, exp: now + TTL_MS }));
  return `${body}.${sign(body, key)}`;
}

/** @returns {Object|null} the data, or null if the token is forged, malformed or expired */
export function verifyTestCheckout(token, { key = secret(), now = Date.now() } = {}) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body, key));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!data || typeof data.exp !== 'number' || data.exp < now) return null;
  return data;
}

/** The normalized payment the handler gets, same shape as Stripe's / MercadoPago's. */
export function simulatedPayment(data, status) {
  return {
    id: newTestId('test_pay'),
    sessionId: data.checkoutId,
    amount: data.amount,
    currency: String(data.currency || '').toLowerCase(),
    email: data.email || null,
    status,
    metadata: data.metadata || {},
    externalReference: data.reference ?? null,
    simulated: true,
  };
}

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function testCheckoutPage(data, token, { error } = {}) {
  const total = (data.amount / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const items = (data.items || []).map(i => `<li>${esc(i.name)}${i.description ? ` <small>— ${esc(i.description)}</small>` : ''}</li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Test checkout</title>
<style>body{font-family:system-ui,sans-serif;background:#111;color:#eee;max-width:28rem;margin:3rem auto;padding:0 1rem}
.box{border:2px dashed #e9c46a;border-radius:10px;padding:1.2rem}h1{font-size:1.1rem;color:#e9c46a;margin:0 0 .8rem}
.total{font-size:2rem;margin:.6rem 0}button{font-size:1rem;padding:.6rem 1rem;border-radius:8px;border:0;cursor:pointer;margin-right:.5rem}
.pay{background:#52b788;color:#000}.no{background:#333;color:#eee}small,.muted{color:#999}a{color:#999}.err{color:#ff6b6b}</style></head>
<body><div class="box"><h1>TEST CHECKOUT — no money moves</h1>
<ul>${items}</ul><div class="total">${esc(data.currency)} ${esc(total)}</div>
<p class="muted">${esc(data.email || '')}<br>Runs <code>${esc(data.functionName)}</code> on ${esc(data.domain)} with <code>payment.simulated</code>.</p>
${error ? `<p class="err">${esc(error)}</p>` : ''}
<form method="post"><input type="hidden" name="t" value="${esc(token)}">
<button class="pay" name="action" value="pay">Pay (simulated)</button><button class="no" name="action" value="decline">Decline</button></form>
<p><a href="${esc(data.cancelUrl)}">Cancel and go back</a></p></div></body></html>`;
}
