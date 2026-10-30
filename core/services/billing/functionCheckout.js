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

import { FUNCTION_NAME } from './functionHook.js';

export const PROVIDERS = ['stripe', 'mercadopago'];
const META_KEY = /^[a-zA-Z0-9_]{1,40}$/;
const RESERVED = ['function', 'domain', 'siteId', 'reference', 'addon', 'guest', 'orderId'];

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

function keysFor(billing, name) {
  return name === 'stripe' ? billing?.stripe?.secretKey : billing?.mercadopago?.accessToken;
}

/**
 * @param {Object} ctx - { siteId, domain, loadBilling?, makeProvider? } (the last two for tests)
 */
export function createFunctionBilling({ siteId, domain, loadBilling = defaultLoad, makeProvider = defaultMake }) {
  async function providerFor(name) {
    if (!PROVIDERS.includes(name)) throw fail(`provider must be one of: ${PROVIDERS.join(', ')}`);
    const billing = await loadBilling(domain);
    if (!keysFor(billing, name)) throw fail(`${name} is not configured on ${domain}`, 'PAYMENT_NOT_CONFIGURED');
    const config = name === 'stripe' ? billing.stripe : billing.mercadopago;
    return { provider: await makeProvider(name, config), config };
  }

  return {
    /** Providers this site has keys for. */
    async providers() {
      const billing = await loadBilling(domain);
      return PROVIDERS.filter(p => keysFor(billing, p));
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
      Object.assign(meta, { function: onPaid, domain, siteId: String(siteId) });
      if (reference !== undefined) meta.reference = String(reference);

      const { provider: impl, config } = await providerFor(provider);
      const clean = items.map(i => ({
        name: i.name.slice(0, 250), description: i.description ? String(i.description).slice(0, 500) : undefined,
        amount: i.amount, quantity: i.quantity,
      }));

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
        return { provider, id: pref.id, url: pref.url };
      }

      const session = await impl.createCustomCheckout(email, clean, {
        currency: String(currency || 'usd').toLowerCase(),
        returnUrl, cancelUrl, expiresAt,
        clientReferenceId: reference !== undefined ? String(reference) : undefined,
        statementDescriptorSuffix: config.statementDescriptorSuffix,
        metadata: meta,
      });
      return { provider, id: session.id, url: session.url };
    },

    /** Full refund, back through the provider that took the payment. */
    async refund({ provider, paymentId, reason } = {}) {
      if (!paymentId) throw fail('paymentId is required');
      const { provider: impl } = await providerFor(provider);
      try {
        return await impl.refundPayment(String(paymentId), { metadata: reason ? { reason: String(reason).slice(0, 500) } : {} });
      } catch (err) {
        if (err?.code === 'charge_already_refunded') return { status: 'already_refunded' };
        throw err;
      }
    },
  };
}
