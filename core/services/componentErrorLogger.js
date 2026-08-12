// core/services/componentErrorLogger.js

import appLog, { setSiteContext } from '@/core/utils/appLog.js';

/**
 * Component Error Logger
 *
 * Logs component bundling, compilation, and runtime errors to the Studio database
 * using the existing appLog infrastructure (function_logs collection).
 *
 * All component errors are always logged — tenant devs need to be notified
 * when their code breaks, regardless of dev/production mode.
 */

/**
 * Sanitize error messages to avoid exposing platform internals to tenants.
 * Strips absolute file paths, internal module references, etc.
 */
function sanitizeErrorMessage(message) {
  if (!message || typeof message !== 'string') return message || 'Unknown error';
  return message
    // Strip absolute file paths (e.g., /Users/.../core/render/...)
    .replace(/\/[^\s:]+\/(core|node_modules|\.next|app)\//g, '')
    // Strip webpack/bundler chunk references
    .replace(/\.next\/server\/chunks\/\S+/g, '[internal]')
    // Keep the message concise
    .substring(0, 500);
}

function sanitizeStack(stack) {
  if (!stack || typeof stack !== 'string') return '';
  // Only keep lines that reference tenant component code, not framework internals
  const lines = stack.split('\n');
  const filtered = lines.filter(line =>
    !line.includes('/core/') &&
    !line.includes('/node_modules/') &&
    !line.includes('.next/server/') &&
    !line.includes('webpack')
  );
  // If everything was filtered, keep at least the first line (the error message)
  return (filtered.length > 0 ? filtered : [lines[0]]).join('\n').substring(0, 2000);
}

/**
 * Log a server-side component bundling error
 *
 * @param {string} componentName - Name of the component that failed
 * @param {Error} error - The error object
 * @param {Object} context - Context information
 * @param {string} context.domain - Domain/hostname
 * @param {string} context.siteId - Site ID for database isolation
 */
export async function logBundlingError(componentName, error, context = {}) {
  const { domain, siteId } = context;

  // Set site context for appLog (same pattern as function execution)
  if (siteId && domain) {
    setSiteContext(
      siteId,
      domain,
      null, // No userId for server-side bundling
      componentName,
      {
        source: 'component',
        phase: 'bundling',
        errorType: error.name || 'Error'
      }
    );
  }

  // Log error with sanitized message (no platform internals)
  const message = `[COMPONENT ERROR] ${componentName}: ${sanitizeErrorMessage(error.message)}`;
  await appLog(message, 'error', sanitizeStack(error.stack));
}

/**
 * Log a client-side component compilation error
 *
 * This is called from the API endpoint after receiving error from client
 *
 * @param {string} componentName - Name of the component that failed
 * @param {Object} errorData - Error information from client
 * @param {string} errorData.message - Error message
 * @param {string} errorData.stack - Error stack trace
 * @param {Object} bundle - Bundle metadata
 * @param {string} bundle.hash - Bundle hash
 * @param {number} bundle.version - Bundle version
 * @param {Object} context - Context information
 * @param {string} context.domain - Domain/hostname
 * @param {string} context.siteId - Site ID for database isolation
 * @param {string} context.userId - User ID (if authenticated)
 * @param {string} context.sessionId - Session ID from client
 */
export async function logCompilationError(componentName, errorData, bundle, context = {}) {
  const { domain, siteId, userId, sessionId } = context;

  // Set site context for appLog
  if (siteId && domain) {
    setSiteContext(
      siteId,
      domain,
      userId || null,
      componentName,
      {
        source: 'component',
        phase: 'compilation',
        bundleHash: bundle?.hash,
        bundleVersion: bundle?.version,
        sessionId: sessionId
      }
    );
  }

  // Log error with sanitized message
  const message = `[COMPONENT COMPILATION ERROR] ${componentName}: ${sanitizeErrorMessage(errorData.message)}`;
  await appLog(message, 'error', sanitizeStack(errorData.stack));
}

/**
 * Log a client-side component runtime error
 *
 * This can be used for runtime errors caught by error boundaries
 *
 * @param {string} componentName - Name of the component that failed
 * @param {Error} error - The error object
 * @param {Object} bundle - Bundle metadata
 * @param {Object} context - Context information
 */
export async function logRuntimeError(componentName, error, bundle, context = {}) {
  const { domain, siteId, userId, sessionId } = context;

  // Set site context for appLog
  if (siteId && domain) {
    setSiteContext(
      siteId,
      domain,
      userId || null,
      componentName,
      {
        source: 'component',
        phase: 'runtime',
        bundleHash: bundle?.hash,
        bundleVersion: bundle?.version,
        sessionId: sessionId
      }
    );
  }

  // Log error with sanitized message
  const message = `[COMPONENT RUNTIME ERROR] ${componentName}: ${sanitizeErrorMessage(error.message)}`;
  await appLog(message, 'error', sanitizeStack(error.stack));
}

export default {
  logBundlingError,
  logCompilationError,
  logRuntimeError
};
