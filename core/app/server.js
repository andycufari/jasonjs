// core/app/server.js
// Server-side app implementation

import Database from '../db';
import { calculateDistance, formatCoordinates, getBoundingBox } from '../utils/geospatial';
import { getCDNUrl, getOptimizedCDNUrl, getThumbnailUrl, getResponsiveImageUrls, isCDNConfigured, getCDNBaseUrl } from '../assets/cdnHelper';
import eventBus from '../services/eventBus';

/**
 * Create server-side app instance
 * Limited to server-safe operations (no UI, browser APIs)
 */
export function createAppServer(serverContext = {}) {
  const {
    domainConfig = {},
    params = {},
    context = {},
    session = null
  } = serverContext;

  // Internal state
  let currentDb = null;

  // Database wrapper - server-side implementation
  const database = {
    // Core database operations
    use(databaseId) {
      currentDb = new Database(domainConfig, params, context);
      currentDb.select(databaseId);
      return currentDb; // Return the actual Database instance for consistent API
    },

    // Query operations - auto-create database if needed
    async query(filters = {}) {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.query(filters);
    },

    async fetch(query = {}) {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.fetch(query);
    },

    async create(data) {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.create(data);
    },

    async update(id, data) {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.update(id, data);
    },

    async delete(id) {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.delete(id);
    },

    async getById(id) {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.getById(id);
    },

    // Real-time subscriptions (server-side)
    async subscribe(filters, callback) {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.subscribe(filters, callback);
    },

    // Geospatial queries
    async nearBy(field, coordinates, maxDistance, minDistance = null) {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.nearBy(field, coordinates, maxDistance, minDistance);
    },

    // Query builder shortcuts
    where(field, value) {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.query({ [field]: value });
    },

    orderBy(field, direction = 'asc') {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.query().orderBy(field, direction);
    },

    limit(count) {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.query().limit(count);
    },

    skip(count) {
      if (!currentDb) {
        currentDb = new Database(domainConfig, params, context);
        currentDb.select('default');
      }
      return currentDb.query().skip(count);
    }
  };

  // UI utilities - server-side stubs (no-ops)
  const ui = {
    async confirm(message, options = {}) {
      console.warn('app.ui.confirm() is not available on the server');
      return false;
    },

    async alert(message, options = {}) {
      console.warn('app.ui.alert() is not available on the server');
    },

    toast(message, options = {}) {
      console.warn('app.ui.toast() is not available on the server');
    },

    loading(show = true) {
      console.warn('app.ui.loading() is not available on the server');
    },

    theme: {
      toggle() {
        console.warn('app.ui.theme.toggle() is not available on the server');
      },
      set(theme) {
        console.warn('app.ui.theme.set() is not available on the server');
      },
      get current() {
        return 'light'; // Default theme on server
      }
    }
  };

  // Authentication - server-side methods
  const auth = {
    get user() {
      return session?.user || null;
    },

    get isAuthenticated() {
      return !!session?.user;
    },

    get isLoading() {
      return false; // No loading state on server
    },

    hasRole(role) {
      const user = session?.user;
      if (!user) return false;
      const roles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
      return roles.includes(role);
    },

    async signIn(provider = 'credentials', options = {}) {
      console.warn('app.auth.signIn() should be called on the client');
      throw new Error('Server-side sign in not supported');
    },

    async signOut() {
      console.warn('app.auth.signOut() should be called on the client');
      throw new Error('Server-side sign out not supported');
    },

    redirectToLogin(returnUrl) {
      console.warn('app.auth.redirectToLogin() is not available on the server');
    },

    async refreshSession() {
      console.warn('app.auth.refreshSession() is not available on the server');
    }
  };

  // Functions and AI - server-side can execute directly
  const functions = {
    async call(functionName, params = {}, options = {}) {
      try {
        // Server-side function execution via the native ES module runner
        const domain = context?.domain || context?.host || context?.siteId;
        if (!domain) {
          throw new Error(`Cannot execute function '${functionName}': no domain in server context`);
        }

        const cleanName = functionName.replace(/[^a-zA-Z0-9/_-]/g, '');
        const { runFunction } = await import('../functions/run.js');

        return await runFunction(domain, cleanName, {
          params,
          session,
          method: options.method || 'POST',
          source: 'server',
          // Only pass a pre-loaded config if we actually have one;
          // otherwise let runFunction load it fresh for the domain
          databaseConfig: (domainConfig && Object.keys(domainConfig).length > 0) ? domainConfig : null
        });
      } catch (error) {
        console.error(`Error executing function '${functionName}':`, error);
        throw error;
      }
    },

    async ai(prompt, options = {}) {
      // Server-side AI calls (direct to API)
      const aiModule = await import('../services/ai');
      return aiModule.complete(prompt, options);
    },

    async execute(code, execContext = {}) {
      console.warn('app.functions.execute() should be used with caution on the server');
      // Server-side code execution is dangerous - should be limited or disabled
      throw new Error('Dynamic code execution disabled on server for security');
    }
  };

  // Browser - server-side stubs
  const browser = {
    location: {
      async get(options = {}) {
        console.warn('app.browser.location.get() is not available on the server');
        return null;
      },

      watch(callback, options = {}) {
        console.warn('app.browser.location.watch() is not available on the server');
        return null;
      },

      get coords() {
        return null;
      }
    },

    device: {
      os: { name: 'Server', version: '1.0' },
      browser: { name: 'Node.js', version: process.version },
      screen: { width: 0, height: 0 }
    },

    async network() {
      return {
        ip: '127.0.0.1',
        isOnline: true,
        connection: 'server'
      };
    },

    get locale() {
      return {
        language: 'en-US',
        languages: ['en-US'],
        country: 'US',
        timezone: 'UTC'
      };
    }
  };

  // Storage - server-side file operations
  const storage = {
    // File operations using S3 service
    async upload(fileData, options = {}) {
      try {
        const s3Service = await import('../services/storage/s3');

        // Determine siteId from context
        const siteId = context.siteId || context.startupId || 'default';

        if (!siteId) {
          throw new Error('Site ID required for file upload');
        }

        // Handle different file input formats
        let fileName, fileType, fileBuffer;

        if (fileData instanceof Buffer) {
          // Raw buffer - need filename and type from options
          fileName = options.fileName || 'upload-' + Date.now();
          fileType = options.fileType || 'application/octet-stream';
          fileBuffer = fileData;
        } else if (typeof fileData === 'object' && fileData.buffer) {
          // File object with buffer
          fileName = fileData.name || options.fileName || 'upload-' + Date.now();
          fileType = fileData.type || options.fileType || 'application/octet-stream';
          fileBuffer = fileData.buffer;
        } else if (typeof fileData === 'string') {
          // Base64 string
          fileName = options.fileName || 'upload-' + Date.now();
          fileType = options.fileType || 'application/octet-stream';
          fileBuffer = Buffer.from(fileData, 'base64');
        } else {
          throw new Error('Invalid file data format');
        }

        // Generate pre-signed URL
        const uploadData = await s3Service.generatePresignedUrl(
          siteId,
          fileName,
          fileType,
          {
            path: options.path || 'uploads',
            maxSize: options.maxSize || 10 * 1024 * 1024,
            allowedTypes: options.allowedTypes || ['*/*']
          }
        );

        // For server-side, we can upload directly to S3
        // This would require additional S3 upload implementation
        // For now, return the upload URL for client-side upload
        return {
          success: true,
          uploadUrl: uploadData.uploadUrl,
          publicUrl: uploadData.publicUrl,
          key: uploadData.key,
          fileName,
          fileType,
          size: fileBuffer.length
        };

      } catch (error) {
        console.error('Server-side file upload error:', error);
        throw error;
      }
    },

    async getUrl(key, options = {}) {
      try {
        const s3Service = await import('../services/storage/s3');
        const siteId = context.siteId || context.startupId || 'default';

        return s3Service.getOptimizedUrl(siteId, key, options);
      } catch (error) {
        console.error('Error getting file URL:', error);
        throw error;
      }
    },

    async delete(key) {
      try {
        const s3Service = await import('../services/storage/s3');
        const siteId = context.siteId || context.startupId || 'default';

        return await s3Service.deleteFile(siteId, key);
      } catch (error) {
        console.error('Error deleting file:', error);
        return false;
      }
    },

    async list(prefix = '', options = {}) {
      try {
        const s3Service = await import('../services/storage/s3');
        const siteId = context.siteId || context.startupId || 'default';

        return await s3Service.listTenantFiles(siteId, { prefix, ...options });
      } catch (error) {
        console.error('Error listing files:', error);
        return { files: [], nextContinuationToken: null, isTruncated: false };
      }
    },

    async exists(key) {
      try {
        const s3Service = await import('../services/storage/s3');
        const siteId = context.siteId || context.startupId || 'default';

        return await s3Service.checkS3ObjectExists(process.env.S3_BUCKET_NAME, `${siteId}/${key}`);
      } catch (error) {
        console.error('Error checking file existence:', error);
        return false;
      }
    },

    async copy(sourceKey, destKey) {
      try {
        const s3Service = await import('../services/storage/s3');
        const siteId = context.siteId || context.startupId || 'default';

        const sourcePath = `${siteId}/${sourceKey}`;
        const destPath = `${siteId}/${destKey}`;

        return await s3Service.copyS3Object(
          process.env.S3_BUCKET_NAME,
          sourcePath,
          process.env.S3_BUCKET_NAME,
          destPath
        );
      } catch (error) {
        console.error('Error copying file:', error);
        return false;
      }
    },

    // Key-value storage (for non-file data)
    async get(key) {
      // Could integrate with server-side storage (Redis, etc.)
      console.warn('app.storage.get() not implemented for server-side key-value storage');
      return null;
    },

    async set(key, value, ttl) {
      console.warn('app.storage.set() not implemented for server-side key-value storage');
    },

    async remove(key) {
      console.warn('app.storage.remove() not implemented for server-side key-value storage');
    },

    async clear() {
      console.warn('app.storage.clear() not implemented for server-side key-value storage');
    },

    get local() {
      console.warn('localStorage is not available on the server');
      return {};
    },

    get session() {
      console.warn('sessionStorage is not available on the server');
      return {};
    }
  };

  // Analytics - server-side tracking
  const analytics = {
    async track(event, properties = {}) {
      // Server-side analytics tracking
      console.log('Analytics track (server):', event, properties);
      // Could integrate with server-side analytics service
    },

    async identify(userId, traits = {}) {
      console.log('Analytics identify (server):', userId, traits);
    },

    async page(name, properties = {}) {
      console.log('Analytics page (server):', name, properties);
    },

    async group(groupId, traits = {}) {
      console.log('Analytics group (server):', groupId, traits);
    }
  };

  // Cache - server-side caching
  const cache = {
    _cache: new Map(), // Simple in-memory cache for server

    get(key) {
      const item = this._cache.get(key);
      if (item && item.expires > Date.now()) {
        return item.value;
      } else if (item) {
        this._cache.delete(key);
      }
      return null;
    },

    set(key, value, ttl = 300000) { // 5 minutes default
      this._cache.set(key, {
        value,
        expires: Date.now() + ttl
      });
    },

    has(key) {
      return this.get(key) !== null;
    },

    delete(key) {
      return this._cache.delete(key);
    },

    clear() {
      this._cache.clear();
    },

    stats() {
      return {
        totalItems: this._cache.size,
        hitRate: 0, // Would need tracking
        totalSize: 0 // Would need calculation
      };
    }
  };

  // Context information - server-side
  const contextObj = {
    get params() {
      return params || {};
    },

    get searchParams() {
      return params || {};
    },

    get pathname() {
      return context.pathname || '/';
    },

    get domain() {
      return context.domain || 'localhost';
    },

    get siteId() {
      return context.siteId || null;
    },

    get userId() {
      return session?.user?.id || null;
    },

    get env() {
      // Server has access to all env vars
      return process.env;
    }
  };

  // Utility functions - same as client
  const utils = {
    formatDate(date, format = 'YYYY-MM-DD') {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    },

    formatCurrency(amount, currency = 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }).format(amount);
    },

    formatNumber(number, options = {}) {
      return new Intl.NumberFormat('en-US', options).format(number);
    },

    calculateDistance,
    formatCoordinates,
    getBoundingBox,

    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    throttle(func, wait) {
      let inThrottle;
      return function executedFunction(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, wait);
        }
      };
    },

    generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    validateEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    validatePhone(phone) {
      return /^[\+]?[1-9][\d]{0,15}$/.test(phone.replace(/\s/g, ''));
    }
  };

  // Client-side URL creation helpers (same as client but using server-side CDN detection)
  const helpers = {
    /**
     * Create optimized asset URL with CDN support
     * @param {string} assetPath - Asset path (can be full URL or relative path)
     * @param {Object} options - Optimization options
     * @returns {string} Optimized URL
     */
    createAssetUrl(assetPath, options = {}) {
      if (!assetPath) return '';

      // If already a full URL (http/https), return as-is or apply CDN optimization
      if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
        // Check if it's an S3 URL that can be converted to CDN
        return getCDNUrl(assetPath);
      }

      // For relative paths, build asset URL
      const cleanPath = assetPath.startsWith('/') ? assetPath.substring(1) : assetPath;

      // Check if CDN is configured
      const cdnBaseUrl = getCDNBaseUrl();
      if (cdnBaseUrl) {
        return getOptimizedCDNUrl(`${cdnBaseUrl}/${cleanPath}`, options);
      }

      // Fallback to local asset serving
      const baseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL || '';
      const fullUrl = baseUrl ? `${baseUrl}/${cleanPath}` : `/assets/${cleanPath}`;

      // Add optimization parameters if supported
      if (Object.keys(options).length > 0) {
        const params = new URLSearchParams();
        if (options.width) params.set('w', options.width.toString());
        if (options.height) params.set('h', options.height.toString());
        if (options.quality) params.set('q', options.quality.toString());
        if (options.format) params.set('f', options.format);
        if (options.fit) params.set('fit', options.fit);

        const queryString = params.toString();
        if (queryString) {
          return `${fullUrl}?${queryString}`;
        }
      }

      return fullUrl;
    },

    /**
     * Create CDN URL from S3 URL or asset path
     * @param {string} s3UrlOrPath - S3 URL or asset path
     * @param {string} s3Key - Optional S3 key
     * @returns {string} CDN URL or original URL
     */
    createCDNUrl(s3UrlOrPath, s3Key = null) {
      return getCDNUrl(s3UrlOrPath, s3Key);
    },

    /**
     * Create thumbnail URL with default settings
     * @param {string} assetPath - Asset path or URL
     * @param {Object} options - Thumbnail options
     * @returns {string} Thumbnail URL
     */
    createThumbnailUrl(assetPath, options = {}) {
      if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
        return getThumbnailUrl(assetPath, options);
      }

      const fullUrl = this.createAssetUrl(assetPath);
      return getThumbnailUrl(fullUrl, options);
    },

    /**
     * Create responsive image URLs for different screen sizes
     * @param {string} assetPath - Asset path or URL
     * @param {Array} sizes - Array of widths
     * @param {Object} options - Base optimization options
     * @returns {Object} Object with responsive URLs and srcSet
     */
    createResponsiveUrls(assetPath, sizes = [400, 800, 1200, 1600], options = {}) {
      if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
        return getResponsiveImageUrls(assetPath, sizes, options);
      }

      const fullUrl = this.createAssetUrl(assetPath);
      return getResponsiveImageUrls(fullUrl, sizes, options);
    },

    /**
     * Get CDN base URL
     * @returns {string|null} CDN base URL
     */
    getCDNBaseUrl() {
      return getCDNBaseUrl();
    },

    /**
     * Check if CDN is configured
     * @returns {boolean} True if CDN is available
     */
    isCDNEnabled() {
      return isCDNConfigured();
    }
  };

  // Events - Inter-component communication (same as client)
  const events = {
    /**
     * Emit data to a channel
     * @param {string} channel - Channel name (e.g., 'user.login', 'cart.update')
     * @param {any} data - Data to emit
     * @param {Object} options - Emit options
     * @returns {number} Number of listeners that received the event
     */
    emit(channel, data, options = {}) {
      return eventBus.emit(channel, data, options);
    },

    /**
     * Subscribe to a channel
     * @param {string} channelPattern - Channel pattern (supports wildcards: 'user.*')
     * @param {Function} callback - Callback function
     * @param {Object} options - Subscription options
     * @returns {Function} Unsubscribe function
     */
    on(channelPattern, callback, options = {}) {
      return eventBus.on(channelPattern, callback, options);
    },

    /**
     * Subscribe to a channel (one-time only)
     * @param {string} channelPattern - Channel pattern
     * @param {Function} callback - Callback function
     * @param {Object} options - Subscription options
     * @returns {Function} Unsubscribe function
     */
    once(channelPattern, callback, options = {}) {
      return eventBus.once(channelPattern, callback, options);
    },

    /**
     * Unsubscribe from a channel
     * @param {string} channelPattern - Channel pattern
     * @param {Function} callback - Callback function to remove
     * @returns {boolean} True if listener was removed
     */
    off(channelPattern, callback) {
      return eventBus.off(channelPattern, callback);
    },

    /**
     * Clear all listeners for a channel pattern
     * @param {string} channelPattern - Channel pattern (optional, clears all if not provided)
     * @returns {boolean} True if listeners were cleared
     */
    clear(channelPattern) {
      return eventBus.clear(channelPattern);
    },

    /**
     * Get the last emitted data for a channel
     * @param {string} channel - Exact channel name
     * @returns {any|null} Last emitted data or null
     */
    getLastEvent(channel) {
      return eventBus.getLastEvent(channel);
    },

    /**
     * Get list of active channels
     * @returns {Array<string>} Array of channel patterns
     */
    getChannels() {
      return eventBus.getChannels();
    },

    /**
     * Get event bus statistics
     * @returns {Object} EventBus statistics
     */
    getStats() {
      return eventBus.getStats();
    },

    /**
     * Configure the event bus
     * @param {Object} config - Configuration options
     */
    configure(config) {
      return eventBus.configure(config);
    },

    /**
     * Enable/disable debug mode
     * @param {boolean} enabled - Debug enabled
     */
    setDebug(enabled) {
      return eventBus.setDebug(enabled);
    }
  };

  // Create the server-side app object
  const app = {
    db: database,
    ui,
    auth,
    functions,
    browser,
    storage,
    analytics,
    cache,
    context: contextObj,
    utils,
    helpers, // Server-side URL creation helpers
    events // Inter-component communication
  };

  // Addon extension support via Proxy
  // Allows addons to add new namespaces to app (e.g., app.web3)
  const loadedAddons = new Map();
  let addonRegistry = null;

  const appProxy = new Proxy(app, {
    get(target, prop) {
      // Return existing properties first
      if (prop in target) {
        return target[prop];
      }

      // Skip internal symbols and common non-addon properties
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') {
        return undefined;
      }

      // Check if this is an addon namespace
      // Lazy-load the registry only when needed
      if (!addonRegistry) {
        try {
          const { getAddonRegistry } = require('../addons/index.js');
          addonRegistry = getAddonRegistry();
        } catch (e) {
          // Addon registry not available yet
          return undefined;
        }
      }

      // Check if addon has server extension for this namespace
      if (addonRegistry.hasServerExtension(prop)) {
        // Return already-loaded addon
        if (loadedAddons.has(prop)) {
          return loadedAddons.get(prop);
        }

        // Return a lazy-loading proxy that loads the addon on first method call
        const lazyAddon = new Proxy({}, {
          get(_, methodName) {
            // Handle special cases
            if (methodName === 'then' || typeof methodName === 'symbol') {
              return undefined;
            }

            // Return async method that loads the addon first
            return async (...args) => {
              // Load the addon if not already loaded
              if (!loadedAddons.has(prop)) {
                const addonContext = {
                  events,
                  auth,
                  db: database,
                  storage,
                  context: contextObj,
                  session
                };

                const extension = await addonRegistry.loadServerExtension(prop, addonContext);
                if (extension) {
                  loadedAddons.set(prop, extension);
                  // Also cache on the app object for direct access
                  target[prop] = extension;
                }
              }

              const addon = loadedAddons.get(prop);
              if (!addon || typeof addon[methodName] !== 'function') {
                throw new Error(`Method ${String(methodName)} not found on app.${String(prop)}`);
              }

              return addon[methodName](...args);
            };
          }
        });

        return lazyAddon;
      }

      return undefined;
    },

    has(target, prop) {
      if (prop in target) return true;

      // Check addon registry
      if (!addonRegistry) {
        try {
          const { getAddonRegistry } = require('../addons/index.js');
          addonRegistry = getAddonRegistry();
        } catch (e) {
          return false;
        }
      }

      return addonRegistry.hasServerExtension(prop);
    }
  });

  return appProxy;
}