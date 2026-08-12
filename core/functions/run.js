/**
 * Site Function Runner
 *
 * Executes native ES module functions from sites/<domain>/functions/<name>.js.
 * Replaces the legacy AsyncFunction sandbox (core/execution) — in the
 * open-source runtime, site functions are trusted first-class modules:
 *
 *   export const config = { public: true, methods: ['GET', 'POST'], auth: false };
 *   export default async function (jcontext) {
 *     const { app, params, body, query, method } = jcontext;
 *     ...
 *   }
 *
 * jcontext also spreads the full `app` object at the top level, so legacy
 * functions written as `async function (app) { const { db, response } = app }`
 * keep working unchanged.
 *
 * @module core/functions/run
 */

import { getFunction, getAllDatabases, getAllSettings } from '@/core/sites/files';
import { createAppContext } from './appContext.js';
import appLog from '@/core/utils/appLog';

const EXECUTION_TIMEOUT_MS = 60000; // 1 minute

/**
 * Run a site function
 *
 * @param {string} domain - Site domain (siteId in OSS mode)
 * @param {string} name - Function name/path (e.g. "hello" or "webhook/stripe")
 * @param {Object} requestContext
 * @param {Object} requestContext.params - Merged params (body + query), legacy-compatible
 * @param {Object} requestContext.body - Parsed request body (POST/PUT/PATCH)
 * @param {Object} requestContext.query - URL search params
 * @param {Headers} requestContext.headers - Request headers
 * @param {Object} requestContext.session - Auth session (or null)
 * @param {string} requestContext.method - HTTP method
 * @param {Object} requestContext.request - Raw request (http source only)
 * @param {string} requestContext.source - 'http' | 'server' | 'internal' | 'trigger'
 * @param {boolean} requestContext.isStudioRequest - Studio IDE request flag
 * @param {Object} requestContext.databaseConfig - Pre-loaded database config (optional)
 * @param {Object} requestContext.settings - Pre-loaded site settings (optional)
 * @returns {Promise<any>} Function result (may carry __STATUS__ for the route)
 */
export async function runFunction(domain, name, requestContext = {}) {
  const {
    params = {},
    body = null,
    query = {},
    headers = null,
    session = null,
    method = 'POST',
    request = null,
    source = 'http',
    isStudioRequest = false,
    databaseConfig = null,
    settings = null
  } = requestContext;

  if (!domain || !name) {
    throw new Error('runFunction requires a domain and a function name');
  }

  // 1. Load the function module (native ES module from sites/<domain>/functions/)
  const mod = await getFunction(domain, name);
  if (!mod) {
    return { __STATUS__: 404, error: `Function not found: ${name}` };
  }

  if (typeof mod.default !== 'function') {
    throw new Error(
      `Function "${name}" has no default export. Site functions must be shaped: ` +
      `export default async function (jcontext) { ... } ` +
      `(optionally with: export const config = { public, methods, auth })`
    );
  }

  // 2. Function metadata (optional named export)
  const config = (mod.config && typeof mod.config === 'object') ? mod.config : {};

  if (Array.isArray(config.methods) && config.methods.length > 0) {
    const allowed = config.methods.map(m => String(m).toUpperCase());
    if (!allowed.includes(String(method).toUpperCase())) {
      return {
        __STATUS__: 405,
        error: `Method ${method} not allowed for function "${name}". Allowed: ${allowed.join(', ')}`
      };
    }
  }

  if (config.auth === true && !session?.user) {
    return { __STATUS__: 401, error: 'Authentication required' };
  }

  // 3. Load site context (use provided or load fresh)
  const dbConfig = databaseConfig || await getAllDatabases(domain) || {};
  const siteSettings = settings || await getAllSettings(domain) || {};

  // 4. Build the app object
  const app = await createAppContext({
    domain,
    functionName: name,
    params,
    session,
    source,
    method,
    request,
    isStudioRequest,
    databaseConfig: dbConfig,
    settings: siteSettings
  });

  // 5. Build jcontext — app spread at top level for legacy `function(app)` style,
  //    plus explicit request fields for the modern destructuring style
  const jcontext = {
    ...app,
    app,
    params,
    body,
    query,
    headers,
    session,
    domain,
    siteId: domain,
    method
  };

  // 6. Execute with timeout protection
  let timer;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Function execution timed out')), EXECUTION_TIMEOUT_MS);
    });

    const startTime = Date.now();
    const result = await Promise.race([mod.default(jcontext), timeoutPromise]);
    console.log(`[Functions] "${name}" executed in ${Date.now() - startTime}ms`);

    return result;
  } catch (error) {
    console.error(`[Functions] Error executing "${name}" on ${domain}:`, error);
    await appLog(`Function execution failed: ${error.message}`, 'error', error.stack);

    // Legacy-compatible error results (route serves these as 200 JSON,
    // matching the previous execution engine's behavior)
    if (error.message === 'Function execution timed out') {
      return { error: 'Function execution timed out' };
    }
    return { error: 'Function execution failed', message: error.message };
  } finally {
    clearTimeout(timer);
    // Flush any pending app.log() writes
    if (app._pendingLogs?.length > 0) {
      await Promise.allSettled(app._pendingLogs);
    }
  }
}

export default runFunction;
