/**
 * Unified Template Variable Replacement Utility
 *
 * Consolidates all template variable replacement logic from:
 * - core/db/index.js (replaceParams)
 * - core/render/pageData.js (replaceParamsInConfig)
 * - core/utils/loadPageDefinition.js (processParamsInJson)
 *
 * Supports:
 * - {{params.variable}} - URL/query parameters
 * - {{user.property}} - Authenticated user properties
 * - [[env.VARIABLE]] - Environment variables
 * - {{context.property}} - General context properties
 */

/**
 * Replace template variables in a string
 * @param {string} str - String containing template variables
 * @param {Object} context - Replacement context
 * @param {Object} context.params - URL/query parameters
 * @param {Object} context.user - Authenticated user object
 * @param {Object} context.env - Environment variables (optional, defaults to process.env)
 * @param {Object} context.context - Additional context properties
 * @param {boolean} shouldEscape - Whether to HTML-escape the replacement values
 * @returns {string} String with variables replaced
 */
export function replaceTemplateVarsInString(str, context = {}, shouldEscape = false) {
  if (typeof str !== 'string') return str;

  const {
    params = {},
    user = null,
    env = process.env,
    context: additionalContext = {}
  } = context;

  let result = str;

  // Replace {{params.variable}} patterns
  result = result.replace(/\{\{params\.(\w+)\}\}/g, (match, paramName) => {
    const paramValue = params[paramName];
    if (paramValue === undefined || paramValue === null) return '';

    const value = String(paramValue);
    return shouldEscape ? escapeHtml(value) : value;
  });

  // Replace {{user.property}} patterns
  result = result.replace(/\{\{user\.(\w+)\}\}/g, (match, userProp) => {
    if (!user || !user[userProp]) return '';

    const value = String(user[userProp]);
    return shouldEscape ? escapeHtml(value) : value;
  });

  // Replace [[env.VARIABLE]] patterns
  result = result.replace(/\[\[env\.(\w+)\]\]/g, (match, envVar) => {
    return env[envVar] || match; // Return original if not found
  });

  // Replace {{context.property}} patterns
  result = result.replace(/\{\{context\.(\w+)\}\}/g, (match, contextProp) => {
    if (!additionalContext[contextProp]) return '';

    const value = String(additionalContext[contextProp]);
    return shouldEscape ? escapeHtml(value) : value;
  });

  return result;
}

/**
 * Replace template variables in an object (deep replacement)
 * @param {any} obj - Object, array, or primitive to process
 * @param {Object} context - Replacement context (same as replaceTemplateVarsInString)
 * @param {boolean} shouldEscape - Whether to HTML-escape the replacement values
 * @returns {any} New object with variables replaced
 */
export function replaceTemplateVars(obj, context = {}, shouldEscape = false) {
  // Handle primitives
  if (obj === null || obj === undefined) return obj;

  // Handle strings
  if (typeof obj === 'string') {
    return replaceTemplateVarsInString(obj, context, shouldEscape);
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => replaceTemplateVars(item, context, shouldEscape));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const replaced = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        replaced[key] = replaceTemplateVars(obj[key], context, shouldEscape);
      }
    }
    return replaced;
  }

  // Return other types as-is
  return obj;
}

/**
 * HTML escape function for safe rendering
 * @param {string} str - String to escape
 * @returns {string} HTML-escaped string
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use replaceTemplateVars instead
 */
export function processParamsInJson(json, params) {
  return replaceTemplateVars(json, { params }, false);
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use replaceTemplateVars instead
 */
export function replaceParamsInConfig(config, params, user = null) {
  return replaceTemplateVars(config, { params, user }, false);
}
