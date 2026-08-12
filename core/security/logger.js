// core/security/logger.js
// Security logging system - separates security events from application logs
// Edge Runtime compatible - uses console logging only

class SecurityLogger {
  constructor() {
    this.logDir = process.env.SECURITY_LOG_DIR || '/opt/jasonjs/logs/security';
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.minLogLevel = process.env.SECURITY_LOG_LEVEL || 'warn'; // info, warn, critical

    // Detect Edge Runtime (Next.js middleware runs in Edge)
    // Check for Edge Runtime indicators without using Node.js APIs
    this.isEdgeRuntime = typeof EdgeRuntime !== 'undefined' ||
                         globalThis.navigator?.userAgent?.includes('Next.js Middleware') ||
                         typeof global.EdgeRuntime !== 'undefined';

    // Only attempt fs operations if NOT in Edge Runtime
    if (!this.isEdgeRuntime) {
      // Lazy load fs and path only when needed (server-side)
      this.fs = null;
      this.path = null;

      // Create log directory if it doesn't exist (only in production)
      if (!this.isDevelopment) {
        try {
          // Dynamic import for Node.js modules
          this.fs = require('fs');
          this.path = require('path');

          if (!this.fs.existsSync(this.logDir)) {
            this.fs.mkdirSync(this.logDir, { recursive: true });
          }
        } catch (error) {
          // Silently fail in Edge Runtime - console logging only
          this.isEdgeRuntime = true;
        }
      }
    }
  }

  /**
   * Format log entry as structured JSON
   */
  formatEntry(level, event, data) {
    return {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...data,
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Write to log file (production only, Node.js runtime only)
   */
  writeToFile(entry) {
    // Skip file writing in Edge Runtime or development
    if (this.isEdgeRuntime || this.isDevelopment || !this.fs || !this.path) {
      return;
    }

    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = this.path.join(this.logDir, `security-${date}.log`);
      const logLine = JSON.stringify(entry) + '\n';

      this.fs.appendFileSync(logFile, logLine, { flag: 'a' });
    } catch (error) {
      // Silently fail - console logging is still active
    }
  }

  /**
   * Log info level event
   */
  info(event, data = {}) {
    const entry = this.formatEntry('info', event, data);

    if (this.isDevelopment) {
      console.log('[SECURITY-INFO]', event, data);
    }

    this.writeToFile(entry);
  }

  /**
   * Format a compact one-line summary for console output (full detail goes to file)
   */
  formatCompact(event, data) {
    const parts = [event];
    if (data.host) parts.push(`@${data.host}`);
    if (data.ip) parts.push(data.ip);
    if (data.method) parts.push(data.method);
    if (data.path) parts.push(data.path);
    if (data.reason) parts.push(`— ${data.reason}`);
    if (data.threatLevel) parts.push(`[${data.threatLevel}]`);
    return parts.join(' ');
  }

  /**
   * Log warning level event (potential threats)
   */
  warn(event, data = {}) {
    const entry = this.formatEntry('warn', event, data);

    console.warn(`[SECURITY-WARN] ${this.formatCompact(event, data)}`);
    this.writeToFile(entry);
  }

  /**
   * Log critical level event (active attacks)
   */
  critical(event, data = {}) {
    const entry = this.formatEntry('critical', event, data);

    console.error(`[SECURITY-CRITICAL] ${this.formatCompact(event, data)}`);
    this.writeToFile(entry);

    // In production, you could integrate with alerting systems here
    // e.g., send to Sentry, PagerDuty, Slack, etc.
  }

  /**
   * Build the common request context every security log entry needs.
   * - Always tags `host` so we can tell which site the event belongs to.
   * - When IP can't be resolved, attaches a `headersDump` so we can find
   *   where the real client IP actually lives in the request.
   */
  buildRequestContext(req) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'unknown';
    const ip = this.extractIP(req);

    const ctx = {
      host,
      ip,
      path: req.nextUrl.pathname,
      method: req.method,
      userAgent: req.headers.get('user-agent') || 'unknown'
    };

    if (ip === 'unknown') {
      // Dump everything that could plausibly contain the real client IP so
      // we can fix the resolver instead of guessing.
      ctx.headersDump = {
        'cf-connecting-ip': req.headers.get('cf-connecting-ip'),
        'true-client-ip': req.headers.get('true-client-ip'),
        'x-real-ip': req.headers.get('x-real-ip'),
        'x-forwarded-for': req.headers.get('x-forwarded-for'),
        'x-forwarded-host': req.headers.get('x-forwarded-host'),
        'x-forwarded-proto': req.headers.get('x-forwarded-proto'),
        'forwarded': req.headers.get('forwarded'),
        'host': req.headers.get('host'),
        'reqIp': req.ip
      };
    }

    return ctx;
  }

  /**
   * Log blocked request
   */
  logBlockedRequest(req, reason, metadata = {}) {
    this.warn('request_blocked', {
      ...this.buildRequestContext(req),
      reason,
      query: Object.fromEntries(req.nextUrl.searchParams),
      ...metadata
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(req, reason, severity = 'warn', metadata = {}) {
    const logMethod = severity === 'critical' ? 'critical' : 'warn';

    this[logMethod]('suspicious_activity', {
      ...this.buildRequestContext(req),
      reason,
      query: Object.fromEntries(req.nextUrl.searchParams),
      ...metadata
    });
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimit(req, limit, metadata = {}) {
    this.warn('rate_limit_exceeded', {
      ...this.buildRequestContext(req),
      limit,
      ...metadata
    });
  }

  /**
   * Log honeypot trigger
   */
  logHoneypot(req, endpoint, metadata = {}) {
    this.critical('honeypot_triggered', {
      ...this.buildRequestContext(req),
      endpoint,
      query: Object.fromEntries(req.nextUrl.searchParams),
      ...metadata
    });
  }

  /**
   * Extract a trustworthy public client IP. Walks all sources and returns the
   * first PUBLIC address — falls back to 'unknown' if none qualify, which
   * triggers buildRequestContext() to dump headers for diagnosis.
   */
  extractIP(req) {
    const xff = req.headers.get('x-forwarded-for');
    const candidates = [
      req.headers.get('cf-connecting-ip'),
      req.headers.get('true-client-ip'),
      req.headers.get('x-real-ip'),
      ...(xff ? xff.split(',').map(s => s.trim()) : []),
      req.ip
    ].filter(Boolean);

    for (const ip of candidates) {
      if (this.isPublicIP(ip)) return ip;
    }
    return 'unknown';
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
   * Get security statistics (for monitoring dashboard)
   */
  getStats() {
    // This could read from log files and return aggregated stats
    // For now, return placeholder
    return {
      message: 'Stats not implemented yet - check log files',
      logDir: this.logDir
    };
  }
}

// Singleton instance
const securityLogger = new SecurityLogger();

export default securityLogger;
