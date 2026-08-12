/**
 * AI Security and Rate Limiting
 * Handles rate limiting, validation, and cost tracking
 */

// In-memory rate limiting store
// In production, use Redis for distributed rate limiting
const rateLimitStore = new Map();

// Cost tracking (approximate tokens to USD conversion)
const TOKEN_COSTS = {
  'gpt-5-mini': { input: 0.15 / 1000000, output: 0.6 / 1000000 }, // per token
  'gpt-5-nano': { input: 0.1 / 1000000, output: 0.4 / 1000000 },
  'gpt-5': { input: 2.5 / 1000000, output: 10 / 1000000 },
  'gpt-image-1': { base: 0.02 }, // per image, varies by size
  'gemini-3.1-flash-image-preview': { base: 0.05 }, // per image, varies by size
  'gemini-3-pro-image-preview': { base: 0.134 }, // per image, varies by size
  'gpt-4o-mini-tts': { base: 0.00015 / 1000 } // per character
};

const dailyCostStore = new Map();

/**
 * Check rate limits for a domain/user
 * @param {string} domain - Domain name
 * @param {string} userId - User ID (optional)
 * @param {Object} limits - Limit configuration
 * @returns {Object} { allowed: boolean, retryAfter: number|null, remaining: number }
 */
export async function checkRateLimit(domain, userId = null, limits = {}) {
  const key = userId ? `${domain}:${userId}` : domain;
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = {
      minute: { count: 0, resetAt: now + 60000 },
      hour: { count: 0, resetAt: now + 3600000 },
      day: { count: 0, resetAt: now + 86400000 }
    };
    rateLimitStore.set(key, entry);
  }

  // Reset counters if time windows expired
  if (now >= entry.minute.resetAt) {
    entry.minute = { count: 0, resetAt: now + 60000 };
  }
  if (now >= entry.hour.resetAt) {
    entry.hour = { count: 0, resetAt: now + 3600000 };
  }
  if (now >= entry.day.resetAt) {
    entry.day = { count: 0, resetAt: now + 86400000 };
  }

  // Check limits
  const minuteLimit = limits.requestsPerMinute || 10;
  const hourLimit = limits.requestsPerHour || 100;
  const dayLimit = limits.requestsPerDay || 500;

  if (entry.minute.count >= minuteLimit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.minute.resetAt - now) / 1000),
      remaining: 0,
      limit: minuteLimit,
      window: 'minute'
    };
  }

  if (entry.hour.count >= hourLimit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.hour.resetAt - now) / 1000),
      remaining: 0,
      limit: hourLimit,
      window: 'hour'
    };
  }

  if (entry.day.count >= dayLimit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.day.resetAt - now) / 1000),
      remaining: 0,
      limit: dayLimit,
      window: 'day'
    };
  }

  // Increment counters
  entry.minute.count++;
  entry.hour.count++;
  entry.day.count++;

  return {
    allowed: true,
    retryAfter: null,
    remaining: Math.min(
      minuteLimit - entry.minute.count,
      hourLimit - entry.hour.count,
      dayLimit - entry.day.count
    ),
    limit: minuteLimit
  };
}

/**
 * Track usage costs
 * @param {string} domain - Domain name
 * @param {string} model - Model name
 * @param {number} inputTokens - Input tokens used
 * @param {number} outputTokens - Output tokens used
 * @returns {number} Estimated cost in USD
 */
export function trackCost(domain, model, inputTokens = 0, outputTokens = 0) {
  const cost = estimateCost(model, inputTokens, outputTokens);

  const today = new Date().toISOString().split('T')[0];
  const key = `${domain}:${today}`;

  const current = dailyCostStore.get(key) || 0;
  dailyCostStore.set(key, current + cost);

  // Clean up old entries (keep last 7 days)
  cleanupOldCosts(7);

  return cost;
}

/**
 * Estimate cost for a request
 * @param {string} model - Model name
 * @param {number} inputTokens - Input tokens
 * @param {number} outputTokens - Output tokens
 * @returns {number} Estimated cost in USD
 */
export function estimateCost(model, inputTokens = 0, outputTokens = 0) {
  const pricing = TOKEN_COSTS[model];
  if (!pricing) return 0;

  if (pricing.input && pricing.output) {
    // Text models
    return (inputTokens * pricing.input) + (outputTokens * pricing.output);
  } else if (pricing.base) {
    // Image/Speech models (flat rate or per character)
    return pricing.base * (inputTokens || 1);
  }

  return 0;
}

/**
 * Check if domain has exceeded daily cost limit
 * @param {string} domain - Domain name
 * @param {number} maxCostPerDay - Maximum cost in USD
 * @returns {Object} { allowed: boolean, current: number, limit: number }
 */
export function checkCostLimit(domain, maxCostPerDay) {
  if (!maxCostPerDay) return { allowed: true, current: 0, limit: 0 };

  const today = new Date().toISOString().split('T')[0];
  const key = `${domain}:${today}`;
  const current = dailyCostStore.get(key) || 0;

  return {
    allowed: current < maxCostPerDay,
    current,
    limit: maxCostPerDay,
    remaining: Math.max(0, maxCostPerDay - current)
  };
}

/**
 * Validate origin for same-origin policy
 * @param {Request} request - HTTP request
 * @param {Array} allowedOrigins - Allowed origins configuration
 * @returns {boolean} True if origin is allowed
 */
export function validateOrigin(request, allowedOrigins = ['same-origin']) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // If no origin/referer, could be server-side request
  if (!origin && !referer) {
    return true; // Allow server-side calls
  }

  // Check same-origin
  if (allowedOrigins.includes('same-origin')) {
    const requestUrl = new URL(request.url);

    if (origin) {
      const originUrl = new URL(origin);
      if (originUrl.host === requestUrl.host) {
        return true;
      }
    }

    if (referer) {
      const refererUrl = new URL(referer);
      if (refererUrl.host === requestUrl.host) {
        return true;
      }
    }
  }

  // Check specific allowed origins
  if (origin && allowedOrigins.includes(origin)) {
    return true;
  }

  return false;
}

/**
 * Validate context (trusted vs untrusted)
 * @param {string} context - Context type (functions, system-components, client, etc.)
 * @param {Array} allowedContexts - Allowed contexts from config
 * @returns {boolean} True if context is allowed
 */
export function validateContext(context, allowedContexts = []) {
  if (!context) return false;
  return allowedContexts.includes(context);
}

/**
 * Validate prompt against security rules
 * @param {string} prompt - Prompt to validate
 * @param {Object} config - AI configuration
 * @param {string} context - Execution context
 * @returns {Object} { valid: boolean, reason: string|null }
 */
export function validatePrompt(prompt, config, context) {
  // Check if arbitrary prompts are allowed
  if (!config.config?.security?.allowArbitraryPrompts) {
    // Must be a template reference
    if (!/^\{\{[\w\s]+\}\}$/.test(prompt.trim())) {
      return {
        valid: false,
        reason: 'Arbitrary prompts not allowed. Use predefined templates.'
      };
    }
  }

  // Check context
  if (!validateContext(context, config.config?.security?.allowedContexts)) {
    return {
      valid: false,
      reason: `Context '${context}' not allowed for AI operations.`
    };
  }

  // Basic security checks (injection prevention)
  const suspiciousPatterns = [
    /ignore\s+previous\s+instructions/i,
    /system\s*:/i,
    /<\/script>/i,
    /<iframe/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(prompt)) {
      return {
        valid: false,
        reason: 'Prompt contains potentially malicious content.'
      };
    }
  }

  return { valid: true, reason: null };
}

/**
 * Log AI usage for monitoring
 * @param {Object} usage - Usage information
 */
export function logUsage(usage) {
  if (process.env.AI_LOG_USAGE !== 'true') return;

  const logEntry = {
    timestamp: new Date().toISOString(),
    domain: usage.domain,
    userId: usage.userId,
    type: usage.type, // prompt, image, speech
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cost: usage.cost,
    duration: usage.duration,
    success: usage.success,
    error: usage.error
  };

  // In production, send to logging service
  console.log('[AI Usage]', JSON.stringify(logEntry));
}

/**
 * Clean up old cost tracking entries
 * @param {number} daysToKeep - Number of days to keep
 */
function cleanupOldCosts(daysToKeep = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  for (const [key] of dailyCostStore) {
    const dateStr = key.split(':')[1];
    if (dateStr < cutoffStr) {
      dailyCostStore.delete(key);
    }
  }
}

/**
 * Clean up old rate limit entries
 */
export function cleanupRateLimits() {
  const now = Date.now();

  for (const [key, entry] of rateLimitStore) {
    // If all time windows are expired, remove entry
    if (
      now >= entry.minute.resetAt &&
      now >= entry.hour.resetAt &&
      now >= entry.day.resetAt
    ) {
      rateLimitStore.delete(key);
    }
  }
}

// Periodic cleanup (every hour)
setInterval(cleanupRateLimits, 3600000);