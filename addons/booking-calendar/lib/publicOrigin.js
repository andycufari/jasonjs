// Public origin for links we hand to people (redirects, cancel links in the event).
//
// request.url carries the INTERNAL origin behind the proxy (https://localhost:3000),
// so build the public one from the tenant domain — same rule as core/auth/options.js.

export function publicOrigin(request) {
  return originFromDomain(request.addonContext?.domain || '', request.url);
}

/** Same rule without a request (billing webhooks act for a site that didn't receive the call). */
export function originFromDomain(domain, fallbackUrl = null) {
  const isLocal = /^(localhost|127\.0\.0\.1)(:|$)/.test(domain || '');
  if ((!domain || isLocal) && fallbackUrl) return new URL(fallbackUrl).origin;
  return `${isLocal ? 'http' : 'https'}://${domain}`;
}
