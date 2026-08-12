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
