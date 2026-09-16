/**
 * Next.js Instrumentation
 *
 * This file is loaded once when the server starts.
 * Used to initialize the embedded worker when EMBEDDED_WORKER=true
 *
 * Note: Path aliases don't work in instrumentation, so we use a
 * lazy initialization approach via the worker module itself.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // JasonJS serves many sites from one process, routed by Host header. NextAuth v4
    // only trusts that host when AUTH_TRUST_HOST (or VERCEL) is set; otherwise it
    // falls back to NEXTAUTH_URL and, when that is unset, to a HARDCODED
    // "http://localhost:3000" (see next-auth/utils/parse-url.js). That makes every
    // auth URL - signout redirects, email magic links, OAuth callbacks - point at
    // localhost in production, and downgrades session cookies (no __Secure- prefix).
    //
    // A single NEXTAUTH_URL cannot be correct for every site, so trusting the proxy
    // host is the only viable default. Safe when your edge (Cloudflare, ALB, nginx)
    // rejects unknown Host headers. Set AUTH_TRUST_HOST=false if it does not.
    if (process.env.AUTH_TRUST_HOST === undefined && !process.env.NEXTAUTH_URL) {
      process.env.AUTH_TRUST_HOST = 'true';
    }

    // CM64 addon boot hook: when a .cm64/ directory is present, its register()
    // installs the remote file-source adapter. The OSS stub is a no-op.
    try {
      const cm64 = await import('@cm64/register');
      await cm64.register?.();
    } catch (e) {
      // addon absent
    }

    if (process.env.EMBEDDED_WORKER === 'true') {
      console.log('[Instrumentation] Embedded worker enabled - will initialize on first use');
    }
  }
}
