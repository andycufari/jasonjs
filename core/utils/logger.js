// core/utils/logger.js - Centralized logging utility

import { getRequestHost } from './requestContext.js';

const isDevelopment = process.env.NODE_ENV === 'development';
const isVerbose = process.env.VERBOSE_LOGS === 'true';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * Format objects for pretty printing
 */
function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'object') {
    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      if (value.length <= 3) {
        return `[${value.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ')}]`;
      }
      return `[${value.length} items]`;
    }

    // Handle objects
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    if (keys.length <= 3) {
      const pairs = keys.map(k => `${k}: ${formatValue(value[k])}`).join(', ');
      return `{ ${pairs} }`;
    }
    return `{ ${keys.length} keys: ${keys.slice(0, 3).join(', ')}... }`;
  }

  if (typeof value === 'string') {
    return value.length > 100 ? `"${value.substring(0, 100)}..."` : `"${value}"`;
  }

  return String(value);
}

/**
 * Get timestamp string
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().split('T')[1].split('.')[0]; // HH:MM:SS format
}

/**
 * Logger utility that respects environment settings
 * - In production: Only shows errors and warnings
 * - In development: Shows all logs with colors
 * - With VERBOSE_LOGS=true: Shows everything including debug logs
 */
class Logger {
  constructor(context = '') {
    this.context = context;
  }

  /**
   * Format prefix with timestamp, host (when bound to a request), and context.
   * Host comes from AsyncLocalStorage so every log inside a request carries
   * the site name without the call site needing to pass it.
   */
  _getPrefix(level, color) {
    const timestamp = colors.gray + getTimestamp() + colors.reset;
    const host = getRequestHost();
    const hostStr = host
      ? colors.gray + `@${host}` + colors.reset
      : '';
    const contextStr = this.context
      ? color + colors.bright + `[${this.context}]` + colors.reset
      : '';
    const levelStr = color + level + colors.reset;

    return [timestamp, levelStr, hostStr, contextStr].filter(Boolean).join(' ');
  }

  /**
   * Debug logs - only in development or with VERBOSE_LOGS
   * Use for detailed debugging information
   */
  debug(message, data = null) {
    if (isDevelopment || isVerbose) {
      const prefix = this._getPrefix('DEBUG', colors.gray);
      if (data !== null) {
        console.log(prefix, message, '\n ', formatValue(data));
      } else {
        console.log(prefix, message);
      }
    }
  }

  /**
   * Info logs - only in development or with VERBOSE_LOGS
   * Use for general information
   */
  info(message, data = null) {
    if (isDevelopment || isVerbose) {
      const prefix = this._getPrefix('INFO ', colors.cyan);
      if (data !== null) {
        console.log(prefix, message, '\n ', formatValue(data));
      } else {
        console.log(prefix, message);
      }
    }
  }

  /**
   * Warning logs - always shown
   * Use for potential issues that don't break functionality
   */
  warn(message, data = null) {
    const prefix = this._getPrefix('WARN ', colors.yellow);
    if (data !== null) {
      console.warn(prefix, message, '\n ', formatValue(data));
    } else {
      console.warn(prefix, message);
    }
  }

  /**
   * Error logs - always shown
   * Use for errors and exceptions
   */
  error(message, error = null) {
    const prefix = this._getPrefix('ERROR', colors.red);
    if (error) {
      console.error(prefix, message);
      if (error.stack) {
        console.error(colors.dim + error.stack + colors.reset);
      } else {
        console.error(' ', formatValue(error));
      }
    } else {
      console.error(prefix, message);
    }
  }

  /**
   * Success logs - only in development or with VERBOSE_LOGS
   * Use for successful operations
   */
  success(message, data = null) {
    if (isDevelopment || isVerbose) {
      const prefix = this._getPrefix('✓    ', colors.green);
      if (data !== null) {
        console.log(prefix, message, formatValue(data));
      } else {
        console.log(prefix, message);
      }
    }
  }

  /**
   * Performance logs - only with VERBOSE_LOGS
   * Use for performance measurements
   */
  perf(label, duration) {
    if (isVerbose) {
      const prefix = this._getPrefix('⚡   ', colors.magenta);
      const durationStr = duration > 100
        ? colors.red + `${duration}ms` + colors.reset
        : duration > 50
        ? colors.yellow + `${duration}ms` + colors.reset
        : colors.green + `${duration}ms` + colors.reset;
      console.log(prefix, label, durationStr);
    }
  }

  /**
   * Start a performance timer
   */
  time(label) {
    if (isVerbose) {
      console.time(this.context ? `[${this.context}] ${label}` : label);
    }
  }

  /**
   * End a performance timer
   */
  timeEnd(label) {
    if (isVerbose) {
      console.timeEnd(this.context ? `[${this.context}] ${label}` : label);
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext) {
    const newContext = this.context
      ? `${this.context}:${childContext}`
      : childContext;
    return new Logger(newContext);
  }
}

/**
 * Create a logger instance with optional context
 * @param {string} context - Context name (e.g., 'Components', 'Database', 'Render')
 * @returns {Logger} Logger instance
 */
export function createLogger(context = '') {
  return new Logger(context);
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Convenience exports for direct use
 */
export const log = {
  debug: (...args) => logger.debug(...args),
  info: (...args) => logger.info(...args),
  warn: (...args) => logger.warn(...args),
  error: (...args) => logger.error(...args),
  perf: (label, duration) => logger.perf(label, duration)
};

export default logger;
