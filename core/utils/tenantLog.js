// core/utils/tenantLog.js
// Unified tenant logging interface for the entire JasonJS Framework

import appLog, { setSiteContext } from './appLog.js';

/**
 * Create a tenant-aware logger for a specific component/service
 * @param {string} componentName - Name of the component (e.g., 'database', 'auth', 'render')
 * @param {Object} context - Optional context (siteId, domain, userId)
 * @returns {Object} Tenant logger instance
 */
export function createTenantLogger(componentName, context = {}) {
  const { siteId, domain, userId } = context;
  
  // Set context if provided
  if (siteId && domain) {
    setSiteContext(siteId, domain, userId);
  }
  
  return {
    // Core logging methods
    info: (message, data = {}) => {
      const logMessage = data ? `[${componentName}] ${message} ${JSON.stringify(data)}` : `[${componentName}] ${message}`;
      appLog(logMessage, 'info');
    },
    
    warn: (message, data = {}) => {
      const logMessage = data ? `[${componentName}] ${message} ${JSON.stringify(data)}` : `[${componentName}] ${message}`;
      appLog(logMessage, 'warning');
    },
    
    error: (message, error = null, data = {}) => {
      const errorText = error ? (error.message || error) : '';
      const logMessage = `[${componentName}] ${message}${errorText ? ': ' + errorText : ''}`;
      appLog(logMessage, 'error');
    },
    
    debug: (message, data = {}) => {
      const logMessage = data ? `[${componentName}] ${message} ${JSON.stringify(data)}` : `[${componentName}] ${message}`;
      appLog(logMessage, 'info');
    },
    
    // Performance logging
    performance: {
      slow: (operation, metrics) => {
        const duration = metrics.duration || metrics.queryTime || 'N/A';
        appLog(`[${componentName}] Slow ${operation}: ${duration}ms`, 'warning');
      },
      
      warning: (operation, message, metrics = {}) => {
        appLog(`[${componentName}] ${operation}: ${message}`, 'warning');
      }
    },
    
    // Database-specific logging
    database: {
      query: (databaseId, operation, metrics) => {
        const queryTime = metrics.queryTime || 'N/A';
        const logType = metrics.queryTime > 100 ? 'warning' : 'info';
        appLog(`[${componentName}] Database ${operation} on ${databaseId}: ${queryTime}ms`, logType);
      },

      recommendation: (databaseId, recommendations, context) => {
        const message = `Index recommendations for ${databaseId}: ${recommendations.length} suggestions`;
        appLog(`[${componentName}] ${message}`, 'recommendation');
      },

      error: (databaseId, operation, error) => {
        const errorText = error.message || error;
        const stack = error.stack || null;
        appLog(`[${componentName}] Database error in ${operation} on ${databaseId}: ${errorText}`, 'error', stack);
      },

      // Validation errors with more context
      validationError: (databaseId, field, message, providedData = {}) => {
        const fieldsProvided = Object.keys(providedData).join(', ') || 'none';
        appLog(`[${componentName}] Validation error on ${databaseId}: ${message}. Fields provided: ${fieldsProvided}`, 'error');
      }
    },
    
    // Security logging
    security: {
      warning: (message, details = {}) => {
        appLog(`[${componentName}] Security: ${message}`, 'warning');
      },
      
      accessDenied: (resource, reason, details = {}) => {
        appLog(`[${componentName}] Access denied to ${resource}: ${reason}`, 'error');
      }
    },
    
    // Function-specific logging
    function: {
      start: (functionName, params = {}) => {
        appLog(`[${componentName}] Function ${functionName} started`, 'info');
      },
      
      complete: (functionName, duration, result = {}) => {
        appLog(`[${componentName}] Function ${functionName} completed in ${duration}ms`, 'info');
      },
      
      error: (functionName, error, context = {}) => {
        const errorText = error.message || error;
        appLog(`[${componentName}] Function ${functionName} failed: ${errorText}`, 'error');
      }
    },
    
    // Raw access to appLog
    raw: (message, type = 'info') => {
      appLog(`[${componentName}] ${message}`, type);
    },
    
    // Update context for this logger instance
    setContext: (newContext) => {
      if (newContext.siteId && newContext.domain) {
        setSiteContext(newContext.siteId, newContext.domain, newContext.userId);
      }
    }
  };
}

/**
 * Global framework logger - use when component/service context is unknown
 * @param {Object} context - Site context (siteId, domain, userId)
 * @returns {Object} Global tenant logger
 */
export function createGlobalLogger(context = {}) {
  return createTenantLogger('framework', context);
}

/**
 * Quick logger for database operations
 * @param {Object} databaseConfig - Database configuration with siteId, domain, etc.
 * @returns {Object} Database-focused logger
 */
export function createDatabaseLogger(databaseConfig) {
  const { siteId, domain, userId } = databaseConfig;
  return createTenantLogger('database', { siteId, domain, userId });
}

/**
 * Quick logger for server functions
 * @param {string} functionName - Name of the function
 * @param {Object} context - Function execution context
 * @returns {Object} Function-focused logger
 */
export function createFunctionLogger(functionName, context = {}) {
  const logger = createTenantLogger('server_function', context);
  
  // Add function name to all logs
  const originalMethods = ['info', 'warn', 'error', 'debug'];
  originalMethods.forEach(method => {
    const original = logger[method];
    logger[method] = (message, data = {}) => {
      return original(`[${functionName}] ${message}`, { functionName, ...data });
    };
  });
  
  return logger;
}

/**
 * Export commonly used loggers
 */
export default {
  create: createTenantLogger,
  global: createGlobalLogger,
  database: createDatabaseLogger,
  function: createFunctionLogger
};