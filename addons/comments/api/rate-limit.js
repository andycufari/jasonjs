// Rate Limiting Utility for Comments Plugin
// Prevents spam by limiting comments per user per time period

// In-memory rate limit store (use Redis in production for distributed systems)
const rateLimitStore = new Map();

// Default limits
const DEFAULT_LIMITS = {
  maxCommentsPerMinute: 2,
  maxCommentsPerHour: 5,
  maxCommentsPerDay: 50,
};

/**
 * Clean up expired entries from rate limit store
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    // Remove entries older than 24 hours
    if (now - data.timestamp > 24 * 60 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every hour
setInterval(cleanupExpiredEntries, 60 * 60 * 1000);

/**
 * Check if user has exceeded rate limit
 * @param {string} userId - User ID
 * @param {object} limits - Custom rate limits
 * @returns {object} { allowed: boolean, remaining: number, resetAt: timestamp, message: string }
 */
export function checkRateLimit(userId, limits = DEFAULT_LIMITS) {
  if (!userId) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: null,
      message: 'User ID is required',
    };
  }

  const now = Date.now();
  const key = `comment_rate_${userId}`;

  // Get or create user's rate limit data
  let userData = rateLimitStore.get(key);

  if (!userData) {
    userData = {
      timestamp: now,
      counts: {
        minute: [],
        hour: [],
        day: [],
      },
    };
  }

  // Filter timestamps by time windows
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  userData.counts.minute = userData.counts.minute.filter((t) => t > oneMinuteAgo);
  userData.counts.hour = userData.counts.hour.filter((t) => t > oneHourAgo);
  userData.counts.day = userData.counts.day.filter((t) => t > oneDayAgo);

  // Check limits
  const minuteCount = userData.counts.minute.length;
  const hourCount = userData.counts.hour.length;
  const dayCount = userData.counts.day.length;

  // Check per-minute limit
  if (minuteCount >= limits.maxCommentsPerMinute) {
    const oldestMinute = Math.min(...userData.counts.minute);
    const resetAt = oldestMinute + 60 * 1000;

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      period: 'minute',
      message: 'Please wait before posting again.',
    };
  }

  // Check per-hour limit
  if (hourCount >= limits.maxCommentsPerHour) {
    const oldestHour = Math.min(...userData.counts.hour);
    const resetAt = oldestHour + 60 * 60 * 1000;

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      period: 'hour',
      message: 'Please wait before posting again.',
    };
  }

  // Check per-day limit
  if (dayCount >= limits.maxCommentsPerDay) {
    const oldestDay = Math.min(...userData.counts.day);
    const resetAt = oldestDay + 24 * 60 * 60 * 1000;

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      period: 'day',
      message: 'Please wait before posting again.',
    };
  }

  // All checks passed
  return {
    allowed: true,
    remaining: {
      minute: limits.maxCommentsPerMinute - minuteCount,
      hour: limits.maxCommentsPerHour - hourCount,
      day: limits.maxCommentsPerDay - dayCount,
    },
    resetAt: null,
    message: 'OK',
  };
}

/**
 * Record a comment submission for rate limiting
 * @param {string} userId - User ID
 */
export function recordComment(userId) {
  if (!userId) return;

  const now = Date.now();
  const key = `comment_rate_${userId}`;

  let userData = rateLimitStore.get(key);

  if (!userData) {
    userData = {
      timestamp: now,
      counts: {
        minute: [],
        hour: [],
        day: [],
      },
    };
  }

  // Add current timestamp to all periods
  userData.counts.minute.push(now);
  userData.counts.hour.push(now);
  userData.counts.day.push(now);

  // Update store
  rateLimitStore.set(key, userData);
}

/**
 * Reset rate limits for a user (admin function)
 * @param {string} userId - User ID
 */
export function resetRateLimit(userId) {
  if (!userId) return;

  const key = `comment_rate_${userId}`;
  rateLimitStore.delete(key);
}

/**
 * Get rate limit status for a user
 * @param {string} userId - User ID
 * @param {object} limits - Custom rate limits
 * @returns {object} Current rate limit status
 */
export function getRateLimitStatus(userId, limits = DEFAULT_LIMITS) {
  if (!userId) {
    return {
      minute: { count: 0, remaining: 0, limit: 0 },
      hour: { count: 0, remaining: 0, limit: 0 },
      day: { count: 0, remaining: 0, limit: 0 },
    };
  }

  const now = Date.now();
  const key = `comment_rate_${userId}`;

  let userData = rateLimitStore.get(key);

  if (!userData) {
    return {
      minute: { count: 0, remaining: limits.maxCommentsPerMinute, limit: limits.maxCommentsPerMinute },
      hour: { count: 0, remaining: limits.maxCommentsPerHour, limit: limits.maxCommentsPerHour },
      day: { count: 0, remaining: limits.maxCommentsPerDay, limit: limits.maxCommentsPerDay },
    };
  }

  // Filter timestamps
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const minuteCount = userData.counts.minute.filter((t) => t > oneMinuteAgo).length;
  const hourCount = userData.counts.hour.filter((t) => t > oneHourAgo).length;
  const dayCount = userData.counts.day.filter((t) => t > oneDayAgo).length;

  return {
    minute: {
      count: minuteCount,
      remaining: limits.maxCommentsPerMinute - minuteCount,
      limit: limits.maxCommentsPerMinute,
    },
    hour: {
      count: hourCount,
      remaining: limits.maxCommentsPerHour - hourCount,
      limit: limits.maxCommentsPerHour,
    },
    day: {
      count: dayCount,
      remaining: limits.maxCommentsPerDay - dayCount,
      limit: limits.maxCommentsPerDay,
    },
  };
}

export default {
  checkRateLimit,
  recordComment,
  resetRateLimit,
  getRateLimitStatus,
};
