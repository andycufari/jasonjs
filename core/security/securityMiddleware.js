// core/security/securityMiddleware.js
// Main security middleware - coordinates all security checks

import { NextResponse } from 'next/server';
import BoundedMap from '../utils/BoundedMap.js';
import securityLogger from './logger.js';
import requestRateLimiter from './requestRateLimit.js';
import threatDetector from './threatDetection.js';

/**
 * Security configuration
 */
const config = {
  enabled: process.env.SECURITY_MIDDLEWARE_ENABLED !== 'false', // Enabled by default
  blockThreats: process.env.SECURITY_BLOCK_THREATS !== 'false', // Block by default
  honeypotEnabled: process.env.SECURITY_HONEYPOT_ENABLED !== 'false',
  logOnly: process.env.SECURITY_LOG_ONLY === 'true' // Set to true to only log, not block
};

/**
 * Cross-cutting security warning tracker.
 * Counts ALL security events (rate limits, threats, honeypots) per IP.
 * Auto-bans after threshold regardless of which check triggered.
 */
class SecurityBanTracker {
  constructor() {
    this.warnings = new BoundedMap({ maxSize: 20000, ttl: 3600000 });
    this.banned = new BoundedMap({ maxSize: 10000, ttl: 7200000 });

    // Config
    this.threshold = parseInt(process.env.SECURITY_BAN_THRESHOLD, 10) || 10;
    this.banDuration = parseInt(process.env.SECURITY_BAN_DURATION_MS, 10) || 60 * 60 * 1000; // 1 hour
  }

  /**
   * Record a security warning for an IP. Returns true if the IP was just banned.
   */
  record(ip, event) {
    // Refuse to count warnings against unknown or non-public IPs.
    // Private/infra IPs (ALB, VPC, health checks) can be shared by many real
    // users — banning one would 403 everyone behind it.
    if (!isPublicIP(ip)) return false;

    // Already banned — skip counting
    if (this.isBanned(ip)) return false;

    const record = this.warnings.get(ip) || { count: 0, firstSeen: Date.now(), events: [] };
    record.count++;
    // Keep last 5 event types for diagnostics
    if (record.events.length < 5) record.events.push(event);
    this.warnings.set(ip, record);

    if (record.count >= this.threshold) {
      this.ban(ip, record);
      return true;
    }
    return false;
  }

  ban(ip, record) {
    // Final guard: never persist a ban for an infra/unknown IP, even if a
    // caller bypassed record(). Banning the ALB or a private IP takes the
    // whole site down.
    if (!isPublicIP(ip)) return;

    const until = Date.now() + this.banDuration;
    this.banned.set(ip, { until, reason: 'security_warnings', count: record?.count || 0, events: record?.events || [] });
    this.warnings.delete(ip);

    // Also propagate to rate limiter and threat detector so all layers block
    requestRateLimiter.blockIP(ip, this.banDuration);
    threatDetector.blockIP(ip);

    securityLogger.critical('auto_banned_ip', {
      ip,
      warningCount: record?.count || 0,
      events: record?.events || [],
      bannedUntil: new Date(until).toISOString(),
      duration: `${Math.round(this.banDuration / 60000)}min`
    });
  }

  isBanned(ip) {
    const entry = this.banned.get(ip);
    if (!entry) return false;
    if (Date.now() >= entry.until) {
      this.banned.delete(ip);
      return false;
    }
    return true;
  }

  getBanInfo(ip) {
    return this.banned.get(ip) || null;
  }

  getStats() {
    return {
      trackedIPs: this.warnings.size,
      bannedIPs: this.banned.size,
      threshold: this.threshold,
      banDuration: `${Math.round(this.banDuration / 60000)}min`
    };
  }
}

const banTracker = new SecurityBanTracker();

/**
 * Main security middleware function
 * Call this from your Next.js middleware
 */
export async function securityMiddleware(request) {
  // Skip if disabled
  if (!config.enabled) {
    return null;
  }

  const { pathname, searchParams } = request.nextUrl;
  const ip = extractIP(request);

  // Smart exemptions - skip rate limiting for system endpoints
  const isExempt = (
    pathname.startsWith('/api/auth/callback/') ||  // OAuth callbacks
    pathname === '/api/auth/session' ||             // Session checks
    pathname === '/api/auth/csrf' ||                // CSRF tokens
    request.method === 'OPTIONS'                    // Preflight requests
  );

  if (isExempt) {
    return null; // Skip all security checks for exempt endpoints
  }

  // 0. Check if IP is already banned by security warning tracker
  if (banTracker.isBanned(ip)) {
    return new NextResponse(
      JSON.stringify({ error: 'Forbidden', message: 'Request blocked by security policy' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 1. Check rate limiting first (fastest check)
  const rateLimitResult = requestRateLimiter.check(ip, getRateLimitType(pathname));

  if (!rateLimitResult.allowed) {
    securityLogger.logRateLimit(request, rateLimitResult);
    banTracker.record(ip, 'rate_limit');

    if (!config.logOnly) {
      return createRateLimitResponse(rateLimitResult);
    }
  }

  // 2. Threat detection
  const threatAnalysis = threatDetector.analyzeRequest(request);

  if (threatAnalysis.isThreat) {
    // Log the threat
    const severity = threatAnalysis.threatLevel === 'critical' || threatAnalysis.threatLevel === 'high'
      ? 'critical'
      : 'warn';

    securityLogger.logSuspiciousActivity(
      request,
      `Threat detected: ${threatAnalysis.threats.map(t => t.type).join(', ')}`,
      severity,
      {
        threatLevel: threatAnalysis.threatLevel,
        threats: threatAnalysis.threats
      }
    );

    // Record security warning — high/critical threats count double
    const weight = (threatAnalysis.threatLevel === 'critical' || threatAnalysis.threatLevel === 'high') ? 2 : 1;
    for (let i = 0; i < weight; i++) {
      banTracker.record(ip, `threat_${threatAnalysis.threatLevel}`);
    }

    // Block if configured and threat level is high enough
    if (config.blockThreats && threatAnalysis.shouldBlock && !config.logOnly) {
      securityLogger.logBlockedRequest(request, 'threat_detected', {
        threatLevel: threatAnalysis.threatLevel,
        threats: threatAnalysis.threats
      });

      // Rate limit suspicious activity more aggressively
      requestRateLimiter.check(ip, 'suspicious');

      return createThreatResponse(threatAnalysis);
    }
  }

  // 3. Check for honeypot endpoints
  if (config.honeypotEnabled && isHoneypotEndpoint(pathname)) {
    securityLogger.logHoneypot(request, pathname, {
      searchParams: Object.fromEntries(searchParams)
    });

    // Honeypot hits are high-signal — count as 3 warnings
    banTracker.record(ip, 'honeypot');
    banTracker.record(ip, 'honeypot');
    banTracker.record(ip, 'honeypot');

    // Auto-block IPs that hit honeypots repeatedly
    const honeypotRate = requestRateLimiter.check(ip, 'suspicious');

    if (!honeypotRate.allowed) {
      threatDetector.blockIP(ip);
    }

    // Return fake response to waste attacker's time
    return createHoneypotResponse(pathname);
  }

  // All checks passed
  return null;
}

/**
 * Determine rate limit type based on path
 */
function getRateLimitType(pathname) {
  if (pathname.startsWith('/api/auth')) {
    return 'auth';
  }
  if (pathname.startsWith('/api')) {
    return 'api';
  }
  return 'general';
}

/**
 * Reject anything that isn't a routable public IP — private ranges, loopback,
 * link-local, IPv6 ULAs. These represent infra (ALB, VPC, health checks), not
 * a single client we can fairly hold accountable.
 */
function isPublicIP(ip) {
  if (!ip || ip === 'unknown') return false;
  if (/^10\./.test(ip)) return false;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return false;
  if (/^192\.168\./.test(ip)) return false;
  if (/^127\./.test(ip)) return false;
  if (/^169\.254\./.test(ip)) return false;
  if (ip === '::1') return false;
  if (/^::ffff:127\./.test(ip)) return false;
  if (/^fe80:/i.test(ip)) return false;
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return false; // fc00::/7 ULA
  return true;
}

/**
 * Extract a trustworthy public client IP. Walks every available source and
 * returns the first PUBLIC address found. Returns 'unknown' if none qualify —
 * record() will skip 'unknown', so we never ban an infra IP by mistake.
 */
function extractIP(req) {
  const xff = req.headers.get('x-forwarded-for');
  const candidates = [
    req.headers.get('cf-connecting-ip'),
    req.headers.get('true-client-ip'),
    req.headers.get('x-real-ip'),
    ...(xff ? xff.split(',').map(s => s.trim()) : []),
    req.ip
  ].filter(Boolean);

  for (const ip of candidates) {
    if (isPublicIP(ip)) return ip;
  }
  return 'unknown';
}

/**
 * Check if path is a honeypot
 */
function isHoneypotEndpoint(pathname) {
  const honeypots = [
    '/actuator/env',
    '/actuator/health',
    '/jolokia/list',
    '/jolokia/exec',
    '/artemis/actuator',
    '/admin/console',
    '/phpmyadmin',
    '/wp-admin',
    '/wp-login.php',
    '/.env',
    '/.git/config'
  ];

  return honeypots.some(trap => pathname.startsWith(trap));
}

/**
 * Create rate limit response
 */
function createRateLimitResponse(rateLimitResult) {
  const retryAfter = Math.ceil(rateLimitResult.resetIn / 1000);

  return new NextResponse(
    JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please slow down.',
      retryAfter: `${retryAfter} seconds`
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + rateLimitResult.resetIn).toISOString()
      }
    }
  );
}

/**
 * Create threat response
 */
function createThreatResponse(threatAnalysis) {
  return new NextResponse(
    JSON.stringify({
      error: 'Forbidden',
      message: 'Request blocked by security policy'
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-Security-Threat-Level': threatAnalysis.threatLevel
      }
    }
  );
}

/**
 * Create honeypot response (fake data to waste scanner time)
 */
function createHoneypotResponse(pathname) {
  // Return different fake responses based on what they're looking for
  let fakeData = {};

  if (pathname.includes('actuator') || pathname.includes('jolokia')) {
    // Fake Spring Boot Actuator response
    fakeData = {
      status: 'UP',
      components: {
        db: { status: 'UP' },
        diskSpace: { status: 'UP' },
        ping: { status: 'UP' }
      }
    };
  } else if (pathname.includes('env')) {
    // Fake environment variables (nothing sensitive)
    fakeData = {
      JAVA_HOME: '/usr/lib/jvm/java-11',
      PATH: '/usr/local/bin:/usr/bin:/bin',
      NODE_ENV: 'production'
    };
  } else {
    // Generic fake 404
    return new NextResponse('Not Found', { status: 404 });
  }

  // Add artificial delay to waste scanner time (500ms)
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(new NextResponse(JSON.stringify(fakeData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Powered-By': 'Spring Boot', // Fake header to confuse scanners
          'Server': 'Apache-Coyote/1.1'
        }
      }));
    }, 500);
  });
}

/**
 * Get security statistics (for monitoring dashboard)
 */
export function getSecurityStats() {
  return {
    config,
    rateLimit: requestRateLimiter.getStats(),
    threats: threatDetector.getStats(),
    blocklist: threatDetector.getBlocklist(),
    banTracker: banTracker.getStats()
  };
}

export { banTracker };

/**
 * Manually block an IP
 */
export function blockIP(ip, duration) {
  threatDetector.blockIP(ip);
  requestRateLimiter.blockIP(ip, duration);
  securityLogger.critical('manual_ip_block', { ip, duration });
}

/**
 * Manually unblock an IP
 */
export function unblockIP(ip) {
  threatDetector.unblockIP(ip);
  requestRateLimiter.unblockIP(ip);
  securityLogger.info('manual_ip_unblock', { ip });
}

export default securityMiddleware;
