// core/sites/files.js - Unified site source abstraction (the mode seam)
// The local sites/ folder is the built-in (and only) implementation.
// A private addon (.cm64/) may register a remote adapter at boot via
// registerAdapter() — that registration is the ONLY mode switch in the system.

import { readFile, access, stat } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { defaultDomain } from './resolve.js';
import { createCache, CacheStrategy, CacheTTL } from '../utils/cache.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('FileSystem');

/**
 * Remote file source adapter interface.
 *
 * An adapter provides tenant files from a remote source (e.g. the CM64
 * studio database). When registered, every public read on the manager is
 * delegated to it; without one, the local sites/ folder is used.
 *
 * @typedef {Object} FileSystemAdapter
 * @property {(domain: string, fileClass: string, fileName: string, versionInfo?: Object|null) => Promise<string|Object|null>} getFile
 *   Raw file content for a tenant file (string, or {type, content} for pages).
 * @property {(domain: string, fileClass: string, versionInfo?: Object|null) => Promise<Array<{name: string, content: string}>>} getFilesByClass
 *   All files of a class for a domain.
 * @property {(domain: string) => Promise<Object|null>} getSite
 *   Site configuration record for a domain.
 * @property {(domain: string, fileClass: string, fileName: string) => Promise<number|null>} getFileTimestamp
 *   Lightweight last-modified timestamp (ms) for cache validation — must not read content.
 * @property {(siteId: string, deployId: string) => Promise<Object|null>} getDeployVersion
 *   Deployment/build version info (adapter-only concept; local mode has none).
 * @property {() => Promise<Object>} healthCheck
 *   Connectivity/health probe for the remote source.
 * @property {(entry: Object) => Promise<void>} [saveFunctionLog]
 *   Optional: persist a tenant function log entry ({siteId, functionName, level, message, ...}).
 * @property {(domain: string, path: string) => Promise<Object|null>} [getFileData]
 *   Optional: resolve an uploaded file by path for /api/files serving
 *   ({record, s3Url, content, metadata} or null).
 * @property {(domain: string, query: {folderPath: string, fileName: string}) => Promise<Object|null>} [getAsset]
 *   Optional: resolve a public asset record for /assets serving.
 */

/**
 * Unified File System Manager
 *
 * Single interface for tenant file reads. Local sites/ directory structure by
 * default; delegates to a registered {@link FileSystemAdapter} when present.
 * All other parts of the framework should use this instead of direct file
 * operations.
 */
// The adapter slot lives on globalThis, not on the instance: Next.js bundles
// instrumentation.js (where the addon registers) separately from route code,
// so each bundle gets its OWN module instance of this file. Instance state
// would strand the registration in the instrumentation bundle while routes
// still see null. globalThis is per-process and crosses bundle boundaries.
const ADAPTER_SLOT = Symbol.for('jasonjs.siteFiles.adapter');

class SiteFiles {
  constructor() {
    // Create filesystem cache to eliminate duplicate reads
    this.cache = createCache('FileSystem', {
      // strategy auto-detects Redis if REDIS_URL is set
      ttl: CacheTTL.FILESYSTEM,
      respectDevMode: true,
      maxSize: 500,
      keyPrefix: 'fs'
    });

    // Lightweight timestamp cache for file change detection
    // Stores { cacheKey → sourceTimestamp } to validate cached files
    // Uses stat/mtime (local) or adapter timestamps — no content reads
    this.fileTimestampCache = new Map();
  }

  /** @type {FileSystemAdapter|null} */
  get adapter() {
    return globalThis[ADAPTER_SLOT] || null;
  }

  /**
   * Register a remote file source adapter.
   * Called once at boot by a private addon; there is no other mode switch.
   *
   * @param {FileSystemAdapter} adapter - Adapter implementation
   */
  registerAdapter(adapter) {
    globalThis[ADAPTER_SLOT] = adapter;
    logger.info('File system adapter registered');
  }

  /**
   * Whether a remote adapter is registered
   * @returns {boolean}
   */
  hasAdapter() {
    return this.adapter !== null;
  }

  /**
   * Get the registered adapter (or null)
   * @returns {FileSystemAdapter|null}
   */
  getAdapter() {
    return this.adapter;
  }

  /**
   * Determine if dev mode is active (for cache bypass)
   * @param {string} domain - Domain to check dev mode for
   * @param {string|null} ipAddress - Client IP address (for security)
   * @returns {Promise<boolean>} True if in dev mode
   */
  async _isDevMode(domain, ipAddress = null) {
    // Check NODE_ENV first (instant, no Redis call)
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // Check Redis-based dev mode for this specific domain + IP
    // This prevents random visitors from disabling cache for everyone
    if (domain) {
      const { isDevModeActive } = await import('../utils/devModeCache.js');
      return await isDevModeActive(domain, ipAddress);
    }

    return false;
  }

  /**
   * Reject names/domains that could escape the sites/ tree
   * @param {string} value - Path segment to validate
   * @returns {boolean} True if safe
   * @private
   */
  _isSafeSegment(value) {
    return typeof value === 'string' &&
      value.length > 0 &&
      !value.includes('..') &&
      !value.includes('\\') &&
      !value.startsWith('/');
  }

  /**
   * Get source timestamp for a file (lightweight check for cache validation)
   * Uses stat/mtime (local) or the adapter's timestamp — never reads file content.
   *
   * @param {string} domain - Domain/site identifier
   * @param {string} fileClass - File class
   * @param {string} fileName - File name
   * @returns {Promise<number|null>} Timestamp in ms, or null
   * @private
   */
  async _getSourceTimestamp(domain, fileClass, fileName) {
    if (this.adapter) {
      return await this.adapter.getFileTimestamp(domain, fileClass, fileName);
    }
    return await this.getLocalFileTimestamp(domain, fileClass, fileName);
  }

  /**
   * Get a file from the appropriate source (with caching)
   *
   * On cache hit, performs a lightweight timestamp check (stat/mtime or adapter
   * timestamp) against the source to detect changes. If the file changed, the
   * cache entry is invalidated and fresh content is returned automatically.
   * This eliminates the need for ?dev=true to pick up file changes during development.
   *
   * @param {string} domain - Domain/site identifier
   * @param {string} fileClass - File type (page, component, css, function, setting)
   * @param {string} fileName - File name
   * @param {Object} versionInfo - Version info (adapter only)
   * @returns {Promise<string|null>} File content
   */
  async getFile(domain, fileClass, fileName, versionInfo = null) {
    // Get client IP for dev mode check (matches pageData.js pattern)
    let clientIp = null;
    try {
      const { headers } = await import('next/headers');
      const { getClientIp } = await import('../utils/getClientIp.js');
      const headersList = await headers();
      clientIp = getClientIp(headersList);
    } catch (error) {
      // Headers not available (not in request context), skip IP check
    }

    const isDev = await this._isDevMode(domain, clientIp);

    // Create cache key
    const version = versionInfo?.version || versionInfo?._id || 'latest';
    const cacheKey = this.cache.generateKey(domain, fileClass, fileName, version);

    // Log dev mode status for file operations
    if (process.env.NODE_ENV === 'development' || isDev) {
      console.log(`📁 [FileSystem] getFile()`, {
        fileClass,
        fileName,
        domain,
        isDev,
        clientIp: clientIp || 'none',
        willBypassCache: isDev
      });
    }

    // Try cache first
    const cached = await this.cache.get(cacheKey, isDev);
    if (cached !== null) {
      // Validate cache with a lightweight timestamp check (no content read)
      if (!isDev) {
        const cachedTimestamp = this.fileTimestampCache.get(cacheKey);
        const sourceTimestamp = await this._getSourceTimestamp(domain, fileClass, fileName);

        if (sourceTimestamp && cachedTimestamp && sourceTimestamp !== cachedTimestamp) {
          // File changed — invalidate and reload
          logger.info(`File changed, invalidating cache: ${fileClass}/${fileName}`, { domain });
          await this.cache.invalidate(`${domain}:${fileClass}:${fileName}`);
          this.fileTimestampCache.delete(cacheKey);
          // Fall through to re-fetch below
        } else {
          // If no timestamp stored yet (e.g. after restart with Redis cache),
          // record it now for future change detection
          if (!cachedTimestamp && sourceTimestamp) {
            this.fileTimestampCache.set(cacheKey, sourceTimestamp);
          }
          logger.debug(`Cache hit (timestamp valid): ${fileClass}/${fileName}`, { domain, version });
          return cached;
        }
      } else {
        return cached;
      }
    }

    // Cache miss - fetch from source
    let result;
    if (this.adapter) {
      result = await this.adapter.getFile(domain, fileClass, fileName, versionInfo);
    } else {
      result = await this.getLocalFile(domain, fileClass, fileName);
    }

    // Cache the result (if found)
    if (result) {
      await this.cache.set(cacheKey, result, null, isDev);

      // Store source timestamp for future change detection
      const sourceTimestamp = await this._getSourceTimestamp(domain, fileClass, fileName);
      if (sourceTimestamp) {
        this.fileTimestampCache.set(cacheKey, sourceTimestamp);
      }

      // Silent in dev mode to reduce log spam
      if (!isDev) {
        logger.debug(`Cached: ${fileClass}/${fileName}`, { domain, version });
      }
    }

    return result;
  }

  /**
   * Get all files of a specific class (mainly for settings)
   *
   * @param {string} domain - Domain/site identifier
   * @param {string} fileClass - File type
   * @param {Object} versionInfo - Version info (adapter only)
   * @returns {Promise<Array>} Array of files with name and content
   */
  async getFilesByClass(domain, fileClass, versionInfo = null) {
    if (this.adapter) {
      return await this.adapter.getFilesByClass(domain, fileClass, versionInfo);
    }
    return await this.getLocalFilesByClass(domain, fileClass);
  }

  /**
   * Get site configuration (with caching)
   *
   * @param {string} domain - Domain
   * @returns {Promise<Object|null>} Site configuration
   */
  async getSite(domain) {
    // Get client IP for dev mode check
    let clientIp = null;
    try {
      const { headers } = await import('next/headers');
      const { getClientIp } = await import('../utils/getClientIp.js');
      const headersList = await headers();
      clientIp = getClientIp(headersList);
    } catch (error) {
      // Headers not available (not in request context), skip IP check
    }

    const isDev = await this._isDevMode(domain, clientIp);

    // Create cache key
    const cacheKey = this.cache.generateKey(domain, 'site', 'config');

    // Try cache first
    const cached = await this.cache.get(cacheKey, isDev);
    if (cached !== null) {
      // Silent in dev mode to reduce log spam
      if (!isDev) {
        logger.debug(`Cache hit: site config`, { domain });
      }
      return cached;
    }

    // Cache miss - fetch from source
    let result;
    if (this.adapter) {
      result = await this.adapter.getSite(domain);
    } else {
      result = await this.getLocalSite(domain);
    }

    // Cache the result (if found)
    if (result) {
      await this.cache.set(cacheKey, result, null, isDev);
      // Silent in dev mode to reduce log spam
      if (!isDev) {
        logger.debug(`Cached: site config`, { domain });
      }
    }

    return result;
  }

  /**
   * Get page configuration with enhanced routing support
   *
   * @param {string} domain - Domain/site identifier
   * @param {string} path - Page path
   * @param {Object} settings - Settings containing routes configuration
   * @param {Object} versionInfo - Version info (adapter only)
   * @returns {Promise<Object|null>} Page configuration
   */
  async getPage(domain, path, settings = {}, versionInfo = null) {
    let params = {};
    let matchedRoute;

    // Check for matching route in settings
    if (settings.routes && typeof settings.routes === 'object') {
      const routes = Object.entries(settings.routes);
      for (const [routePath, routeConfig] of routes) {
        // Skip function routes — these are handled by middleware rewrites
        if (routeConfig && routeConfig.function) continue;
        const regex = new RegExp('^' + routePath.replace(/:\w+/g, '([^/]+)') + '$');
        if (regex.test(path)) {
          matchedRoute = { path: routePath, ...routeConfig };
          break;
        }
      }
    }

    let pageName = matchedRoute ? matchedRoute.page : this.pathToPageName(path);
    let pageContent = null;

    if (this.adapter) {
      const result = await this.adapter.getFile(domain, 'page', pageName, versionInfo);
      if (result) {
        pageContent = result;
      }
    } else {
      pageContent = await this.getLocalPageContent(domain, pageName);
    }

    // If no direct page found and no explicit route matched, try auto-detection of dynamic patterns
    if (!pageContent && !matchedRoute) {
      // Split the path into segments
      const pathSegments = path.split('/').filter(segment => segment.length > 0);

      // Try to find a matching dynamic page pattern by reducing segments and replacing with :param
      for (let i = pathSegments.length - 1; i >= 0; i--) {
        const testSegments = [...pathSegments];
        // Smart parameter naming based on position and context
        let paramName;
        if (i === pathSegments.length - 1) {
          paramName = 'slug'; // Last segment is usually 'slug'
        } else if (testSegments.includes('sobre') || testSegments.includes('de')) {
          paramName = 'category'; // Context suggests category
        } else {
          paramName = `param${i}`; // Fallback
        }
        testSegments[i] = `:${paramName}`;
        const testPageName = testSegments.join('/');

        let testContent = null;
        if (this.adapter) {
          testContent = await this.adapter.getFile(domain, 'page', testPageName, versionInfo);
        } else {
          testContent = await this.getLocalPageContent(domain, testPageName);
        }

        if (testContent) {
          pageContent = testContent;
          pageName = testPageName;

          // Extract parameters from the dynamic pattern
          const dynamicPattern = testPageName;
          const actualSegments = path.split('/').filter(segment => segment.length > 0);
          const patternSegments = dynamicPattern.split('/').filter(segment => segment.length > 0);

          // Map actual values to parameter names
          patternSegments.forEach((segment, index) => {
            if (segment.startsWith(':')) {
              const paramName = segment.slice(1);
              params[paramName] = actualSegments[index];
            }
          });
          break;
        }
      }
    }

    if (!pageContent) {
      return null;
    }

    // Extract route parameters if there's a matched route
    if (matchedRoute) {
      const routeParamNames = matchedRoute.path.match(/:\w+/g) || [];
      const routeParamValues = path.match(new RegExp(matchedRoute.path.replace(/:\w+/g, '([^/]+)')));
      if (routeParamValues) {
        routeParamNames.forEach((name, index) => {
          params[name.slice(1)] = routeParamValues[index + 1];
        });
      }
    }

    // Parse the content based on source
    let processedPage = null;
    if (this.adapter) {
      // Handle adapter content (raw string or {type, content} object)
      if (typeof pageContent === 'object' && pageContent.type && pageContent.content) {
        if (pageContent.type === 'html') {
          return {
            type: 'html',
            content: pageContent.content
          };
        } else {
          try {
            processedPage = JSON.parse(pageContent.content);
          } catch (e) {
            console.error('Error parsing JSON page content:', e);
            return null;
          }
        }
      } else {
        // Legacy behavior: if just content string was returned
        try {
          processedPage = JSON.parse(pageContent);
        } catch (e) {
          // If not JSON, check if it's HTML
          if (pageContent.trim().startsWith('<')) {
            return {
              type: 'html',
              content: pageContent
            };
          }
          return null;
        }
      }
    } else {
      // Handle local content (already parsed)
      processedPage = pageContent;
    }

    // Add parameters to the page
    if (processedPage && typeof processedPage === 'object') {
      processedPage.params = params;
    }

    return processedPage;
  }

  /**
   * Get all settings merged together (with caching)
   *
   * @param {string} domain - Domain/site identifier
   * @param {Object} versionInfo - Version info (adapter only)
   * @returns {Promise<Object>} All settings merged
   */
  async getAllSettings(domain, versionInfo = null) {
    // Discover setting names, then read each via getFile() so every entry
    // inherits the per-file timestamp-validated cache. No separate
    // all-settings cache key — writes to any setting take effect immediately.
    if (this.adapter) {
      const settingFiles = await this.adapter.getFilesByClass(domain, 'setting', versionInfo);
      const result = {};
      for (const file of settingFiles) {
        const settingName = file.name.replace(/\.json$/, '');
        try {
          const content = await this.getFile(domain, 'setting', settingName, versionInfo);
          if (!content || (typeof content === 'string' && content.trim().length === 0)) {
            logger.warn(`Skipping empty setting file: ${file.name}`, { domain });
            continue;
          }
          result[settingName] = typeof content === 'string' ? JSON.parse(content) : content;
        } catch (error) {
          logger.warn(`Skipping corrupt setting file: ${file.name} (${error.message})`, { domain });
        }
      }
      return result;
    }

    return await this.getLocalAllSettings(domain);
  }

  /**
   * Get deployment version info (adapter only — local mode has no deployments)
   *
   * @param {string} siteId - Site ID
   * @param {string} deployId - Deployment ID
   * @returns {Promise<Object|null>} Version info
   */
  async getDeployVersion(siteId, deployId) {
    if (this.adapter) {
      return await this.adapter.getDeployVersion(siteId, deployId);
    }
    // No deployments in local mode
    return null;
  }

  /**
   * Get a site component as a ready React component.
   *
   * Adapter mode: delegates to the CM64 addon's runtime component loader.
   * Local mode: native import from sites/<domain>/components/<name>.jsx —
   * the static '@sites/' prefix and '.jsx' suffix in the template literal are
   * load-bearing for webpack's context module, do not restructure them.
   *
   * @param {string} domain - Domain/site identifier
   * @param {string} name - Component name (may include subfolders)
   * @returns {Promise<Function|null>} React component, or null if not found
   */
  async getComponent(domain, name) {
    if (this.adapter) {
      const m = await import('@cm64/component-loader');
      return m.loadStudioComponent(domain, name);
    }

    if (!this._isSafeSegment(domain) || !this._isSafeSegment(name)) {
      return null;
    }

    try {
      const mod = await import(`@sites/${domain}/components/${name}.jsx`);
      return mod.default;
    } catch (error) {
      if (error?.code === 'MODULE_NOT_FOUND' || /Cannot find module/.test(error?.message || '')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get a site function module.
   *
   * Adapter mode: delegates to the CM64 addon's function runner.
   * Local mode: imports sites/<domain>/functions/<name>.js from disk with an
   * mtime cache-buster so edits are picked up without a process restart.
   *
   * @param {string} domain - Domain/site identifier
   * @param {string} name - Function name (single path segment, [a-zA-Z0-9_-] only)
   * @returns {Promise<Object|null>} Module namespace, or null if not found
   */
  async getFunction(domain, name) {
    if (this.adapter) {
      const m = await import('@cm64/function-runner');
      return m.loadStudioFunction(domain, name);
    }

    // Path-traversal guard: single safe segment only
    if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(name) || name.includes('..')) {
      return null;
    }
    if (!this._isSafeSegment(domain)) {
      return null;
    }

    const file = join(process.env.SITES_PATH || './sites', domain, 'functions', `${name}.js`);

    let fileStat;
    try {
      fileStat = await stat(file);
    } catch {
      return null;
    }

    // mtime query param keeps functions live-editable without a restart
    return await import(/* webpackIgnore: true */ pathToFileURL(file).href + '?v=' + fileStat.mtimeMs);
  }

  /**
   * Get all database configurations merged from multiple sources
   * Priority: databases/*.json (new format) > settings/database.json (legacy)
   *
   * @param {string} domain - Domain/site identifier
   * @param {Object} versionInfo - Version info (adapter only)
   * @returns {Promise<Object>} All database configs merged { dbName: {...config} }
   */
  async getAllDatabases(domain, versionInfo = null) {
    // Get client IP for dev mode check
    let clientIp = null;
    try {
      const { headers } = await import('next/headers');
      const { getClientIp } = await import('../utils/getClientIp.js');
      const headersList = await headers();
      clientIp = getClientIp(headersList);
    } catch (error) {
      // Headers not available (not in request context), skip IP check
    }

    const isDev = await this._isDevMode(domain, clientIp);

    // Create cache key
    const version = versionInfo?.version || versionInfo?._id || 'latest';
    const cacheKey = this.cache.generateKey(domain, 'all-databases', version);

    // Try cache first
    const cached = await this.cache.get(cacheKey, isDev);
    if (cached !== null) {
      if (!isDev) {
        logger.debug(`Cache hit: all databases`, { domain, version });
      }
      return cached;
    }

    // Cache miss - fetch from source
    const databases = {};

    // 1. Load from settings/database.json first (legacy, lower priority)
    const legacyDatabases = await this.getLegacyDatabases(domain, versionInfo);
    Object.assign(databases, legacyDatabases);

    // 2. Load from databases/ directory (new format, higher priority - overwrites legacy)
    const individualDatabases = await this.getIndividualDatabases(domain, versionInfo);
    Object.assign(databases, individualDatabases);

    // Cache the result
    if (Object.keys(databases).length > 0) {
      await this.cache.set(cacheKey, databases, null, isDev);
      if (!isDev) {
        logger.debug(`Cached: all databases`, { domain, version, count: Object.keys(databases).length });
      }
    }

    return databases;
  }

  /**
   * Get individual database files from databases/ directory
   * @private
   */
  async getIndividualDatabases(domain, versionInfo = null) {
    const databases = {};

    if (this.adapter) {
      // Adapter mode: get files with class='database'
      const dbFiles = await this.adapter.getFilesByClass(domain, 'database', versionInfo);

      for (const file of dbFiles) {
        try {
          const dbName = file.name.replace(/\.json$/, '');
          const config = typeof file.content === 'string' ? JSON.parse(file.content) : file.content;
          databases[dbName] = { id: dbName, ...config };
        } catch (error) {
          console.error(`Error parsing database file ${file.name}:`, error);
        }
      }
    } else {
      // Local mode: read from databases/ directory
      const dbFiles = await this.getLocalFilesByClass(domain, 'database');
      for (const file of dbFiles) {
        try {
          const config = typeof file.content === 'string' ? JSON.parse(file.content) : file.content;
          databases[file.name] = { id: file.name, ...config };
        } catch (error) {
          console.error(`Error parsing database file ${file.name}:`, error);
        }
      }
    }

    return databases;
  }

  /**
   * Get legacy database config from settings/database.json
   * @private
   */
  async getLegacyDatabases(domain, versionInfo = null) {
    try {
      let databaseSetting = null;
      let content = null;

      if (this.adapter) {
        // Adapter mode: get settings/database file
        content = await this.adapter.getFile(domain, 'setting', 'database', versionInfo);
      } else {
        // Local mode: read settings/database.json
        content = await this.getLocalFile(domain, 'setting', 'database');
      }

      if (content) {
        databaseSetting = typeof content === 'string' ? JSON.parse(content) : content;
      }

      if (databaseSetting && typeof databaseSetting === 'object') {
        // Add id to each database config if not present
        const databases = {};
        for (const [dbName, dbConfig] of Object.entries(databaseSetting)) {
          databases[dbName] = { id: dbName, ...dbConfig };
        }
        return databases;
      }
    } catch (error) {
      console.error(`Error loading legacy database settings for ${domain}:`, error);
    }

    return {};
  }

  // ===================================================================
  // LOCAL FILESYSTEM IMPLEMENTATION
  // ===================================================================

  async fileExists(filePath) {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readJsonFile(filePath) {
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading JSON file ${filePath}:`, error);
      return null;
    }
  }

  pathToPageName(path) {
    // Convert URL path to page file name
    return path === '/' ? 'index' : path.replace(/^\//, '').replace(/\/$/, '');
  }

  async getLocalFile(domain, fileClass, fileName) {
    const sitesPath = process.env.SITES_PATH || './sites';
    const sitePath = join(sitesPath, domain);

    let filePath;
    switch (fileClass) {
      case 'component':
        // Try .jsx first, then .js for components
        filePath = join(sitePath, 'components', `${fileName}.jsx`);
        if (!(await this.fileExists(filePath))) {
          filePath = join(sitePath, 'components', `${fileName}.js`);
        }
        break;
      case 'css':
        filePath = join(sitePath, 'css', `${fileName}.css`);
        break;
      case 'page':
        filePath = join(sitePath, 'pages', `${fileName}.json`);
        break;
      case 'function':
        filePath = join(sitePath, 'functions', `${fileName}.js`);
        break;
      case 'setting':
        filePath = join(sitePath, 'settings', `${fileName}.json`);
        break;
      case 'site':
        // Site configuration files at root level
        filePath = join(sitePath, `${fileName}.json`);
        break;
      case 'private':
        // Private files (system prompts, etc.) - not exposed via public API
        // Stored in sites/{domain}/private/{fileName}.md
        filePath = join(sitePath, 'private', `${fileName}.md`);
        break;
      case 'database':
        // Individual database definition files
        // Stored in sites/{domain}/databases/{fileName}.json
        filePath = join(sitePath, 'databases', `${fileName}.json`);
        break;
      default:
        return null;
    }

    if (!(await this.fileExists(filePath))) {
      return null;
    }

    return await readFile(filePath, 'utf-8');
  }

  /**
   * Get file modification timestamp from local filesystem (lightweight stat call)
   * @param {string} domain - Domain/site identifier
   * @param {string} fileClass - File class
   * @param {string} fileName - File name
   * @returns {Promise<number|null>} Timestamp in ms, or null if not found
   */
  async getLocalFileTimestamp(domain, fileClass, fileName) {
    const sitesPath = process.env.SITES_PATH || './sites';
    const sitePath = join(sitesPath, domain);

    let filePath;
    switch (fileClass) {
      case 'function':
        filePath = join(sitePath, 'functions', `${fileName}.js`);
        break;
      case 'component':
        filePath = join(sitePath, 'components', `${fileName}.jsx`);
        if (!(await this.fileExists(filePath))) {
          filePath = join(sitePath, 'components', `${fileName}.js`);
        }
        break;
      case 'page':
        filePath = join(sitePath, 'pages', `${fileName}.json`);
        break;
      case 'setting':
        filePath = join(sitePath, 'settings', `${fileName}.json`);
        break;
      case 'css':
        filePath = join(sitePath, 'css', `${fileName}.css`);
        break;
      case 'database':
        filePath = join(sitePath, 'databases', `${fileName}.json`);
        break;
      case 'private':
        filePath = join(sitePath, 'private', `${fileName}.md`);
        break;
      default:
        return null;
    }

    try {
      const fileStat = await stat(filePath);
      return fileStat.mtimeMs;
    } catch {
      return null;
    }
  }

  async getLocalFilesByClass(domain, fileClass) {
    const sitesPath = process.env.SITES_PATH || './sites';
    const sitePath = join(sitesPath, domain);
    let classPath;

    switch (fileClass) {
      case 'setting':
        classPath = join(sitePath, 'settings');
        break;
      case 'page':
        classPath = join(sitePath, 'pages');
        break;
      case 'component':
        classPath = join(sitePath, 'components');
        break;
      case 'database':
        classPath = join(sitePath, 'databases');
        break;
      case 'function':
        classPath = join(sitePath, 'functions');
        break;
      case 'css':
        classPath = join(sitePath, 'css');
        break;
      default:
        return [];
    }

    if (!(await this.fileExists(classPath))) {
      return [];
    }

    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(classPath);
      const result = [];

      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) {
          const fileName = file.replace(/\.(json|jsx|js|css)$/, '');
          const content = await this.getLocalFile(domain, fileClass, fileName);
          if (content) {
            result.push({
              name: fileName,
              content: content
            });
          }
        }
      }

      return result;
    } catch (error) {
      console.error(`Error reading files from ${classPath}:`, error);
      return [];
    }
  }

  async getLocalSite(domain) {
    const sitesPath = process.env.SITES_PATH || './sites';
    const sitePath = join(sitesPath, domain);

    // Check if site directory exists
    if (!(await this.fileExists(sitePath))) {
      return null;
    }

    // Create a site-like object for local mode
    return {
      _id: domain,
      primary_domain: domain,
      name: domain,
      mode: 'standalone',
      database: {
        enabled: false,
        source: 'local'
      },
      settings: {
        path: sitePath
      }
    };
  }

  async getLocalPageContent(domain, pageName) {
    const sitesPath = process.env.SITES_PATH || './sites';
    const sitePath = join(sitesPath, domain);

    // Try JSON file first
    let pageFile = join(sitePath, 'pages', `${pageName}.json`);

    // For root path, try index.json first, then fall back to home.json
    if (pageName === 'index' && !(await this.fileExists(pageFile))) {
      pageFile = join(sitePath, 'pages', 'home.json');
    }

    if (await this.fileExists(pageFile)) {
      return await this.readJsonFile(pageFile);
    }

    // Try HTML file
    let htmlFile = join(sitePath, 'pages', `${pageName}.html`);

    // For root path, try index.html first, then fall back to home.html
    if (pageName === 'index' && !(await this.fileExists(htmlFile))) {
      htmlFile = join(sitePath, 'pages', 'home.html');
    }

    if (await this.fileExists(htmlFile)) {
      const content = await readFile(htmlFile, 'utf-8');
      return {
        type: 'html',
        content: content
      };
    }

    return null;
  }

  async getLocalPage(domain, path) {
    // Legacy method for backward compatibility - now uses the enhanced getPage
    return await this.getPage(domain, path, {}, null);
  }

  async getLocalAllSettings(domain) {
    const sitesPath = process.env.SITES_PATH || './sites';
    const sitePath = join(sitesPath, domain);
    const settingsDir = join(sitePath, 'settings');

    const settings = {};

    try {
      // Try to read all files from settings directory
      const fs = await import('fs/promises');
      const settingsFiles = await fs.readdir(settingsDir);

      for (const file of settingsFiles) {
        if (file.endsWith('.json')) {
          const settingName = file.replace('.json', '');
          const settingContent = await this.readJsonFile(join(settingsDir, file));
          if (settingContent) {
            settings[settingName] = settingContent;
          }
        }
      }
    } catch (error) {
      // Fallback to legacy settings.json if settings directory doesn't exist
      const legacySettingsPath = join(sitePath, 'settings.json');
      if (await this.fileExists(legacySettingsPath)) {
        const legacySettings = await this.readJsonFile(legacySettingsPath);
        if (legacySettings) {
          return legacySettings;
        }
      }
    }

    return settings;
  }

  /**
   * Get environment variable value
   *
   * Reads the site's .env setting file (class='setting', name='.env').
   * Does NOT fall back to process.env — system code should use process.env
   * directly when global vars are needed.
   *
   * @param {string} domain - Domain/site identifier
   * @param {string} varName - Environment variable name
   * @param {string} defaultValue - Default value if not found
   * @returns {Promise<string|null>} Environment variable value
   */
  async getEnv(domain, varName, defaultValue = null) {
    try {
      // Try to load .env file from settings
      let envContent = null;
      if (this.adapter) {
        envContent = await this.adapter.getFile(domain, 'setting', '.env', null);
      } else {
        envContent = await this.getLocalFile(domain, 'setting', '.env');
      }

      if (envContent) {
        try {
          const envVars = JSON.parse(envContent);
          if (envVars && envVars[varName] !== undefined) {
            return envVars[varName];
          }
        } catch (error) {
          console.error(`Error parsing .env setting for ${domain}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error loading env var ${varName} for ${domain}:`, error);
    }

    // NO process.env fallback - only return site-specific env vars
    // System code should use process.env directly when global vars are needed
    return defaultValue;
  }

  /**
   * Invalidate cache for a specific domain
   * Useful when files are updated
   *
   * @param {string} domain - Domain to invalidate cache for
   * @returns {Promise<number>} Number of invalidated entries
   */
  async invalidateDomainCache(domain) {
    const count = await this.cache.invalidate(domain);
    // Also clear function timestamp entries for this domain
    for (const key of this.fileTimestampCache.keys()) {
      if (key.includes(domain)) {
        this.fileTimestampCache.delete(key);
      }
    }
    logger.info(`Invalidated ${count} cache entries for domain: ${domain}`);
    return count;
  }

  /**
   * Invalidate cache for a specific file
   *
   * @param {string} domain - Domain
   * @param {string} fileClass - File type
   * @param {string} fileName - File name
   * @returns {Promise<number>} Number of invalidated entries
   */
  async invalidateFileCache(domain, fileClass, fileName) {
    const pattern = `${domain}:${fileClass}:${fileName}`;
    const count = await this.cache.invalidate(pattern);
    // Also clear timestamp entry
    for (const key of this.fileTimestampCache.keys()) {
      if (key.includes(pattern)) {
        this.fileTimestampCache.delete(key);
      }
    }
    logger.info(`Invalidated cache for file: ${pattern}`);
    return count;
  }

  /**
   * Clear all filesystem cache
   *
   * @returns {Promise<number>} Number of cleared entries
   */
  async clearCache() {
    const count = await this.cache.clear();
    this.fileTimestampCache.clear();
    logger.info(`Cleared all filesystem cache: ${count} entries`);
    return count;
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

// Singleton instance
let fileSystemManager = null;

/**
 * Get the unified file system manager instance
 * @returns {SiteFiles} Site files manager
 */
export function getFileSystem() {
  if (!fileSystemManager) {
    fileSystemManager = new SiteFiles();
  }
  return fileSystemManager;
}

// Convenience functions that use the unified file system

/**
 * Register a remote file source adapter (called by a private addon at boot)
 * @param {FileSystemAdapter} adapter - Adapter implementation
 */
export function registerAdapter(adapter) {
  const fs = getFileSystem();
  fs.registerAdapter(adapter);
}

/**
 * Get file content from the local filesystem or the registered adapter
 */
export async function getFile(domain, fileClass, fileName, versionInfo = null) {
  const fs = getFileSystem();
  return await fs.getFile(domain, fileClass, fileName, versionInfo);
}

/**
 * Get all settings merged together
 */
export async function getAllSettings(domain, versionInfo = null) {
  const fs = getFileSystem();
  return await fs.getAllSettings(domain, versionInfo);
}

/**
 * Get a specific setting file by name
 * More efficient than getAllSettings when you only need one setting
 *
 * @param {string} domain - Domain/site identifier
 * @param {string} settingName - Setting file name (e.g., 'billing', 'auth', '.env')
 * @param {Object} versionInfo - Version info (adapter only)
 * @returns {Promise<Object|null>} Parsed setting content or null if not found
 */
export async function getSettings(domain, settingName, versionInfo = null) {
  const fs = getFileSystem();
  const content = await fs.getFile(domain, 'setting', settingName, versionInfo);

  if (!content) {
    return null;
  }

  // Parse if string, return as-is if already object
  if (typeof content === 'string') {
    try {
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error parsing setting ${settingName}:`, error);
      return null;
    }
  }

  return content;
}

/**
 * Get page configuration
 */
export async function getPage(domain, path, settings = {}, versionInfo = null) {
  const fs = getFileSystem();
  return await fs.getPage(domain, path, settings, versionInfo);
}

/**
 * Get site configuration
 */
export async function getSite(domain) {
  const fs = getFileSystem();
  return await fs.getSite(domain);
}

/**
 * Get files by class (mainly for settings)
 */
export async function getFilesByClass(domain, fileClass, versionInfo = null) {
  const fs = getFileSystem();
  return await fs.getFilesByClass(domain, fileClass, versionInfo);
}

/**
 * Get deployment version info (adapter only)
 */
export async function getDeployVersion(siteId, deployId) {
  const fs = getFileSystem();
  return await fs.getDeployVersion(siteId, deployId);
}

/**
 * Get a site component as a ready React component
 */
export async function getComponent(domain, name) {
  const fs = getFileSystem();
  return await fs.getComponent(domain, name);
}

/**
 * Get a site function module
 */
export async function getFunction(domain, name) {
  const fs = getFileSystem();
  return await fs.getFunction(domain, name);
}

/**
 * Get all database configurations merged from multiple sources
 * Priority: databases/*.json (new format) > settings/database.json (legacy)
 */
export async function getAllDatabases(domain, versionInfo = null) {
  const fs = getFileSystem();
  return await fs.getAllDatabases(domain, versionInfo);
}

/**
 * Get environment variable value (site-specific only)
 * Returns ONLY site-specific .env settings - does NOT fallback to process.env
 * System code that needs global env vars should use process.env directly
 *
 * Handles localhost/dev domains by resolving to DEFAULT_DOMAIN
 */
export async function getEnv(domain, varName, defaultValue = null) {
  const fs = getFileSystem();

  // Normalize domain: handle localhost and dev tunnels
  let resolvedDomain = domain;
  if (domain === 'localhost' || domain?.startsWith('localhost:')) {
    resolvedDomain = defaultDomain() || domain;
  }
  // Remove port suffix for consistency
  if (resolvedDomain?.includes(':')) {
    resolvedDomain = resolvedDomain.split(':')[0];
  }

  return await fs.getEnv(resolvedDomain, varName, defaultValue);
}
