// studio/core/databases/mongodb/index.js

import { MongoClient } from 'mongodb';
import crypto from 'crypto';
import {
  encryptFieldsForWrite,
  decryptFieldsForRead,
  assertNoEncryptedFieldInFilter,
} from '../../../utils/crypto.js';

// Connection pool to reuse connections for same connection strings
const connectionPool = new Map();

// Track connection metadata for cleanup
const connectionMetadata = new Map();

/**
 * Normalize a sort direction value to MongoDB's expected -1 / 1.
 * Accepts numeric (-1, 1, "-1", "1") and string ("desc", "asc",
 * case-insensitive) forms. Defaults to ascending (1) for unrecognized
 * values to match existing behavior.
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

// Default MongoDB options (without TLS - let connection string decide)
const defaultOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  minPoolSize: 2, // Keep minimum 2 connections open
};

/**
 * Get or create a MongoDB client for the given connection string
 * Multiple databases can share the same connection if they use the same URI
 */
export async function getMongoClient(connectionString) {
  // Return null if no connection string provided
  if (!connectionString) {
    return null;
  }

  // Check if we're in build time and should skip connections
  if (isBuildTime()) {
    console.log('Build time detected, skipping MongoDB connection in getMongoClient');
    return null;
  }

  // Create a hash of the connection string to use as a key
  const connectionHash = crypto.createHash('md5').update(connectionString).digest('hex');

  if (!connectionPool.has(connectionHash)) {

    // Determine connection options based on connection string
    let connectionOptions = { ...defaultOptions };

    // For local MongoDB connections, explicitly disable TLS if not in connection string
    if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
      if (!connectionString.includes('tls=') && !connectionString.includes('ssl=')) {
        connectionOptions.tls = false;
      }
    }

    const client = new MongoClient(connectionString, connectionOptions);

    try {
      // Connect immediately and store the connected client
      const connectedClient = await client.connect();

      // Store the connected client (not a promise)
      connectionPool.set(connectionHash, connectedClient);

      // Store metadata for tracking
      connectionMetadata.set(connectionHash, {
        created: new Date(),
        lastUsed: new Date(),
        connectionString: connectionString.replace(/\/\/.*:.*@/, '//***:***@'), // Hide credentials in logs
      });

      // Set up error handlers
      connectedClient.on('error', (error) => {
        console.error('MongoDB client error:', error);
        cleanup(connectionHash);
      });

      connectedClient.on('close', () => {
        console.log(`MongoDB connection closed for hash: ${connectionHash.substring(0, 8)}`);
        cleanup(connectionHash);
      });

    } catch (error) {
      console.error('MongoDB connection failed:', error);
      // During build time, return null instead of throwing
      if (isBuildTime()) {
        return null;
      }
      throw error;
    }
  }

  // Update last used timestamp
  const metadata = connectionMetadata.get(connectionHash);
  if (metadata) {
    metadata.lastUsed = new Date();
  }

  return connectionPool.get(connectionHash);
}

/**
 * Clean up a connection from the pool
 */
function cleanup(connectionHash) {
  connectionPool.delete(connectionHash);
  connectionMetadata.delete(connectionHash);
}

/**
 * Clean up idle connections (called periodically)
 */
function cleanupIdleConnections() {
  const now = new Date();
  const maxIdleTime = 30 * 60 * 1000; // 30 minutes for better performance
  
  for (const [hash, metadata] of connectionMetadata.entries()) {
    const idleTime = now - metadata.lastUsed;
    if (idleTime > maxIdleTime) {
      console.log(`Closing idle MongoDB connection for hash: ${hash.substring(0, 8)} (idle for ${Math.round(idleTime / 1000)}s)`);
      
      const client = connectionPool.get(hash);
      if (client) {
        client.close().catch(error => {
          console.error('Error closing idle connection:', error);
        });
      }
      
      cleanup(hash);
    }
  }
}

// Set up periodic cleanup of idle connections
if (typeof global !== 'undefined' && !global.mongoCleanupInterval) {
  global.mongoCleanupInterval = setInterval(cleanupIdleConnections, 10 * 60 * 1000); // Every 10 minutes
}

/**
 * Get connection pool status for monitoring
 */
export function getConnectionPoolStatus() {
  return Array.from(connectionMetadata.entries()).map(([hash, metadata]) => ({
    hash: hash.substring(0, 8),
    ...metadata,
    idleTime: new Date() - metadata.lastUsed
  }));
}

/**
 * Close all connections in the pool (for graceful shutdown)
 */
export async function closeAllConnections() {
  console.log('Closing all MongoDB connections...');
  
  const closePromises = [];
  
  for (const [hash, client] of connectionPool.entries()) {
    closePromises.push(
      client.close().catch(error => {
        console.error(`Error closing connection ${hash.substring(0, 8)}:`, error);
      })
    );
  }
  
  await Promise.all(closePromises);
  
  // Clear all pools
  connectionPool.clear();
  connectionMetadata.clear();
  
  // Clear the cleanup interval
  if (global.mongoCleanupInterval) {
    clearInterval(global.mongoCleanupInterval);
    delete global.mongoCleanupInterval;
  }
  
  console.log('All MongoDB connections closed');
}

// Disable shutdown handlers in development to prevent connection spam
// Only handle graceful shutdown in production
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
  process.on('SIGINT', closeAllConnections);
  process.on('SIGTERM', closeAllConnections);
}

/**
 * Lazy loading MongoDB client cache
 */
let _cachedClientPromise = null;

/**
 * Get default MongoDB client (lazy loading)
 * Only connects when actually called, safe for build time
 */
async function getDefaultClient() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI not set in environment variables');
    return null;
  }
  try {
    return await getMongoClient(process.env.MONGODB_URI);
  } catch (error) {
    console.error('Failed to create default MongoDB client:', error);
    return null;
  }
}

/**
 * Check if we're in a build environment
 */
function isBuildTime() {
  return process.env.NEXT_PHASE === 'phase-production-build' ||
         process.env.NODE_ENV === 'build' ||
         process.argv.includes('build') ||
         process.env.BUILD_MODE === 'true';
}

/**
 * Legacy export for backward compatibility
 * Returns a promise that resolves to the MongoDB client
 * Skips connection during build time to prevent build failures
 */
export const clientPromise = (function() {
  if (isBuildTime()) {
    console.log('Build time detected, skipping MongoDB connection');
    return Promise.resolve(null);
  }

  if (!_cachedClientPromise) {
    _cachedClientPromise = getDefaultClient();
  }

  return _cachedClientPromise;
})();

// Database operations for MongoDB connector
import { ObjectId } from 'mongodb';

/**
 * Build complex MongoDB filter from QueryBuilder operators
 * @param {Object} filterValue - Filter value with operators
 * @param {string} fieldName - Field name for geospatial queries
 * @returns {Object} MongoDB filter object
 */
function buildComplexFilter(filterValue, fieldName) {
  const mongoFilter = {};
  
  // Use for...of instead of forEach so return statements work properly
  for (const operator of Object.keys(filterValue)) {
    const value = filterValue[operator];
    
    switch (operator) {
      // Comparison operators
      case 'gt':
        mongoFilter.$gt = value;
        break;
      case 'gte':
        mongoFilter.$gte = value;
        break;
      case 'lt':
        mongoFilter.$lt = value;
        break;
      case 'lte':
        mongoFilter.$lte = value;
        break;
      case 'not':
        mongoFilter.$ne = value;
        break;
      case 'in':
        mongoFilter.$in = value;
        break;
        
      // String operators
      case 'contains':
        mongoFilter.$regex = escapeRegex(value);
        mongoFilter.$options = 'i';
        break;
      case 'starts_with':
        mongoFilter.$regex = '^' + escapeRegex(value);
        mongoFilter.$options = 'i';
        break;
      case 'ends_with':
        mongoFilter.$regex = escapeRegex(value) + '$';
        mongoFilter.$options = 'i';
        break;
        
      // Geospatial operators
      case 'nearBy':
        const nearFilter = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: value.coordinates
            },
            $maxDistance: value.maxDistance
          }
        };
        
        if (value.minDistance) {
          nearFilter.$near.$minDistance = value.minDistance;
        }
        
        return nearFilter; // Return immediately as this replaces the entire field filter
        
      case 'withinCircle':
        return {
          $geoWithin: {
            $centerSphere: [value.center, value.radius / 6378100] // Convert meters to radians
          }
        };
        
      case 'withinBounds':
        return {
          $geoWithin: {
            $box: [value.southwest, value.northeast]
          }
        };
        
      case 'withinGeometry':
        return {
          $geoWithin: {
            $geometry: value
          }
        };
        
      default:
        // If operator is not recognized, treat it as a direct value
        mongoFilter[operator] = value;
    }
  }
  
  return mongoFilter;
}

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert $regex condition to $regexMatch for aggregation expressions
 * @param {Object} condition - Condition with $regex
 * @returns {Object} $regexMatch condition
 */
function convertToRegexMatch(condition) {
  const fieldName = Object.keys(condition)[0];
  const regexObj = condition[fieldName];
  
  return {
    $regexMatch: {
      input: `$${fieldName}`,
      regex: regexObj.$regex,
      options: regexObj.$options || 'i'
    }
  };
}

async function getDatabase(databaseConfig) {
  // Use connection string from config, fallback to environment variable
  const connectionString = databaseConfig.connection || databaseConfig.config?.connection || process.env.MONGODB_URI;

  if (!connectionString) {
    console.error('MongoDB connection string not found in config or environment variables');
    return null;
  }

  // Get client from connection pool
  const client = await getMongoClient(connectionString);

  if (!client) {
    console.warn('MongoDB client not available - returning null database');
    return null;
  }

  // Use database name from config, fallback to environment variable
  const dbName = databaseConfig.database || databaseConfig.config?.database || process.env.MONGODB_DB_NAME || process.env.WEBAPP_DB_NAME || 'apps_db';

  return client.db(dbName);
}

/**
 * Perform intelligent search across searchable fields
 * @param {string} searchTerm - Search query
 * @param {Object} databaseConfig - Database configuration
 * @param {number} limit - Maximum results (default: 10)
 * @param {Object} additionalFilters - Additional query filters
 * @returns {Promise<Array>} Search results with relevance scoring
 */
export async function searchData(searchTerm, databaseConfig, limit = 10, additionalFilters = {}) {
  try {
    if (!searchTerm || searchTerm.length < (databaseConfig.search?.minLength || 2)) {
      return [];
    }

    const db = await getDatabase(databaseConfig);
    const collection = db.collection(databaseConfig.collection || databaseConfig.config?.collection || 'data');
    
    // Build search pipeline
    const pipeline = [];
    
    // Get searchable fields from schema
    const searchableFields = getSearchableFields(databaseConfig.schema || {});
    
    if (searchableFields.length === 0) {
      // Fallback to basic text search if no searchable fields defined
      const mongoQuery = {
        $text: { $search: searchTerm },
        ...additionalFilters
      };
      
      // Note: siteId filtering is handled by jason database connector only
      // MongoDB connector is for user's private databases
      
      const results = await collection
        .find(mongoQuery)
        .limit(limit)
        .toArray();

      return results.map(doc => {
        const plain = decryptFieldsForRead(doc, databaseConfig.schema);
        return {
          id: plain._id.toString(),
          ...plain,
          _id: plain._id.toString(),
          _relevanceScore: 1
        };
      });
    }
    
    // Create search conditions for each searchable field
    const searchConditions = [];
    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length > 1);
    
    // Build AND conditions for each word (records must contain ALL words)
    const wordMatchConditions = [];
    const scoreExpressions = [];
    
    searchWords.forEach((word, wordIndex) => {
      // For each word, create OR conditions across all searchable fields
      const fieldConditionsForWord = [];
      
      searchableFields.forEach(field => {
        const fieldWeight = field.searchWeight || 1;
        
        // Starts with word (high score)
        const startsWithCondition = { [field.name]: { $regex: '^' + escapeRegex(word), $options: 'i' } };
        fieldConditionsForWord.push(startsWithCondition);
        
        // Add score for this condition
        const startsWithRegexCondition = convertToRegexMatch(startsWithCondition);
        scoreExpressions.push({
          $cond: [
            startsWithRegexCondition,
            fieldWeight * 5,
            0
          ]
        });
        
        // Contains word (medium score) 
        const containsCondition = { [field.name]: { $regex: escapeRegex(word), $options: 'i' } };
        fieldConditionsForWord.push(containsCondition);
        
        // Add score for this condition
        const containsRegexCondition = convertToRegexMatch(containsCondition);
        scoreExpressions.push({
          $cond: [
            containsRegexCondition,
            fieldWeight * 2,
            0
          ]
        });
        
        // Fuzzy matching for longer words (if enabled)
        if (databaseConfig.search?.fuzzyMatch && word.length > 3) {
          const fuzzyPattern = createFuzzyPattern(word);
          const fuzzyCondition = { [field.name]: { $regex: fuzzyPattern, $options: 'i' } };
          fieldConditionsForWord.push(fuzzyCondition);
          
          // Add score for this condition
          const fuzzyRegexCondition = convertToRegexMatch(fuzzyCondition);
          scoreExpressions.push({
            $cond: [
              fuzzyRegexCondition,
              fieldWeight * 1,
              0
            ]
          });
        }
      });
      
      // Each word must match in at least one field
      wordMatchConditions.push({ $or: fieldConditionsForWord });
    });
    
    // Add exact phrase match as bonus scoring (highest score)
    searchableFields.forEach(field => {
      const fieldWeight = field.searchWeight || 1;
      const exactPhraseCondition = { [field.name]: { $regex: escapeRegex(searchTerm), $options: 'i' } };
      
      // Add score for exact phrase match
      const exactPhraseRegexCondition = convertToRegexMatch(exactPhraseCondition);
      scoreExpressions.push({
        $cond: [
          exactPhraseRegexCondition,
          fieldWeight * 10,
          0
        ]
      });
    });
    
    // Match stage - ALL words must be found (AND logic) plus additional filters
    const matchStage = {
      $match: {
        $and: [
          ...wordMatchConditions, // Each word must match in at least one field
          additionalFilters
        ]
      }
    };
    
    // Note: siteId filtering is handled by the jason database connector only
    // MongoDB connector is for user's private databases - no siteId filtering needed
    
    // Exclude soft-deleted records
    if (databaseConfig.softDelete === true) {
      matchStage.$match.$and.push({ deletedAt: { $exists: false } });
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
        // Determine the output field name - use 'as' if provided, otherwise use 'class'
        const outputFieldName = join.as || join.class;
        
        const lookupStage = {
          $lookup: {
            from: join.collection || join.class,
            localField: join.key || join.localField,
            foreignField: join.foreignField || join.foreignKey || '_id',
            as: `${outputFieldName}_data`
          }
        };
        pipeline.push(lookupStage);
        
        // Handle join types properly
        if (join.type === 'left') {
          // Left join: unwind with preserveNullAndEmptyArrays to keep records without matches
          pipeline.push({
            $unwind: {
              path: `$${outputFieldName}_data`,
              preserveNullAndEmptyArrays: true // Keep records even if no join match
            }
          });
        } else if (join.type === 'inner' || !join.type) {
          // Inner join: unwind without preserving nulls (default behavior)
          pipeline.push({
            $unwind: {
              path: `$${outputFieldName}_data`,
              preserveNullAndEmptyArrays: false
            }
          });
        }
        
        // Add joined fields
        if (join.fields && join.fields.length > 0) {
          const projection = {};
          join.fields.forEach(field => {
            projection[field] = `$${outputFieldName}_data.${field}`;
          });
          projection._id = `$${outputFieldName}_data._id`;
          
          pipeline.push({
            $addFields: {
              [outputFieldName]: projection
            }
          });
        } else {
          pipeline.push({
            $addFields: {
              [outputFieldName]: `$${outputFieldName}_data`
            }
          });
        }
        
        pipeline.push({
          $project: {
            [`${outputFieldName}_data`]: 0
          }
        });
      });
    }
    
    // Sort by relevance score (descending)
    pipeline.push({
      $sort: { _relevanceScore: -1, createdAt: -1 }
    });
    
    // Limit results
    pipeline.push({
      $limit: limit
    });
    
    // === FOCUSED DEBUG: Show exact query being executed ===
    // console.log('\n🔍 MONGODB SEARCH QUERY DEBUG:');
    // console.log(`Collection: ${databaseConfig.collection || databaseConfig.config?.collection || 'data'}`);
    // console.log(`Database: ${databaseConfig.database || databaseConfig.config?.database || process.env.MONGODB_DB_NAME || 'apps_db'}`);
    // console.log(`Connection: ${databaseConfig.connection || databaseConfig.config?.connection || process.env.MONGODB_URI}`);
    // console.log(`Search term: "${searchTerm}"`);
    // console.log(`Limit: ${limit}`);
    // console.log(`Additional filters:`, JSON.stringify(additionalFilters, null, 2));
    // console.log('Pipeline stages:');
    // pipeline.forEach((stage, index) => {
    //   console.log(`  Stage ${index + 1}: ${Object.keys(stage)[0]}`);
    //   if (stage.$match) {
    //     console.log(`    Match conditions: ${JSON.stringify(stage.$match, null, 2)}`);
    //   }
    // });
    // console.log('=== END DEBUG ===\n');
    
    // // Execute search
    // console.log('Executing MongoDB aggregation...');
    const results = await collection.aggregate(pipeline).toArray();

    // Transform results (decrypt encrypted fields)
    return results.map(doc => {
      const plain = decryptFieldsForRead(doc, databaseConfig.schema);
      return {
        id: plain._id.toString(),
        ...plain,
        _id: plain._id.toString()
      };
    });

  } catch (error) {
    console.error('MongoDB searchData error:', error);
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
        searchWeight: fieldConfig.searchWeight || 1,
        searchFrom: fieldConfig.searchFrom || fieldName
      });
    }
  });
  
  return searchableFields;
}

/**
 * Create fuzzy pattern for approximate matching
 * @param {string} word - Word to create fuzzy pattern for
 * @returns {string} Regex pattern for fuzzy matching
 */
function createFuzzyPattern(word) {
  // Create pattern that allows 1 character substitution, insertion, or deletion
  let pattern = '';
  for (let i = 0; i < word.length; i++) {
    const char = escapeRegex(word[i]);
    if (i === 0) {
      pattern += `(${char}|.${char}|${char}.)?`;
    } else if (i === word.length - 1) {
      pattern += `(${char}|.${char}|${char}.)?`;
    } else {
      pattern += `(${char}|.)?`;
    }
  }
  return pattern;
}

export async function fetchData(query, databaseConfig) {
  try {
    console.log('🔍 MONGODB FETCHDATA DEBUG - Query:', JSON.stringify(query, null, 2));
    console.log('🔍 MONGODB FETCHDATA DEBUG - DatabaseConfig has joins:', !!databaseConfig.joins, databaseConfig.joins?.length || 0);

    const db = await getDatabase(databaseConfig);
    if (!db) {
      console.warn('Database not available - returning empty results');
      return [];
    }
    const collection = db.collection(databaseConfig.collection || databaseConfig.config?.collection || 'data');
    
    // Build MongoDB query
    const mongoQuery = {};
    
    // Note: siteId filtering is handled by jason database connector only
    // MongoDB connector is for user's private databases - no multi-tenant isolation needed
    
    // Exclude soft-deleted records if soft delete is enabled
    if (databaseConfig.softDelete === true && !query.includeDeleted) {
      mongoQuery.deletedAt = { $exists: false };
    }
    
    // Add query filters (support both query.filters and query.query formats)
    const filters = query.filters || query.query;
    // Reject filters that reference encrypted fields — they can't be queried.
    assertNoEncryptedFieldInFilter(filters, databaseConfig.schema);
    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = filters[key];

        if (key === '_id' && typeof value === 'string') {
          // Try to use ObjectId if it's a valid 24-character hex string, otherwise use as-is
          if (value.length === 24 && /^[0-9a-fA-F]{24}$/.test(value)) {
            mongoQuery[key] = new ObjectId(value);
          } else {
            // Use custom ID as-is (for databases with custom primary keys)
            mongoQuery[key] = value;
          }
        } else if (typeof value === 'object' && value !== null) {
          // Handle complex filters (comparison operators, geospatial, etc.)
          const complexFilter = buildComplexFilter(value, key);
          mongoQuery[key] = complexFilter;
        } else {
          mongoQuery[key] = value;
        }
      });
    }
    
    // Handle text search
    if (query.search) {
      mongoQuery.$text = { $search: query.search };
    }
    
    // Build sort options. Accepts numeric (-1, 1, "-1", "1") and string
    // ("desc", "asc", case-insensitive) forms so page JSON, the fluent API,
    // and raw Mongo-style sort specs all behave the same.
    const sortOptions = {};
    if (query.sort) {
      Object.keys(query.sort).forEach(key => {
        sortOptions[key] = normalizeSortDirection(query.sort[key]);
      });
    }
    
    // Handle joins using aggregation pipeline
    if (databaseConfig.joins && databaseConfig.joins.length > 0) {
      //console.log('🔍 MONGODB JOIN DEBUG - Processing joins:', databaseConfig.joins);
      
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
              distanceField: '_distance',
              maxDistance: geoQuery.$near.$maxDistance,
              spherical: true
            }
          };
          
          // Remove geospatial query from regular match stage
          const filteredQuery = { ...mongoQuery };
          delete filteredQuery[fieldName];
          
          // Add $geoNear as first stage
          pipeline.push(geoNearStage);
          //console.log('🔍 MONGODB JOIN DEBUG - GeoNear stage:', JSON.stringify(geoNearStage, null, 2));
          
          // Add remaining filters as match stage if any
          if (Object.keys(filteredQuery).length > 0) {
            pipeline.push({ $match: filteredQuery });
           // console.log('🔍 MONGODB JOIN DEBUG - Match stage (after geo):', JSON.stringify({ $match: filteredQuery }, null, 2));
          }
        }
      } else {
        // Add regular match stage if no geospatial queries
        if (Object.keys(mongoQuery).length > 0) {
          pipeline.push({ $match: mongoQuery });
          //console.log('🔍 MONGODB JOIN DEBUG - Match stage:', JSON.stringify({ $match: mongoQuery }, null, 2));
        }
      }
      
      // Add lookup stages for joins
      databaseConfig.joins.forEach(join => {
        //console.log('🔍 MONGODB JOIN DEBUG - Processing join:', join);
        
        // Determine the output field name - use 'as' if provided, otherwise use 'class'
        const outputFieldName = join.as || join.class;
        
        // Standard MongoDB relationship using $lookup
        const lookupStage = {
          $lookup: {
            from: join.collection || join.class,
            localField: join.key || join.localField,
            foreignField: join.foreignField || join.foreignKey || '_id',
            as: `${outputFieldName}_data`
          }
        };
        
        //console.log('🔍 MONGODB JOIN DEBUG - Lookup stage:', JSON.stringify(lookupStage, null, 2));
        pipeline.push(lookupStage);
        
        // Handle join types properly
        if (join.type === 'left') {
          // Left join: unwind with preserveNullAndEmptyArrays to keep records without matches
          pipeline.push({
            $unwind: {
              path: `$${outputFieldName}_data`,
              preserveNullAndEmptyArrays: true // Keep records even if no join match
            }
          });
        } else if (join.type === 'inner' || !join.type) {
          // Inner join: unwind without preserving nulls (default behavior)
          pipeline.push({
            $unwind: {
              path: `$${outputFieldName}_data`,
              preserveNullAndEmptyArrays: false
            }
          });
        }
        
        // Add the joined object with selected fields
        if (join.fields && join.fields.length > 0) {
          // Create projection for specific fields only
          const projection = {};
          join.fields.forEach(field => {
            projection[field] = `$${outputFieldName}_data.${field}`;
          });
          projection._id = `$${outputFieldName}_data._id`; // Always include ID
          
          pipeline.push({
            $addFields: {
              [outputFieldName]: projection
            }
          });
        } else {
          // If no specific fields, add the whole joined object
          pipeline.push({
            $addFields: {
              [outputFieldName]: `$${outputFieldName}_data`
            }
          });
        }
        
        // Remove the temporary _data field
        pipeline.push({
          $project: {
            [`${outputFieldName}_data`]: 0
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
      //console.log('🔍 MONGODB JOIN DEBUG - Full pipeline:', JSON.stringify(pipeline, null, 2));
      const results = await collection.aggregate(pipeline).toArray();
      //console.log('🔍 MONGODB JOIN DEBUG - Raw results (first result):', JSON.stringify(results[0], null, 2));
      
      // Transform results for compatibility (decrypt encrypted fields)
      const transformedResults = results.map(doc => {
        const plain = decryptFieldsForRead(doc, databaseConfig.schema);
        return {
          id: plain._id.toString(),
          ...plain,
          _id: plain._id.toString()
        };
      });
      //console.log('🔍 MONGODB JOIN DEBUG - Transformed result (first):', JSON.stringify(transformedResults[0], null, 2));
      return transformedResults;
    }
    
    // Execute standard query (no joins)
    //console.log('🔍 Final MongoDB Query (no joins):', JSON.stringify(mongoQuery, null, 2));
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

    // Transform results for compatibility (decrypt encrypted fields)
    return results.map(doc => {
      const plain = decryptFieldsForRead(doc, databaseConfig.schema);
      return {
        id: plain._id.toString(),
        ...plain,
        _id: plain._id.toString()
      };
    });
    
  } catch (error) {
    console.error('MongoDB fetchData error:', error);
    throw error;
  }
}

export async function createData(data, databaseConfig) {
  try {
    const db = await getDatabase(databaseConfig);
    if (!db) {
      throw new Error('Database not available - cannot create data');
    }
    const collection = db.collection(databaseConfig.collection || databaseConfig.config?.collection || 'data');
    
    // Prepare document
    const document = {
      ...data.data || data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Note: siteId is handled by jason database connector only
    // MongoDB connector doesn't add siteId to user's private databases
    
    // Add userId if available
    if (databaseConfig.userId) {
      document.createdBy = databaseConfig.userId;
      document.updatedBy = databaseConfig.userId;
    }
    
    // Remove any _id if provided (MongoDB will generate)
    delete document._id;
    delete document.id;

    // Encrypt fields marked { encrypted: true } in the schema before insert
    const encryptedDocument = encryptFieldsForWrite(document, databaseConfig.schema);

    const result = await collection.insertOne(encryptedDocument);

    // Return created document (decrypt encrypted fields so callers see plaintext)
    const createdDoc = await collection.findOne({ _id: result.insertedId });
    const plain = decryptFieldsForRead(createdDoc, databaseConfig.schema);
    return {
      id: plain._id.toString(),
      ...plain,
      _id: plain._id.toString()
    };

  } catch (error) {
    console.error('MongoDB createData error:', error);
    throw error;
  }
}

export async function updateData(data, databaseConfig) {
  try {
    const db = await getDatabase(databaseConfig);
    const collection = db.collection(databaseConfig.collection || databaseConfig.config?.collection || 'data');

    const { id, fullRecord, ...updateData } = data;

    if (!id) {
      throw new Error('ID is required for update operation');
    }

    const inputData = updateData.data || updateData;

    // Validate against schema if defined (MongoDB connector supports optional schema validation)
    if (databaseConfig.schema) {
      // Import validation from jason connector if needed
      const { validateSchema } = await import('../jason/index.js');

      if (fullRecord) {
        // Validate the complete record to ensure all required fields are present
        validateSchema(fullRecord, databaseConfig.schema, false);
      } else {
        // Validate only the fields being updated (partial update)
        validateSchema(inputData, databaseConfig.schema, true);
      }
    }

    // Prepare update document — encrypt fields marked { encrypted: true } in schema
    const encryptedInput = encryptFieldsForWrite(inputData, databaseConfig.schema);
    const update = {
      $set: {
        ...encryptedInput,
        updatedAt: new Date()
      }
    };

    // Add updatedBy if userId is available
    if (databaseConfig.userId) {
      update.$set.updatedBy = databaseConfig.userId;
    }

    // Remove fields that shouldn't be updated
    delete update.$set._id;
    delete update.$set.id;
    delete update.$set.siteId;
    delete update.$set.createdAt;
    delete update.$set.createdBy;

    const query = {
      _id: new ObjectId(id)
    };

    // Note: siteId filtering is handled by jason database connector only
    // MongoDB connector is for user's private databases

    const result = await collection.updateOne(query, update);

    if (result.matchedCount === 0) {
      throw new Error('Document not found or access denied');
    }

    // Return updated document (decrypt encrypted fields for caller)
    const updatedDoc = await collection.findOne(query);
    const plain = decryptFieldsForRead(updatedDoc, databaseConfig.schema);
    return {
      id: plain._id.toString(),
      ...plain,
      _id: plain._id.toString()
    };

  } catch (error) {
    console.error('MongoDB updateData error:', error);
    throw error;
  }
}

export async function deleteData(data, databaseConfig) {
  try {
    const db = await getDatabase(databaseConfig);
    const collection = db.collection(databaseConfig.collection || databaseConfig.config?.collection || 'data');
    
    const id = data.id || data;
    
    if (!id) {
      throw new Error('ID is required for delete operation');
    }
    
    const query = {
      _id: new ObjectId(id)
    };
    
    // Note: siteId filtering is handled by jason database connector only
    // MongoDB connector is for user's private databases
    
    // Check if document exists first
    const existingDoc = await collection.findOne(query);
    if (!existingDoc) {
      throw new Error('Document not found or access denied');
    }
    
    // Check if soft delete is enabled (default: false)
    if (databaseConfig.softDelete === true) {
      // Perform soft delete (add deletedAt field)
      const result = await collection.updateOne(query, {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      return {
        id: existingDoc._id.toString(),
        deleted: true,
        deletedAt: new Date()
      };
    } else {
      // Perform hard delete (actually remove the document)
      const result = await collection.deleteOne(query);
      
      return {
        id: existingDoc._id.toString(),
        deleted: true
      };
    }
    
  } catch (error) {
    console.error('MongoDB deleteData error:', error);
    throw error;
  }
}

// ===== REAL-TIME SUBSCRIPTIONS =====

/**
 * Subscribe to real-time changes using MongoDB Change Streams
 * @param {Object} filters - Subscription filters
 * @param {Function} callback - Change callback function
 * @param {Object} databaseConfig - Database configuration
 * @returns {Promise<Object>} Subscription object with unsubscribe method
 */
export async function subscribe(filters, callback, databaseConfig) {
  try {
    const db = await getDatabase(databaseConfig);
    const collection = db.collection(databaseConfig.collection || databaseConfig.config?.collection || 'data');
    
    // Build match pipeline for change stream
    const pipeline = [];
    
    // Filter by siteId for multi-tenancy if available
    const matchFilter = {};
    
    // Note: siteId filtering is handled by jason database connector only
    // MongoDB connector is for user's private databases
    
    // Add user-defined filters
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (key === '_id' && typeof value === 'string') {
          matchFilter[`fullDocument.${key}`] = new ObjectId(value);
        } else {
          matchFilter[`fullDocument.${key}`] = value;
        }
      });
    }
    
    // Add the match stage to pipeline
    pipeline.push({ $match: matchFilter });
    
    //console.log('MongoDB Change Stream - Starting subscription with pipeline:', JSON.stringify(pipeline, null, 2));
    
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
      console.error('MongoDB Change Stream error:', error);
      callback({
        type: 'error',
        error: error.message
      });
    });
    
    // Handle close
    changeStream.on('close', () => {
      console.log('MongoDB Change Stream closed');
      callback({
        type: 'close'
      });
    });
    
    console.log('MongoDB Change Stream - Subscription started successfully');
    
    return {
      unsubscribe: async () => {
        try {
          await changeStream.close();
          console.log('MongoDB Change Stream - Subscription closed');
        } catch (error) {
          console.error('Error closing change stream:', error);
        }
      }
    };
    
  } catch (error) {
    console.error('MongoDB subscribe error:', error);
    throw error;
  }
}

/**
 * Transform MongoDB change event to standard format
 * @param {Object} change - MongoDB change event
 * @returns {Object} Transformed change event
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

// Removed Parse-style join handling - using standard MongoDB relationships only

/**
 * Transform MongoDB document to standard format
 * @param {Object} doc - MongoDB document
 * @returns {Object} Transformed document
 */
function transformDocument(doc) {
  if (!doc) return null;
  
  return {
    id: doc._id.toString(),
    ...doc,
    _id: doc._id.toString()
  };
}