// core/utils/appLog.js
// Simple tenant-aware logging to replace console.log

// 🔒 CRITICAL: Use process.stdout/stderr directly to avoid ANY console interception
// This bypasses all console.log interceptions that may be applied during function execution
const safeLog = (msg) => {
  try {
    const output = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
    process.stdout.write(output + '\n');
  } catch {
    process.stdout.write(String(msg) + '\n');
  }
};

const safeError = (msg) => {
  try {
    const output = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
    process.stderr.write(output + '\n');
  } catch {
    process.stderr.write(String(msg) + '\n');
  }
};

// Global site context for tenant-aware logging
let globalSiteContext = {
  siteId: null,
  domain: null,
  userId: null,
  functionName: null,
  executionContext: null
};

/**
 * Set the current site context for tenant-aware logging
 * This should be called at the beginning of each request
 */
export function setSiteContext(siteId, domain, userId = null, functionName = null, executionContext = null) {
  globalSiteContext = {
    siteId,
    domain,
    userId,
    functionName,
    executionContext
  };
}

/**
 * Get the current site context
 */
export function getSiteContext() {
  return globalSiteContext;
}

// 🔒 RECURSION GUARD: Prevents infinite loops when:
// 1. Database operations trigger logs
// 2. Console interception calls appLog which calls console again
let isLogging = false;

/**
 * Simple tenant-aware logging function - better than console.log
 * @param {any} message - Message to log (string, object, etc.)
 * @param {string} type - Log type: 'info', 'warning', 'error', 'recommendation', 'console'
 * @param {string} stack - Stack trace for errors (optional)
 */
export async function appLog(message, type = 'info', stack = null) {
  // 🔒 RECURSION GUARD: Prevent all forms of recursive logging
  if (isLogging) {
    return;
  }

  isLogging = true;

  // Normalize common aliases so user code using 'warn' still maps to 'warning'
  const levelAliases = { warn: 'warning', err: 'error', log: 'info', debug: 'info' };
  type = levelAliases[type] || type;

  try {
    const context = getSiteContext();
    const time = new Date().toLocaleTimeString();
    const siteIdentifier = context.domain || context.siteId || 'unknown';
    const userContext = context.userId ? ` [${context.userId}]` : '';

    // Simple emoji indicators
    const typeEmojis = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      recommendation: '💡',
      console: '🖥️'
    };

    const emoji = typeEmojis[type] || 'ℹ️';
    const header = `${emoji} [${time}] [${siteIdentifier}]${userContext}`;

    // Always log to terminal for real-time monitoring
    // 🔒 CRITICAL: Use process.stdout directly to avoid console interception
    safeLog(header);
    safeLog(message);

    // Persist via the registered adapter when possible. Log loudly if any
    // precondition fails so silent drops never hide tenant debugging info again.
    const { getFileSystem } = await import('../sites/files.js');
    const adapter = getFileSystem().getAdapter();
    if (!adapter?.saveFunctionLog) {
      safeError(`[appLog] skip persist: no adapter with saveFunctionLog registered (local mode)`);
    } else if (!context.siteId) {
      safeError(`[appLog] skip persist: missing siteId in context (domain=${context.domain}, fn=${context.functionName})`);
    } else if (!context.functionName) {
      safeError(`[appLog] skip persist: missing functionName in context (siteId=${context.siteId})`);
    } else {
      try {
        await adapter.saveFunctionLog({
          siteId: context.siteId,
          functionName: context.functionName,
          level: type,
          message: message,
          userId: context.userId,
          executionContext: context.executionContext || {},
          stack: stack
        });
      } catch (error) {
        safeError('[appLog] Failed to persist log to database: ' + (error?.stack || error?.message || error));
      }
    }
  } finally {
    isLogging = false;
  }
}

// Log types constants
export const LOG_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  RECOMMENDATION: 'recommendation',
  INDEX_RECOMMENDATION: 'index_recommendation',
  SLOW_QUERY: 'slow_query'
};

// In-memory log storage (in production this would be a database)
const siteLogs = new Map();

/**
 * Get logs for a specific site
 * @param {string} siteId - Site identifier
 * @param {string} logType - Optional log type filter
 * @returns {Array} Array of log entries
 */
export function getSiteLogs(siteId, logType = null) {
  const logs = siteLogs.get(siteId) || [];

  if (logType) {
    return logs.filter(log => log.type === logType);
  }

  return logs;
}

/**
 * Clear logs for a specific site
 * @param {string} siteId - Site identifier
 */
export function clearSiteLogs(siteId) {
  siteLogs.delete(siteId);
}

/**
 * Add a log entry for a specific site
 * @param {string} siteId - Site identifier
 * @param {string} type - Log type
 * @param {any} message - Log message
 * @param {object} data - Additional log data
 */
export async function addSiteLog(siteId, type, message, data = {}) {
  // Store in memory for backward compatibility
  if (!siteLogs.has(siteId)) {
    siteLogs.set(siteId, []);
  }

  const logs = siteLogs.get(siteId);
  logs.push({
    timestamp: new Date().toISOString(),
    type,
    message,
    data
  });

  // Keep only last 1000 logs per site to prevent memory issues
  if (logs.length > 1000) {
    logs.splice(0, logs.length - 1000);
  }

  // Also persist remotely when an adapter is registered
  const context = getSiteContext();
  const { getFileSystem } = await import('../sites/files.js');
  if (getFileSystem().hasAdapter() && context.functionName) {
    await appLog(message, type);
  }
}

// Default export for simple usage: appLog(message, type)
export default appLog;