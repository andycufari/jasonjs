// Checkout for paid meeting types. The session is created SERVER-SIDE with the price of
// the meeting type — never the public guest-checkout route, which takes the amount from
// the request body.
//
// The site needs settings/billing.json with a Stripe secret key:
//   { "stripe": { "secretKey": "[[env.STRIPE_SECRET_KEY]]" } }
// Its webhook can be any site on the same Stripe account (see core/services/billing/stripeHub.js).

import { getBillingConfig } from '../../../core/services/billing/config.js';
import StripeProvider from '../../../core/services/billing/providers/stripe.js';

export async function getStripeProvider(domain) {
  const billing = await getBillingConfig(domain);
  if (!billing?.stripe?.secretKey) {
    const err = new Error(`Stripe not configured on ${domain}`);
    err.code = 'PAYMENT_NOT_CONFIGURED';
    throw err;
  }
  return { provider: new StripeProvider(billing.stripe), stripeConfig: billing.stripe };
}

/**
 * @param {Object} opts
 * @param {string} opts.returnUrl - Where Stripe sends the guest after paying; may contain {CHECKOUT_SESSION_ID}
 * @param {string} opts.cancelUrl - Where Stripe sends the guest if they give up
 * @returns {Promise<{ url: string, sessionId: string }>}
 */
export async function createBookingCheckout({ domain, siteId, booking, rules, returnUrl, cancelUrl }) {
  const { provider, stripeConfig } = await getStripeProvider(domain);

  const bookingId = String(booking._id || booking.id);
  const name = rules.name?.es || rules.name?.en || rules.meetingType;
  const when = new Date(booking.startUtc).toLocaleString('es-AR', {
    timeZone: rules.timezone || 'UTC', dateStyle: 'medium', timeStyle: 'short',
  });

  const session = await provider.createCustomCheckout(
    booking.guestEmail,
    [{ name, description: `${when} (${rules.timezone || 'UTC'})`, amount: booking.amountCents }],
    {
      currency: (booking.currency || 'USD').toLowerCase(),
      returnUrl,
      cancelUrl,
      expiresAt: booking.holdExpiresAt,
      clientReferenceId: bookingId,
      statementDescriptorSuffix: stripeConfig.statementDescriptorSuffix,
      metadata: {
        addon: 'booking-calendar', // → hooks/billing.js
        kind: 'booking',
        bookingId,
        siteId: String(siteId),
        domain, // → the shared webhook routes the payment to this site
      },
    }
  );
  return { url: session.url, sessionId: session.id };
}
