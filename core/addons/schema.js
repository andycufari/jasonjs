/**
 * Addon Schema Validation
 *
 * Validates addon.json manifest files to ensure they meet the required structure
 */

/**
 * Addon manifest schema definition
 * Describes the expected structure of addon.json files
 */
export const ADDON_SCHEMA = {
  // Required fields
  required: ['name', 'version'],

  // Field definitions
  fields: {
    // Core metadata
    name: { type: 'string', description: 'Unique addon identifier (kebab-case)' },
    displayName: { type: 'string', description: 'Human-readable name' },
    version: { type: 'string', description: 'Semver version (e.g., 1.0.0)' },
    description: { type: 'string', description: 'Brief description of the addon' },
    type: { type: 'string', enum: ['addon', 'connector', 'plugin'], description: 'Addon type' },

    // Author info
    author: {
      type: 'object',
      fields: {
        name: { type: 'string' },
        email: { type: 'string' },
        url: { type: 'string' }
      }
    },

    // Capabilities
    capabilities: {
      type: 'array',
      items: { type: 'string' },
      validValues: [
        'extends_app_client',
        'extends_app_server',
        'provides_api',
        'provides_components',
        'provides_database',
        'provides_utilities',
        'provides_readonly_api',
        'provides_readonly_database'
      ]
    },

    // App extensions (conventionally in ./app/ folder)
    app: {
      type: 'object',
      description: 'Extensions to the app.* object. Files should be in ./app/ folder',
      fields: {
        namespace: { type: 'string', description: 'Namespace for app object (e.g., "web3" for app.web3)' },
        client: {
          type: 'object',
          fields: {
            entry: { type: 'string', description: 'Path to client extension (e.g., ./app/client.js)' },
            exports: { type: 'array', items: { type: 'string' } }
          }
        },
        server: {
          type: 'object',
          fields: {
            entry: { type: 'string', description: 'Path to server extension (e.g., ./app/server.js)' },
            exports: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    },

    // Database schemas folder
    schemas: {
      type: 'string',
      description: 'Path to schemas folder containing collection JSON files (e.g., ./schemas/)'
    },

    // API routes
    api: {
      type: 'object',
      fields: {
        prefix: { type: 'string', description: 'API route prefix' },
        routes: {
          type: 'array',
          items: {
            type: 'object',
            fields: {
              path: { type: 'string' },
              methods: { type: 'array', items: { type: 'string' } },
              handler: { type: 'string' },
              description: { type: 'string' }
            }
          }
        }
      }
    },

    // Components
    components: {
      type: ['array', 'object'],
      description: 'Components provided by the addon'
    },

    // Database schemas
    // Databases use tenant isolation via app.db.use() - collections are auto-prefixed with siteId
    database: {
      type: 'object',
      description: 'Database collections required by the addon. Uses tenant-isolated collections via app.db.use()',
      fields: {
        // Collection name -> schema definition
        // User can customize collection name via component props (e.g., databaseClass="my_comments")
        // Default collection names are prefixed with siteId automatically by the framework
      }
    },

    // Install configuration
    install: {
      type: 'object',
      description: 'Installation requirements and setup instructions',
      fields: {
        databases: {
          type: 'array',
          description: 'Database collections that should be created during install',
          items: {
            type: 'object',
            fields: {
              name: { type: 'string', description: 'Default collection name' },
              schema: { type: 'object', description: 'Collection schema definition' },
              indexes: { type: 'array', description: 'Database indexes to create' },
              security: { type: 'object', description: 'Security rules for the collection' }
            }
          }
        },
        settings: {
          type: 'array',
          description: 'Settings to add to site settings',
          items: {
            type: 'object',
            fields: {
              key: { type: 'string', description: 'Setting key path (e.g., "addons.comments.moderation")' },
              defaultValue: { type: 'any', description: 'Default value for the setting' },
              description: { type: 'string' }
            }
          }
        },
        envVars: {
          type: 'array',
          description: 'Environment variables that may be required',
          items: {
            type: 'object',
            fields: {
              name: { type: 'string' },
              required: { type: 'boolean' },
              description: { type: 'string' }
            }
          }
        }
      }
    },

    // Skill documentation
    skill: {
      type: 'object',
      description: 'AI skill documentation for Claude/AI assistants',
      fields: {
        file: { type: 'string', description: 'Path to skill markdown file (e.g., ./skill.md)' },
        name: { type: 'string', description: 'Skill name for AI context' },
        description: { type: 'string', description: 'Brief description for AI' }
      }
    },

    // Dependencies
    dependencies: {
      type: 'object',
      fields: {
        npm: { type: 'object' }
      }
    },

    // Configuration
    configuration: {
      type: 'object',
      fields: {
        environmentVariables: { type: 'object' }
      }
    }
  }
};

/**
 * Validate an addon manifest against the schema
 * @param {Object} manifest - The addon.json content
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateAddonManifest(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a valid object'] };
  }

  // Check required fields
  for (const field of ADDON_SCHEMA.required) {
    if (!manifest[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate name format (kebab-case)
  if (manifest.name && !/^[a-z][a-z0-9-]*$/.test(manifest.name)) {
    errors.push('Name must be kebab-case (lowercase letters, numbers, and hyphens)');
  }

  // Validate version format (semver)
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push('Version must follow semver format (e.g., 1.0.0)');
  }

  // Validate capabilities if present
  if (manifest.capabilities && Array.isArray(manifest.capabilities)) {
    const validCapabilities = ADDON_SCHEMA.fields.capabilities.validValues;
    for (const cap of manifest.capabilities) {
      if (!validCapabilities.includes(cap)) {
        errors.push(`Invalid capability: ${cap}. Valid values: ${validCapabilities.join(', ')}`);
      }
    }
  }

  // Validate app namespace if present
  if (manifest.app?.namespace) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(manifest.app.namespace)) {
      errors.push('App namespace must start with lowercase letter and contain only alphanumeric characters');
    }

    // Check for reserved namespaces
    const reservedNamespaces = ['db', 'database', 'auth', 'ui', 'events', 'functions', 'billing', 'storage', 'analytics', 'cache', 'context', 'utils', 'helpers', 'browser', 'navigate', 'scripts', 'user', 'users'];
    if (reservedNamespaces.includes(manifest.app.namespace)) {
      errors.push(`App namespace "${manifest.app.namespace}" is reserved by the framework`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a manifest declares a specific capability
 */
export function hasCapability(manifest, capability) {
  return manifest?.capabilities?.includes(capability) || false;
}

/**
 * Get all components from a manifest
 */
export function getManifestComponents(manifest) {
  if (!manifest?.components) {
    return [];
  }

  // Handle array format (soft addons)
  if (Array.isArray(manifest.components)) {
    return manifest.components;
  }

  // Handle object format (core addons)
  return Object.entries(manifest.components).map(([name, config]) => ({
    name,
    ...(typeof config === 'object' ? config : { description: config })
  }));
}

export default {
  ADDON_SCHEMA,
  validateAddonManifest,
  hasCapability,
  getManifestComponents
};
