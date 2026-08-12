// core/utils/apiError.js
// Centralized API error sanitization - prevents leaking internal details to clients

/**
 * Error codes for client-side handling
 */
export const ErrorCodes = {
  // Auth
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_INVALID: 'AUTH_INVALID',

  // Data
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

  // Operations
  OPERATION_FAILED: 'OPERATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

/**
 * Patterns to detect and sanitize from error messages
 * These indicate sensitive information that should never reach the client
 */
const SENSITIVE_PATTERNS = [
  // File paths
  /\/Users\/[^\s]+/gi,
  /\/home\/[^\s]+/gi,
  /\/var\/[^\s]+/gi,
  /[A-Z]:\\[^\s]+/gi,  // Windows paths

  // Database internals
  /mongodb(\+srv)?:\/\/[^\s]+/gi,
  /at\s+\w+\s+\([^)]+\)/g,  // Stack trace lines
  /ObjectId\("[^"]+"\)/gi,
  /collection\s+['"][^'"]+['"]/gi,
  /\.aggregate\([^)]+\)/gi,
  /\$match|\$lookup|\$project/g,  // MongoDB operators

  // Secrets/keys patterns
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /api[_-]?key[=:]\s*['"]?[^\s'"]+/gi,
  /secret[=:]\s*['"]?[^\s'"]+/gi,
  /password[=:]\s*['"]?[^\s'"]+/gi,

  // Internal module references
  /node_modules\/[^\s]+/gi,
  /@[\w-]+\/[\w-]+/g,  // Scoped packages in errors
];

/**
 * Map of known error patterns to safe client messages
 */
const ERROR_MAP = [
  // Authentication
  { pattern: /authentication required/i, message: 'Authentication required', code: ErrorCodes.AUTH_REQUIRED, status: 401 },
  { pattern: /not authenticated/i, message: 'Not authenticated', code: ErrorCodes.AUTH_REQUIRED, status: 401 },
  { pattern: /unauthorized/i, message: 'Not authorized', code: ErrorCodes.AUTH_FORBIDDEN, status: 403 },
  { pattern: /not authorized/i, message: 'Not authorized', code: ErrorCodes.AUTH_FORBIDDEN, status: 403 },
  { pattern: /forbidden/i, message: 'Access denied', code: ErrorCodes.AUTH_FORBIDDEN, status: 403 },
  { pattern: /invalid.*token/i, message: 'Invalid session', code: ErrorCodes.AUTH_INVALID, status: 401 },
  { pattern: /session.*expired/i, message: 'Session expired', code: ErrorCodes.AUTH_INVALID, status: 401 },

  // Not found
  { pattern: /not found/i, message: 'Resource not found', code: ErrorCodes.NOT_FOUND, status: 404 },
  { pattern: /does not exist/i, message: 'Resource not found', code: ErrorCodes.NOT_FOUND, status: 404 },
  { pattern: /no.*found/i, message: 'Resource not found', code: ErrorCodes.NOT_FOUND, status: 404 },

  // Validation
  { pattern: /validation/i, message: 'Validation failed', code: ErrorCodes.VALIDATION_FAILED, status: 400 },
  { pattern: /invalid.*input/i, message: 'Invalid input', code: ErrorCodes.VALIDATION_FAILED, status: 400 },
  { pattern: /required.*field/i, message: 'Required field missing', code: ErrorCodes.VALIDATION_FAILED, status: 400 },
  { pattern: /duplicate/i, message: 'Duplicate entry', code: ErrorCodes.DUPLICATE_ENTRY, status: 409 },

  // Rate limiting
  { pattern: /rate.*limit/i, message: 'Too many requests', code: ErrorCodes.RATE_LIMITED, status: 429 },
  { pattern: /quota.*exceeded/i, message: 'Quota exceeded', code: ErrorCodes.QUOTA_EXCEEDED, status: 429 },
  { pattern: /too many/i, message: 'Too many requests', code: ErrorCodes.RATE_LIMITED, status: 429 },

  // Database
  { pattern: /database.*failed/i, message: 'Operation failed', code: ErrorCodes.OPERATION_FAILED, status: 500 },
  { pattern: /mongodb/i, message: 'Operation failed', code: ErrorCodes.OPERATION_FAILED, status: 500 },
  { pattern: /connection.*refused/i, message: 'Service temporarily unavailable', code: ErrorCodes.SERVICE_UNAVAILABLE, status: 503 },
  { pattern: /timeout/i, message: 'Request timed out', code: ErrorCodes.SERVICE_UNAVAILABLE, status: 504 },
];

/**
 * Check if error message contains sensitive information
 * @param {string} message
 * @returns {boolean}
 */
function containsSensitiveInfo(message) {
  if (!message || typeof message !== 'string') return false;
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Sanitize an error for client response
 *
 * @param {Error|string|Object} error - The error to sanitize
 * @param {Object} options - Options
 * @param {boolean} options.isDev - Development mode (slightly more detail)
 * @param {string} options.context - Context hint (e.g., 'database', 'auth', 'function')
 * @returns {{ message: string, code: string, status: number }}
 */
export function sanitizeError(error, options = {}) {
  const { isDev = process.env.NODE_ENV === 'development', context = '' } = options;

  // Extract error message
  let rawMessage = '';
  if (error instanceof Error) {
    rawMessage = error.message || '';
  } else if (typeof error === 'string') {
    rawMessage = error;
  } else if (error?.message) {
    rawMessage = error.message;
  }

  // Default response
  let result = {
    message: 'Operation failed',
    code: ErrorCodes.OPERATION_FAILED,
    status: 500
  };

  // Check for known patterns
  for (const mapping of ERROR_MAP) {
    if (mapping.pattern.test(rawMessage)) {
      result = {
        message: mapping.message,
        code: mapping.code,
        status: mapping.status
      };
      break;
    }
  }

  // If the original error has a code/status, preserve it if it's a client error
  if (error?.code && typeof error.code === 'string') {
    result.code = error.code;
  }
  if (error?.status && typeof error.status === 'number' && error.status >= 400 && error.status < 500) {
    result.status = error.status;
  }

  // In dev mode, add context hint if message seems safe
  if (isDev && rawMessage && !containsSensitiveInfo(rawMessage)) {
    // Only append if it adds value and isn't the same as the sanitized message
    const lowerRaw = rawMessage.toLowerCase();
    const lowerResult = result.message.toLowerCase();
    if (!lowerRaw.includes(lowerResult) && !lowerResult.includes(lowerRaw)) {
      // Still safe, but truncate to prevent very long messages
      const safeHint = rawMessage.slice(0, 100);
      if (safeHint.length < rawMessage.length) {
        result.message = `${result.message}: ${safeHint}...`;
      } else {
        result.message = `${result.message}: ${safeHint}`;
      }
    }
  }

  return result;
}

/**
 * Create a NextResponse JSON error with sanitized message
 *
 * @param {Error|string|Object} error - The error
 * @param {Object} options - Options passed to sanitizeError
 * @returns {Response} NextResponse-compatible object
 */
export function createErrorResponse(error, options = {}) {
  const { NextResponse } = require('next/server');
  const sanitized = sanitizeError(error, options);

  // Log the full error server-side for debugging
  if (process.env.NODE_ENV !== 'test') {
    console.error('[API Error]', {
      sanitized: sanitized.message,
      original: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context: options.context
    });
  }

  return NextResponse.json(
    {
      error: sanitized.message,
      code: sanitized.code
    },
    { status: sanitized.status }
  );
}

/**
 * Wrap an async handler with automatic error sanitization
 *
 * @param {Function} handler - Async handler function
 * @param {Object} options - Options for error sanitization
 * @returns {Function} Wrapped handler
 *
 * @example
 * export const GET = withErrorHandling(async (request) => {
 *   const data = await fetchData();
 *   return NextResponse.json({ data });
 * }, { context: 'data-api' });
 */
export function withErrorHandling(handler, options = {}) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return createErrorResponse(error, options);
    }
  };
}

export default {
  sanitizeError,
  createErrorResponse,
  withErrorHandling,
  ErrorCodes
};
