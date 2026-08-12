// core/security/threatDetection.js
// Pattern detection for malicious requests

/**
 * Known exploit patterns and malicious request detection
 */
class ThreatDetector {
  constructor() {
    // Known malicious path patterns (common exploits)
    this.exploitPaths = [
      // Spring Boot Actuator exploits
      /\/actuator\/(env|health|metrics|dump|heapdump|threaddump|trace|loggers|auditevents|mappings|configprops)/i,
      /\/jolokia\/(exec|read|write|search|list|version)/i,
      /\/artemis\/(actuator|admin|console)/i,

      // Path traversal attempts
      /\.\.\/\.\.\//,  // ../ directory traversal
      /\.\.\\\.\.\\/, // ..\ windows traversal
      /\%2e\%2e\%2f/i, // URL encoded ../
      /\%252e\%252e\%252f/i, // Double URL encoded ../

      // File inclusion attempts
      /\/(windows|winnt|system32|etc|passwd|shadow|hosts)/i,
      /\/win\.ini/i,
      /\/etc\/(passwd|shadow|hosts|group)/i,
      /\/proc\/(self|version|cpuinfo|meminfo)/i,

      // Common vulnerability scans
      /\/(admin|administrator|manage|manager|console|control|portal)/i,
      /\/phpmyadmin/i,
      /\/wp-admin/i,
      /\/wp-login/i,
      /\/xmlrpc\.php/i,
      /\/config\.(php|json|yml|yaml|xml)/i,
      /\/\.env/i,
      /\/\.git/i,

      // API endpoint scans
      /\/api\/(v[0-9]+\/)?(admin|internal|debug|test)/i,

      // Log file access attempts
      /\/log\/view/i,
      /\/(logs|log)\/(error|access|debug|system)/i,

      // Shell/command execution
      /\/shell/i,
      /\/cmd/i,
      /\/exec/i,
      /\/console/i,

      // Database access attempts
      /\/db\/(admin|console|phpmyadmin)/i,
      /\/mysql/i,
      /\/mongodb/i,

      // Backup file scans
      /\/(backup|bak|old|test|temp|tmp)\.(sql|tar|gz|zip|rar)/i,

      // Jenkins/CI exploits
      /\/jenkins/i,
      /\/hudson/i
    ];

    // Suspicious query parameters
    this.suspiciousParams = [
      'filename',
      'file',
      'path',
      'base',
      'dir',
      'folder',
      'root',
      'cmd',
      'command',
      'exec',
      'execute',
      'system',
      'shell',
      'debug',
      'eval',
      'assert',
      'include',
      'require',
      'import'
    ];

    // Known malicious IP patterns (can be updated dynamically)
    this.blockedIPs = new Set([
      // Add known malicious IPs here
      // '18.233.109.105', // Example from logs - AWS scanner
    ]);

    // IP ranges (CIDR notation support would go here)
    this.blockedRanges = [];

    // User agent patterns (known attack/scanner tools only)
    // NOTE: curl and wget are NOT included — they are used by
    // legitimate webhooks, health checks, monitoring, and APIs
    this.suspiciousUserAgents = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
      /nessus/i,
      /openvas/i,
      /acunetix/i,
      /burp/i,
      /metasploit/i,
      /havij/i,
      /zgrab/i,
      /shodan/i,
      /censys/i,
      /dirbuster/i,
      /gobuster/i,
      /wfuzz/i,
      /ffuf/i,
      /nuclei/i
    ];
  }

  /**
   * Check if path contains known exploits
   */
  isExploitPath(pathname) {
    return this.exploitPaths.some(pattern => pattern.test(pathname));
  }

  /**
   * Check if request has suspicious query parameters
   */
  hasSuspiciousParams(searchParams) {
    for (const param of searchParams.keys()) {
      if (this.suspiciousParams.includes(param.toLowerCase())) {
        // Extra check: if the value contains path traversal patterns
        const value = searchParams.get(param);
        if (value && (
          value.includes('../') ||
          value.includes('..\\') ||
          value.includes('/etc/') ||
          value.includes('c:\\') ||
          value.includes('/windows/')
        )) {
          return {
            suspicious: true,
            param,
            value,
            reason: 'path_traversal_in_param'
          };
        }
      }
    }
    return { suspicious: false };
  }

  /**
   * Check if IP is blocked
   */
  isBlockedIP(ip) {
    return this.blockedIPs.has(ip);
  }

  /**
   * Check if user agent is suspicious
   */
  isSuspiciousUserAgent(userAgent) {
    if (!userAgent) return false;
    return this.suspiciousUserAgents.some(pattern => pattern.test(userAgent));
  }

  /**
   * Comprehensive threat analysis
   */
  analyzeRequest(req) {
    const threats = [];
    const pathname = req.nextUrl.pathname;
    const searchParams = req.nextUrl.searchParams;
    const userAgent = req.headers.get('user-agent') || '';
    const ip = this.extractIP(req);

    // Check for exploit paths
    if (this.isExploitPath(pathname)) {
      threats.push({
        type: 'exploit_path',
        severity: 'high',
        detail: `Known exploit path pattern detected: ${pathname}`
      });
    }

    // Check for suspicious parameters
    const paramCheck = this.hasSuspiciousParams(searchParams);
    if (paramCheck.suspicious) {
      threats.push({
        type: 'suspicious_param',
        severity: 'high',
        detail: `Suspicious parameter: ${paramCheck.param}=${paramCheck.value}`,
        reason: paramCheck.reason
      });
    }

    // Check blocked IPs
    if (this.isBlockedIP(ip)) {
      threats.push({
        type: 'blocked_ip',
        severity: 'critical',
        detail: `Request from blocked IP: ${ip}`
      });
    }

    // Check user agent — known attack tools get blocked (high severity)
    if (this.isSuspiciousUserAgent(userAgent)) {
      threats.push({
        type: 'suspicious_user_agent',
        severity: 'high',
        detail: `Suspicious user agent: ${userAgent}`
      });
    }

    // Calculate overall threat level
    const maxSeverity = threats.length > 0
      ? Math.max(...threats.map(t => this.severityToNumber(t.severity)))
      : 0;

    return {
      isThreat: threats.length > 0,
      threatLevel: this.numberToSeverity(maxSeverity),
      threats,
      shouldBlock: maxSeverity >= 3 // Block high and critical
    };
  }

  /**
   * Add IP to blocklist. Refuses infra/private IPs — banning the ALB or a
   * VPC address would 403 every legitimate user behind it.
   */
  blockIP(ip) {
    if (!this.isPublicIP(ip)) return;
    this.blockedIPs.add(ip);
    console.log(`[THREAT-DETECTION] Added IP to blocklist: ${ip}`);
  }

  /**
   * Remove IP from blocklist
   */
  unblockIP(ip) {
    this.blockedIPs.delete(ip);
    console.log(`[THREAT-DETECTION] Removed IP from blocklist: ${ip}`);
  }

  /**
   * Get current blocklist
   */
  getBlocklist() {
    return Array.from(this.blockedIPs);
  }

  /**
   * Extract a trustworthy public client IP. Walks every source and returns
   * the first public address — falls back to 'unknown' if none qualify, so
   * downstream blockIP() can't accidentally blacklist infra.
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

  /**
   * Reject anything that isn't a routable public IP — private ranges,
   * loopback, link-local, IPv6 ULAs.
   */
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
   * Severity mapping
   */
  severityToNumber(severity) {
    const map = { low: 1, medium: 2, high: 3, critical: 4 };
    return map[severity] || 0;
  }

  numberToSeverity(num) {
    const map = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };
    return map[num] || 'none';
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      blockedIPsCount: this.blockedIPs.size,
      exploitPatternsCount: this.exploitPaths.length,
      suspiciousParamsCount: this.suspiciousParams.length,
      userAgentPatternsCount: this.suspiciousUserAgents.length
    };
  }
}

// Singleton instance
const threatDetector = new ThreatDetector();

export default threatDetector;
