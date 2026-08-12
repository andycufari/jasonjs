// studio/core/database.js

import * as notionConnector from './adapters/notion';
import * as mongodbConnector from './adapters/mongodb';
import * as jasonConnector from './adapters/jason';
import * as jsonConnector from './adapters/json';
import * as fileConnector from './adapters/file';
import { QueryBuilder } from './adapters/QueryBuilder.js';
import { wrapInRecords } from './adapters/Record.js';
import { applySecurityFiltering } from '../security/fieldFilter.js';
import { createLogger } from '../utils/logger.js';
import { replaceTemplateVars } from '../render/templateVars.js';
import { getEnv } from '../sites/files.js';
import appLog from '../utils/appLog.js';

const logger = createLogger('Database');

class Database {
  constructor(domainConfig, params, context = {}) {
    this.domainConfig = domainConfig;
    this.params = params;
    this.context = context; // Contains siteId, domain, userId, etc.
    this.selectedDatabase = null;
    this.siteEnvCache = null; // Cache for site-specific env vars
    this.connectors = {
      notion: notionConnector,
      mongodb: mongodbConnector,
      // Zero-config default: when MONGODB_URI is not set, the 'jason' type is
      // backed by the file store (JSON files in sites/<domain>/data/).
      // Setting MONGODB_URI upgrades app.db to MongoDB — no config changes.
      jason: process.env.MONGODB_URI ? jasonConnector : fileConnector,
      file: fileConnector,
      json: jsonConnector,
    };
  }

  setConfig(config) {
    this.domainConfig = config || {};
  }

  select(database) {
    if (!this.domainConfig) {
      logger.error('No domain configuration available');
      this.selectedDatabase = null;
      return;
    }

    if (!database) {
      logger.error('No database identifier provided');
      this.selectedDatabase = null;
      return;
    }

    if (typeof this.domainConfig === 'object' && database in this.domainConfig) {
      const rawConfig = this.domainConfig[database];

      // Debug: log loaded config to verify schema is present
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`Database "${database}" config loaded`, {
          hasSchema: !!rawConfig?.schema,
          schemaKeys: rawConfig?.schema ? Object.keys(rawConfig.schema) : [],
          type: rawConfig?.type,
          hasConfig: !!rawConfig?.config
        });
      }

      // Validate database configuration to prevent app freezes from misconfigured databases
      const validation = this.validateDatabaseConfig(database, rawConfig);
      if (!validation.valid) {
        logger.error(`Invalid database configuration for "${database}": ${validation.error}`);
        this.selectedDatabase = null;
        return;
      }

      // Warn about potential issues (don't fail, but alert developers)
      if (validation.warnings && validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          logger.warn(`Database "${database}": ${warning}`);
        });
      }

      const databaseConfig = {
        id: database,
        ...rawConfig
      };
      // Process database configuration to resolve environment variables
      this.selectedDatabase = this.replaceParams(databaseConfig);
    } else {
      logger.error(`Database not found in config: ${database}`);
      this.selectedDatabase = null;
    }
  }

  /**
   * Validate database configuration to catch misconfigurations early
   * This prevents app freezes from invalid database setups
   * @param {string} databaseId - Database identifier
   * @param {Object} config - Database configuration object
   * @returns {Object} Validation result { valid: boolean, error?: string, warnings?: string[] }
   * @private
   */
  validateDatabaseConfig(databaseId, config) {
    const warnings = [];

    // Config must be an object
    if (!config || typeof config !== 'object') {
      return { valid: false, error: 'Configuration must be an object' };
    }

    // Must have a valid name or the databaseId itself will be used
    const effectiveName = config.name || config.collection || databaseId;
    if (!effectiveName || (typeof effectiveName === 'string' && effectiveName.trim() === '')) {
      return { valid: false, error: 'Database must have a valid name, collection, or id' };
    }

    // Warn about empty schema (queries may not work as expected)
    if (!config.schema || Object.keys(config.schema).length === 0) {
      warnings.push('Empty schema - queries may not work as expected. Define a schema for better reliability.');
    }

    // Warn about missing security configuration
    if (!config.security) {
      warnings.push('No security configuration - database will use default security settings.');
    }

    // Validate type if specified
    const validTypes = ['jason', 'mongodb', 'notion', 'json', 'file'];
    if (config.type && !validTypes.includes(config.type)) {
      return { valid: false, error: `Invalid database type "${config.type}". Valid types: ${validTypes.join(', ')}` };
    }

    return { valid: true, warnings };
  }

  replaceParams(obj) {
    // Use unified template replacement utility
    const user = this.context?.session?.user || this.context?.user;
    return replaceTemplateVars(obj, {
      params: this.params,
      user: user,
      context: this.context
    });
  }

  /**
   * Resolve [[env.VARIABLE]] placeholders in config using site-specific env vars
   * @param {Object} config - Configuration object with potential env placeholders
   * @returns {Promise<Object>} Config with resolved env vars
   */
  async resolveEnvVars(config) {
    if (!config || typeof config !== 'object') return config;

    const domain = this.context?.domain;
    if (!domain) {
      // No domain context, return as-is (env vars won't resolve)
      return config;
    }

    const resolveValue = async (value) => {
      if (typeof value === 'string') {
        // Match [[env.VARIABLE_NAME]]
        const match = value.match(/^\[\[env\.(\w+)\]\]$/);
        if (match) {
          const envVar = match[1];
          const resolved = await getEnv(domain, envVar);
          return resolved || value; // Return original if not found
        }
        return value;
      }
      if (Array.isArray(value)) {
        return Promise.all(value.map(resolveValue));
      }
      if (typeof value === 'object' && value !== null) {
        const resolved = {};
        for (const key of Object.keys(value)) {
          resolved[key] = await resolveValue(value[key]);
        }
        return resolved;
      }
      return value;
    };

    return resolveValue(config);
  }

  async performOperation(operation, config) {
    if (!this.selectedDatabase) {
      logger.error('No database selected, use select() first');
      return {
        success: false,
        error: 'No database selected',
        data: null
      };
    }

    const type = this.selectedDatabase.type || 'jason'; // Default to jason if no type specified
    const connector = this.connectors[type];

    if (!connector || typeof connector[operation] !== 'function') {
      logger.error(`Unsupported operation for database type: ${type}`, { operation });
      return {
        success: false,
        error: `Unsupported operation ${operation}`,
        data: null
      };
    }

    const processedConfig = this.replaceParams(config);

    // 🔒 SECURITY: Never log processed configs to appLog (contains user data)
    // Debug log in development
    logger.debug(`DB operation: ${operation}`, {
      database: this.selectedDatabase.id,
      type
    });

    try {
      // Resolve [[env.X]] placeholders in database config
      const resolvedDbConfig = await this.resolveEnvVars(this.selectedDatabase.config);

      // Merge database config with context (siteId, userId)
      const enhancedConfig = {
        ...resolvedDbConfig,
        ...this.context,
        id: this.selectedDatabase.id, // Pass database ID for JasonJS class naming
        schema: this.selectedDatabase.schema, // Pass schema for validation
        security: this.selectedDatabase.security, // Pass security config
        joins: this.selectedDatabase.joins, // Pass joins configuration
        databaseSchemas: this.context.databaseSchemas || this.domainConfig, // Pass all database schemas for join resolution
        userId: this.context.userId || this.context.session?.user?.id // Ensure userId is available for auto-creation
      };


      const result = await connector[operation](processedConfig, enhancedConfig);
      return {
        success: true,
        error: null,
        data: result
      };
    } catch (error) {
      // 🔒 SECURITY: Log clean error message for user, full details server-side only
      logger.error(`Database ${operation} failed`, error);

      // Log clean error to function log (visible to user)
      await appLog(`Database error: ${error.message}`, 'error');

      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  async fetch(config) {
    const isDev = process.env.NODE_ENV === 'development';

    // 🔒 SECURITY: Server-side logs only (not visible to user)
    logger.debug('Fetching data', {
      database: this.selectedDatabase?.id,
      hasFilters: !!config.filters
    });

    // 🔒 SECURITY: Owner-level READ filtering
    if (this.selectedDatabase?.security?.read?.level === 'owner') {
      const userId = this.context?.userId || this.context?.session?.user?.id;
      const userRole = this.context?.session?.user?.role;
      const isAdmin = userRole === 'admin';

      // Non-admin users can only see their own records
      if (!isAdmin && userId && !this.context?.serverSideAccess) {
        config.filters = config.filters || {};
        config.filters.created_by = userId;

        logger.debug('Owner-level filter applied', { userId });
      }
    }

    const result = await this.performOperation('fetchData', config);

    if (isDev) {
      if (Array.isArray(result.data)) {
        logger.debug(`Fetched ${result.data.length} records`);
      } else if (result.data && typeof result.data === 'object') {
        logger.debug('Fetched 1 record');
      } else {
        logger.debug('Fetch completed', { hasData: !!result.data });
      }
    }

    // Auto-join user data if enabled and successful
    if (result.success && result.data && this.shouldAutoJoinUsers()) {
      result.data = await this.autoJoinUserData(result.data);
    }

    // Apply security field filtering (bypass for server-side functions)
    if (result.success && result.data && this.selectedDatabase && !this.context.serverSideAccess) {
      logger.debug('Applying security filtering');
      const session = this.context.session || null;
      result.data = applySecurityFiltering(
        result.data,
        this.selectedDatabase,
        session,
        'read'
      );
      if (isDev) {
        if (Array.isArray(result.data)) {
          logger.debug(`After filtering: ${result.data.length} records`);
        } else if (result.data && typeof result.data === 'object') {
          logger.debug('After filtering: 1 record');
        }
      }
    } else if (this.context.serverSideAccess) {
      logger.debug('Server-side access: bypassing security filtering');
    }

    return result;
  }

  async count(filters = {}) {
    const isDev = process.env.NODE_ENV === 'development';
    logger.debug('Counting records', { database: this.selectedDatabase?.id });

    // Apply owner-level filtering for count as well
    if (this.selectedDatabase?.security?.read?.level === 'owner') {
      const userId = this.context?.userId || this.context?.session?.user?.id;
      const userRole = this.context?.session?.user?.role;
      const isAdmin = userRole === 'admin';

      if (!isAdmin && userId && !this.context?.serverSideAccess) {
        filters = filters || {};
        filters.created_by = userId;
      }
    }

    const result = await this.performOperation('countData', { filters });

    if (isDev && result.success) {
      logger.debug(`Count result: ${result.data}`);
    }

    return result;
  }

  async create(config) {
    // Pre-process file fields before creation
    if (config.data) {
      config.data = await this.processFileFields(config.data, 'create');
    }

    // Auto-add tracking fields if database has security config and user is authenticated
    if (this.selectedDatabase?.security && this.context?.userId && config.data) {
      config.data.created_by = this.context.userId;
      config.data.created_at = new Date();
    }

    const result = await this.performOperation('createData', config);

    // Invalidate related caches after successful write
    if (result.success) {
      await this.invalidateRelatedCaches();
    }

    return result;
  }

  async update(idOrConfig, data = null, fullRecord = null) {
    // Extract ID for ownership validation
    const recordId = typeof idOrConfig === 'string' ? idOrConfig : idOrConfig.id;

    // 🔒 SECURITY: Owner-level UPDATE validation
    if (this.selectedDatabase?.security?.update?.level === 'owner') {
      const userId = this.context?.userId || this.context?.session?.user?.id;
      // Check both role (string) and roles (array) for admin
      const userRole = this.context?.session?.user?.role;
      const userRoles = this.context?.session?.user?.roles;
      const isAdmin = userRole === 'admin' ||
                      (Array.isArray(userRoles) && userRoles.includes('admin')) ||
                      this.context?.session?.user?.isAdmin;

      // Non-admin users can only update their own records
      if (!isAdmin && userId && !this.context?.serverSideAccess) {
        const record = await this.getById(recordId);

        if (!record) {
          throw new Error('Record not found');
        }

        if (record.created_by !== userId) {
          throw new Error('Not authorized to modify this record');
        }
      }
    }

    // Support both formats:
    // .update(id, data, fullRecord) - clean API with optional full record for validation
    // .update(config) - object format for backward compatibility
    let result;
    if (typeof idOrConfig === 'string' && data !== null) {
      // Pre-process file fields before update
      const processedData = await this.processFileFields(data, 'update');

      // Auto-add tracking fields if database has security config and user is authenticated
      if (this.selectedDatabase?.security && this.context?.userId) {
        processedData.updated_by = this.context.userId;
        processedData.updated_at = new Date();
      }

      result = await this.performOperation('updateData', {
        id: idOrConfig,
        data: processedData,
        fullRecord: fullRecord // Pass full record for validation
      });
    } else {
      // Pre-process file fields in config format
      if (idOrConfig.data) {
        idOrConfig.data = await this.processFileFields(idOrConfig.data, 'update');

        // Auto-add tracking fields if database has security config and user is authenticated
        if (this.selectedDatabase?.security && this.context?.userId) {
          idOrConfig.data.updated_by = this.context.userId;
          idOrConfig.data.updated_at = new Date();
        }
      }
      result = await this.performOperation('updateData', idOrConfig);
    }

    // Invalidate related caches after successful write
    if (result.success) {
      await this.invalidateRelatedCaches();
    }

    return result;
  }

  async delete(idOrConfig) {
    // Extract ID for ownership validation
    const recordId = typeof idOrConfig === 'string' ? idOrConfig : idOrConfig.id;

    // 🔒 SECURITY: Owner-level DELETE validation
    if (this.selectedDatabase?.security?.delete?.level === 'owner') {
      const userId = this.context?.userId || this.context?.session?.user?.id;
      // Check both role (string) and roles (array) for admin
      const userRole = this.context?.session?.user?.role;
      const userRoles = this.context?.session?.user?.roles;
      const isAdmin = userRole === 'admin' ||
                      (Array.isArray(userRoles) && userRoles.includes('admin')) ||
                      this.context?.session?.user?.isAdmin;

      // Non-admin users can only delete their own records
      if (!isAdmin && userId && !this.context?.serverSideAccess) {
        const record = await this.getById(recordId);

        if (!record) {
          throw new Error('Record not found');
        }

        if (record.created_by !== userId) {
          throw new Error('Not authorized to delete this record');
        }
      }
    }

    // Support both formats:
    // .delete(id) - clean API
    // .delete(config) - object format for backward compatibility
    let result;
    if (typeof idOrConfig === 'string') {
      result = await this.performOperation('deleteData', { id: idOrConfig });
    } else {
      result = await this.performOperation('deleteData', idOrConfig);
    }

    // Invalidate related caches after successful write
    if (result.success) {
      await this.invalidateRelatedCaches();
    }

    return result;
  }

  // ===== FLUID API METHODS =====
  
  /**
   * Select a database and return a fluent interface
   * @param {string} databaseId - Database identifier
   * @param {string|boolean} role - Optional role for server-side impersonation (true = admin)
   * @returns {Database} New instance with selected database
   */
  use(databaseId, role = null) {
    // Always create a new Database instance to avoid shared state issues
    // This prevents bugs where multiple .use() calls would modify the same instance
    const newContext = role !== null ? {
      ...this.context,
      serverSideAccess: true, // Role impersonation requires server-side access
      session: {
        ...this.context.session,
        user: {
          ...this.context.session?.user,
          role: role === true ? 'admin' : role // true = admin, string = specific role
        }
      }
    } : this.context;

    const newDatabase = new Database(this.domainConfig, this.params, newContext);
    newDatabase.select(databaseId);

    // Throw helpful error if database doesn't exist
    if (!newDatabase.selectedDatabase) {
      const availableDatabases = Object.keys(this.domainConfig || {}).join(', ') || 'none';
      throw new Error(`Database "${databaseId}" not found. Available databases: ${availableDatabases}. Make sure your database is defined in the databases/ folder.`);
    }

    return newDatabase;
  }

  /**
   * Add a new record
   * @param {Object} data - Data to insert
   * @returns {Promise<Record>} Created record wrapped in Record instance
   */
  async add(data) {
    const result = await this.create({ data });
    if (result.success && result.data) {
      return wrapInRecords(result.data, this, this.selectedDatabase?.id);
    }
    throw new Error(result.error || 'Failed to create record');
  }

  /**
   * Get a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<Record|null>} Record instance or null
   */
  async getById(id) {
    // Use the primary key from schema, default to 'id' if not specified
    const primaryKey = this.selectedDatabase?.schema?.primary_key || 'id';
    const result = await this.fetch({ filters: { [primaryKey]: id } });
    if (result.success && result.data && result.data.length > 0) {
      return wrapInRecords(result.data[0], this, this.selectedDatabase?.id);
    }
    return null;
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteById(id) {
    const result = await this.delete(id);
    return result.success;
  }

  /**
   * Start a query with optional initial filters (Fluid API version)
   * @param {Object} filters - Initial filters
   * @returns {QueryBuilder} Query builder instance
   */
  query(filters = {}) {
    if (!this.selectedDatabase) {
      throw new Error('No database selected. Use select() or use() method first.');
    }
    
    return new QueryBuilder(this, this.selectedDatabase.id, filters);
  }

  /**
   * Find nearby locations (convenience method for geospatial queries)
   * @param {string} field - Location field name
   * @param {Array<number>} coordinates - [longitude, latitude] coordinates
   * @param {number} maxDistance - Maximum distance in meters
   * @param {number} minDistance - Minimum distance in meters (optional)
   * @returns {QueryBuilder} Query builder instance
   */
  nearBy(field, coordinates, maxDistance, minDistance = null) {
    if (!this.selectedDatabase) {
      throw new Error('No database selected. Use select() or use() method first.');
    }
    
    return new QueryBuilder(this, this.selectedDatabase.id)
      .nearBy(field, coordinates, maxDistance, minDistance);
  }

  /**
   * Perform intelligent search across searchable fields
   * @param {string} searchTerm - Search query string
   * @param {number} limit - Maximum results (default: 10)
   * @param {Object} additionalFilters - Additional query filters
   * @returns {Promise<Array>} Search results sorted by relevance
   */
  async search(searchTerm, limit = 10, additionalFilters = {}) {
    if (!this.selectedDatabase) {
      throw new Error('No database selected. Use select() or use() method first.');
    }
    
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length === 0) {
      return [];
    }
    
    const trimmedTerm = searchTerm.trim();
    const type = this.selectedDatabase.type || 'jason'; // Default to jason if no type specified
    const connector = this.connectors[type];

    if (!connector || typeof connector.searchData !== 'function') {
      logger.warn(`Search not supported for database type: ${type}, falling back to query`);
      
      // Fallback to basic query if search not supported
      const queryBuilder = this.query(additionalFilters);
      
      // Try to search in common fields
      const searchableFields = this.getSearchableFieldsFromSchema();
      if (searchableFields.length > 0) {
        // Use OR conditions for each searchable field
        queryBuilder.or();
        searchableFields.forEach(field => {
          queryBuilder.contains(field.name, trimmedTerm);
        });
      } else {
        // Fallback to title/name field if no searchable fields defined
        queryBuilder.contains('title', trimmedTerm)
          .or()
          .contains('name', trimmedTerm);
      }
      
      return await queryBuilder.limit(limit);
    }

    try {
      // Merge database config with context (siteId, userId) - MUST include databaseSchemas for joins!
      const databaseConfig = {
        ...this.selectedDatabase,
        siteId: this.context?.siteId,
        userId: this.context?.userId,
        databaseSchemas: this.context.databaseSchemas || this.domainConfig // Required for join resolution
      };

      const processedFilters = this.replaceParams(additionalFilters);

      // Call the connector's search method
      const results = await connector.searchData(trimmedTerm, databaseConfig, limit, processedFilters);
      
      // Create result object in the same format as other operations
      let searchResult = {
        success: true,
        data: results,
        error: null
      };
      
      // Auto-join user data if enabled and successful
      if (searchResult.success && searchResult.data && this.shouldAutoJoinUsers()) {
        searchResult.data = await this.autoJoinUserData(searchResult.data);
      }
      
      // Apply security field filtering (bypass for server-side functions)
      if (searchResult.success && searchResult.data && this.selectedDatabase && !this.context.serverSideAccess) {
        const session = this.context.session || null;
        searchResult.data = applySecurityFiltering(
          searchResult.data, 
          this.selectedDatabase, 
          session, 
          'read'
        );
      } else if (this.context.serverSideAccess) {
        logger.debug('Server-side search: bypassing security filtering');
      }

      return searchResult;

    } catch (error) {
      logger.error('Search operation failed', error);
      throw error;
    }
  }

  /**
   * Get searchable fields from the current database schema
   * @returns {Array} Array of searchable field configurations
   * @private
   */
  getSearchableFieldsFromSchema() {
    if (!this.selectedDatabase?.schema) {
      return [];
    }
    
    const searchableFields = [];
    
    Object.entries(this.selectedDatabase.schema).forEach(([fieldName, fieldConfig]) => {
      if (fieldConfig.search === true) {
        searchableFields.push({
          name: fieldName,
          type: fieldConfig.type,
          searchWeight: fieldConfig.searchWeight || 1
        });
      }
    });
    
    return searchableFields;
  }

  /**
   * Subscribe to real-time changes (MongoDB only)
   * @param {Object} filters - Subscription filters
   * @param {Function} callback - Change callback
   * @returns {Promise<Object>} Subscription object with unsubscribe method
   */
  async subscribe(filters, callback) {
    if (!this.selectedDatabase) {
      throw new Error('No database selected. Use select() or use() method first.');
    }

    const type = this.selectedDatabase.type || 'jason'; // Default to jason if no type specified
    const connector = this.connectors[type];

    if (!connector || typeof connector.subscribe !== 'function') {
      throw new Error(`Real-time subscriptions not supported for database type: ${type}`);
    }

    const processedFilters = this.replaceParams(filters);
    
    try {
      return await connector.subscribe(processedFilters, callback, this.selectedDatabase.config);
    } catch (error) {
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Helper method to detect complex database-specific queries
   * @param {Object} filters - Query filters
   * @returns {boolean} True if complex query
   * @private
   */
  _isComplexQuery(filters) {
    // Check for Notion-specific query structure
    if (filters.and || filters.or || filters.filter || filters.sorts) {
      return true;
    }
    
    // Check for MongoDB-specific operators
    if (filters.$and || filters.$or || filters.$match) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if auto-join users is enabled for current database
   * @returns {boolean} True if should auto-join users
   * @private
   */
  shouldAutoJoinUsers() {
    // Skip user joining for users database itself (prevents infinite recursion)
    if (this.selectedDatabase?.id === 'users') {
      return false;
    }
    
    // Check database config - default to false (disabled by default)
    return this.selectedDatabase?.autoJoinUsers === true;
  }

  /**
   * Automatically join user data for records with user reference fields
   * @param {Array|Object} data - Data to process
   * @returns {Array|Object} Data with joined user information
   * @private
   */
  async autoJoinUserData(data) {
    if (!data) return data;

    try {
      // Handle both single object and array
      const isArray = Array.isArray(data);
      const records = isArray ? data : [data];

      if (records.length === 0) return data;

      // Extract unique user IDs from all user reference fields
      const userFields = ['createdBy', 'updatedBy', 'assignedTo', 'userId', 'ownerId', 'authorId'];
      const userIds = new Set();

      records.forEach(record => {
        userFields.forEach(field => {
          if (record[field] && typeof record[field] === 'string') {
            userIds.add(record[field]);
          }
        });
      });

      if (userIds.size === 0) return data;

      // Fetch user profiles in bulk
      const userProfiles = await this.fetchUserProfiles([...userIds]);

      // Join user data to records
      const enhancedRecords = records.map(record => {
        const enhanced = { ...record };

        userFields.forEach(field => {
          if (record[field] && userProfiles[record[field]]) {
            // Add user object for the field (e.g., record.user for createdBy)
            const userFieldName = this.getUserFieldName(field);
            enhanced[userFieldName] = userProfiles[record[field]];
          }
        });

        return enhanced;
      });

      return isArray ? enhancedRecords : enhancedRecords[0];
      
    } catch (error) {
      console.warn('Failed to auto-join user data:', error);
      return data; // Return original data if joining fails
    }
  }

  /**
   * Get the field name for joined user data
   * @param {string} referenceField - Original reference field name
   * @returns {string} User object field name
   * @private
   */
  getUserFieldName(referenceField) {
    const fieldMapping = {
      createdBy: 'user',        // Most common case
      updatedBy: 'updatedUser',
      assignedTo: 'assignee',
      userId: 'user',
      ownerId: 'owner',
      authorId: 'author'
    };
    
    return fieldMapping[referenceField] || 'user';
  }

  /**
   * Process file fields in data before database operations
   * Handles file upload URLs, metadata, and cleanup
   * @param {Object} data - Data to process
   * @param {string} operation - Operation type ('create', 'update')
   * @returns {Object} Processed data
   * @private
   */
  async processFileFields(data, operation = 'create') {
    if (!data || typeof data !== 'object') return data;
    if (!this.selectedDatabase?.schema) return data;

    const processedData = { ...data };
    const schema = this.selectedDatabase.schema;

    // Find file fields in schema (including media types: image, video, audio)
    for (const [fieldName, fieldConfig] of Object.entries(schema)) {
      if (fieldConfig.type === 'file' ||
          fieldConfig.type === 'files' ||
          fieldConfig.type === 'image' ||
          fieldConfig.type === 'video' ||
          fieldConfig.type === 'audio') {
        const fieldValue = processedData[fieldName];

        if (fieldValue !== undefined && fieldValue !== null) {
          processedData[fieldName] = await this.processFileField(
            fieldValue,
            fieldConfig,
            fieldName,
            operation
          );
        }
      }
    }

    return processedData;
  }

  /**
   * Process individual file field value
   * @param {*} value - Field value (URL string, object, or array)
   * @param {Object} fieldConfig - Field schema configuration
   * @param {string} fieldName - Field name
   * @param {string} operation - Operation type
   * @returns {*} Processed value
   * @private
   */
  async processFileField(value, fieldConfig, fieldName, operation) {
    if (!value) return value;

    // Determine if field should handle multiple files
    // - 'files' type is always multiple
    // - 'file', 'image', 'video', 'audio' are single by default unless multiple is explicitly true
    // - Avatar/square variants should always be single
    const isCompactVariant = fieldConfig.variant === 'avatar' || fieldConfig.variant === 'square';
    const isArrayField = fieldConfig.type === 'files' ||
                        (fieldConfig.multiple === true && !isCompactVariant);

    if (isArrayField) {
      // Handle array of files
      if (!Array.isArray(value)) return [];

      const processedFiles = await Promise.all(
        value.map(file => this.normalizeFileObject(file, fieldConfig))
      );

      return processedFiles.filter(Boolean); // Remove null/invalid files
    } else {
      // Handle single file
      return await this.normalizeFileObject(value, fieldConfig);
    }
  }

  /**
   * Normalize file object to consistent format
   * @param {string|Object} file - File URL or object
   * @param {Object} fieldConfig - Field configuration
   * @returns {Object|null} Normalized file object
   * @private
   */
  async normalizeFileObject(file, fieldConfig) {
    if (!file) return null;

    // If it's just a URL string, convert to object
    if (typeof file === 'string') {
      return {
        url: file,
        name: this.extractFileNameFromUrl(file),
        type: this.inferMimeTypeFromUrl(file),
        size: null,
        uploadedAt: new Date().toISOString()
      };
    }

    // If it's already an object, ensure it has required fields
    if (typeof file === 'object') {
      return {
        id: file.id || file.key,
        url: file.url,
        name: file.name || this.extractFileNameFromUrl(file.url),
        type: file.type || file.mimeType || this.inferMimeTypeFromUrl(file.url),
        size: file.size || null,
        key: file.key || file.id,
        uploadedAt: file.uploadedAt || new Date().toISOString(),
        // Preserve additional metadata
        ...file
      };
    }

    return null;
  }

  /**
   * Extract filename from URL
   * @param {string} url - File URL
   * @returns {string} Filename
   * @private
   */
  extractFileNameFromUrl(url) {
    if (!url || typeof url !== 'string') return 'unknown';

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename || 'unknown';
    } catch {
      // Fallback for relative URLs or malformed URLs
      const parts = url.split('/');
      return parts[parts.length - 1] || 'unknown';
    }
  }

  /**
   * Infer MIME type from file URL/extension
   * @param {string} url - File URL
   * @returns {string} MIME type
   * @private
   */
  inferMimeTypeFromUrl(url) {
    if (!url || typeof url !== 'string') return 'application/octet-stream';

    const ext = url.split('.').pop()?.toLowerCase();

    const mimeTypes = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',

      // Videos
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',

      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',

      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      // Archives
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',

      // Text
      txt: 'text/plain',
      csv: 'text/csv',
      json: 'application/json'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Fetch user profiles for given user IDs
   * @param {string[]} userIds - Array of user IDs
   * @returns {Object} Map of userId -> user profile
   * @private
   */
  async fetchUserProfiles(userIds) {
    if (!userIds || userIds.length === 0) return {};

    try {
      // Access MongoDB directly for shared users collection
      // Import MongoDB utilities from Jason connector
      const { ObjectId } = await import('mongodb');

      // Get MongoDB client directly (shared connection)
      const { getMongoClient } = await import('./adapters/mongodb/index.js');
      const connectionString = process.env.MONGODB_URI;

      if (!connectionString) {
        console.warn('MONGODB_URI not configured - skipping user joins');
        return {};
      }

      const client = await getMongoClient(connectionString);
      const dbName = process.env.MONGODB_DB_NAME || 'jasonjs_universal';
      const db = client.db(dbName);

      // Use a shared users collection (no site prefix)
      const usersCollection = db.collection('users');

      // Convert string IDs to ObjectIds if needed for query
      const queryIds = userIds.map(id => {
        // If it looks like an ObjectId string, convert it
        if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
          return new ObjectId(id);
        }
        // Otherwise use as-is (simple string ID)
        return id;
      });

      // Query for users with both _id and id fields
      const result = await usersCollection.find({
        $or: [
          { _id: { $in: queryIds } },
          { id: { $in: userIds } }
        ]
      }).toArray();

      if (!result || result.length === 0) {
        console.warn('No user profiles found for user joins');
        return {};
      }

      // Create map of userId -> safe profile data
      const profiles = {};
      result.forEach(user => {
        const userId = user.id || user._id?.toString();
        if (userId) {
          const imageUrl = user.avatar || user.profile_picture || user.image || null;
          profiles[userId] = {
            id: userId,
            name: user.name || user.display_name || user.username || 'Unknown User',
            image: imageUrl, // Use 'image' for consistency with NextAuth
            avatar: imageUrl, // Keep avatar for backward compatibility
            initials: this.getInitials(user.name || user.display_name || user.username || '?')
          };
        }
      });

      return profiles;

    } catch (error) {
      console.warn('Error fetching user profiles:', error);
      return {};
    }
  }

  /**
   * Generate initials from a name
   * @param {string} name - User name
   * @returns {string} User initials
   * @private
   */
  getInitials(name) {
    if (!name || typeof name !== 'string') return '?';
    
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  }

  /**
   * Invalidate related caches after database write operations
   * This ensures cached data is refreshed after creates, updates, and deletes
   * @private
   */
  async invalidateRelatedCaches() {
    try {
      const domain = this.context?.domain;

      if (!domain) {
        logger.debug('No domain in context, skipping cache invalidation');
        return;
      }

      // Import cache utilities dynamically to avoid circular dependencies
      const { getCache } = await import('../utils/cache.js');

      // Invalidate PageData cache (affects page rendering with database queries)
      const pageDataCache = getCache('PageData');
      if (pageDataCache) {
        const invalidated = await pageDataCache.invalidate(domain);
        logger.debug(`Invalidated ${invalidated} PageData cache entries for domain: ${domain}`);
      }

      // Invalidate database connector-specific caches (JasonDB, etc.)
      if (this.selectedDatabase) {
        const type = this.selectedDatabase.type || 'jason'; // Default to jason if no type specified

        // Get the database-specific cache (e.g., 'JasonDB', 'MongoDBCache', etc.)
        const dbCacheName = this.getDatabaseCacheName(type);
        if (dbCacheName) {
          const dbCache = getCache(dbCacheName);
          if (dbCache && typeof dbCache.invalidate === 'function') {
            // Invalidate all queries for this database by pattern: siteId:databaseId
            // NOTE: Normalize siteId to string to match cache keys (handles ObjectId conversion)
            const siteId = (this.context?.siteId || domain).toString();
            const invalidationPattern = `${siteId}:${this.selectedDatabase.id}`;

            const invalidated = await dbCache.invalidate(invalidationPattern);
            logger.debug(`Invalidated ${invalidated} ${dbCacheName} cache entries for pattern: ${invalidationPattern}`);
          }
        }
      }

      // Note: Component bundle cache doesn't need invalidation on DB writes
      // Components are cached based on code hash, not data

      logger.debug(`Cache invalidation completed for domain: ${domain}`);
    } catch (error) {
      // Don't throw - cache invalidation failures shouldn't break database operations
      logger.error('Cache invalidation failed', error);
    }
  }

  /**
   * Get the cache name for a given database type
   * @param {string} type - Database type (mongodb, jason, notion, json)
   * @returns {string|null} Cache name or null if no dedicated cache
   * @private
   */
  getDatabaseCacheName(type) {
    switch (type.toLowerCase()) {
      case 'jason':
        // File-backed jason (no MONGODB_URI) doesn't populate the JasonDB
        // query cache — reads go straight to disk.
        return process.env.MONGODB_URI ? 'JasonDB' : null;
      case 'file':
        return null; // File store reads from disk, no query cache
      case 'mongodb':
        return null; // MongoDB uses pagination/indexing, no dedicated query cache
      case 'notion':
        return null; // Notion has its own API caching
      case 'json':
        return null; // JSON files are cached by filesystem cache
      default:
        return null;
    }
  }

}

// Create a global database instance manager
const databaseInstances = new Map();

/**
 * Factory function to create or get database instances
 * @param {Object} domainConfig - Domain configuration
 * @param {Object} params - Parameters
 * @returns {Database} Database instance
 */
export function createDatabase(domainConfig, params = {}) {
  const key = JSON.stringify({ domainConfig, params });
  
  if (!databaseInstances.has(key)) {
    databaseInstances.set(key, new Database(domainConfig, params));
  }
  
  return databaseInstances.get(key);
}

/**
 * Simplified database factory for common use cases
 * @param {string} databaseId - Database identifier
 * @param {Object} config - Database configuration
 * @returns {Database} Configured database instance
 */
export function database(databaseId, config = null) {
  const db = new Database(config || {});
  if (databaseId) {
    db.use(databaseId);
  }
  return db;
}

export default Database;
