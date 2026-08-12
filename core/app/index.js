// core/app/index.js
// Unified App Object for JasonJS Framework
// Works in both client and server components

const isClient = typeof window !== 'undefined';

/**
 * UNIFIED APP OBJECT
 *
 * Single entry point for all JasonJS Framework features
 * Automatically detects environment and provides appropriate implementation
 *
 * @example
 * import { app } from '@jasonjs';
 *
 * // Database operations
 * const users = await app.db.query().where('active', true).limit(10);
 *
 * // UI interactions (client-only)
 * const confirmed = await app.ui.confirm('Delete this item?');
 *
 * // Authentication
 * if (!app.auth.isAuthenticated) {
 *   app.auth.redirectToLogin();
 * }
 */

// Lazy-load client module only when needed (prevents SSR issues)
let _createAppClient = null;
function getCreateAppClient() {
  if (!_createAppClient) {
    // Dynamic import is not ideal here, so we use require for sync access
    // This is safe because this function is only called on client or when explicitly needed
    _createAppClient = require('./client').createAppClient;
  }
  return _createAppClient;
}

/**
 * Create app instance with proper context
 * Used by DynamicComponentLoader to provide contextualized app objects
 * For dynamic components, we always use client-side app to avoid server dependencies
 */
export function createApp(context = {}) {
  // For dynamic components, always use client-side app to avoid MongoDB/server deps
  // The components run in browser environment anyway
  return getCreateAppClient()(context);
}

// Default instance for direct imports (backwards compatibility)
// On server, we create a minimal stub that warns about server usage
// On client, we lazily create the full app instance
let appInstance = null;

function getAppInstance() {
  if (appInstance) return appInstance;

  if (isClient) {
    // Client-side app with all features
    appInstance = getCreateAppClient()();
  } else {
    // Server-side: Return a minimal stub that warns about usage
    // Real server code should use createAppServer from ./server.js via jcontext
    appInstance = createServerStub();
  }

  return appInstance;
}

// Create a minimal stub for server-side that doesn't import client modules
function createServerStub() {
  const warnServerUsage = (method) => {
    console.warn(`[app.${method}] Called on server - use jcontext.app for server-side operations`);
    return null;
  };

  return {
    db: { use: () => warnServerUsage('db.use'), query: () => warnServerUsage('db.query') },
    ui: { toast: () => warnServerUsage('ui.toast'), confirm: () => warnServerUsage('ui.confirm') },
    auth: { get user() { return null; }, get isAuthenticated() { return false; } },
    events: { emit: () => {}, on: () => () => {}, off: () => {} },
    context: {},
    _isServerStub: true
  };
}

// Export the app instance via getter to enable lazy initialization
export const app = new Proxy({}, {
  get(target, prop) {
    return getAppInstance()[prop];
  }
});

// Also export as default for convenience
export default app;

// Export hook for React components (lazy loaded to prevent SSR issues)
export function useApp() {
  if (!isClient) {
    // Return server stub during SSR
    return createServerStub();
  }
  // Dynamically import the hook
  const { useApp: useAppHook } = require('../hooks/useApp');
  return useAppHook();
}

// Export types for TypeScript
export * from './types';