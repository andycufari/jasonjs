// core/databases/QueryBuilder.js

export class QueryBuilder {
  constructor(database, databaseId, initialFilters = {}) {
    this.database = database;
    this.databaseId = databaseId;
    this.filters = { ...initialFilters };
    this.options = {};
    this.isClient = typeof window !== 'undefined';
  }
  
  /**
   * Add greater than filter
   * @param {string} field - Field name
   * @param {*} value - Value to compare
   * @returns {QueryBuilder} Chainable
   */
  gt(field, value) {
    this.filters[field] = { ...this.filters[field], gt: value };
    return this;
  }
  
  /**
   * Add greater than or equal filter
   * @param {string} field - Field name
   * @param {*} value - Value to compare
   * @returns {QueryBuilder} Chainable
   */
  gte(field, value) {
    this.filters[field] = { ...this.filters[field], gte: value };
    return this;
  }
  
  /**
   * Add less than filter
   * @param {string} field - Field name
   * @param {*} value - Value to compare
   * @returns {QueryBuilder} Chainable
   */
  lt(field, value) {
    this.filters[field] = { ...this.filters[field], lt: value };
    return this;
  }
  
  /**
   * Add less than or equal filter
   * @param {string} field - Field name
   * @param {*} value - Value to compare
   * @returns {QueryBuilder} Chainable
   */
  lte(field, value) {
    this.filters[field] = { ...this.filters[field], lte: value };
    return this;
  }
  
  /**
   * Add contains filter
   * @param {string} field - Field name
   * @param {*} value - Value to search for
   * @returns {QueryBuilder} Chainable
   */
  contains(field, value) {
    this.filters[field] = { ...this.filters[field], contains: value };
    return this;
  }
  
  /**
   * Add starts with filter
   * @param {string} field - Field name
   * @param {string} value - Value to search for
   * @returns {QueryBuilder} Chainable
   */
  startsWith(field, value) {
    this.filters[field] = { ...this.filters[field], starts_with: value };
    return this;
  }
  
  /**
   * Add ends with filter
   * @param {string} field - Field name
   * @param {string} value - Value to search for
   * @returns {QueryBuilder} Chainable
   */
  endsWith(field, value) {
    this.filters[field] = { ...this.filters[field], ends_with: value };
    return this;
  }
  
  /**
   * Add in array filter
   * @param {string} field - Field name
   * @param {Array} values - Values to match
   * @returns {QueryBuilder} Chainable
   */
  in(field, values) {
    this.filters[field] = { ...this.filters[field], in: values };
    return this;
  }
  
  /**
   * Add not equal filter
   * @param {string} field - Field name
   * @param {*} value - Value to exclude
   * @returns {QueryBuilder} Chainable
   */
  not(field, value) {
    this.filters[field] = { ...this.filters[field], not: value };
    return this;
  }

  // ===== GEOSPATIAL QUERIES =====

  /**
   * Find documents near a point (requires geospatial index)
   * @param {string} field - Location field name
   * @param {Array<number>} coordinates - [longitude, latitude] coordinates
   * @param {number} maxDistance - Maximum distance in meters
   * @param {number} minDistance - Minimum distance in meters (optional)
   * @returns {QueryBuilder} Chainable
   */
  nearBy(field, coordinates, maxDistance, minDistance = null) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      throw new Error('Coordinates must be an array of [longitude, latitude]');
    }
    
    this.filters[field] = {
      ...this.filters[field],
      nearBy: {
        coordinates,
        maxDistance,
        minDistance
      }
    };
    return this;
  }

  /**
   * Find documents within a geometric shape
   * @param {string} field - Location field name
   * @param {Object} geometry - GeoJSON geometry object
   * @returns {QueryBuilder} Chainable
   */
  withinGeometry(field, geometry) {
    this.filters[field] = {
      ...this.filters[field],
      withinGeometry: geometry
    };
    return this;
  }

  /**
   * Find documents within a circular area
   * @param {string} field - Location field name
   * @param {Array<number>} center - [longitude, latitude] center coordinates
   * @param {number} radius - Radius in meters
   * @returns {QueryBuilder} Chainable
   */
  withinCircle(field, center, radius) {
    if (!Array.isArray(center) || center.length !== 2) {
      throw new Error('Center must be an array of [longitude, latitude]');
    }
    
    this.filters[field] = {
      ...this.filters[field],
      withinCircle: {
        center,
        radius
      }
    };
    return this;
  }

  /**
   * Find documents within a bounding box
   * @param {string} field - Location field name
   * @param {Array<number>} southwest - [longitude, latitude] southwest corner
   * @param {Array<number>} northeast - [longitude, latitude] northeast corner
   * @returns {QueryBuilder} Chainable
   */
  withinBounds(field, southwest, northeast) {
    if (!Array.isArray(southwest) || southwest.length !== 2) {
      throw new Error('Southwest must be an array of [longitude, latitude]');
    }
    if (!Array.isArray(northeast) || northeast.length !== 2) {
      throw new Error('Northeast must be an array of [longitude, latitude]');
    }
    
    this.filters[field] = {
      ...this.filters[field],
      withinBounds: {
        southwest,
        northeast
      }
    };
    return this;
  }
  
  /**
   * Control join behavior for this query
   * @param {boolean|Object} joinConfig - false to disable joins, or join config object
   * @returns {QueryBuilder} Chainable
   */
  join(joinConfig = true) {
    if (joinConfig === false || joinConfig === null) {
      // Disable joins for this query
      this.options.disableJoins = true;
    } else if (joinConfig === true) {
      // Enable joins (default behavior)
      this.options.disableJoins = false;
    } else if (typeof joinConfig === 'object') {
      // Custom join configuration (future enhancement)
      this.options.customJoins = joinConfig;
      this.options.disableJoins = false;
    }
    return this;
  }

  /**
   * Add ordering
   * @param {string} field - Field to order by
   * @param {string} direction - 'asc' or 'desc'
   * @returns {QueryBuilder} Chainable
   */
  orderBy(field, direction = 'asc') {
    if (!this.options.sort) {
      this.options.sort = {};
    }
    this.options.sort[field] = direction;
    return this;
  }
  
  /**
   * Set limit
   * @param {number} count - Maximum number of results
   * @returns {QueryBuilder} Chainable
   */
  limit(count) {
    this.options.limit = count;
    return this;
  }
  
  /**
   * Set skip/offset
   * @param {number} count - Number of results to skip
   * @returns {QueryBuilder} Chainable
   */
  skip(count) {
    this.options.skip = count;
    return this;
  }
  
  /**
   * Execute the query and return plain data objects
   * @returns {Promise<Array<Object>>} Results as plain objects
   */
  async execute() {
    // Add timeout protection to prevent hanging queries from freezing the app
    const DEFAULT_TIMEOUT = 15000; // 15 seconds
    const timeout = this.options.timeout || DEFAULT_TIMEOUT;

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Query timeout after ${timeout}ms`)), timeout);
    });

    try {
      const queryConfig = {
        filters: this.filters,
        ...this.options
      };

      const queryPromise = this.database.performOperation('fetchData', queryConfig);
      const result = await Promise.race([queryPromise, timeoutPromise]);

      if (result.success && result.data) {
        // Return plain data - no Record wrapping
        if (Array.isArray(result.data)) {
          return result.data;
        }
        return [result.data];
      }

      // Operation returned no data — log if there was an error message
      if (result && !result.success && result.error) {
        console.warn(`[Database] Query for "${this.databaseId}" returned no data: ${result.error}`);
      }

      return [];
    } catch (error) {
      // Log clearly so tenant devs can diagnose
      console.error(`[Database] Query failed for "${this.databaseId}":`, error.message);
      if (error.stack) console.error(error.stack);
      return []; // Graceful degradation - component shows empty state
    }
  }

  /**
   * Execute the query and return Record instances (for ORM-style operations)
   * Use this when you need .save(), .delete(), etc. on the results
   * @returns {Promise<Array<Record>>} Results wrapped in Record instances
   */
  async records() {
    // Add timeout protection to prevent hanging queries from freezing the app
    const DEFAULT_TIMEOUT = 15000; // 15 seconds
    const timeout = this.options.timeout || DEFAULT_TIMEOUT;

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Query timeout after ${timeout}ms`)), timeout);
    });

    try {
      const queryConfig = {
        filters: this.filters,
        ...this.options
      };

      const queryPromise = this.database.performOperation('fetchData', queryConfig);
      const result = await Promise.race([queryPromise, timeoutPromise]);

      if (result.success && result.data) {
        const { Record } = await import('./Record.js');
        if (Array.isArray(result.data)) {
          return result.data.map(item => new Record(item, this.database, this.databaseId));
        }
        return [new Record(result.data, this.database, this.databaseId)];
      }

      // Operation returned no data — log if there was an error message
      if (result && !result.success && result.error) {
        console.warn(`[Database] Query (records) for "${this.databaseId}" returned no data: ${result.error}`);
      }

      return [];
    } catch (error) {
      // Log clearly so tenant devs can diagnose
      console.error(`[Database] Query (records) failed for "${this.databaseId}":`, error.message);
      if (error.stack) console.error(error.stack);
      return []; // Graceful degradation - component shows empty state
    }
  }

  /**
   * Get first result as plain object
   * @returns {Promise<Object|null>} First result or null
   */
  async first() {
    const originalLimit = this.options.limit;
    this.limit(1);

    try {
      const results = await this.execute();
      this.options.limit = originalLimit; // Restore original limit
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      this.options.limit = originalLimit; // Restore original limit
      throw error;
    }
  }

  /**
   * Get first result as Record instance
   * @returns {Promise<Record|null>} First result as Record or null
   */
  async firstRecord() {
    const originalLimit = this.options.limit;
    this.limit(1);

    try {
      const results = await this.records();
      this.options.limit = originalLimit; // Restore original limit
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      this.options.limit = originalLimit; // Restore original limit
      throw error;
    }
  }
  
  /**
   * Get count of matching results (optimized - uses database count operation)
   * @returns {Promise<number>} Number of matching results
   */
  async count() {
    try {
      const queryConfig = {
        filters: this.filters,
        ...this.options
      };

      // Try to use the optimized countData operation
      const result = await this.database.performOperation('countData', queryConfig);

      if (result.success && typeof result.data === 'number') {
        return result.data;
      }

      // Fallback: if countData is not available, execute and count
      const results = await this.execute();
      return results.length;
    } catch (error) {
      // Fallback for databases that don't support count operation
      const results = await this.execute();
      return results.length;
    }
  }
  
  /**
   * Check if any results exist
   * @returns {Promise<boolean>} True if results exist
   */
  async exists() {
    const result = await this.first();
    return result !== null;
  }
  
  /**
   * Make the QueryBuilder thenable so it can be awaited directly
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   */
  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
  
  /**
   * Add catch handler for promises
   * @param {Function} onRejected - Error handler
   */
  catch(onRejected) {
    return this.execute().catch(onRejected);
  }
  
  /**
   * Add finally handler for promises
   * @param {Function} onFinally - Finally handler
   */
  finally(onFinally) {
    return this.execute().finally(onFinally);
  }
  
  /**
   * Clone the query builder
   * @returns {QueryBuilder} New query builder with same configuration
   */
  clone() {
    const cloned = new QueryBuilder(this.database, this.databaseId, this.filters);
    cloned.options = { ...this.options };
    return cloned;
  }
  
  /**
   * Get the raw query configuration
   * @returns {Object} Query configuration object
   */
  toQuery() {
    return {
      filters: this.filters,
      ...this.options
    };
  }
}