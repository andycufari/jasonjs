// app.billing.checkout / refund / providers — one-time payments from a site function.
//
// The function decides what is sold and at what price; the checkout is created here,
// server-side (the public guest-checkout route takes the amount from the request body,
// so it can't be trusted with a price). When the provider confirms the payment, the webhook
// runs the function named in onPaid (see functionHook.js).
//
//   const { url } = await app.billing.checkout({
//     provider: 'mercadopago',              // or 'stripe'
//     email: 'ana@example.com',
//     items: [{ name: 'Taller', description: 'Sábado 14/11', amount: 5500000 }], // cents
//     currency: 'ARS',
//     reference: inscripcionId,             // your row id; comes back in payment.metadata.reference
//     onPaid: 'tallerPagado',               // site function that applies the payment
//     returnUrl: 'https://…/taller?pago=ok', cancelUrl: 'https://…/taller',
//   });
//
// Providers need their keys in setting/billing.json (stripe.secretKey, mercadopago.accessToken).
// provider 'test' (admins only) needs no keys: see testCheckout.js.
//
// Every checkout lands in the shared ledger (billing_checkouts) with how it ended, including whether
// the site's handler took the payment: app.billing.payments() and `cm64 payments` read it.

import { FUNCTION_NAME } from './functionHook.js';

export const PROVIDERS = ['stripe', 'mercadopago'];
const META_KEY = /^[a-zA-Z0-9_]{1,40}$/;
const RESERVED = ['function', 'domain', 'siteId', 'reference', 'ledger', 'simulated', 'addon', 'guest', 'orderId'];

function fail(message, code = 'INVALID_CHECKOUT') {
  const err = new Error(message);
  err.code = code;
  return err;
}

/** Public origin of the tenant, for links the provider calls back (MercadoPago's webhook). */
export function originFromDomain(domain) {
  const isLocal = /^(localhost|127\.0\.0\.1)(:|$)/.test(domain || '');
  return `${isLocal ? 'http' : 'https'}://${domain}`;
}

async function defaultLoad(domain) {
  const { getBillingConfig } = await import('./config.js');
  return getBillingConfig(domain).catch(() => null);
}

async function defaultMake(name, config) {
  if (name === 'stripe') return new (await import('./providers/stripe.js')).default(config);
  return new (await import('./providers/mercadopago.js')).default(config);
}

async function defaultLedger(siteId) {
  const { createBillingDB } = await import('../../billing/db.js');
  return createBillingDB(siteId);
}

async function defaultTest() {
  return import('./testCheckout.js');
}

// The ledger is bookkeeping: if it fails, the sale and the payment still go through.
async function safely(what, fn) {
  try { return await fn(); } catch (err) { console.error(`[billing] ledger ${what} failed:`, err.message); return null; }
}

function keysFor(billing, name) {
  return name === 'stripe' ? billing?.stripe?.secretKey : billing?.mercadopago?.accessToken;
}

/**
 * @param {Object} ctx - { siteId, domain, isAdmin, loadBilling?, makeProvider?, ledger?, test? } (the last four for tests)
 */
export function createFunctionBilling({
  siteId, domain, isAdmin = false,
  loadBilling = defaultLoad, makeProvider = defaultMake, ledger = defaultLedger, test = defaultTest,
}) {
  const book = (what, fn) => safely(what, async () => fn(await ledger(siteId)));

  async function providerFor(name) {
    if (!PROVIDERS.includes(name)) throw fail(`provider must be one of: ${PROVIDERS.join(', ')}`);
    const billing = await loadBilling(domain);
    if (!keysFor(billing, name)) throw fail(`${name} is not configured on ${domain}`, 'PAYMENT_NOT_CONFIGURED');
    const config = name === 'stripe' ? billing.stripe : billing.mercadopago;
    return { provider: await makeProvider(name, config), config };
  }

  return {
    /** Providers this site has keys for (+ 'test' for an admin). */
    async providers() {
      const billing = await loadBilling(domain);
      const list = PROVIDERS.filter(p => keysFor(billing, p));
      return isAdmin ? [...list, 'test'] : list;
    },

    /** The ledger, newest first. Admin only: it has every buyer's email. */
    async payments({ limit = 50, status, since } = {}) {
      if (!isAdmin) throw fail('app.billing.payments: admin only', 'FORBIDDEN');
      const db = await ledger(siteId);
      return db.listCheckouts({ limit, status, since });
    },

    /** @returns {Promise<{ provider, id, url }>} */
    async checkout(options = {}) {
      const {
        provider = 'stripe', email, items, currency, reference, onPaid,
        returnUrl, cancelUrl, expiresAt, metadata = {},
      } = options;

      if (!FUNCTION_NAME.test(onPaid || '')) {
        throw fail('onPaid: the name of the site function that applies the payment');
      }
      if (!Array.isArray(items) || items.length === 0) throw fail('items: at least one { name, amount }');
      for (const item of items) {
        if (!item || typeof item.name !== 'string' || !item.name.trim()) throw fail('items: every item needs a name');
        if (!Number.isInteger(item.amount) || item.amount <= 0) throw fail('items: amount is a positive integer, in cents');
        if (item.quantity !== undefined && (!Number.isInteger(item.quantity) || item.quantity <= 0)) {
          throw fail('items: quantity is a positive integer');
        }
      }
      if (!returnUrl || !cancelUrl) throw fail('returnUrl and cancelUrl are required');
      if (reference !== undefined && String(reference).length > 200) throw fail('reference: up to 200 characters');

      // Your metadata (strings, short keys) + ours, which you can't override: the webhook
      // routes by domain and runs metadata.function.
      const meta = {};
      for (const [key, value] of Object.entries(metadata || {})) {
        if (!META_KEY.test(key) || RESERVED.includes(key)) throw fail(`metadata: invalid or reserved key "${key}"`);
        if (Object.keys(meta).length >= 20) throw fail('metadata: up to 20 keys');
        meta[key] = String(value ?? '').slice(0, 500);
      }
      const ledgerId = `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      Object.assign(meta, { function: onPaid, domain, siteId: String(siteId), ledger: ledgerId });
      if (reference !== undefined) meta.reference = String(reference);

      const clean = items.map(i => ({
        name: i.name.slice(0, 250), description: i.description ? String(i.description).slice(0, 500) : undefined,
        amount: i.amount, quantity: i.quantity,
      }));
      const amount = clean.reduce((sum, i) => sum + i.amount * (i.quantity || 1), 0);
      const record = (checkoutId, cur) => book('record', db => db.recordCheckout({
        ledgerId, domain, function: onPaid, reference: reference !== undefined ? String(reference) : null,
        provider, checkoutId, email: email || null, amountCents: amount, currency: cur,
        description: clean.map(i => i.name).join(', ').slice(0, 300), test: provider === 'test',
      }));

      if (provider === 'test') {
        if (!isAdmin) throw fail("provider 'test' is for admins only");
        const t = await test();
        const checkoutId = t.newTestId('test_cs');
        const cur = String(currency || 'USD').toUpperCase();
        const token = t.signTestCheckout({
          domain, siteId: String(siteId), functionName: onPaid, reference: meta.reference ?? null,
          amount, currency: cur, email: email || null, items: clean,
          metadata: { ...meta, simulated: 'true' }, returnUrl, cancelUrl, checkoutId,
        });
        await record(checkoutId, cur);
        return { provider, id: checkoutId, url: `${originFromDomain(domain)}/api/billing/test-checkout?t=${token}` };
      }

      const { provider: impl, config } = await providerFor(provider);

      if (provider === 'mercadopago') {
        const pref = await impl.createCustomCheckout(email, clean, {
          currency: String(currency || 'ARS').toUpperCase(),
          returnUrl, cancelUrl, expiresAt,
          externalReference: reference !== undefined ? String(reference) : undefined,
          // Each checkout names this site's webhook: nothing to set in MercadoPago's panel.
          notificationUrl: `${originFromDomain(domain)}/api/billing/webhook/mercadopago?source_news=webhooks`,
          instantOnly: true, // approved or rejected right away; a cash payment takes days
          statementDescriptor: config.statementDescriptor,
          metadata: meta,
        });
        await record(pref.id, String(currency || 'ARS').toUpperCase());
        return { provider, id: pref.id, url: pref.url };
      }

      const session = await impl.createCustomCheckout(email, clean, {
        currency: String(currency || 'usd').toLowerCase(),
        returnUrl, cancelUrl, expiresAt,
        clientReferenceId: reference !== undefined ? String(reference) : undefined,
        statementDescriptorSuffix: config.statementDescriptorSuffix,
        metadata: meta,
      });
      await record(session.id, String(currency || 'usd').toUpperCase());
      return { provider, id: session.id, url: session.url };
    },

    /** Full refund, back through the provider that took the payment. */
    async refund({ provider, paymentId, reason } = {}) {
      if (!paymentId) throw fail('paymentId is required');
      let result;
      if (provider === 'test') {
        result = { id: `test_re_${paymentId}`, status: 'simulated' };
      } else {
        const { provider: impl } = await providerFor(provider);
        try {
          result = await impl.refundPayment(String(paymentId), { metadata: reason ? { reason: String(reason).slice(0, 500) } : {} });
        } catch (err) {
          if (err?.code !== 'charge_already_refunded') throw err;
          result = { status: 'already_refunded' };
        }
      }
      await book('refund', db => db.markRefunded(paymentId));
      return result;
    },
  };
}
