/**
 * Addon Registry - Discovers and manages all addons in the JasonJS framework
 *
 * Addons can:
 * - Extend the app object with new APIs (client + server)
 * - Provide components via @addons/ namespace
 * - Register API routes
 * - Define database schemas
 */

import { readFile, readdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AddonRegistry');

// Get the framework root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FRAMEWORK_ROOT = join(__dirname, '../..');

/**
 * Addon Registry Class
 *
 * Manages discovery, loading, and access to all addons
 */
class AddonRegistry {
  constructor() {
    this.addons = new Map();
    this.clientExtensions = new Map();
    this.serverExtensions = new Map();
    this.apiRoutes = new Map();
    this.initialized = false;
    this._initPromise = null;
  }

  /**
   * Initialize the addon registry (discovers all addons)
   * Safe to call multiple times - will only initialize once
   */
  async init() {
    if (this.initialized) return;

    // Prevent concurrent initialization
    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = this._doInit();
    await this._initPromise;
    this._initPromise = null;
  }

  async _doInit() {
    const startTime = Date.now();

    // Load all addons from unified /addons/ directory
    await this.loadAddonsFromDirectory(join(FRAMEWORK_ROOT, 'addons'), 'addon');

    this.initialized = true;
    logger.info(`Addon registry initialized in ${Date.now() - startTime}ms - ${this.addons.size} addon(s) loaded`);
  }

  /**
   * Load all addons from a directory
   */
  async loadAddonsFromDirectory(dirPath, type) {
    try {
      await access(dirPath);
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.loadAddon(join(dirPath, entry.name), type);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Error loading addons from ${dirPath}:`, error);
      }
    }
  }

  /**
   * Load a single addon from its directory
   */
  async loadAddon(addonPath, type) {
    try {
      const manifestPath = join(addonPath, 'addon.json');

      // Check if addon.json exists
      await access(manifestPath);

      const manifestContent = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      // Validate required fields
      if (!manifest.name) {
        logger.warn(`Addon at ${addonPath} missing "name" field, skipping`);
        return;
      }

      const addon = {
        name: manifest.name,
        displayName: manifest.displayName || manifest.name,
        version: manifest.version || '1.0.0',
        type: type, // 'core' or 'soft'
        manifest,
        path: addonPath,
        loaded: false
      };

      this.addons.set(manifest.name, addon);

      // Register app extensions if declared
      if (manifest.app?.namespace) {
        const namespace = manifest.app.namespace;

        if (manifest.app.client?.entry) {
          this.clientExtensions.set(namespace, {
            addonName: manifest.name,
            entry: join(addonPath, manifest.app.client.entry),
            exports: manifest.app.client.exports || []
          });
          logger.debug(`Registered client extension: app.${namespace}`);
        }

        if (manifest.app.server?.entry) {
          this.serverExtensions.set(namespace, {
            addonName: manifest.name,
            entry: join(addonPath, manifest.app.server.entry),
            exports: manifest.app.server.exports || []
          });
          logger.debug(`Registered server extension: app.${namespace}`);
        }
      }

      // Register API routes if declared
      if (manifest.api?.routes) {
        this.apiRoutes.set(manifest.name, {
          prefix: manifest.api.prefix || `/api/addons/${manifest.name}`,
          routes: manifest.api.routes,
          addonPath
        });
        logger.debug(`Registered ${manifest.api.routes.length} API routes for ${manifest.name}`);
      }

      logger.debug(`Loaded addon: ${manifest.name} (${type})`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // No addon.json, skip silently (might be a non-addon directory)
        logger.debug(`No addon.json found at ${addonPath}, skipping`);
      } else {
        logger.error(`Failed to load addon from ${addonPath}:`, error.message);
      }
    }
  }

  /**
   * Get an addon by name
   */
  getAddon(name) {
    return this.addons.get(name);
  }

  /**
   * Get all addons
   */
  getAllAddons() {
    return Array.from(this.addons.values());
  }

  /**
   * Get client extension info for a namespace
   */
  getClientExtension(namespace) {
    return this.clientExtensions.get(namespace);
  }

  /**
   * Get server extension info for a namespace
   */
  getServerExtension(namespace) {
    return this.serverExtensions.get(namespace);
  }

  /**
   * Get all registered client extension namespaces
   */
  getClientNamespaces() {
    return Array.from(this.clientExtensions.keys());
  }

  /**
   * Get all registered server extension namespaces
   */
  getServerNamespaces() {
    return Array.from(this.serverExtensions.keys());
  }

  /**
   * Get API routes for an addon
   */
  getApiRoutes(addonName) {
    return this.apiRoutes.get(addonName);
  }

  /**
   * Get all API routes
   */
  getAllApiRoutes() {
    return Array.from(this.apiRoutes.entries());
  }

  /**
   * Check if a namespace has a client extension
   */
  hasClientExtension(namespace) {
    return this.clientExtensions.has(namespace);
  }

  /**
   * Check if a namespace has a server extension
   */
  hasServerExtension(namespace) {
    return this.serverExtensions.has(namespace);
  }

  /**
   * Load and instantiate a client extension
   * @param {string} namespace - The extension namespace (e.g., 'web3')
   * @param {Object} context - Context object with events, auth, db, etc.
   */
  async loadClientExtension(namespace, context) {
    const extensionInfo = this.clientExtensions.get(namespace);
    if (!extensionInfo) {
      return null;
    }

    try {
      const module = await import(extensionInfo.entry);

      // Support multiple export patterns
      if (typeof module.createClient === 'function') {
        return module.createClient(context);
      } else if (typeof module.default === 'function') {
        return module.default(context);
      } else if (typeof module.default === 'object') {
        return module.default;
      }

      logger.warn(`Client extension ${namespace} has no valid export pattern`);
      return null;
    } catch (error) {
      logger.error(`Failed to load client extension ${namespace}:`, error);
      return null;
    }
  }

  /**
   * Load and instantiate a server extension
   * @param {string} namespace - The extension namespace (e.g., 'web3')
   * @param {Object} context - Context object with db, auth, etc.
   */
  async loadServerExtension(namespace, context) {
    const extensionInfo = this.serverExtensions.get(namespace);
    if (!extensionInfo) {
      return null;
    }

    try {
      const module = await import(extensionInfo.entry);

      // Support multiple export patterns
      if (typeof module.createServer === 'function') {
        return module.createServer(context);
      } else if (typeof module.default === 'function') {
        return module.default(context);
      } else if (typeof module.default === 'object') {
        return module.default;
      }

      logger.warn(`Server extension ${namespace} has no valid export pattern`);
      return null;
    } catch (error) {
      logger.error(`Failed to load server extension ${namespace}:`, error);
      return null;
    }
  }

  /**
   * Get addon components list
   */
  getAddonComponents(addonName) {
    const addon = this.addons.get(addonName);
    if (!addon?.manifest?.components) {
      return [];
    }

    // Handle both array format (soft addons) and object format (core addons)
    if (Array.isArray(addon.manifest.components)) {
      return addon.manifest.components;
    }

    return Object.entries(addon.manifest.components).map(([name, config]) => ({
      name,
      ...config
    }));
  }
}

// Singleton instance
let registry = null;

/**
 * Get the addon registry instance
 * Note: Call initAddons() before first use to ensure discovery is complete
 */
export function getAddonRegistry() {
  if (!registry) {
    registry = new AddonRegistry();
  }
  return registry;
}

/**
 * Initialize the addon registry (discovers all addons)
 * Safe to call multiple times
 */
export async function initAddons() {
  const reg = getAddonRegistry();
  await reg.init();
  return reg;
}

/**
 * Check if an addon exists
 */
export function hasAddon(name) {
  return getAddonRegistry().addons.has(name);
}

/**
 * Get addon manifest
 */
export function getAddonManifest(name) {
  const addon = getAddonRegistry().getAddon(name);
  return addon?.manifest || null;
}

export default {
  getAddonRegistry,
  initAddons,
  hasAddon,
  getAddonManifest
};
