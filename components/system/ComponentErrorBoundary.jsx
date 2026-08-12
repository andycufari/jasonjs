'use client';

/**
 * Component Error Boundary for Dynamic Components
 *
 * Security Model:
 * - Visitors see ONLY generic "Something went wrong" message
 * - NO stack traces, file paths, bundle code, or framework internals exposed
 * - Database logs contain ONLY sanitized user component errors
 * - Framework internals are NEVER exposed to tenants
 */

import React, { Component } from 'react';

/**
 * Sanitize error messages for tenant viewing
 * ONLY removes framework internal paths - keeps the actual error message intact
 *
 * Philosophy: Show the real error, just hide where it came from internally
 *
 * @param {string} message - Raw error message
 * @returns {string} Sanitized message safe for tenant
 */
function sanitizeErrorMessage(message) {
  if (!message || typeof message !== 'string') {
    return 'An error occurred in the component';
  }

  let sanitized = message;

  // Remove absolute file system paths that reveal server structure
  sanitized = sanitized.replace(/\/Users\/[^\s:)]+/g, '');
  sanitized = sanitized.replace(/\/home\/[^\s:)]+/g, '');
  sanitized = sanitized.replace(/\/var\/[^\s:)]+/g, '');
  sanitized = sanitized.replace(/C:\\[^\s:)]+/g, '');

  // Remove framework internal paths (but keep the error message)
  sanitized = sanitized.replace(/\s+at\s+.*?core\/.*?:\d+:\d+/g, '');
  sanitized = sanitized.replace(/\s+at\s+.*?components\/system\/.*?:\d+:\d+/g, '');
  sanitized = sanitized.replace(/\s+at\s+.*?node_modules\/.*?:\d+:\d+/g, '');
  sanitized = sanitized.replace(/\s+at\s+.*?\.next\/.*?:\d+:\d+/g, '');
  sanitized = sanitized.replace(/\s+at\s+.*?webpack.*?:\d+:\d+/g, '');

  // Clean up multiple spaces and newlines
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized || 'An error occurred in the component';
}

/**
 * Sanitize stack trace - remove framework internals but keep user component traces
 * @param {string} stack - Raw stack trace
 * @returns {string} Sanitized stack trace
 */
function sanitizeStackTrace(stack) {
  if (!stack || typeof stack !== 'string') {
    return '';
  }

  // Split into lines
  const lines = stack.split('\n');

  // Filter out framework internal lines
  const sanitizedLines = lines.filter(line => {
    // Keep the error message line (first line)
    if (!line.trim().startsWith('at ')) {
      return true;
    }

    // Remove framework internal traces
    if (line.includes('core/') ||
        line.includes('components/system/') ||
        line.includes('node_modules/') ||
        line.includes('.next/') ||
        line.includes('webpack')) {
      return false;
    }

    return true;
  });

  // Remove absolute paths from remaining lines
  const cleanedLines = sanitizedLines.map(line => {
    let cleaned = line;
    cleaned = cleaned.replace(/\/Users\/[^\s:)]+/g, '');
    cleaned = cleaned.replace(/\/home\/[^\s:)]+/g, '');
    cleaned = cleaned.replace(/\/var\/[^\s:)]+/g, '');
    cleaned = cleaned.replace(/C:\\[^\s:)]+/g, '');
    return cleaned.trim();
  }).filter(Boolean);

  return cleanedLines.join('\n');
}

/**
 * Analyze error and extract useful debugging info
 * Philosophy: Show the REAL error message, just categorize it for helpful icons/hints
 *
 * @param {Error} error - The error object
 * @returns {Object} { category, errorMessage, sanitizedStack, hint }
 */
function analyzeError(error) {
  if (!error?.message) {
    return {
      category: 'unknown',
      errorMessage: 'An unknown error occurred',
      sanitizedStack: '',
      hint: null
    };
  }

  const message = error.message;
  const messageLower = message.toLowerCase();

  // Sanitize the actual error message (removes paths, keeps content)
  const errorMessage = sanitizeErrorMessage(message);

  // Sanitize stack trace (removes framework internals)
  const sanitizedStack = sanitizeStackTrace(error.stack);

  // Determine category and provide contextual hint (not replacement message)
  let category = 'runtime';
  let hint = null;

  // Import/Module errors - specific named export not found
  if (message.includes('not found in module') && message.includes('Export "')) {
    category = 'import';
    hint = 'This export does not exist in the module. Check the spelling or consult the module documentation.';
  }
  // Import/Module errors - entire module not found
  else if (messageLower.includes('module') && messageLower.includes('not found')) {
    category = 'import';
    hint = 'Check your import statements and make sure the module is available';
  }
  else if (messageLower.includes('whitelist')) {
    category = 'import';
    hint = 'This module is not in the approved list. Check documentation for available modules.';
  }
  // Reference errors
  else if (messageLower.includes('is not defined')) {
    category = 'reference';
    hint = 'Make sure this variable is declared or imported before using it';
  }
  else if (messageLower.includes('cannot read propert') || messageLower.includes('cannot access')) {
    category = 'reference';
    hint = 'Try using optional chaining (?.) or check if the value exists before accessing';
  }
  // Type errors
  else if (messageLower.includes('is not a function')) {
    category = 'type';
    // Check if it's an array method
    if (messageLower.match(/\.(map|filter|foreach|reduce|find|some|every)/)) {
      hint = 'This variable might not be an array. Check the data type or add a fallback (e.g., Array.isArray() check)';
    } else {
      hint = 'Make sure this is actually a function and is properly defined/imported';
    }
  }
  else if (messageLower.includes('is not iterable')) {
    category = 'type';
    hint = 'This value cannot be iterated over. Make sure it\'s an array or iterable object';
  }
  // Syntax errors
  else if (messageLower.includes('unexpected token')) {
    category = 'syntax';
    hint = 'Check for missing closing tags, brackets, parentheses, or quotes';
  }
  // React errors
  else if (messageLower.includes('maximum update depth') || messageLower.includes('infinite loop')) {
    category = 'react';
    hint = 'Check useEffect dependencies or setState calls that might be causing infinite re-renders';
  }
  else if (messageLower.includes('invalid hook call') || messageLower.includes('rendered more hooks') || messageLower.includes('rendered fewer hooks')) {
    category = 'react';
    hint = 'Hooks must be called at the top level of your component (not in loops, conditions, or nested functions)';
  }
  // Network errors
  else if (messageLower.includes('fetch') || messageLower.includes('network')) {
    category = 'network';
    hint = 'Check your internet connection and API endpoint';
  }

  return {
    category,
    errorMessage,
    sanitizedStack,
    hint
  };
}

export class ComponentErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console (only visible with devtools)
    console.error('Component Error:', error);

    this.setState({ errorInfo });

    // Log to database in dev mode
    const { isDevMode, componentName, bundle } = this.props;
    if (isDevMode && typeof window !== 'undefined') {
      this.logErrorToDatabase(error, errorInfo);
    }
  }

  async logErrorToDatabase(error, errorInfo) {
    const { componentName = 'Unknown' } = this.props;

    // Analyze and sanitize error - removes framework internals, keeps actual error
    const errorDetails = analyzeError(error);

    try {
      await fetch('/api/log-component-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentName,
          error: {
            category: errorDetails.category,
            message: errorDetails.errorMessage,
            stack: errorDetails.sanitizedStack, // Only user component traces
            hint: errorDetails.hint,
            type: 'boundary_error'
          },
          sessionId: `boundary_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          timestamp: new Date().toISOString()
        })
      });
    } catch (logError) {
      // Silent fail
    }
  }

  render() {
    const { hasError, error } = this.state;
    const { componentName = 'Component', isDevMode } = this.props;

    // Handle caught errors or passed error prop
    const displayError = this.props.error || error;

    if (hasError || this.props.error) {
      // Analyze error - get real message with internal paths removed
      const errorDetails = displayError ? analyzeError(displayError) : {
        category: 'unknown',
        errorMessage: 'An unknown error occurred',
        sanitizedStack: '',
        hint: null
      };

      // Emoji mapping for error categories
      const categoryEmoji = {
        import: '📦',
        reference: '🔍',
        type: '⚙️',
        syntax: '📝',
        react: '⚛️',
        network: '🌐',
        runtime: '⚠️',
        unknown: '⚠️'
      };

      const emoji = categoryEmoji[errorDetails.category] || '⚠️';

      return (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50 my-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{emoji}</span>
            <h3 className="text-red-800 font-semibold">
              Component Error
            </h3>
          </div>

          {/* THE ACTUAL ERROR MESSAGE - not a generic replacement */}
          <div className="bg-white border border-red-300 rounded p-3 mb-3">
            <p className="text-red-900 text-sm font-mono whitespace-pre-wrap break-words">
              {errorDetails.errorMessage}
            </p>
          </div>

          {/* Show helpful hint in dev mode */}
          {isDevMode && errorDetails.hint && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3">
              <p className="text-amber-800 text-xs">
                <strong>💡 Hint:</strong> {errorDetails.hint}
              </p>
            </div>
          )}

          {/* Show sanitized stack trace in dev mode */}
          {isDevMode && errorDetails.sanitizedStack && (
            <details className="mb-3">
              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                📋 Stack Trace (click to expand)
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto text-gray-700 font-mono">
                {errorDetails.sanitizedStack}
              </pre>
            </details>
          )}

          {/* Component name for debugging */}
          {isDevMode && componentName && (
            <p className="text-red-600 text-xs mb-3 font-mono bg-red-100 px-2 py-1 rounded inline-block">
              Component: {componentName}
            </p>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            >
              Refresh Page
            </button>

            {isDevMode && (
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                }}
                className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>

          {/* Dev mode console hint */}
          {isDevMode && (
            <p className="text-xs text-gray-500 mt-3 border-t border-gray-200 pt-3">
              🔍 Full error details (including framework internals) are in the browser console
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional component wrapper for easier use
export default function ComponentErrorBoundaryWrapper({ children, ...props }) {
  return (
    <ComponentErrorBoundary {...props}>
      {children}
    </ComponentErrorBoundary>
  );
}
