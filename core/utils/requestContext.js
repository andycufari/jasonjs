// core/utils/requestContext.js
// Per-request context propagated implicitly via AsyncLocalStorage.
// Set once at the request boundary (middleware / route handler), then any
// code anywhere in the async call tree can read it without threading args.

import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

/**
 * Run `fn` with `context` bound for the duration of its async tree.
 * Anything inside `fn` (including awaits, timers, child promises) sees the
 * same context via getRequestContext().
 */
export function runWithRequestContext(context, fn) {
  return storage.run(context, fn);
}

/**
 * Read the current request context. Returns null when called outside a
 * bound run() — e.g. from a background timer or module init.
 */
export function getRequestContext() {
  return storage.getStore() || null;
}

/**
 * Convenience: read just the host. Returns null when no context is bound.
 */
export function getRequestHost() {
  const ctx = storage.getStore();
  return ctx?.host || null;
}

/**
 * Mutate the active context in-place. Used when later middleware resolves
 * something the entry didn't know yet (e.g. siteId after host lookup).
 */
export function updateRequestContext(patch) {
  const ctx = storage.getStore();
  if (ctx) Object.assign(ctx, patch);
}

/**
 * Wrap a Next.js route handler so every log inside it is tagged with the
 * request's host. Usage:
 *
 *   export const GET = withRequestContext(async (req, ctx) => { ... });
 *
 * Falls back to reading `host` from headers() when no request is passed
 * (e.g. zero-arg GET handlers).
 */
export function withRequestContext(handler) {
  return async function wrappedHandler(req, ctx) {
    let host = 'unknown';
    try {
      if (req?.headers?.get) {
        host = req.headers.get('x-forwarded-host') || req.headers.get('host') || host;
      } else {
        const { headers } = await import('next/headers');
        const h = await headers();
        host = h.get('x-forwarded-host') || h.get('host') || host;
      }
    } catch {
      // headers() unavailable (e.g. static generation) — leave 'unknown'
    }
    return runWithRequestContext({ host }, () => handler(req, ctx));
  };
}
