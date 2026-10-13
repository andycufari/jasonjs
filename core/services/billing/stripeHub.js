// One Stripe webhook endpoint per Stripe ACCOUNT (the "hub"), shared by every site that
// charges with that account. Stripe delivers every event of an account to every endpoint
// registered on it, so per-site endpoints would each receive every other site's events.
//
// The receiving site verifies the signature with its own webhook secret, as before, and
// then routes by metadata.domain — stamped on every Checkout Session the framework creates:
//   - no domain, or this same site → handled here, exactly as before.
//   - another site → the event is re-fetched from Stripe with the TARGET site's own key
//     before handing it over. Stripe only returns it if the event belongs to the target's
//     account, so a hub on account A can't push events into a site that charges with
//     account B even with forged metadata. The re-fetched copy is the one handled.

import { getSite } from '@/core/sites/files';
import { getBillingConfig } from '@/core/services/billing/config';
import StripeProvider from '@/core/services/billing/providers/stripe';

//
// A Stripe account shared with systems outside the platform (another product's own
// checkout, say) delivers THEIR events here too. With `"sharedAccount": true` in the
// receiving site's billing.json stripe config, events without metadata.domain — i.e. not
// created by a platform site — are dropped instead of going down the legacy path.
// Opt-in: sites that own their Stripe account keep handling untagged events as before.

/**
 * @returns {Promise<Object>} { domain, site, provider, event } to handle, or { drop: reason }
 *   when the event can't be attributed. Throws on transient failures so Stripe retries.
 */
export async function resolveStripeTarget({ event, receivingDomain, receivingSite, receivingProvider, receivingConfig = {} }) {
  const metadata = event?.data?.object?.metadata || {};
  const targetDomain = metadata.domain;

  if (!targetDomain && receivingConfig.sharedAccount) {
    return { drop: 'no metadata.domain on a shared Stripe account — not from a platform site' };
  }

  if (!targetDomain || targetDomain === receivingDomain) {
    return { domain: receivingDomain, site: receivingSite, provider: receivingProvider, event };
  }

  const site = await getSite(targetDomain);
  if (!site) return { drop: `target site not found: ${targetDomain}` };

  const siteId = site._id?.toString() || site.siteId || targetDomain;
  if (metadata.siteId && metadata.siteId !== siteId) {
    return { drop: `metadata.siteId ${metadata.siteId} is not ${targetDomain}'s (${siteId})` };
  }

  const billing = await getBillingConfig(targetDomain);
  if (!billing?.stripe?.secretKey) return { drop: `Stripe not configured on ${targetDomain}` };

  const provider = new StripeProvider(billing.stripe);
  let ownEvent;
  try {
    ownEvent = await provider.retrieveEvent(event.id);
  } catch (err) {
    // Not found = the event isn't in the target's Stripe account. Anything else
    // (network, permissions) may heal, so let Stripe retry.
    if (err?.statusCode === 404 || err?.code === 'resource_missing') {
      return { drop: `event ${event.id} is not in ${targetDomain}'s Stripe account` };
    }
    throw err;
  }

  return { domain: targetDomain, site, provider, event: ownEvent };
}
