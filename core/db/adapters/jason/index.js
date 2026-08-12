// core/databases/jason/index.js

import { ObjectId } from 'mongodb';
import { getMongoClient } from '../mongodb/index.js';
import { createDatabaseLogger } from '../../../utils/tenantLog.js';
import { createCache, CacheStrategy, CacheTTL } from '../../../utils/cache.js';
import {
  encryptFieldsForWrite,
  decryptFieldsForRead,
  assertNoEncryptedFieldInFilter,
} from '../../../utils/crypto.js';

// Create unified cache for JasonDB queries
const jasonCache = createCache('JasonDB', {
  // strategy auto-detects Redis if REDIS_URL is set
  ttl: CacheTTL.DEFAULT,
  respectDevMode: true,
  maxSize: 1000,
  keyPrefix: 'jasondb'
});

/**
 * Normalize a sort direction value to MongoDB's expected -1 / 1.
 * Accepts numeric (-1, 1, "-1", "1") and string ("desc", "asc",
 * case-insensitive) forms so page JSON, the fluent API, and raw
 * Mongo-style sort specs all behave the same.
 *
 * Defaults to ascending (1) for unrecognized values to match existing
 * behavior.
 */
function normalizeSortDirection(v) {
  if (v === -1 || v === '-1') return -1;
  if (v === 1 || v === '1') return 1;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    if (s === 'desc' || s === 'descending') return -1;
    if (s === 'asc' || s === 'ascending') return 1;
  }
  return 1;
}

/**
 * Get the shared MongoDB client for JasonJS universal storage
 * Uses shared connection pool instead of creating new connections
 */
async function getJasonClient() {
  const connectionString = process.env.MONGODB_URI;
  
  if (!connectionString) {
    throw new Error('MONGODB_URI environment variable is required for JasonJS databases');
  }
  
  return getMongoClient(connectionString);
}

/**
 * Get the JasonJS database instance
 */
async function getJasonDatabase() {
  const client = await getJasonClient();
  const dbName = process.env.MONGODB_DB_NAME || 'jasonjs_universal';
  return client.db(dbName);
}

/**
 * Generate a simple string ID for documents
 * @returns {string} Simple string ID
 */
function generateStringId() {
  // Generate a simple ID using timestamp + random string
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${randomStr}`;
}

/**
 * Sanitize site identifier for use in collection names
 * @param {string} siteId - Site identifier (ObjectId, domain, or custom)
 * @returns {string} Sanitized identifier safe for collection names
 */
/**
 * Normalize siteId to string for consistent cache keys
 * Handles both string and ObjectId types
 */
function normalizeSiteId(siteId, domain) {
  const id = siteId || domain;
  if (!id) return '';
  return id.toString();
}

function sanitizeIdentifierForCollection(siteId) {
  if (!siteId) {
    throw new Error('Site identifier is required');
  }

  return siteId
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Get collection name for a specific site and database
 * @param {Object} databaseConfig - Database configuration
 * @returns {string} Collection name
 * @throws {Error} If configuration is invalid or would produce an invalid collection name
 */
function getCollectionName(databaseConfig) {
  const { siteId, id: databaseId, collection, config } = databaseConfig;

  if (!siteId) {
    throw new Error('Site identifier is required for Jason database operations');
  }

  if (!databaseId) {
    throw new Error('Database ID is required for Jason database operations');
  }

  const sanitizedSiteId = sanitizeIdentifierForCollection(siteId);

  // Use custom collection name if provided in config.collection or top-level collection, otherwise use database ID
  const rawCollectionName = collection || config?.collection || databaseId;

  // Validate collection name before using
  if (!rawCollectionName || (typeof rawCollectionName === 'string' && rawCollectionName.trim() === '')) {
    throw new Error(`Invalid database configuration: no valid collection name for database "${databaseId}". Check your database settings.`);
  }

  const sanitizedCollectionName = sanitizeIdentifierForCollection(rawCollectionName);

  // Final validation to catch edge cases
  if (!sanitizedCollectionName || sanitizedCollectionName.trim() === '') {
    throw new Error(`Invalid collection name generated for database "${databaseId}". The name "${rawCollectionName}" sanitizes to an empty string.`);
  }

  const finalName = `${sanitizedSiteId}_${sanitizedCollectionName}`;

  // Validate final name doesn't have problematic patterns
  if (finalName.endsWith('_') || finalName.includes('__') || finalName.startsWith('_')) {
    throw new Error(`Invalid collection name generated: "${finalName}". Check database configuration for "${databaseId}".`);
  }

  return finalName;
}

/**
 * Analyze query for index recommendations
 * @param {Object} mongoQuery - MongoDB query object
 * @param {Object} sortOptions - Sort options
 * @returns {Array} Array of index recommendations
 */
function analyzeQueryForIndexRecommendations(mongoQuery, sortOptions = {}) {
  const recommendations = [];
  
  // Get filter fields (excluding MongoDB operators)
  const filterFields = Object.keys(mongoQuery).filter(field => !field.startsWith('$'));
  const sortFields = Object.keys(sortOptions);
  
  // Single field indexes for filters
  filterFields.forEach(field => {
    if (field !== 'deletedAt') { // deletedAt is common, suggest compound instead
      recommendations.push({
        type: 'single',
        index: { [field]: 1 },
        reason: `Filtering on ${field}`
      });
    }
  });
  
  // Single field indexes for sorting
  sortFields.forEach(field => {
    const direction = sortOptions[field];
    recommendations.push({
      type: 'single', 
      index: { [field]: direction },
      reason: `Sorting by ${field} ${direction === -1 ? 'desc' : 'asc'}`
    });
  });
  
  // Compound index recommendations
  if (filterFields.length > 1) {
    // Array format for compound indexes (Jason DB style)
    recommendations.push({
      type: 'compound',
      index: filterFields, // Array format: ["field1", "field2"]
      reason: `Compound filtering on ${filterFields.join(', ')}`
    });
  }
  
  // Compound index with filters + sort
  if (filterFields.length > 0 && sortFields.length > 0) {
    const compoundFields = [...filterFields, ...sortFields.filter(f => !filterFields.includes(f))];
    if (compoundFields.length > 1) {
      recommendations.push({
        type: 'compound_sort',
        index: compoundFields, // Array format
        reason: `Compound index for filtering (${filterFields.join(', ')}) and sorting (${sortFields.join(', ')})`
      });
    }
  }
  
  // Remove duplicates
  const unique = [];
  const seen = new Set();
  
  recommendations.forEach(rec => {
    const key = Array.isArray(rec.index) ? rec.index.join('_') : JSON.stringify(rec.index);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(rec);
    }
  });
  
  return unique;
}

/**
 * Log performance metrics and index recommendations using tenant logger
 * @param {Object} params - Performance logging parameters
 */
/**
 * Ensure indexes are created based on schema configuration and explicit indexes
 * This is the new simplified approach for index management
 */
export async function ensureIndexes(databaseConfig) {
  try {
    const db = await getJasonDatabase();
    const collectionName = getCollectionName(databaseConfig);
    const collection = db.collection(collectionName);
    const logger = createDatabaseLogger(databaseConfig);
    
    const indexesToCreate = [];
    
    // 1. AUTO-INDEXES FROM SCHEMA PROPERTIES
    if (databaseConfig.schema) {
      Object.entries(databaseConfig.schema).forEach(([fieldName, fieldConfig]) => {
        // Auto-create search indexes
        if (fieldConfig.search === true) {
          indexesToCreate.push({
            fields: { [fieldName]: 'text' },
            options: { 
              name: `${fieldName}_search`,
              weights: fieldConfig.searchWeight ? { [fieldName]: fieldConfig.searchWeight } : undefined
            }
          });
        }
        
        // Auto-create single field indexes
        if (fieldConfig.index === true) {
          indexesToCreate.push({
            fields: { [fieldName]: 1 },
            options: { name: `${fieldName}_1` }
          });
        }
        
        // Auto-create geospatial indexes
        if (fieldConfig.type === 'geopoint' || fieldConfig.type === 'geo') {
          indexesToCreate.push({
            fields: { [fieldName]: '2dsphere' },
            options: { name: `${fieldName}_geo` }
          });
        }
        
        // Auto-create unique indexes
        if (fieldConfig.unique === true) {
          indexesToCreate.push({
            fields: { [fieldName]: 1 },
            options: { name: `${fieldName}_unique`, unique: true }
          });
        }
      });
    }
    
    // 2. EXPLICIT COMPLEX INDEXES
    if (databaseConfig.indexes && Array.isArray(databaseConfig.indexes)) {
      databaseConfig.indexes.forEach((indexConfig, idx) => {
        if (indexConfig.fields) {
          const fields = {};
          
          // Handle both array format and object format
          if (Array.isArray(indexConfig.fields)) {
            // Simple array format: ["field1", "field2"]
            indexConfig.fields.forEach(field => {
              fields[field] = 1; // Default to ascending
            });
          } else {
            // Object format: { "field1": 1, "field2": -1 }
            Object.assign(fields, indexConfig.fields);
          }
          
          const options = {
            name: indexConfig.name || `compound_${idx}`,
            ...indexConfig.settings
          };
          
          indexesToCreate.push({ fields, options });
        }
      });
    }
    
    // 3. SYSTEM INDEXES (always created)
    indexesToCreate.push(
      // For soft deletes
      { fields: { deletedAt: 1 }, options: { name: 'deletedAt_1', sparse: true } },
      // For created/updated timestamps
      { fields: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
      { fields: { updatedAt: -1 }, options: { name: 'updatedAt_desc' } }
    );
    
    // Create all indexes
    for (const indexSpec of indexesToCreate) {
      try {
        await collection.createIndex(indexSpec.fields, indexSpec.options);
        logger.info(`Created index ${indexSpec.options.name} on ${collectionName}`);
      } catch (error) {
        // Ignore duplicate key errors (index already exists)
        if (error.code !== 11000 && error.code !== 85) {
          logger.warn(`Failed to create index ${indexSpec.options.name}: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    const logger = createDatabaseLogger(databaseConfig);
    logger.error('Failed to ensure indexes', error);
  }
}

/**
 * Check query performance and generate index recommendations
 * Integrated into tenant logging system
 */
function checkPerformanceAndRecommendIndexes(logger, operation, databaseConfig, queryTime, query, sortOptions = {}) {
  const slowQueryThreshold = process.env.NODE_ENV === 'production' ? 100 : 50;
  
  if (queryTime > slowQueryThreshold) {
    // Log slow query with tenant context
    logger.performance.slow(`database_${operation}`, {
      databaseId: databaseConfig.id,
      query: query,
      sortOptions: sortOptions,
      queryTime: queryTime
    });
    
    // Generate index recommendations
    const recommendations = analyzeQueryForIndexRecommendations(query, sortOptions);
    
    if (recommendations.length > 0) {
      // Log index recommendations with actionable advice
      logger.database.recommendation(databaseConfig.id, recommendations, {
        query: query,
        queryTime: queryTime,
        operation: operation,
        severity: queryTime > 200 ? 'high' : queryTime > 100 ? 'medium' : 'low'
      });
    }
  }
}

/**
 * Apply schema defaults to data for missing fields
 * @param {Object} data - Data object to apply defaults to (mutated in place)
 * @param {Object} schema - Schema with default values
 */
export function applySchemaDefaults(data, schema) {
  if (!schema) return;

  for (const [field, fieldConfig] of Object.entries(schema)) {
    // Only apply default if field is missing (undefined or null) and has a default value
    const isMissing = data[field] === undefined || data[field] === null;
    if (isMissing && fieldConfig.default !== undefined) {
      data[field] = fieldConfig.default;
    }
  }
}

/**
 * Validate data against schema if defined
 */
export function validateSchema(data, schema, isUpdate = false) {
  if (!schema) return true;

  // Enhanced schema validation with rich text support
  for (const [field, fieldConfig] of Object.entries(schema)) {
    // For updates, only validate required fields if they are being updated
    // For creates, validate all required fields
    // Use explicit undefined/null check instead of falsy check (0, false, '' are valid values)
    const isMissing = data[field] === undefined || data[field] === null;
    if (fieldConfig.required && isMissing && !isUpdate) {
      // Provide helpful error with fields that WERE provided
      const providedFields = Object.keys(data).join(', ') || 'none';
      throw new Error(`Required field '${field}' is missing. Fields provided: ${providedFields}`);
    }

    if (data[field] !== undefined && data[field] !== null && fieldConfig.type) {
      const expectedType = fieldConfig.type.toLowerCase();
      const actualType = typeof data[field];
      
      if (expectedType === 'string' && actualType !== 'string') {
        throw new Error(`Field '${field}' must be a string`);
      }
      if (expectedType === 'number' && actualType !== 'number') {
        throw new Error(`Field '${field}' must be a number`);
      }
      if (expectedType === 'boolean' && actualType !== 'boolean') {
        throw new Error(`Field '${field}' must be a boolean`);
      }
      if (expectedType === 'rich_text') {
        // Rich text can be string (HTML), object (structured), null, or undefined
        if (data[field] !== null && data[field] !== undefined) {
          if (actualType !== 'string' && actualType !== 'object') {
            throw new Error(`Field '${field}' must be a string (HTML) or object (structured) for rich_text type`);
          }
          // Allow empty strings for rich text (valid case)
          if (actualType === 'string') {
            // HTML strings are valid, including empty strings
            continue;
          }
          // If it's an object, validate it has expected structure (but be lenient)
          if (actualType === 'object' && data[field]) {
            // Accept any object structure for rich text - TiptapRichTextInput sends HTML strings
            // but other editors might send structured data
            console.log(`Rich text field '${field}' received object data:`, typeof data[field]);
          }
        }
      }
      if (expectedType === 'price') {
        // Price can be number or string (formatted currency)
        if (actualType !== 'number' && actualType !== 'string') {
          throw new Error(`Field '${field}' must be a number or string for price type`);
        }
        // If it's a string, validate it's a valid price format
        if (actualType === 'string' && data[field]) {
          const cleanValue = data[field].toString().replace(/[$€£¥₹,\s]/g, '');
          const num = parseFloat(cleanValue);
          if (isNaN(num)) {
            throw new Error(`Field '${field}' contains invalid price format`);
          }
          // Validate range if specified
          if (fieldConfig.min !== undefined && num < fieldConfig.min) {
            throw new Error(`Field '${field}' price must be at least ${fieldConfig.min}`);
          }
          if (fieldConfig.max !== undefined && num > fieldConfig.max) {
            throw new Error(`Field '${field}' price must not exceed ${fieldConfig.max}`);
          }
        }
        // If it's a number, validate range
        if (actualType === 'number') {
          if (fieldConfig.min !== undefined && data[field] < fieldConfig.min) {
            throw new Error(`Field '${field}' price must be at least ${fieldConfig.min}`);
          }
          if (fieldConfig.max !== undefined && data[field] > fieldConfig.max) {
            throw new Error(`Field '${field}' price must not exceed ${fieldConfig.max}`);
          }
        }
      }
      if (expectedType === 'file' || expectedType === 'files' ||
          expectedType === 'image' || expectedType === 'video' || expectedType === 'audio') {
        // Media file validation handled by FileUpload component
        continue;
      }
      if (expectedType === 'array' && !Array.isArray(data[field])) {
        throw new Error(`Field '${field}' must be an array`);
      }
      if (expectedType === 'object' && actualType !== 'object') {
        throw new Error(`Field '${field}' must be an object`);
      }
    }
  }
  
  return true;
}

/**
 * Transform MongoDB document to JasonJS format
 * New format: all fields at root level, no data wrapper
 */
function transformDocument(doc) {
  if (!doc) return null;
  
  // Simple transformation - all fields are already at root level
  return {
    ...doc,
    id: doc._id // Ensure both id and _id are available
  };
}

/**
 * Perform intelligent search across searchable fields (JasonJS version)
 * @param {string} searchTerm - Search query
 * @param {Object} databaseConfig - Database configuration
 * @param {number} limit - Maximum results (default: 10)
 * @param {Object} additionalFilters - Additional query filters
 * @returns {Promise<Array>} Search results with relevance scoring
 */
export async function searchData(searchTerm, databaseConfig, limit = 10, additionalFilters = {}) {
  const startTime = Date.now();
  const logger = createDatabaseLogger(databaseConfig);
  const isDev = process.env.NODE_ENV === 'development';

  try {
    if (isDev) {
      console.log('[SEARCH DEBUG] Starting search:', {
        searchTerm,
        limit,
        additionalFilters,
        databaseId: databaseConfig.id
      });
    }

    if (!searchTerm || searchTerm.length < (databaseConfig.search?.minLength || 2)) {
      return [];
    }

    // Check if dev mode is active from database context (bypass cache in dev mode)
    const isDevMode = databaseConfig.devMode === true;

    // Check cache first (skip cache in dev mode)
    const cacheKey = jasonCache.generateKey(
      normalizeSiteId(databaseConfig.siteId, databaseConfig.domain),
      databaseConfig.id,
      'search',
      { searchTerm, limit, additionalFilters }
    );

    if (!isDevMode) {
      const cached = await jasonCache.get(cacheKey, isDevMode);
      if (cached) {
        if (isDev) {
          console.log('[SEARCH CACHE] HIT:', {
            searchTerm,
            database: databaseConfig.id,
            filters: additionalFilters,
            cacheKey: cacheKey.substring(cacheKey.lastIndexOf(':') + 1)
          });
        }
        return cached;
      }
    } else if (isDev) {
      console.log('[SEARCH CACHE] BYPASSED (dev mode active)');
    }

    if (isDev) {
      console.log('[SEARCH CACHE] MISS:', {
        searchTerm,
        database: databaseConfig.id,
        filters: additionalFilters,
        cacheKey: cacheKey.substring(cacheKey.lastIndexOf(':') + 1)
      });
    }

    const db = await getJasonDatabase();
    const collectionName = getCollectionName(databaseConfig);
    const collection = db.collection(collectionName);

    // Get searchable fields from schema
    const searchableFields = getSearchableFields(databaseConfig.schema || {});
    
    if (searchableFields.length === 0) {
      // Fallback to basic search in common fields (direct access)
      const mongoQuery = {
        deletedAt: { $exists: false },
        $or: [
          { title: { $regex: new RegExp(escapeRegex(searchTerm), 'i') } },
          { name: { $regex: new RegExp(escapeRegex(searchTerm), 'i') } },
          { description: { $regex: new RegExp(escapeRegex(searchTerm), 'i') } }
        ],
        ...additionalFilters
      };
      
      const results = await collection
        .find(mongoQuery)
        .limit(limit)
        .toArray();

      const transformedResults = results.map(doc => ({
        ...transformDocument(doc),
        _relevanceScore: 1
      }));

      // Store in cache (skip in dev mode)
      if (!isDevMode) {
        const cacheTTL = databaseConfig.cache?.search?.ttl || databaseConfig.cache?.ttl || CacheTTL.DEFAULT;
        await jasonCache.set(cacheKey, transformedResults, cacheTTL, isDevMode);
      }

      return transformedResults;
    }
    
    // Build search pipeline for JasonJS data structure
    const pipeline = [];

    // Split search term into words
    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length > 1);

    // Handle geospatial filtering in search if provided (direct field access)
    if (additionalFilters.nearBy) {
      const { field, coordinates, maxDistance, minDistance } = additionalFilters.nearBy;
      const geoQuery = {
        [field]: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: coordinates // [longitude, latitude]
            },
            $maxDistance: maxDistance
          }
        }
      };

      if (minDistance !== null && minDistance !== undefined) {
        geoQuery[field].$near.$minDistance = minDistance;
      }

      // Add to additional filters and remove from nearBy to avoid duplication
      Object.assign(additionalFilters, geoQuery);
      delete additionalFilters.nearBy;
    }

    // Build AND conditions: each word must appear in at least one field
    const wordAndConditions = [];
    const scoreExpressions = [];

    // If only one word or exact phrase search, prioritize exact matches
    if (searchWords.length === 1) {
      // Single word - search across all fields with OR
      const singleWordConditions = [];

      searchableFields.forEach(field => {
        const fieldWeight = field.searchWeight || 1;
        const fieldPath = field.name;

        // Exact match (highest score)
        singleWordConditions.push({ [fieldPath]: { $regex: new RegExp(`^${escapeRegex(searchTerm)}$`, 'i') } });
        scoreExpressions.push({
          $cond: [
            {
              $regexMatch: {
                input: { $ifNull: [`$${fieldPath}`, ""] },
                regex: `^${escapeRegex(searchTerm)}$`,
                options: 'i'
              }
            },
            fieldWeight * 20,
            0
          ]
        });

        // Starts with (high score)
        singleWordConditions.push({ [fieldPath]: { $regex: new RegExp(`^${escapeRegex(searchTerm)}`, 'i') } });
        scoreExpressions.push({
          $cond: [
            {
              $regexMatch: {
                input: { $ifNull: [`$${fieldPath}`, ""] },
                regex: `^${escapeRegex(searchTerm)}`,
                options: 'i'
              }
            },
            fieldWeight * 10,
            0
          ]
        });

        // Contains (medium score)
        singleWordConditions.push({ [fieldPath]: { $regex: new RegExp(escapeRegex(searchTerm), 'i') } });
        scoreExpressions.push({
          $cond: [
            {
              $regexMatch: {
                input: { $ifNull: [`$${fieldPath}`, ""] },
                regex: escapeRegex(searchTerm),
                options: 'i'
              }
            },
            fieldWeight * 5,
            0
          ]
        });
      });

      wordAndConditions.push({ $or: singleWordConditions });

    } else {
      // Multiple words - require ALL words to be present (AND logic)

      // First, add condition for exact phrase match (highest priority)
      const exactPhraseConditions = [];
      searchableFields.forEach(field => {
        const fieldWeight = field.searchWeight || 1;
        const fieldPath = field.name;

        exactPhraseConditions.push({ [fieldPath]: { $regex: new RegExp(escapeRegex(searchTerm), 'i') } });
        scoreExpressions.push({
          $cond: [
            {
              $regexMatch: {
                input: { $ifNull: [`$${fieldPath}`, ""] },
                regex: escapeRegex(searchTerm),
                options: 'i'
              }
            },
            fieldWeight * 20, // Highest score for exact phrase
            0
          ]
        });
      });

      // Note: We don't add exactPhraseConditions to wordAndConditions as a requirement
      // It's only for scoring. We want to allow partial matches too.

      // For each word, require it to appear in at least ONE field
      searchWords.forEach(word => {
        const wordConditions = [];

        searchableFields.forEach(field => {
          const fieldWeight = field.searchWeight || 1;
          const fieldPath = field.name;

          // Word appears in this field
          wordConditions.push({ [fieldPath]: { $regex: new RegExp(escapeRegex(word), 'i') } });

          // Scoring for this word in this field
          scoreExpressions.push({
            $cond: [
              {
                $regexMatch: {
                  input: { $ifNull: [`$${fieldPath}`, ""] },
                  regex: escapeRegex(word),
                  options: 'i'
                }
              },
              fieldWeight * 3, // Each word match
              0
            ]
          });
        });

        // This word must appear in at least one field
        wordAndConditions.push({ $or: wordConditions });
      });
    }

    // Match stage - ALL words must match (AND logic)
    const matchStage = {
      $match: {
        $and: [
          { deletedAt: { $exists: false } },
          ...wordAndConditions, // Spread AND conditions for each word
          additionalFilters
        ]
      }
    };

    // Debug logging in development only
    if (isDev) {
      console.log('[SEARCH DEBUG] Search term escaped:', escapeRegex(searchTerm));
      console.log('[SEARCH DEBUG] Search words:', searchWords);
      console.log('[SEARCH DEBUG] Searchable fields:', searchableFields.map(f => f.name));
      console.log('[SEARCH DEBUG] AND conditions (each word must match):', wordAndConditions.length);
      console.log('[SEARCH DEBUG] Match stage:', JSON.stringify(matchStage, null, 2));
      console.log('[SEARCH DEBUG] Search logic:', searchWords.length === 1 ? 'Single word (OR across fields)' : 'Multiple words (AND - all must match)');
      console.log('[SEARCH DEBUG] Additional filters:', JSON.stringify(additionalFilters));
    }

    pipeline.push(matchStage);
    
    // Add relevance score
    pipeline.push({
      $addFields: {
        _relevanceScore: {
          $add: scoreExpressions
        }
      }
    });
    
    // Handle joins if configured
    if (databaseConfig.joins && databaseConfig.joins.length > 0) {
      databaseConfig.joins.forEach(join => {
        // Backward compatibility: support both old (localField/foreignField) and new (key/foreignKey) naming
        const localKey = join.key || join.localField;
        const foreignKey = join.foreignKey || join.foreignField || '_id';
        const joinType = join.type || 'left'; // Default to left join
        const asName = join.as || join.class; // Use 'as' if provided, otherwise fall back to class name

        // Get the joined database config from databaseSchemas
        const joinedDbConfig = databaseConfig.databaseSchemas?.[join.class];

        // Get the joined collection name using the full config
        const joinedCollectionName = getCollectionName({
          siteId: databaseConfig.siteId,
          id: join.class,
          collection: joinedDbConfig?.collection,
          config: joinedDbConfig?.config
        });

        const lookupStage = {
          $lookup: {
            from: joinedCollectionName,
            let: { localField: `$${localKey}` },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [`$${foreignKey === '_id' ? '_id' : foreignKey}`, '$$localField']
                  }
                }
              }
            ],
            as: `${asName}_data`
          }
        };
        pipeline.push(lookupStage);

        // Unwind the joined array
        // - left join: preserve documents even if no match (preserveNullAndEmptyArrays: true)
        // - inner join: only keep documents with matches (preserveNullAndEmptyArrays: false)
        const preserveNull = joinType === 'left';
        pipeline.push({
          $unwind: {
            path: `$${asName}_data`,
            preserveNullAndEmptyArrays: preserveNull
          }
        });
        
        // Add joined fields
        if (join.fields && join.fields.length > 0) {
          const projection = {};
          join.fields.forEach(field => {
            projection[field] = `$${asName}_data.${field}`; // Direct field access
          });
          projection._id = `$${asName}_data._id`;
          projection.id = `$${asName}_data._id`; // Use direct ID
          
          pipeline.push({
            $addFields: {
              [asName]: projection
            }
          });
        } else {
          pipeline.push({
            $addFields: {
              [asName]: {
                $mergeObjects: [
                  `$${asName}_data`,
                  {
                    id: `$${asName}_data._id` // Ensure id field is available
                  }
                ]
              }
            }
          });
        }
        
        pipeline.push({
          $project: {
            [`${asName}_data`]: 0
          }
        });
      });
    }
    
    // Sort by relevance score
    pipeline.push({
      $sort: { _relevanceScore: -1, createdAt: -1 }
    });
    
    // Limit results
    pipeline.push({
      $limit: limit
    });
    
    // Execute search
    const results = await collection.aggregate(pipeline).toArray();

    if (isDev && results.length > 0) {
      console.log('[SEARCH DEBUG] Results found:', results.length, '- First result:', {
        title: results[0].title,
        score: results[0]._relevanceScore
      });
    }

    // Log performance metrics using tenant logger
    const queryTime = Date.now() - startTime;
    logger.database.query(databaseConfig.id, 'search', {
      searchTerm,
      additionalFilters,
      queryTime,
      limit,
      resultsCount: results.length,
      hasSearchableFields: searchableFields.length > 0
    });
    
    // Check performance and recommend indexes if needed
    const searchQuery = { $text: { $search: searchTerm }, ...additionalFilters };
    checkPerformanceAndRecommendIndexes(logger, 'search', databaseConfig, queryTime, searchQuery, { _relevanceScore: -1 });

    // Transform results (decrypt encrypted fields first)
    const transformedResults = results.map(doc =>
      transformDocument(decryptFieldsForRead(doc, databaseConfig.schema))
    );

    // Store in cache (skip in dev mode)
    if (!isDevMode) {
      const cacheTTL = databaseConfig.cache?.search?.ttl || databaseConfig.cache?.ttl || CacheTTL.DEFAULT;
      await jasonCache.set(cacheKey, transformedResults, cacheTTL, isDevMode);
    }

    return transformedResults;

  } catch (error) {
    logger.database.error(databaseConfig.id, 'search', error);
    throw error;
  }
}

/**
 * Extract searchable fields from schema configuration
 * @param {Object} schema - Schema configuration
 * @returns {Array} Array of searchable field configurations
 */
function getSearchableFields(schema) {
  const searchableFields = [];
  
  Object.entries(schema).forEach(([fieldName, fieldConfig]) => {
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
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function fetchData(query, databaseConfig) {
  const startTime = Date.now();
  const logger = createDatabaseLogger(databaseConfig);
  const isDev = process.env.NODE_ENV === 'development';

  try {
    // Check cache first
    const isDevMode = databaseConfig.devMode === true;
    const cacheKey = jasonCache.generateKey(
      normalizeSiteId(databaseConfig.siteId, databaseConfig.domain),
      databaseConfig.id,
      'query',
      { query, joins: databaseConfig.joins } // Include joins in cache key
    );

    const cached = await jasonCache.get(cacheKey, isDevMode);
    if (cached) {
      if (isDev) {
        console.log('[QUERY CACHE] HIT:', {
          database: databaseConfig.id,
          filters: query.filters,
          sort: query.sort,
          limit: query.limit,
          cacheKey: cacheKey.substring(cacheKey.lastIndexOf(':') + 1)
        });
      }
      return cached;
    }

    if (isDev) {
      console.log('[QUERY CACHE] MISS:', {
        database: databaseConfig.id,
        filters: query.filters,
        sort: query.sort,
        limit: query.limit,
        cacheKey: cacheKey.substring(cacheKey.lastIndexOf(':') + 1)
      });
    }

    // Skip index creation during fetch operations - indexes should be created during setup
    // await ensureIndexes(databaseConfig);

    const db = await getJasonDatabase();
    const collectionName = getCollectionName(databaseConfig);
    const collection = db.collection(collectionName);
    
    // Build MongoDB query - no class or siteId needed!
    const mongoQuery = {};

    // ALWAYS exclude soft-deleted records by default (for backwards compatibility)
    // This allows querying to work correctly even when mixed soft/hard deletes are present
    // Users can optionally include deleted records with includeDeleted: true
    if (!query.includeDeleted) {
      mongoQuery.deletedAt = { $exists: false };
    }
    
    // Add query filters - support both 'filters' and 'query' formats
    const queryFilters = query.filters || query.query || {};
    // Reject filters that reference encrypted fields — they can't be queried.
    assertNoEncryptedFieldInFilter(queryFilters, databaseConfig.schema);
    if (Object.keys(queryFilters).length > 0) {
      Object.keys(queryFilters).forEach(key => {
        const value = queryFilters[key];
        if (key === '_id' || key === 'id') {
          // Handle both ObjectId strings and simple string IDs
          if (typeof value === 'string') {
            if (value.match(/^[0-9a-fA-F]{24}$/)) {
              // It's an ObjectId string
              mongoQuery._id = new ObjectId(value);
            } else {
              // It's a simple string ID
              mongoQuery._id = value;
            }
          } else {
            mongoQuery._id = value;
          }
        } else if (typeof value === 'object' && value !== null && value.nearBy) {
          // Handle nested nearBy query (e.g., filters: { location: { nearBy: {...} } })
          const { coordinates, maxDistance, minDistance } = value.nearBy;
          const geoQuery = {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: coordinates // [longitude, latitude]
              },
              $maxDistance: maxDistance
            }
          };

          if (minDistance !== null && minDistance !== undefined) {
            geoQuery.$near.$minDistance = minDistance;
          }

          mongoQuery[key] = geoQuery; // key is the field name (e.g., 'location')
        } else {
          // Direct field access - no data wrapper!
          mongoQuery[key] = value;
        }
      });
    }

    // Handle geospatial queries (nearBy) - direct field access (top-level format)
    if (query.nearBy) {
      const { field, coordinates, maxDistance, minDistance } = query.nearBy;
      const geoQuery = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: coordinates // [longitude, latitude]
          },
          $maxDistance: maxDistance
        }
      };

      if (minDistance !== null && minDistance !== undefined) {
        geoQuery.$near.$minDistance = minDistance;
      }

      mongoQuery[field] = geoQuery; // Direct field access
    }
    
    // Handle text search within data
    if (query.search) {
      mongoQuery.$text = { $search: query.search };
    }
    
    // Build sort options - direct field access.
    // Accept all common sort spec forms so page JSON, fluent API, and raw
    // Mongo-style queries behave identically:
    //   { votes: -1 }       Mongo numeric (also "-1")
    //   { votes: 'desc' }   string (case-insensitive)
    //   { votes: 1 }        Mongo numeric ascending (also "1")
    //   { votes: 'asc' }    string ascending
    const sortOptions = {};
    if (query.sort) {
      Object.keys(query.sort).forEach(key => {
        sortOptions[key] = normalizeSortDirection(query.sort[key]);
      });
    }

    // Handle joins using aggregation pipeline
    // Skip joins if explicitly disabled via query.disableJoins
    const shouldExecuteJoins = databaseConfig.joins &&
                                databaseConfig.joins.length > 0 &&
                                !query.disableJoins;

    if (shouldExecuteJoins) {
      const pipeline = [];

      // Check if we have geospatial queries that conflict with aggregation
      const hasGeoNear = JSON.stringify(mongoQuery).includes('$near');
      let geoNearStage = null;

      if (hasGeoNear) {
        // Extract geospatial query and convert to $geoNear pipeline stage
        const locationQuery = Object.entries(mongoQuery).find(([key, value]) =>
          value && typeof value === 'object' && value.$near
        );

        if (locationQuery) {
          const [fieldName, geoQuery] = locationQuery;
          geoNearStage = {
            $geoNear: {
              near: geoQuery.$near.$geometry,
              distanceField: 'distance',
              maxDistance: geoQuery.$near.$maxDistance,
              spherical: true,
              key: fieldName // Specify which field has the geospatial index
            }
          };

          if (geoQuery.$near.$minDistance !== null && geoQuery.$near.$minDistance !== undefined) {
            geoNearStage.$geoNear.minDistance = geoQuery.$near.$minDistance;
          }

          // Remove geospatial query from regular match stage
          const filteredQuery = { ...mongoQuery };
          delete filteredQuery[fieldName];

          // Add $geoNear as first stage (MUST be first)
          pipeline.push(geoNearStage);

          // Add remaining filters as match stage if any
          if (Object.keys(filteredQuery).length > 0) {
            pipeline.push({ $match: filteredQuery });
          }
        }
      } else {
        // Add regular match stage if no geospatial queries
        if (Object.keys(mongoQuery).length > 0) {
          pipeline.push({ $match: mongoQuery });
        }
      }

      // Add lookup stages for joins
      databaseConfig.joins.forEach(join => {
        // Backward compatibility: support both old (localField/foreignField) and new (key/foreignKey) naming
        const localKey = join.key || join.localField;
        const foreignKey = join.foreignKey || join.foreignField || '_id';
        const joinType = join.type || 'left'; // Default to left join
        const asName = join.as || join.class; // Use 'as' if provided, otherwise fall back to class name

        // Get the joined database config from databaseSchemas
        const joinedDbConfig = databaseConfig.databaseSchemas?.[join.class];

        // Get the joined collection name using the full config
        const joinedCollectionName = getCollectionName({
          siteId: databaseConfig.siteId,
          id: join.class,
          collection: joinedDbConfig?.collection,
          config: joinedDbConfig?.config
        });

        const lookupStage = {
          $lookup: {
            from: joinedCollectionName, // Use specific collection for joined data
            let: { localField: `$${localKey}` },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [`$${foreignKey === '_id' ? '_id' : foreignKey}`, '$$localField']
                  }
                }
              }
            ],
            as: `${asName}_data`
          }
        };
        pipeline.push(lookupStage);

        // Unwind the joined array
        // - left join: preserve documents even if no match (preserveNullAndEmptyArrays: true)
        // - inner join: only keep documents with matches (preserveNullAndEmptyArrays: false)
        const preserveNull = joinType === 'left';
        pipeline.push({
          $unwind: {
            path: `$${asName}_data`,
            preserveNullAndEmptyArrays: preserveNull
          }
        });
        
        // Add the joined object with selected fields
        if (join.fields && join.fields.length > 0) {
          // Create projection for specific fields only
          const projection = {};
          join.fields.forEach(field => {
            projection[field] = `$${asName}_data.${field}`; // Direct field access
          });
          projection._id = `$${asName}_data._id`; // Always include ID
          projection.id = `$${asName}_data._id`; // Use direct ID (already a string)
          
          pipeline.push({
            $addFields: {
              [asName]: projection
            }
          });
        } else {
          // If no specific fields, add the whole joined object
          pipeline.push({
            $addFields: {
              [asName]: {
                $mergeObjects: [
                  `$${asName}_data`,
                  {
                    id: `$${asName}_data._id` // Ensure id field is available
                  }
                ]
              }
            }
          });
        }
        
        // Remove the temporary _data field
        pipeline.push({
          $project: {
            [`${asName}_data`]: 0
          }
        });
      });
      
      // Add sort stage
      if (Object.keys(sortOptions).length > 0) {
        pipeline.push({ $sort: sortOptions });
      }
      
      // Add skip and limit
      if (query.skip) {
        pipeline.push({ $skip: parseInt(query.skip) });
      }
      
      if (query.limit) {
        pipeline.push({ $limit: parseInt(query.limit) });
      }
      
      // Execute aggregation pipeline
      const results = await collection.aggregate(pipeline).toArray();

      // Log performance metrics using tenant logger
      const queryTime = Date.now() - startTime;
      logger.database.query(databaseConfig.id, 'fetch', {
        query: mongoQuery,
        sortOptions,
        queryTime,
        limit: query.limit,
        skip: query.skip,
        hasJoins: true
      });

      // Check performance and recommend indexes if needed
      checkPerformanceAndRecommendIndexes(logger, 'fetch', databaseConfig, queryTime, mongoQuery, sortOptions);

      // Transform results (decrypt encrypted fields first)
      const transformedResults = results.map(doc =>
        transformDocument(decryptFieldsForRead(doc, databaseConfig.schema))
      );

      // Store in cache
      const cacheTTL = databaseConfig.cache?.query?.ttl || databaseConfig.cache?.ttl || CacheTTL.DEFAULT;
      await jasonCache.set(cacheKey, transformedResults, cacheTTL, isDevMode);

      if (isDev) {
        logger.debug(`Cache WRITE: key="${cacheKey}", ttl=${cacheTTL}ms, entries=${transformedResults.length}`);
      }

      return transformedResults;
    }
    
    // Execute standard query (no joins)
    let cursor = collection.find(mongoQuery);
    
    if (Object.keys(sortOptions).length > 0) {
      cursor = cursor.sort(sortOptions);
    }
    
    if (query.limit) {
      cursor = cursor.limit(parseInt(query.limit));
    }
    
    if (query.skip) {
      cursor = cursor.skip(parseInt(query.skip));
    }
    
    const results = await cursor.toArray();

    // Log performance metrics using tenant logger
    const queryTime = Date.now() - startTime;
    logger.database.query(databaseConfig.id, 'fetch', {
      query: mongoQuery,
      sortOptions,
      queryTime,
      limit: query.limit,
      skip: query.skip,
      hasJoins: false
    });

    // Check performance and recommend indexes if needed
    checkPerformanceAndRecommendIndexes(logger, 'fetch', databaseConfig, queryTime, mongoQuery, sortOptions);

    // Transform results (decrypt encrypted fields first)
    const transformedResults = results.map(doc =>
      transformDocument(decryptFieldsForRead(doc, databaseConfig.schema))
    );

    // Store in cache
    const cacheTTL = databaseConfig.cache?.query?.ttl || databaseConfig.cache?.ttl || CacheTTL.DEFAULT;
    await jasonCache.set(cacheKey, transformedResults, cacheTTL, isDevMode);

    return transformedResults;

  } catch (error) {
    logger.database.error(databaseConfig.id, 'fetch', error);
    throw error;
  }
}

/**
 * Count documents matching filters
 * Used for server-side pagination to get total count
 */
export async function countData(query, databaseConfig) {
  const logger = createDatabaseLogger(databaseConfig);

  try {
    const db = await getJasonDatabase();
    const collectionName = getCollectionName(databaseConfig);
    const collection = db.collection(collectionName);

    // Build MongoDB query
    const mongoQuery = {};

    // ALWAYS exclude soft-deleted records by default (for backwards compatibility)
    if (!query.includeDeleted) {
      mongoQuery.deletedAt = { $exists: false };
    }

    // Add filters
    const filters = query.filters || {};
    // Reject filters that reference encrypted fields — they can't be queried.
    assertNoEncryptedFieldInFilter(filters, databaseConfig.schema);
    Object.keys(filters).forEach(key => {
      const value = filters[key];
      if (key === '_id' || key === 'id') {
        if (typeof value === 'string' && value.match(/^[0-9a-fA-F]{24}$/)) {
          mongoQuery._id = new ObjectId(value);
        } else {
          mongoQuery._id = value;
        }
      } else {
        mongoQuery[key] = value;
      }
    });

    const count = await collection.countDocuments(mongoQuery);

    logger.database.query(databaseConfig.id, 'count', {
      filters: mongoQuery,
      result: count
    });

    return count;
  } catch (error) {
    logger.database.error(databaseConfig.id, 'count', error);
    throw error;
  }
}

export async function createData(data, databaseConfig) {
  const startTime = Date.now();
  const logger = createDatabaseLogger(databaseConfig);

  try {
    const db = await getJasonDatabase();
    const collectionName = getCollectionName(databaseConfig);
    const collection = db.collection(collectionName);

    const inputData = data.data || data;

    // Auto-inject userId before validation if schema requires it and userId is available
    // This ensures tenant code doesn't need to manually pass userId (security best practice)
    if (databaseConfig.userId && databaseConfig.schema?.userId?.required && !inputData.userId) {
      inputData.userId = databaseConfig.userId;
    }

    // Apply schema defaults BEFORE validation
    if (databaseConfig.schema) {
      applySchemaDefaults(inputData, databaseConfig.schema);
    }

    // Validate against schema if defined
    if (databaseConfig.schema) {
      validateSchema(inputData, databaseConfig.schema);
    }
    
    // Generate simple string ID
    const documentId = generateStringId();

    // Prepare document - all fields at root level
    const document = {
      _id: documentId,
      ...inputData, // Spread user data directly at root level
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add userId if available
    if (databaseConfig.userId) {
      document.created_by = databaseConfig.userId;  // Use created_by consistently
      document.updated_by = databaseConfig.userId;  // Use updated_by consistently
    }

    // Encrypt fields marked { encrypted: true } in the schema before insert
    const encryptedDocument = encryptFieldsForWrite(document, databaseConfig.schema);

    const result = await collection.insertOne(encryptedDocument);
    
    // Log performance metrics using tenant logger
    const queryTime = Date.now() - startTime;
    logger.database.query(databaseConfig.id, 'create', {
      documentId,
      queryTime,
      hasSchema: !!databaseConfig.schema
    });

    // Invalidate cache for this database
    // NOTE: Use normalized siteId to match cache keys
    const invalidatePattern = `${normalizeSiteId(databaseConfig.siteId, databaseConfig.domain)}:${databaseConfig.id}`;
    const invalidatedCount = await jasonCache.invalidate(invalidatePattern);
    logger.debug(`Cache invalidation for CREATE: pattern="${invalidatePattern}", invalidated=${invalidatedCount} entries`);

    // Return created document (decrypt encrypted fields for caller)
    const createdDoc = await collection.findOne({ _id: documentId });
    return transformDocument(decryptFieldsForRead(createdDoc, databaseConfig.schema));

  } catch (error) {
    logger.database.error(databaseConfig.id, 'create', error);
    throw error;
  }
}

export async function updateData(data, databaseConfig) {
  const startTime = Date.now();
  const logger = createDatabaseLogger(databaseConfig);

  try {
    const db = await getJasonDatabase();
    const collectionName = getCollectionName(databaseConfig);
    const collection = db.collection(collectionName);

    const { id, fullRecord, ...updateData } = data;

    if (!id) {
      throw new Error('ID is required for update operation');
    }

    const inputData = updateData.data || updateData;

    // Validate against schema if defined
    // If fullRecord is provided (from Record.save()), validate the complete record
    // Otherwise, validate only the fields being updated (partial update)
    if (databaseConfig.schema) {
      if (fullRecord) {
        // Validate the complete record to ensure all required fields are present
        // This ensures data integrity when using Record.save() which only sends changed fields
        validateSchema(fullRecord, databaseConfig.schema, false);
      } else {
        // Validate only the fields being updated (partial update via direct update call)
        validateSchema(inputData, databaseConfig.schema, true);
      }
    }
    
    // Prepare update document - direct field updates (encrypt schema-marked fields first)
    const encryptedInput = encryptFieldsForWrite(inputData, databaseConfig.schema);
    const update = {
      $set: {
        ...encryptedInput, // Update fields directly at root level
        updatedAt: new Date()
      }
    };

    // Add updatedBy if userId is available
    if (databaseConfig.userId) {
      update.$set.updated_by = databaseConfig.userId;  // Use updated_by consistently
    }
    
    // Handle both ObjectId strings and simple string IDs
    let queryId = id;
    if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
      queryId = new ObjectId(id);
    }
    
    const query = { _id: queryId }; // No class or siteId needed!
    
    const result = await collection.updateOne(query, update);
    
    if (result.matchedCount === 0) {
      throw new Error('Document not found or access denied');
    }
    
    // Log performance metrics using tenant logger
    const queryTime = Date.now() - startTime;
    logger.database.query(databaseConfig.id, 'update', {
      documentId: id,
      queryTime,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      hasSchema: !!databaseConfig.schema
    });

    // Invalidate cache for this database
    // NOTE: Use normalized siteId to match cache keys
    const invalidatePattern = `${normalizeSiteId(databaseConfig.siteId, databaseConfig.domain)}:${databaseConfig.id}`;
    const invalidatedCount = await jasonCache.invalidate(invalidatePattern);
    logger.debug(`Cache invalidation for UPDATE: pattern="${invalidatePattern}", invalidated=${invalidatedCount} entries`);

    // Return updated document (decrypt encrypted fields for caller)
    const updatedDoc = await collection.findOne(query);
    return transformDocument(decryptFieldsForRead(updatedDoc, databaseConfig.schema));

  } catch (error) {
    logger.database.error(databaseConfig.id, 'update', error);
    throw error;
  }
}

export async function deleteData(data, databaseConfig) {
  const startTime = Date.now();
  const logger = createDatabaseLogger(databaseConfig);
  
  try {
    const db = await getJasonDatabase();
    const collectionName = getCollectionName(databaseConfig);
    const collection = db.collection(collectionName);
    
    const id = data.id || data;
    
    if (!id) {
      throw new Error('ID is required for delete operation');
    }
    
    // Handle both ObjectId strings and simple string IDs
    let queryId = id;
    if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
      queryId = new ObjectId(id);
    }
    
    const query = { _id: queryId }; // No class or siteId needed!
    
    // Check if document exists first
    const existingDoc = await collection.findOne(query);
    if (!existingDoc) {
      throw new Error('Document not found or access denied');
    }
    
    // Check if soft delete is enabled (default: false for JasonJS - hard delete by default)
    if (databaseConfig.softDelete === true) {
      // Perform soft delete (add deletedAt field)
      const result = await collection.updateOne(query, {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      // Log performance metrics using tenant logger
      const queryTime = Date.now() - startTime;
      logger.database.query(databaseConfig.id, 'delete', {
        documentId: id,
        queryTime,
        deletionType: 'soft'
      });

      // Invalidate cache for this database
      // NOTE: Use normalized siteId to match cache keys
      const invalidatePattern = `${normalizeSiteId(databaseConfig.siteId, databaseConfig.domain)}:${databaseConfig.id}`;
      const invalidatedCount = await jasonCache.invalidate(invalidatePattern);
      logger.debug(`Cache invalidation for DELETE (soft): pattern="${invalidatePattern}", invalidated=${invalidatedCount} entries`);

      return {
        id: existingDoc._id,
        deleted: true,
        deletedAt: new Date()
      };
    } else {
      // Perform hard delete (actually remove the document)
      const result = await collection.deleteOne(query);

      // Log performance metrics using tenant logger
      const queryTime = Date.now() - startTime;
      logger.database.query(databaseConfig.id, 'delete', {
        documentId: id,
        queryTime,
        deletionType: 'hard',
        deletedCount: result.deletedCount
      });

      // Invalidate cache for this database
      // NOTE: Use normalized siteId to match cache keys
      const invalidatePattern = `${normalizeSiteId(databaseConfig.siteId, databaseConfig.domain)}:${databaseConfig.id}`;
      const invalidatedCount = await jasonCache.invalidate(invalidatePattern);
      logger.debug(`Cache invalidation for DELETE (hard): pattern="${invalidatePattern}", invalidated=${invalidatedCount} entries`);

      return {
        id: existingDoc._id,
        deleted: true
      };
    }
    
  } catch (error) {
    logger.database.error(databaseConfig.id, 'delete', error);
    throw error;
  }
}

/**
 * Subscribe to real-time changes using MongoDB Change Streams
 * Same as MongoDB connector but filtered by class and siteId
 */
export async function subscribe(filters, callback, databaseConfig) {
  try {
    const db = await getJasonDatabase();
    const collectionName = getCollectionName(databaseConfig);
    const collection = db.collection(collectionName);
    
    // Build match pipeline for change stream
    const pipeline = [];
    
    // No need to filter by class and siteId - collection is already isolated!
    const matchFilter = {};
    
    // Add user-defined filters (direct field access)
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (key === '_id' || key === 'id') {
          // Handle both ObjectId strings and simple string IDs
          if (typeof value === 'string') {
            if (value.match(/^[0-9a-fA-F]{24}$/)) {
              matchFilter['fullDocument._id'] = new ObjectId(value);
            } else {
              matchFilter['fullDocument._id'] = value;
            }
          } else {
            matchFilter['fullDocument._id'] = value;
          }
        } else {
          matchFilter[`fullDocument.${key}`] = value; // Direct field access
        }
      });
    }
    
    // Add the match stage to pipeline
    pipeline.push({ $match: matchFilter });
    
    console.log('JasonJS Change Stream - Starting subscription with pipeline:', JSON.stringify(pipeline, null, 2));
    
    // Create change stream
    const changeStream = collection.watch(pipeline, {
      fullDocument: 'updateLookup'
    });
    
    // Handle change events
    changeStream.on('change', (change) => {
      try {
        const transformedChange = transformChangeEvent(change);
        callback(transformedChange);
      } catch (error) {
        console.error('Error processing change event:', error);
      }
    });
    
    // Handle errors
    changeStream.on('error', (error) => {
      console.error('JasonJS Change Stream error:', error);
      callback({
        type: 'error',
        error: error.message
      });
    });
    
    // Handle close
    changeStream.on('close', () => {
      console.log('JasonJS Change Stream closed');
      callback({
        type: 'close'
      });
    });
    
    console.log('JasonJS Change Stream - Subscription started successfully');
    
    return {
      unsubscribe: async () => {
        try {
          await changeStream.close();
          console.log('JasonJS Change Stream - Subscription closed');
        } catch (error) {
          console.error('Error closing change stream:', error);
        }
      }
    };
    
  } catch (error) {
    console.error('JasonJS subscribe error:', error);
    throw error;
  }
}

/**
 * Transform MongoDB change event to standard format
 */
function transformChangeEvent(change) {
  const baseEvent = {
    type: change.operationType,
    timestamp: change.clusterTime || new Date(),
    database: change.ns?.db,
    collection: change.ns?.coll
  };
  
  switch (change.operationType) {
    case 'insert':
      return {
        ...baseEvent,
        type: 'create',
        data: transformDocument(change.fullDocument),
        id: change.fullDocument._id.toString()
      };
      
    case 'update':
    case 'replace':
      return {
        ...baseEvent,
        type: 'update',
        data: transformDocument(change.fullDocument),
        id: change.documentKey._id.toString(),
        changes: change.updateDescription?.updatedFields || {}
      };
      
    case 'delete':
      return {
        ...baseEvent,
        type: 'delete',
        id: change.documentKey._id.toString()
      };
      
    default:
      return {
        ...baseEvent,
        type: change.operationType
      };
  }
}

// ===== MIGRATION UTILITIES =====

/**
 * Migrate all collections from one site identifier to another
 * Useful when domain changes or site ID changes
 * @param {string} oldSiteId - Old site identifier
 * @param {string} newSiteId - New site identifier
 * @returns {Promise<Object>} Migration results
 */
export async function migrateSiteData(oldSiteId, newSiteId) {
  try {
    const db = await getJasonDatabase();
    
    const oldPrefix = sanitizeIdentifierForCollection(oldSiteId);
    const newPrefix = sanitizeIdentifierForCollection(newSiteId);
    
    if (oldPrefix === newPrefix) {
      return {
        success: true,
        message: 'No migration needed - identifiers are the same',
        migrated: 0
      };
    }
    
    console.log(`Starting migration from ${oldPrefix} to ${newPrefix}`);
    
    // Get all collections for old site
    const collections = await db.listCollections({
      name: { $regex: `^${oldPrefix}_` }
    }).toArray();
    
    if (collections.length === 0) {
      return {
        success: true,
        message: 'No collections found for old site identifier',
        migrated: 0
      };
    }
    
    const migrated = [];
    
    // Rename each collection
    for (const col of collections) {
      const oldName = col.name;
      const newName = oldName.replace(oldPrefix, newPrefix);
      
      try {
        console.log(`Migrating ${oldName} -> ${newName}`);
        await db.renameCollection(oldName, newName);
        migrated.push({
          from: oldName,
          to: newName
        });
      } catch (error) {
        console.error(`Failed to migrate ${oldName}:`, error);
        throw new Error(`Migration failed for collection ${oldName}: ${error.message}`);
      }
    }
    
    console.log(`Migration completed: ${migrated.length} collections migrated`);
    
    return {
      success: true,
      message: `Successfully migrated ${migrated.length} collections`,
      migrated: migrated.length,
      collections: migrated,
      from: oldSiteId,
      to: newSiteId
    };
    
  } catch (error) {
    console.error('Migration error:', error);
    return {
      success: false,
      error: error.message,
      migrated: 0
    };
  }
}

/**
 * List all collections for a specific site
 * @param {string} siteId - Site identifier
 * @returns {Promise<Array>} List of collections and their stats
 */
export async function listSiteCollections(siteId) {
  try {
    const db = await getJasonDatabase();
    const prefix = sanitizeIdentifierForCollection(siteId);
    
    // Get all collections for this site
    const collections = await db.listCollections({
      name: { $regex: `^${prefix}_` }
    }).toArray();
    
    const collectionStats = [];
    
    for (const col of collections) {
      const collection = db.collection(col.name);
      const stats = await collection.estimatedDocumentCount();
      const databaseName = col.name.replace(`${prefix}_`, '');
      
      collectionStats.push({
        name: col.name,
        database: databaseName,
        documentCount: stats,
        siteId: siteId
      });
    }
    
    return {
      success: true,
      siteId: siteId,
      collections: collectionStats,
      totalCollections: collectionStats.length,
      totalDocuments: collectionStats.reduce((sum, col) => sum + col.documentCount, 0)
    };
    
  } catch (error) {
    console.error('Error listing site collections:', error);
    return {
      success: false,
      error: error.message,
      collections: []
    };
  }
}

/**
 * Delete all collections for a specific site (use with caution!)
 * @param {string} siteId - Site identifier
 * @param {boolean} confirm - Must be true to actually delete
 * @returns {Promise<Object>} Deletion results
 */
export async function deleteSiteData(siteId, confirm = false) {
  if (!confirm) {
    throw new Error('Must pass confirm=true to actually delete site data');
  }
  
  try {
    const db = await getJasonDatabase();
    const prefix = sanitizeIdentifierForCollection(siteId);
    
    // Get all collections for this site
    const collections = await db.listCollections({
      name: { $regex: `^${prefix}_` }
    }).toArray();
    
    if (collections.length === 0) {
      return {
        success: true,
        message: 'No collections found for site',
        deleted: 0
      };
    }
    
    const deleted = [];
    
    // Drop each collection
    for (const col of collections) {
      try {
        console.log(`Deleting collection ${col.name}`);
        await db.dropCollection(col.name);
        deleted.push(col.name);
      } catch (error) {
        console.error(`Failed to delete ${col.name}:`, error);
        throw new Error(`Deletion failed for collection ${col.name}: ${error.message}`);
      }
    }
    
    console.log(`Deletion completed: ${deleted.length} collections deleted`);
    
    return {
      success: true,
      message: `Successfully deleted ${deleted.length} collections`,
      deleted: deleted.length,
      collections: deleted,
      siteId: siteId
    };
    
  } catch (error) {
    console.error('Deletion error:', error);
    return {
      success: false,
      error: error.message,
      deleted: 0
    };
  }
}