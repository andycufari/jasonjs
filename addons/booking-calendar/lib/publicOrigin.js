// Public origin for links we hand to people (redirects, cancel links in the event).
//
// request.url carries the INTERNAL origin behind the proxy (https://localhost:3000),
// so build the public one from the tenant domain — same rule as core/auth/options.js.

export function publicOrigin(request) {
  const domain = request.addonContext?.domain || '';
  const isLocal = /^(localhost|127\.0\.0\.1)(:|$)/.test(domain);
  return !domain || isLocal ? new URL(request.url).origin : `https://${domain}`;
}
