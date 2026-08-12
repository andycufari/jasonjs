/**
 * App Context for Site Functions
 *
 * Builds the `app` object handed to every site function. This is the
 * framework's API promise: db, auth, env, cache, ai, email, billing,
 * analytics, CURL, response helpers, utilities.
 *
 * Open-source runtime notes (vs the legacy multi-tenant execution engine):
 * - siteId := domain everywhere. Single-tenant, trusted code.
 * - Quota checks removed (email/webhook/cache quotas were Studio infra).
 * - app.cache backed by core/utils/cache.js (same API as the old tenantCache).
 * - app.worker is a stub: background jobs require the CM64 addon (.cm64/).
 *
 * @module core/functions/appContext
 */

import { getEnv, getSettings } from '@/core/sites/files';
import Database from '@/core/db';
import { sanitizeData } from '@/core/security/sanitize';
import { createServerAI } from '@/core/app/ai-server';
import { createCache, CacheTTL } from '@/core/utils/cache';
import { getEmailService } from '@/core/services/email';
import appLog, { setSiteContext } from '@/core/utils/appLog';
import analyticsTracker from '@/core/services/tracking/analytics';
import axios from 'axios';

// ============================================
// External HTTP (app.CURL) — SSRF-safe fetch
// ============================================

/**
 * Check if hostname is an internal/private IP address
 */
function isInternalIP(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }

  const ipv4Regex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
  const match = hostname.match(ipv4Regex);

  if (match) {
    const [, a, b] = match.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
  }

  if (hostname.includes(':')) {
    if (hostname.toLowerCase().startsWith('fc') || hostname.toLowerCase().startsWith('fd')) {
      return true;
    }
    if (hostname.toLowerCase().startsWith('fe80')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if URL is a cloud metadata endpoint
 */
function isCloudMetadataEndpoint(url) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('169.254.169.254')) return true;
  if (lowerUrl.includes('metadata.google.internal')) return true;
  return false;
}

/**
 * Secure CURL implementation with domain allowlist
 * Allowed domains come from settings.allowedExternalDomains
 */
async function simpleCURL(url, params = {}, method = 'GET', auth = null, settings = {}) {
  try {
    const urlObj = new URL(url);

    if (isInternalIP(urlObj.hostname)) {
      throw new Error('Direct IP addresses are not allowed. Please use domain names and add them to your allowed domains list.');
    }

    if (isCloudMetadataEndpoint(url)) {
      throw new Error('Access to cloud metadata endpoints is not allowed for security reasons');
    }

    if (urlObj.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs are allowed for security reasons');
    }

    const allowedDomains = settings.allowedExternalDomains || [];

    if (allowedDomains.length === 0) {
      throw new Error('No external domains configured. Add allowed domains to your site settings under "allowedExternalDomains"');
    }

    const isAllowed = allowedDomains.some(domain => {
      if (domain.startsWith('*.')) {
        const baseDomain = domain.slice(2);
        return urlObj.hostname.endsWith(baseDomain);
      }
      return urlObj.hostname === domain;
    });

    if (!isAllowed) {
      throw new Error(
        `Domain "${urlObj.hostname}" is not in the allowed domains list. ` +
        `Current allowed domains: ${allowedDomains.join(', ')}. ` +
        `Add it to your site settings to use this API.`
      );
    }

    const internalPatterns = [
      /\.local$/, /\.internal$/, /\.lan$/, /^localhost/,
      /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./
    ];

    for (const pattern of internalPatterns) {
      if (pattern.test(urlObj.hostname)) {
        throw new Error(`Domain "${urlObj.hostname}" appears to be an internal domain and is not allowed`);
      }
    }

  } catch (error) {
    if (error instanceof TypeError) {
      return { response: null, status: null, error: 'Invalid URL format' };
    }
    return { response: null, status: null, error: error.message };
  }

  const config = {
    method: method.toUpperCase(),
    url: url,
    headers: { 'User-Agent': 'JasonJS-Framework/1.0' },
    timeout: 30000,
    maxRedirects: 5,
  };

  if (auth) {
    if (typeof auth === 'string') {
      config.headers['Authorization'] = `Bearer ${auth}`;
    } else if (auth.username && auth.password) {
      config.auth = auth;
    } else if (auth.token) {
      config.headers['Authorization'] = `Bearer ${auth.token}`;
    }
  }

  if (['POST', 'PUT', 'PATCH'].includes(config.method)) {
    config.data = params;
  } else {
    config.params = params;
  }

  try {
    const response = await axios(config);
    return { response: response.data, status: response.status, error: null };
  } catch (error) {
    return {
      response: error.response ? error.response.data : null,
      status: error.response ? error.response.status : null,
      error: error.message
    };
  }
}

// ============================================
// Status codes
// ============================================

/**
 * Convert string status codes to HTTP status numbers
 */
export function convertStatusToHttpCode(status) {
  if (typeof status === 'number') {
    return status >= 100 && status < 600 ? status : 200;
  }

  if (typeof status === 'string') {
    const statusMap = {
      'OK': 200, 'SUCCESS': 200, 'CREATED': 201, 'ACCEPTED': 202, 'NO_CONTENT': 204,
      'BAD_REQUEST': 400, 'INVALID': 400, 'AUTH': 401, 'UNAUTHORIZED': 401,
      'FORBIDDEN': 403, 'NOT_FOUND': 404, 'METHOD_NOT_ALLOWED': 405, 'CONFLICT': 409,
      'VALIDATION_ERROR': 422, 'TOO_MANY_REQUESTS': 429, 'ERROR': 500,
      'INTERNAL_ERROR': 500, 'SERVER_ERROR': 500, 'NOT_IMPLEMENTED': 501,
      'BAD_GATEWAY': 502, 'SERVICE_UNAVAILABLE': 503, 'GATEWAY_TIMEOUT': 504
    };
    return statusMap[status.toUpperCase()] || 200;
  }

  return 200;
}

// ============================================
// app.cache — per-site cache (same API the old tenantCache exposed,
// minus quotas; backed by core/utils/cache.js, Redis-aware)
// ============================================

const CACHE_LIMITS = {
  MAX_TTL_SECONDS: 3600,        // 1 hour max
  DEFAULT_TTL_SECONDS: 300,     // 5 minutes default
  MAX_VALUE_SIZE: 100 * 1024,   // 100 KB
  MAX_KEY_LENGTH: 256,
  KEY_PATTERN: /^[a-zA-Z0-9_:.]+$/
};

function getSiteCacheInstance() {
  return createCache('SiteCache', {
    ttl: CacheTTL.DEFAULT,
    respectDevMode: false, // function cache should work in dev mode
    maxSize: 10000,
    keyPrefix: 'site'
  });
}

function sanitizeCacheKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Cache key must be a non-empty string');
  }
  if (key.length > CACHE_LIMITS.MAX_KEY_LENGTH) {
    throw new Error(`Cache key exceeds maximum length of ${CACHE_LIMITS.MAX_KEY_LENGTH} characters`);
  }
  if (!CACHE_LIMITS.KEY_PATTERN.test(key)) {
    throw new Error('Cache key contains invalid characters. Allowed: a-z, A-Z, 0-9, _, :, .');
  }
  return key.toLowerCase();
}

function validateAndSerializeCacheValue(value) {
  if (value === undefined) {
    throw new Error('Cannot cache undefined value');
  }
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error('Cache value must be JSON serializable');
  }
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');
  if (sizeBytes > CACHE_LIMITS.MAX_VALUE_SIZE) {
    throw new Error(`Cache value exceeds maximum size of ${CACHE_LIMITS.MAX_VALUE_SIZE / 1024} KB (actual: ${(sizeBytes / 1024).toFixed(1)} KB)`);
  }
  return serialized;
}

function validateCacheTTL(ttlSeconds) {
  let ttl = Number(ttlSeconds);
  if (!Number.isFinite(ttl) || ttl <= 0) ttl = CACHE_LIMITS.DEFAULT_TTL_SECONDS;
  ttl = Math.min(ttl, CACHE_LIMITS.MAX_TTL_SECONDS);
  return ttl * 1000;
}

/**
 * Create a site-scoped cache API (get/set/delete/has/ttl/status)
 * @param {string} siteId - Site identifier (the domain in OSS mode)
 */
export function createSiteCache(siteId) {
  if (!siteId) {
    throw new Error('siteId is required for site cache');
  }

  const normalizedSiteId = siteId.toString().toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cache = getSiteCacheInstance();
  const fullKey = (userKey) => `${normalizedSiteId}:${userKey}`;

  return {
    get: async (key) => {
      try {
        const value = await cache.get(fullKey(sanitizeCacheKey(key)));
        return value;
      } catch (error) {
        console.error(`[SiteCache] Get error for site ${normalizedSiteId}:`, error.message);
        return null;
      }
    },

    set: async (key, value, ttlSeconds) => {
      try {
        const sanitizedKey = sanitizeCacheKey(key);
        const serialized = validateAndSerializeCacheValue(value);
        const ttlMs = validateCacheTTL(ttlSeconds);
        await cache.set(fullKey(sanitizedKey), JSON.parse(serialized), ttlMs);
        return true;
      } catch (error) {
        if (error.message.includes('Cache')) throw error;
        console.error(`[SiteCache] Set error for site ${normalizedSiteId}:`, error.message);
        return false;
      }
    },

    delete: async (key) => {
      try {
        const count = await cache.invalidate(fullKey(sanitizeCacheKey(key)));
        return count > 0;
      } catch (error) {
        console.error(`[SiteCache] Delete error for site ${normalizedSiteId}:`, error.message);
        return false;
      }
    },

    has: async (key) => {
      try {
        const value = await cache.get(fullKey(sanitizeCacheKey(key)));
        return value !== null && value !== undefined;
      } catch (error) {
        console.error(`[SiteCache] Has error for site ${normalizedSiteId}:`, error.message);
        return false;
      }
    },

    ttl: async (key) => {
      try {
        const value = await cache.get(fullKey(sanitizeCacheKey(key)));
        if (value === null || value === undefined) return null;
        return -1; // exists, but backend doesn't expose TTL
      } catch (error) {
        console.error(`[SiteCache] TTL error for site ${normalizedSiteId}:`, error.message);
        return null;
      }
    },

    // Quotas were removed in the open-source runtime; kept for API compatibility
    status: () => ({ unlimited: true, quotas: null })
  };
}

// ============================================
// createAppContext — the `app` object
// ============================================

/**
 * Create the app object for function execution
 *
 * @param {Object} options
 * @param {string} options.domain - Site domain (required; siteId := domain)
 * @param {string} options.functionName - Function being executed
 * @param {Object} options.params - Merged request params
 * @param {Object} options.session - Auth session (or null)
 * @param {string} options.source - 'http' | 'server' | 'internal' | 'trigger'
 * @param {string} options.method - HTTP method
 * @param {Object} options.request - Raw request object (http source only)
 * @param {boolean} options.isStudioRequest - Studio IDE request flag
 * @param {Object} options.databaseConfig - Pre-loaded database config
 * @param {Object} options.settings - Pre-loaded site settings
 */
export async function createAppContext({
  domain,
  functionName,
  params = {},
  session = null,
  source = 'http',
  method = 'POST',
  request = null,
  isStudioRequest = false,
  databaseConfig = {},
  settings = {}
}) {
  // In the open-source runtime, the site identifier IS the domain
  const siteId = domain;

  // Set logging context
  setSiteContext(siteId, domain, session?.user?.id || null, functionName, { source, method });

  // Database setup
  const contextParams = {
    siteId,
    domain,
    userId: session?.user?.id || null,
    session: session ? { user: session.user } : null,
    serverSideAccess: true
  };
  const database = new Database(databaseConfig, {}, contextParams);

  const databaseAPI = {
    ...database,
    use(databaseId, role = null) {
      return database.use(databaseId, role);
    }
  };

  // Pending log promises (flushed after the function returns)
  const pendingLogs = [];

  // AI module
  const ai = createServerAI({
    domain,
    userId: session?.user?.id || null,
    user: session?.user || null
  });

  // Site-scoped cache
  const siteCache = createSiteCache(siteId);

  return {
    // HTTP-specific (only available for source='http')
    request: source === 'http' ? request : undefined,

    params,
    method,
    source, // 'http', 'server', 'internal', 'trigger'

    db: databaseAPI,
    database: databaseAPI,
    ai,
    cache: siteCache,

    // ===== SITE ENVIRONMENT VARIABLES =====
    env: {
      async get(varName, defaultValue = null) {
        if (!varName || typeof varName !== 'string') {
          throw new Error('Environment variable name must be a non-empty string');
        }
        return await getEnv(domain, varName, defaultValue);
      },
      async all() {
        const envContent = await getSettings(domain, '.env');
        return envContent || {};
      },
      async has(varName) {
        const value = await getEnv(domain, varName);
        return value !== null && value !== undefined;
      }
    },

    // ===== AUTHENTICATION CONTEXT =====
    auth: {
      user: session?.user || null,
      isAuthenticated: !!session?.user,
      isStudioRequest: isStudioRequest,
      userRoles: session?.user?.roles || [session?.user?.role].filter(Boolean) || [],
      hasRole: (roles) => {
        if (!session?.user) return false;
        if (!Array.isArray(roles)) roles = [roles];
        const userRoles = session.user.roles || [session.user.role].filter(Boolean);
        return roles.some(role => userRoles.includes(role));
      },
      get isAdmin() {
        return this.hasRole(['admin']);
      },

      // User management functions
      createUser: async (userData, checkExisting = true) => {
        const { createUser: createUserLib, getUserByEmail, getUserByUsername } = await import('@/core/auth/lib');

        if (!userData.email) {
          throw new Error('Email is required to create a user');
        }

        const cleanUserData = { ...userData };
        delete cleanUserData.siteId;
        delete cleanUserData._id;
        delete cleanUserData.id;

        if (checkExisting) {
          const existingUser = await getUserByEmail(cleanUserData.email, siteId);
          if (existingUser) {
            return existingUser;
          }
        }

        let username = cleanUserData.username;
        if (!username) {
          username = cleanUserData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
          if (username.length < 3) {
            username = username + Math.random().toString(36).substring(2, 5);
          }
          const existingByUsername = await getUserByUsername(username, siteId);
          if (existingByUsername) {
            username = username + Math.random().toString(36).substring(2, 5);
          }
        }

        const user = await createUserLib({
          name: cleanUserData.name,
          email: cleanUserData.email.toLowerCase(),
          username: username.toLowerCase(),
          password: cleanUserData.password,
          role: cleanUserData.role || 'user',
          emailVerified: cleanUserData.emailVerified || false,
          ...Object.keys(cleanUserData).reduce((acc, key) => {
            if (!['name', 'email', 'username', 'password', 'role', 'emailVerified', 'siteId', '_id', 'id'].includes(key)) {
              acc[key] = cleanUserData[key];
            }
            return acc;
          }, {}),
          siteId: siteId
        });

        return user;
      },

      getUserByEmail: async (email) => {
        const { getUserByEmail } = await import('@/core/auth/lib');
        return await getUserByEmail(email, siteId);
      },

      getUserByUsername: async (username) => {
        const { getUserByUsername } = await import('@/core/auth/lib');
        return await getUserByUsername(username, siteId);
      },

      getUserById: async (userId) => {
        const { getUserById } = await import('@/core/auth/lib');
        return await getUserById(userId, siteId);
      },

      countUsers: async (filter = {}) => {
        const { countUsers } = await import('@/core/auth/lib');
        return await countUsers(siteId, filter);
      },

      getUsers: async (options = {}) => {
        const { getUsers } = await import('@/core/auth/lib');
        return await getUsers(siteId, options);
      }
    },

    sanitizeData,
    CURL: (url, curlParams = {}, curlMethod = 'GET', auth = null) => {
      return simpleCURL(url, curlParams, curlMethod, auth, settings);
    },

    // ===== LOGGING =====
    log: (message, type = 'info') => {
      pendingLogs.push(appLog(message, type));
    },

    // Internal: pending log promises for flushing
    _pendingLogs: pendingLogs,

    // ===== RESPONSE HELPERS =====
    return: (data, statusCode = 200, options = {}) => {
      const numericStatus = convertStatusToHttpCode(statusCode);
      // Support raw content types (text/plain, text/html, etc.)
      if (options.contentType) {
        return { __STATUS__: numericStatus, __CONTENT_TYPE__: options.contentType, __RAW_BODY__: data };
      }
      const sanitizedData = sanitizeData(data);
      // Wrap primitives so the spread operator doesn't break them
      if (typeof sanitizedData !== 'object' || sanitizedData === null) {
        return { __STATUS__: numericStatus, data: sanitizedData };
      }
      return { __STATUS__: numericStatus, ...sanitizedData };
    },

    response: (data, statusCode = 200, options = {}) => {
      const numericStatus = convertStatusToHttpCode(statusCode);
      if (options.contentType) {
        return { __STATUS__: numericStatus, __CONTENT_TYPE__: options.contentType, __RAW_BODY__: data };
      }
      const sanitizedData = sanitizeData(data);
      if (typeof sanitizedData !== 'object' || sanitizedData === null) {
        return { __STATUS__: numericStatus, data: sanitizedData };
      }
      return { __STATUS__: numericStatus, ...sanitizedData };
    },

    // ===== ANALYTICS =====
    trackEvent: async (event, properties = {}) => {
      try {
        await analyticsTracker.track(
          domain,
          event,
          { ...properties, $serverSide: true, $functionContext: true },
          session?.user?.id || null
        );
        return { success: true, event, siteId };
      } catch (error) {
        console.error('Function analytics tracking failed:', error);
        return { success: false, event, error: error.message };
      }
    },

    // ===== SERVER-TO-SERVER FUNCTION CALLS =====
    functions: {
      call: async (name, callParams = {}, options = {}) => {
        // Lazy import to avoid circular dependency (run.js imports this module)
        const { runFunction } = await import('./run.js');
        return runFunction(domain, name, {
          params: callParams,
          session,
          method: options.method || 'POST',
          source: 'internal',
          databaseConfig,
          settings
        });
      }
    },

    // ===== UTILITIES NAMESPACE =====
    utils: {
      generateSlug: (title) => {
        let slug = title.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '');
        const timestamp = Date.now().toString(36);
        return `${slug.slice(0, 50)}-${timestamp}`;
      },

      sendEmail: async (options = {}) => {
        try {
          const emailService = getEmailService();
          const theme = settings.theme || {};

          const result = await emailService.send(domain, { ...options, theme });

          return { ...result, siteId };
        } catch (error) {
          console.error(
            `[sendEmail] Failed — site=${siteId} domain=${domain} function=${functionName}: ${error.message}`,
            error?.stack
          );
          return { success: false, error: error.message, siteId, domain, functionName };
        }
      },

      uploadFile: async (fileData, path = 'uploads', options = {}) => {
        const { filename } = options;
        if (!fileData) {
          throw new Error('File data is required');
        }
        const fileKey = `${siteId}/${path}/${Date.now()}_${filename || 'file'}`;
        console.log(`Uploading file ${fileKey} for site ${siteId}`);
        return {
          success: true,
          fileKey,
          url: `/api/assets/${fileKey}`,
          uploadedAt: new Date().toISOString(),
          siteId
        };
      },

      generatePDF: async (template, data = {}) => {
        if (!template) {
          throw new Error('PDF template is required');
        }
        const pdfKey = `${siteId}/pdfs/${Date.now()}_${template}.pdf`;
        console.log(`Generating PDF ${pdfKey} for site ${siteId}`);
        return {
          success: true,
          pdfKey,
          url: `/api/assets/${pdfKey}`,
          template,
          generatedAt: new Date().toISOString(),
          siteId
        };
      },

      sendWebhook: async (url, data = {}, options = {}) => {
        const { method: webhookMethod = 'POST' } = options;

        if (!url) {
          throw new Error('Webhook URL is required');
        }

        console.log(`Sending webhook to ${url} for site ${siteId}`);

        try {
          const response = await simpleCURL(url, data, webhookMethod, null, settings);
          return {
            success: response.status >= 200 && response.status < 300,
            url,
            method: webhookMethod,
            status: response.status,
            response: response.response,
            sentAt: new Date().toISOString(),
            siteId
          };
        } catch (error) {
          return {
            success: false,
            url,
            error: error.message,
            sentAt: new Date().toISOString(),
            siteId
          };
        }
      },

      optimizeImage: async (imageKey, options = {}) => {
        const { width, height, quality = 75, format } = options;

        if (!imageKey) {
          throw new Error('Image key is required');
        }

        if (!imageKey.startsWith(`${siteId}/`)) {
          throw new Error('Access denied: Image does not belong to your site');
        }

        const optimizedKey = `${imageKey}_optimized`;
        console.log(`Optimizing image ${imageKey} for site ${siteId}`);

        return {
          success: true,
          originalKey: imageKey,
          optimizedKey,
          url: `/api/assets/${optimizedKey}`,
          dimensions: { width, height },
          quality,
          format,
          optimizedAt: new Date().toISOString(),
          siteId
        };
      }
    },

    // ===== BILLING API =====
    billing: {
      async getStatus() {
        if (!session?.user?.id) {
          return null;
        }

        const { getActiveSubscription, getUserPlan } = await import('@/core/services/billing/subscription.js');
        const billingConfig = await import('@/core/services/billing/config.js')
          .then(m => m.getBillingConfig(domain))
          .catch(() => null);

        const subscription = await getActiveSubscription(siteId, session.user.id);

        if (!subscription) {
          return { plan: 'free', status: 'none' };
        }

        if (billingConfig) {
          const planDetails = await getUserPlan(siteId, session.user.id, billingConfig);
          return {
            plan: planDetails?.id || subscription.planId || 'unknown',
            status: subscription.status,
            ...planDetails
          };
        }

        return {
          plan: subscription.planId || 'unknown',
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
        };
      },

      async hasPlan(planId) {
        if (!session?.user?.id) {
          return false;
        }
        const { hasPlan } = await import('@/core/services/billing/subscription.js');
        return hasPlan(siteId, session.user.id, planId);
      },

      async hasFeature(feature) {
        if (!session?.user?.id) {
          return false;
        }
        const { hasFeature } = await import('@/core/services/billing/subscription.js');
        const { getBillingConfig } = await import('@/core/services/billing/config.js');
        const billingConfig = await getBillingConfig(domain).catch(() => null);

        if (!billingConfig) {
          return false;
        }

        return hasFeature(siteId, session.user.id, feature, billingConfig);
      }
    },

    // ===== WORKER API (background jobs — CM64 addon only) =====
    worker: {
      async emit() {
        throw new Error('app.worker requires the CM64 addon (.cm64/) — background jobs are not available in the open-source runtime yet');
      },
      async call() {
        throw new Error('app.worker requires the CM64 addon (.cm64/) — background jobs are not available in the open-source runtime yet');
      }
    }
  };
}
