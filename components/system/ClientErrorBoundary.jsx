'use client';

import React from 'react';

/**
 * Client-side error boundary for catching React render errors
 *
 * Security Model:
 * - Shows REAL error messages (not generic replacements)
 * - Removes framework internal paths and stack traces
 * - Keeps actual error content for debugging
 */

/**
 * Sanitize error message - remove framework paths, keep the actual error
 */
function sanitizeErrorMessage(message) {
  if (!message || typeof message !== 'string') {
    return 'An error occurred in the component';
  }

  let sanitized = message;
  sanitized = sanitized.replace(/\/Users\/[^\s:)]+/g, '');
  sanitized = sanitized.replace(/\/home\/[^\s:)]+/g, '');
  sanitized = sanitized.replace(/\/var\/[^\s:)]+/g, '');
  sanitized = sanitized.replace(/C:\\[^\s:)]+/g, '');
  sanitized = sanitized.replace(/\s+at\s+.*?core\/.*?:\d+:\d+/g, '');
  sanitized = sanitized.replace(/\s+at\s+.*?components\/system\/.*?:\d+:\d+/g, '');
  sanitized = sanitized.replace(/\s+at\s+.*?node_modules\/.*?:\d+:\d+/g, '');
  sanitized = sanitized.replace(/\s+at\s+.*?\.next\/.*?:\d+:\d+/g, '');
  sanitized = sanitized.replace(/\s+at\s+.*?webpack.*?:\d+:\d+/g, '');
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  return sanitized || 'An error occurred in the component';
}

/**
 * Sanitize stack trace - keep user traces, remove framework internals
 */
function sanitizeStackTrace(stack) {
  if (!stack || typeof stack !== 'string') return '';

  const lines = stack.split('\n');
  const sanitizedLines = lines.filter(line => {
    if (!line.trim().startsWith('at ')) return true;
    if (line.includes('core/') || line.includes('components/system/') ||
        line.includes('node_modules/') || line.includes('.next/') ||
        line.includes('webpack')) return false;
    return true;
  });

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
 * Analyze error and extract debugging info
 * Shows REAL error message, just categorizes for helpful hints
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
  const errorMessage = sanitizeErrorMessage(message);
  const sanitizedStack = sanitizeStackTrace(error.stack);

  let category = 'runtime';
  let hint = null;

  if (messageLower.includes('module') && messageLower.includes('not found')) {
    category = 'import';
    hint = 'Check your import statements';
  } else if (messageLower.includes('is not defined')) {
    category = 'reference';
    hint = 'Make sure this variable is declared or imported';
  } else if (messageLower.includes('cannot read propert') || messageLower.includes('cannot access')) {
    category = 'reference';
    hint = 'Try using optional chaining (?.) or check if the value exists';
  } else if (messageLower.includes('is not a function')) {
    category = 'type';
    if (messageLower.match(/\.(map|filter|foreach|reduce|find)/)) {
      hint = 'This variable might not be an array. Add a check or fallback';
    } else {
      hint = 'Make sure this is actually a function';
    }
  } else if (messageLower.includes('maximum update depth') || messageLower.includes('infinite loop')) {
    category = 'react';
    hint = 'Check useEffect dependencies or setState calls';
  } else if (messageLower.includes('hook')) {
    category = 'react';
    hint = 'Hooks must be at the top level of your component';
  }

  return { category, errorMessage, sanitizedStack, hint };
}

class ClientErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console (only visible to developers with devtools open)
    console.error('Component Error:', error);

    // In dev mode, log to database for debugging
    const { isDevMode, componentName } = this.props;
    if (isDevMode && typeof window !== 'undefined') {
      this.logErrorToDatabase(error);
    }
  }

  async logErrorToDatabase(error) {
    const { componentName = 'Unknown' } = this.props;
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
            stack: errorDetails.sanitizedStack,
            hint: errorDetails.hint,
            type: 'render_error'
          },
          sessionId: `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          timestamp: new Date().toISOString()
        })
      });
    } catch (logError) {
      // Silent fail
    }
  }

  render() {
    if (this.state.hasError) {
      const { isDevMode, componentName } = this.props;
      const errorDetails = this.state.error ? analyzeError(this.state.error) : {
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
            <h3 className="text-red-800 font-semibold">Component Error</h3>
          </div>

          {/* THE ACTUAL ERROR MESSAGE */}
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

          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            >
              Refresh Page
            </button>

            {isDevMode && (
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>

          {isDevMode && (
            <p className="text-xs text-gray-500 mt-3 border-t border-gray-200 pt-3">
              🔍 Full error details (with framework internals) are in the browser console
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ClientErrorBoundary;
