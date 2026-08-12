// core/auth/rateLimit.js
// Rate limiting utilities for auth endpoints

import requestRateLimiter from '@/core/security/requestRateLimit';
import { NextResponse } from 'next/server';

/**
 * Get client IP from request
 * @param {Request} request - The incoming request
 * @returns {string} IP address
 */
export function getClientIP(request) {
  // Check various headers for real IP (behind proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return '127.0.0.1';
}

/**
 * Check auth rate limit and return error response if exceeded
 * @param {Request} request - The incoming request
 * @param {Object} options - Rate limit options
 * @param {string} options.type - Rate limit type: 'auth', 'api', 'general', 'suspicious'
 * @returns {NextResponse|null} Error response if rate limited, null if allowed
 */
export function checkAuthRateLimit(request, options = {}) {
  const { type = 'auth' } = options;
  const ip = getClientIP(request);

  const result = requestRateLimiter.check(ip, type);

  if (!result.allowed) {
    const resetInSeconds = Math.ceil(result.resetIn / 1000);

    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: resetInSeconds,
        reason: result.reason
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(resetInSeconds),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + resetInSeconds)
        }
      }
    );
  }

  return null;
}

/**
 * Stricter rate limit for code verification (prevent brute force)
 * Max 5 attempts per 5 minutes per IP
 */
class CodeVerificationLimiter {
  constructor() {
    // Store: { ip: { attempts, resetAt } }
    this.attempts = new Map();

    this.config = {
      maxAttempts: 5,
      windowMs: 5 * 60 * 1000 // 5 minutes
    };

    // Cleanup every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  check(ip) {
    const now = Date.now();
    let record = this.attempts.get(ip);

    // Initialize or reset if window expired
    if (!record || now >= record.resetAt) {
      record = {
        attempts: 0,
        resetAt: now + this.config.windowMs
      };
      this.attempts.set(ip, record);
    }

    record.attempts++;

    if (record.attempts > this.config.maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: record.resetAt - now
      };
    }

    return {
      allowed: true,
      remaining: this.config.maxAttempts - record.attempts,
      resetIn: record.resetAt - now
    };
  }

  // Reset attempts for an IP (call after successful verification)
  reset(ip) {
    this.attempts.delete(ip);
  }

  cleanup() {
    const now = Date.now();
    for (const [ip, record] of this.attempts.entries()) {
      if (now >= record.resetAt) {
        this.attempts.delete(ip);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
export const codeVerificationLimiter = new CodeVerificationLimiter();

/**
 * Check code verification rate limit
 * @param {Request} request - The incoming request
 * @returns {NextResponse|null} Error response if rate limited, null if allowed
 */
export function checkCodeVerificationLimit(request) {
  const ip = getClientIP(request);
  const result = codeVerificationLimiter.check(ip);

  if (!result.allowed) {
    const resetInSeconds = Math.ceil(result.resetIn / 1000);

    return NextResponse.json(
      {
        error: 'Too many verification attempts. Please wait before trying again.',
        retryAfter: resetInSeconds
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(resetInSeconds)
        }
      }
    );
  }

  return null;
}

/**
 * Reset code verification limit after successful verification
 * @param {Request} request - The incoming request
 */
export function resetCodeVerificationLimit(request) {
  const ip = getClientIP(request);
  codeVerificationLimiter.reset(ip);
}

export default {
  checkAuthRateLimit,
  checkCodeVerificationLimit,
  resetCodeVerificationLimit,
  getClientIP
};
