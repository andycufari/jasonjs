// core/databases/mongodb/indexing.js
// MongoDB geospatial indexing utilities

import { getMongoClient } from './index.js';

/**
 * Create a 2dsphere index for geospatial queries
 * @param {Object} databaseConfig - Database configuration
 * @param {string} collection - Collection name
 * @param {string} field - Field name to index
 * @param {Object} options - Additional index options
 * @returns {Promise<Object>} Index creation result
 */
export async function create2dsphereIndex(databaseConfig, collection, field, options = {}) {
  try {
    const connectionString = databaseConfig.connection || process.env.MONGODB_URI;
    if (!connectionString) {
      throw new Error('MongoDB connection string not found');
    }

    const client = await getMongoClient(connectionString);
    const dbName = databaseConfig.database || process.env.MONGODB_DB_NAME || 'apps_db';
    const db = client.db(dbName);
    const col = db.collection(collection);

    const indexSpec = { [field]: '2dsphere' };
    const indexOptions = {
      name: `${field}_2dsphere`,
      background: true, // Create index in background
      ...options
    };

    console.log(`Creating 2dsphere index on ${collection}.${field}...`);
    const result = await col.createIndex(indexSpec, indexOptions);
    console.log(`✅ 2dsphere index created: ${result}`);

    return {
      success: true,
      indexName: result,
      field,
      collection,
      type: '2dsphere'
    };

  } catch (error) {
    console.error('Failed to create 2dsphere index:', error);
    throw error;
  }
}

/**
 * Create a 2d index for legacy coordinate pairs
 * @param {Object} databaseConfig - Database configuration  
 * @param {string} collection - Collection name
 * @param {string} field - Field name to index
 * @param {Object} options - Additional index options
 * @returns {Promise<Object>} Index creation result
 */
export async function create2dIndex(databaseConfig, collection, field, options = {}) {
  try {
    const connectionString = databaseConfig.connection || process.env.MONGODB_URI;
    if (!connectionString) {
      throw new Error('MongoDB connection string not found');
    }

    const client = await getMongoClient(connectionString);
    const dbName = databaseConfig.database || process.env.MONGODB_DB_NAME || 'apps_db';
    const db = client.db(dbName);
    const col = db.collection(collection);

    const indexSpec = { [field]: '2d' };
    const indexOptions = {
      name: `${field}_2d`,
      background: true,
      min: -180,
      max: 180,
      ...options
    };

    console.log(`Creating 2d index on ${collection}.${field}...`);
    const result = await col.createIndex(indexSpec, indexOptions);
    console.log(`✅ 2d index created: ${result}`);

    return {
      success: true,
      indexName: result,
      field,
      collection,
      type: '2d'
    };

  } catch (error) {
    console.error('Failed to create 2d index:', error);
    throw error;
  }
}

/**
 * Create compound index with geospatial field
 * @param {Object} databaseConfig - Database configuration
 * @param {string} collection - Collection name
 * @param {Object} indexSpec - Index specification (e.g., { location: '2dsphere', category: 1 })
 * @param {Object} options - Additional index options
 * @returns {Promise<Object>} Index creation result
 */
export async function createCompoundGeoIndex(databaseConfig, collection, indexSpec, options = {}) {
  try {
    const connectionString = databaseConfig.connection || process.env.MONGODB_URI;
    if (!connectionString) {
      throw new Error('MongoDB connection string not found');
    }

    const client = await getMongoClient(connectionString);
    const dbName = databaseConfig.database || process.env.MONGODB_DB_NAME || 'apps_db';
    const db = client.db(dbName);
    const col = db.collection(collection);

    const indexOptions = {
      background: true,
      ...options
    };

    if (!indexOptions.name) {
      // Generate index name from spec
      const nameparts = Object.keys(indexSpec).map(key => `${key}_${indexSpec[key]}`);
      indexOptions.name = nameparts.join('_');
    }

    console.log(`Creating compound geospatial index on ${collection}:`, indexSpec);
    const result = await col.createIndex(indexSpec, indexOptions);
    console.log(`✅ Compound index created: ${result}`);

    return {
      success: true,
      indexName: result,
      indexSpec,
      collection,
      type: 'compound_geo'
    };

  } catch (error) {
    console.error('Failed to create compound geospatial index:', error);
    throw error;
  }
}

/**
 * List all indexes on a collection
 * @param {Object} databaseConfig - Database configuration
 * @param {string} collection - Collection name
 * @returns {Promise<Array>} List of indexes
 */
export async function listIndexes(databaseConfig, collection) {
  try {
    const connectionString = databaseConfig.connection || process.env.MONGODB_URI;
    if (!connectionString) {
      throw new Error('MongoDB connection string not found');
    }

    const client = await getMongoClient(connectionString);
    const dbName = databaseConfig.database || process.env.MONGODB_DB_NAME || 'apps_db';
    const db = client.db(dbName);
    const col = db.collection(collection);

    const indexes = await col.listIndexes().toArray();
    return indexes;

  } catch (error) {
    console.error('Failed to list indexes:', error);
    throw error;
  }
}

/**
 * Check if a geospatial index exists on a field
 * @param {Object} databaseConfig - Database configuration
 * @param {string} collection - Collection name
 * @param {string} field - Field name
 * @returns {Promise<Object|null>} Index info or null if not found
 */
export async function getGeoIndex(databaseConfig, collection, field) {
  try {
    const indexes = await listIndexes(databaseConfig, collection);
    
    const geoIndex = indexes.find(index => {
      const spec = index.key;
      return spec[field] === '2dsphere' || spec[field] === '2d';
    });

    return geoIndex || null;

  } catch (error) {
    console.error('Failed to check for geo index:', error);
    throw error;
  }
}

/**
 * Auto-create recommended geospatial indexes for a collection
 * @param {Object} databaseConfig - Database configuration  
 * @param {string} collection - Collection name
 * @param {Array<string>} locationFields - Array of location field names
 * @param {Object} options - Index creation options
 * @returns {Promise<Array>} Results from index creation
 */
export async function setupGeoIndexes(databaseConfig, collection, locationFields, options = {}) {
  const results = [];
  
  for (const field of locationFields) {
    try {
      // Check if index already exists
      const existingIndex = await getGeoIndex(databaseConfig, collection, field);
      
      if (existingIndex) {
        console.log(`⚠️  Geospatial index already exists on ${collection}.${field}: ${existingIndex.name}`);
        results.push({
          field,
          status: 'exists',
          indexName: existingIndex.name,
          indexType: existingIndex.key[field]
        });
        continue;
      }

      // Create 2dsphere index (recommended for modern geospatial queries)
      const result = await create2dsphereIndex(databaseConfig, collection, field, options);
      results.push({
        field,
        status: 'created',
        ...result
      });

    } catch (error) {
      console.error(`Failed to setup geo index for ${field}:`, error);
      results.push({
        field,
        status: 'error',
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Database health check for geospatial queries
 * @param {Object} databaseConfig - Database configuration
 * @param {string} collection - Collection name
 * @param {Array<string>} locationFields - Array of location field names to check
 * @returns {Promise<Object>} Health check results
 */
export async function geoHealthCheck(databaseConfig, collection, locationFields) {
  const health = {
    collection,
    locationFields: [],
    recommendations: [],
    status: 'healthy'
  };

  try {
    const connectionString = databaseConfig.connection || process.env.MONGODB_URI;
    if (!connectionString) {
      throw new Error('MongoDB connection string not found');
    }

    const client = await getMongoClient(connectionString);
    const dbName = databaseConfig.database || process.env.MONGODB_DB_NAME || 'apps_db';
    const db = client.db(dbName);
    const col = db.collection(collection);

    // Check collection stats
    const stats = await col.stats();
    health.documentCount = stats.count;

    // Check each location field
    for (const field of locationFields) {
      const fieldHealth = {
        field,
        hasIndex: false,
        indexType: null,
        sampleValidation: { checked: 0, valid: 0, invalid: 0 }
      };

      // Check for geospatial index
      const geoIndex = await getGeoIndex(databaseConfig, collection, field);
      if (geoIndex) {
        fieldHealth.hasIndex = true;
        fieldHealth.indexType = geoIndex.key[field];
        fieldHealth.indexName = geoIndex.name;
      } else {
        health.recommendations.push(`Create geospatial index on field '${field}' for better query performance`);
        if (health.status === 'healthy') health.status = 'needs_optimization';
      }

      // Sample documents to validate coordinate format
      const samples = await col.find({ [field]: { $exists: true } }).limit(10).toArray();
      fieldHealth.sampleValidation.checked = samples.length;

      for (const doc of samples) {
        const coords = doc[field];
        if (Array.isArray(coords) && coords.length === 2 && 
            typeof coords[0] === 'number' && typeof coords[1] === 'number' &&
            coords[0] >= -180 && coords[0] <= 180 && 
            coords[1] >= -90 && coords[1] <= 90) {
          fieldHealth.sampleValidation.valid++;
        } else {
          fieldHealth.sampleValidation.invalid++;
        }
      }

      if (fieldHealth.sampleValidation.invalid > 0) {
        health.recommendations.push(`Field '${field}' contains invalid coordinates. Ensure format is [longitude, latitude]`);
        health.status = 'has_issues';
      }

      health.locationFields.push(fieldHealth);
    }

  } catch (error) {
    health.status = 'error';
    health.error = error.message;
  }

  return health;
}

/**
 * Geospatial setup wizard - interactive setup for development
 */
export const setupWizard = {
  /**
   * Quick setup for common location patterns
   * @param {Object} databaseConfig - Database configuration
   * @param {string} collection - Collection name
   * @returns {Promise<Object>} Setup results
   */
  async quickSetup(databaseConfig, collection) {
    console.log('🗺️  Starting geospatial quick setup...');
    
    const commonLocationFields = ['location', 'coordinates', 'position', 'latlng', 'coords'];
    const foundFields = [];
    
    try {
      // Check which fields exist in the collection
      const connectionString = databaseConfig.connection || process.env.MONGODB_URI;
      const client = await getMongoClient(connectionString);
      const dbName = databaseConfig.database || process.env.MONGODB_DB_NAME || 'apps_db';
      const db = client.db(dbName);
      const col = db.collection(collection);
      
      for (const field of commonLocationFields) {
        const count = await col.countDocuments({ [field]: { $exists: true } });
        if (count > 0) {
          foundFields.push({ field, count });
          console.log(`📍 Found location field '${field}' in ${count} documents`);
        }
      }
      
      if (foundFields.length === 0) {
        console.log('ℹ️  No common location fields found. Use setupGeoIndexes() manually.');
        return { foundFields: [], indexesCreated: [] };
      }
      
      // Create indexes for found fields
      const fieldNames = foundFields.map(f => f.field);
      const results = await setupGeoIndexes(databaseConfig, collection, fieldNames);
      
      console.log('✅ Geospatial setup complete!');
      return { foundFields, indexesCreated: results };
      
    } catch (error) {
      console.error('❌ Quick setup failed:', error);
      throw error;
    }
  }
};