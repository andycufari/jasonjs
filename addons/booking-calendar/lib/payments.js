// Checkout for paid meeting types. The session is created SERVER-SIDE with the price of
// the meeting type — never the public guest-checkout route, which takes the amount from
// the request body.
//
// Two providers; the guest picks one:
//   - Stripe (card, the type's priceCents/currency):
//       settings/billing.json { "stripe": { "secretKey": "[[env.STRIPE_SECRET_KEY]]" } }
//     Its webhook can be any site on the same Stripe account (core/services/billing/stripeHub.js).
//   - MercadoPago (pesos, the type's priceArsCents):
//       settings/billing.json { "mercadopago": { "accessToken": "[[env.MP_ACCESS_TOKEN]]" } }
//     Each checkout names this site's webhook (notification_url): nothing to set in MP's panel.

import { getBillingConfig } from '../../../core/services/billing/config.js';
import StripeProvider from '../../../core/services/billing/providers/stripe.js';
import MercadoPagoProvider from '../../../core/services/billing/providers/mercadopago.js';

export const PROVIDERS = ['stripe', 'mercadopago'];

function notConfigured(name, domain) {
  const err = new Error(`${name} not configured on ${domain}`);
  err.code = 'PAYMENT_NOT_CONFIGURED';
  return err;
}

export async function getStripeProvider(domain) {
  const billing = await getBillingConfig(domain);
  if (!billing?.stripe?.secretKey) throw notConfigured('Stripe', domain);
  return { provider: new StripeProvider(billing.stripe), stripeConfig: billing.stripe };
}

export async function getMercadoPagoProvider(domain) {
  const billing = await getBillingConfig(domain);
  if (!billing?.mercadopago?.accessToken) throw notConfigured('MercadoPago', domain);
  return { provider: new MercadoPagoProvider(billing.mercadopago), mpConfig: billing.mercadopago };
}

/** Providers this site has keys for. */
export async function configuredProviders(domain) {
  const billing = await getBillingConfig(domain).catch(() => null);
  return PROVIDERS.filter(p => (p === 'stripe' ? billing?.stripe?.secretKey : billing?.mercadopago?.accessToken));
}

/** What a meeting type costs with each provider (0 = not offered with it). */
export function priceFor(rules, provider) {
  if (provider === 'mercadopago') return { amountCents: rules.priceArsCents || 0, currency: 'ARS' };
  return { amountCents: rules.priceCents || 0, currency: rules.currency || 'USD' };
}

/** Providers a guest can pay this type with: configured on the site and priced. */
export function payableProviders(rules, configured) {
  return configured.filter(p => priceFor(rules, p).amountCents > 0);
}

/**
 * @param {Object} opts
 * @param {'stripe'|'mercadopago'} opts.provider
 * @param {string} opts.origin    - Public origin of the site (for MercadoPago's webhook URL)
 * @param {string} opts.returnUrl - Where the guest lands after paying
 * @param {string} opts.cancelUrl - Where the guest lands if they give up
 * @returns {Promise<{ url: string, sessionId: string }>}
 */
export async function createBookingCheckout({ provider = 'stripe', domain, siteId, origin, booking, rules, returnUrl, cancelUrl }) {
  const bookingId = String(booking._id || booking.id);
  const name = rules.name?.es || rules.name?.en || rules.meetingType;
  const when = new Date(booking.startUtc).toLocaleString('es-AR', {
    timeZone: rules.timezone || 'UTC', dateStyle: 'medium', timeStyle: 'short',
  });
  const item = { name, description: `${when} (${rules.timezone || 'UTC'})`, amount: booking.amountCents };
  const metadata = {
    addon: 'booking-calendar', // → hooks/billing.js
    kind: 'booking',
    bookingId,
    siteId: String(siteId),
    domain, // → the shared Stripe webhook routes the payment to this site
  };

  if (provider === 'mercadopago') {
    const { provider: mp, mpConfig } = await getMercadoPagoProvider(domain);
    const pref = await mp.createCustomCheckout(booking.guestEmail, [item], {
      currency: 'ARS',
      returnUrl,
      cancelUrl,
      externalReference: bookingId,
      notificationUrl: `${origin}/api/billing/webhook/mercadopago?source_news=webhooks`,
      expiresAt: booking.holdExpiresAt,
      instantOnly: true, // a cash payment takes days; the hold lasts minutes
      statementDescriptor: mpConfig.statementDescriptor,
      metadata,
    });
    return { url: pref.url, sessionId: pref.id };
  }

  const { provider: stripe, stripeConfig } = await getStripeProvider(domain);
  const session = await stripe.createCustomCheckout(booking.guestEmail, [item], {
    currency: (booking.currency || 'USD').toLowerCase(),
    returnUrl,
    cancelUrl,
    expiresAt: booking.holdExpiresAt,
    clientReferenceId: bookingId,
    statementDescriptorSuffix: stripeConfig.statementDescriptorSuffix,
    metadata,
  });
  return { url: session.url, sessionId: session.id };
}

/** Close an unpaid checkout so nobody can pay for a slot that's being released. */
export async function expireBookingCheckout(domain, row) {
  if (row.provider === 'mercadopago') {
    if (!row.checkoutId) return;
    const { provider } = await getMercadoPagoProvider(domain);
    await provider.expireCheckout(row.checkoutId);
    return;
  }
  const sessionId = row.stripeSessionId || row.checkoutId;
  if (!sessionId) return;
  const { provider } = await getStripeProvider(domain);
  await provider.expireCheckoutSession(sessionId);
}
