// core/sites/resolve.js - The single host → site resolution point
//
// Every request-scoped lookup of "which site is this?" goes through
// resolveSite(). Pass the Request when you have one (API routes,
// middleware); call with no arguments in server components, where the
// headers come from next/headers.
//
// Resolution rules, applied once here and nowhere else:
// - x-forwarded-host (first value) wins over host, matching the proxy
//   behavior of middleware.js and the page renderer
// - localhost and dev tunnels (ngrok, localtunnel, ...) resolve to
//   DEFAULT_DOMAIN
// - the port suffix is stripped
//
// siteId is the domain (siteId := domain everywhere in JasonJS).

const DEV_TUNNEL_PATTERNS = [
  /\.ngrok-free\.app$/,
  /\.ngrok\.io$/,
  /\.loca\.lt$/,        // localtunnel
  /\.serveo\.net$/,     // serveo
  /\.localhost\.run$/,  // localhost.run
];

function isDevTunnel(host) {
  if (!host) return false;
  return DEV_TUNNEL_PATTERNS.some((pattern) => pattern.test(host));
}

async function readHostHeader(request) {
  if (request) {
    return request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  }

  try {
    // Imported lazily so this module stays usable outside request scope
    // (and out of client bundles)
    const { headers } = await import('next/headers');
    const headersList = await headers();
    return headersList.get('x-forwarded-host') || headersList.get('host') || '';
  } catch {
    // Static generation / no request scope
    return '';
  }
}

/**
 * Resolve the site targeted by the current request.
 *
 * @param {Request} [request] - Pass when available; omit in server components
 * @returns {Promise<{host: string, siteId: string}>}
 */
export async function resolveSite(request = null) {
  let host = (await readHostHeader(request)).split(',')[0].trim();

  if (!host || host === 'localhost' || host.startsWith('localhost:') || isDevTunnel(host)) {
    host = process.env.DEFAULT_DOMAIN || 'localhost';
  }

  host = host.split(':')[0];

  return { host, siteId: host };
}
