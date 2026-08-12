// core/security/requestRateLimit.js
// HTTP request rate limiting with IP blocking for security middleware

import BoundedMap from '../utils/BoundedMap.js';

class RequestRateLimiter {
  constructor() {
    // Store: { ip: { count, resetAt, blocked, violations } }
    this.requests = new BoundedMap({ maxSize: 50000, ttl: 3600000 });
    this.blockedIPs = new BoundedMap({ maxSize: 10000, ttl: 3600000 });

    // Configuration - VERY generous limits for real users, only blocks clear abuse
    // These limits are designed to never block legitimate usage patterns
    this.limits = {
      // Requests per window
      general: {
        max: 300, // page/HTML requests per minute (5 req/sec - covers tab spam, prefetching)
        window: 60 * 1000 // 1 minute
      },
      api: {
        max: 200, // API calls per minute (3.3 req/sec - allows parallel SPA requests)
        window: 60 * 1000
      },
      auth: {
        max: 30, // Auth requests (OAuth flows make 10-15 reqs, allow retries)
        window: 5 * 60 * 1000 // per 5 minutes
      },
      suspicious: {
        max: 50, // Stricter for honeypot hits and threat patterns
        window: 60 * 1000
      }
    };

    // Auto-block thresholds - very forgiving, only blocks persistent abuse
    this.autoBlock = {
      violations: 10, // Block after 10 violations (not 5) - give benefit of doubt
      duration: 20 * 60 * 1000 // Block for 20 minutes (not 15) - enough time to realize issue
    };

  }

  /**
   * Check if IP is rate limited
   * @param {string} ip - IP address
   * @param {string} type - 'general', 'api', 'auth', 'suspicious'
   * @returns {Object} { allowed, remaining, resetIn }
   */
  check(ip, type = 'general') {
    // Check if IP is blocked
    if (this.isBlocked(ip)) {
      const blockedUntil = this.blockedIPs.get(ip);
      const resetIn = blockedUntil - Date.now();

      return {
        allowed: false,
        remaining: 0,
        resetIn,
        reason: 'ip_blocked',
        blockedUntil: new Date(blockedUntil).toISOString()
      };
    }

    const limit = this.limits[type] || this.limits.general;
    const now = Date.now();
    const key = `${ip}:${type}`;

    let record = this.requests.get(key);

    // Initialize or reset if window expired
    if (!record || now >= record.resetAt) {
      record = {
        count: 0,
        resetAt: now + limit.window,
        violations: record?.violations || 0,
        firstSeen: record?.firstSeen || now
      };
      this.requests.set(key, record);
    }

    // Increment count
    record.count++;

    // Check if limit exceeded
    if (record.count > limit.max) {
      record.violations++;

      // Auto-block after repeated violations
      if (record.violations >= this.autoBlock.violations) {
        this.blockIP(ip, this.autoBlock.duration);
        return {
          allowed: false,
          remaining: 0,
          resetIn: this.autoBlock.duration,
          reason: 'auto_blocked',
          violations: record.violations
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetIn: record.resetAt - now,
        reason: 'rate_limit_exceeded',
        violations: record.violations
      };
    }

    return {
      allowed: true,
      remaining: limit.max - record.count,
      resetIn: record.resetAt - now
    };
  }

  /**
   * Block an IP address. Refuses infra/private IPs to prevent blocking the
   * ALB or a shared upstream and 403'ing every user behind it.
   */
  blockIP(ip, duration = this.autoBlock.duration) {
    if (!this.isPublicIP(ip)) return;
    const blockedUntil = Date.now() + duration;
    this.blockedIPs.set(ip, blockedUntil);
    console.log(`[RATE-LIMIT] Auto-blocked IP: ${ip} until ${new Date(blockedUntil).toISOString()}`);
  }

  isPublicIP(ip) {
    if (!ip || ip === 'unknown') return false;
    if (/^10\./.test(ip)) return false;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return false;
    if (/^192\.168\./.test(ip)) return false;
    if (/^127\./.test(ip)) return false;
    if (/^169\.254\./.test(ip)) return false;
    if (ip === '::1') return false;
    if (/^::ffff:127\./.test(ip)) return false;
    if (/^fe80:/i.test(ip)) return false;
    if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return false;
    return true;
  }

  /**
   * Check if IP is blocked
   */
  isBlocked(ip) {
    if (!this.blockedIPs.has(ip)) return false;

    const blockedUntil = this.blockedIPs.get(ip);
    const now = Date.now();

    if (now >= blockedUntil) {
      // Block expired, remove it
      this.blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  /**
   * Manually unblock an IP
   */
  unblockIP(ip) {
    this.blockedIPs.delete(ip);
    console.log(`[RATE-LIMIT] Unblocked IP: ${ip}`);
  }

  /**
   * Get statistics for monitoring
   */
  getStats() {
    const now = Date.now();

    return {
      totalTrackedIPs: this.requests.size,
      blockedIPs: Array.from(this.blockedIPs.entries()).map(([ip, until]) => ({
        ip,
        blockedUntil: new Date(until).toISOString(),
        remainingMs: until - now
      })),
      topRequesters: this.getTopRequesters(10)
    };
  }

  /**
   * Get top requesters
   */
  getTopRequesters(limit = 10) {
    const aggregated = new Map();

    for (const [key, record] of this.requests.entries()) {
      const ip = key.split(':')[0];
      const current = aggregated.get(ip) || { count: 0, violations: 0 };
      current.count += record.count;
      current.violations += record.violations;
      aggregated.set(ip, current);
    }

    return Array.from(aggregated.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([ip, data]) => ({ ip, ...data }));
  }

  /**
   * Destroy (cleanup BoundedMap timers)
   */
  destroy() {
    this.requests.destroy();
    this.blockedIPs.destroy();
  }
}

// Singleton instance
const requestRateLimiter = new RequestRateLimiter();

export default requestRateLimiter;
