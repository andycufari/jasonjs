// core/client/database.js
// SECURE Database Client - tenant isolation handled server-side

import { useMemo } from 'react';
import { QueryBuilder } from '../db/adapters/QueryBuilder.js';
import { Record } from '../db/adapters/Record.js';

// Global request cache to deduplicate across all instances
const globalRequestCache = new Map();

// Global search deduplication (prevents identical simultaneous searches)
const pendingSearches = new Map();

/**
 * SECURE DATABASE CLIENT
 *
 * Tenant isolation is handled SERVER-SIDE in /api/data routes
 * Client simply makes requests - server enforces siteId based on session
 *
 * SECURITY: No client-side tenant handling to prevent tampering
 *
 * NOTE: Client-side debouncing removed due to sandbox setTimeout limits
 * Server-side throttling handles rate limiting instead
 */
export class DatabaseClient {
  constructor(databaseId) {
    this.databaseId = databaseId;
    this.selectedDatabase = { id: databaseId };
    this.pendingRequests = globalRequestCache; // Use global cache
  }

  async _fetch(method, data = null) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      let url = `/api/data/${this.databaseId}`;

      // For GET requests, convert data to URL parameters
      if (method === 'GET' && data) {
        const params = new URLSearchParams();
        Object.entries(data).forEach(([key, value]) => {
          if (typeof value === 'object') {
            params.append(key, JSON.stringify(value));
          } else {
            params.append(key, value);
          }
        });
        url += `?${params.toString()}`;
      } else if (data) {
        // For other methods, use body
        options.body = JSON.stringify(data);
      }

      // Request deduplication for GET requests
      if (method === 'GET') {
        const requestKey = url;
        if (this.pendingRequests.has(requestKey)) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Deduplicating request:', requestKey);
          }
          return this.pendingRequests.get(requestKey);
        }

        const promise = this._performRequest(url, options);
        this.pendingRequests.set(requestKey, promise);
        
        // Clear cache after 10 seconds to prevent memory leaks
        setTimeout(() => {
          this.pendingRequests.delete(requestKey);
        }, 10000);
        
        try {
          const result = await promise;
          return result;
        } finally {
          // Remove immediately on completion
          this.pendingRequests.delete(requestKey);
        }
      }

      return this._performRequest(url, options);
    } catch (error) {
      console.error('Database operation failed:', error);
      throw error;
    }
  }

  async _performRequest(url, options) {
    // Add timeout protection to prevent website freezes from hanging queries
    const DEFAULT_TIMEOUT = 15000; // 15 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Operation failed');
      }

      // Handle nested data structure
      return result.data?.data || result.data || [];
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout gracefully - return empty array instead of crashing
      if (error.name === 'AbortError') {
        console.error(`[Database] Request timed out after ${DEFAULT_TIMEOUT}ms for: ${url}`);
        return []; // Graceful degradation - component shows empty state
      }

      throw error;
    }
  }

  // ===== TRADITIONAL API (Backward Compatible) =====

  async fetch(query = {}) {
    return this._fetch('GET', query);
  }

  async update(id, data) {
    return this._fetch('PUT', { id, data });
  }

  async create(data) {
    // Send data directly without wrapping in { data }
    // The API route expects the record data at the root level
    return this._fetch('POST', data);
  }

  async delete(id) {
    return this._fetch('DELETE', { id });
  }

  // Alias for backward compatibility
  async performOperation(operation, config) {
    const methodMap = {
      fetchData: () => this.fetch(config),
      createData: () => this.create(config),
      updateData: () => this.update(config.id, config.data || config),
      deleteData: () => this.delete(config.id || config)
    };

    const method = methodMap[operation];
    if (!method) {
      throw new Error(`Unsupported operation: ${operation}`);
    }

    try {
      const data = await method();
      return {
        success: true,
        error: null,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  // ===== FLUID API =====

  /**
   * Add a new record
   * @param {Object} data - Data to insert
   * @returns {Promise<Record>} Created record wrapped in Record instance
   */
  async add(data) {
    const result = await this.create(data);
    return new Record(result, this, this.databaseId);
  }

  /**
   * Get a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<Record|null>} Record instance or null
   */
  async getById(id) {
    // For client-side, we need to query with filters to respect primary key
    const results = await this.fetch({ filters: { _id: id } }); // MongoDB uses _id as primary key
    if (results && results.length > 0) {
      return new Record(results[0], this, this.databaseId);
    }
    return null;
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteById(id) {
    try {
      await this.delete(id);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start a query with optional initial filters
   * @param {Object} filters - Initial filters
   * @returns {QueryBuilder} Query builder instance
   */
  query(filters = {}) {
    return new QueryBuilder(this, this.databaseId, filters);
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
    return new QueryBuilder(this, this.databaseId)
      .nearBy(field, coordinates, maxDistance, minDistance);
  }

  /**
   * Perform intelligent search across searchable fields
   *
   * AUTOMATIC PROTECTIONS:
   * - Deduplication: Prevents identical simultaneous searches
   * - Server-side throttling: Rate limiting handled by API
   *
   * NOTE: Client-side debouncing removed due to sandbox setTimeout limits.
   * Components should implement their own debouncing if needed, or rely on
   * server-side throttling to prevent rate limits.
   *
   * @param {string} searchTerm - Search query string
   * @param {number} limit - Maximum number of results (default: 10)
   * @param {Object} additionalFilters - Additional filters to apply
   * @returns {Promise<Array>} Search results
   */
  async search(searchTerm, limit = 10, additionalFilters = {}) {
    // Generate unique search key for deduplication
    const searchKey = `${this.databaseId}:${searchTerm}:${limit}:${JSON.stringify(additionalFilters)}`;

    try {
      // DEDUPLICATION: Check if identical search is already in progress
      if (pendingSearches.has(searchKey)) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Search] Deduplicating identical search');
        }
        return pendingSearches.get(searchKey);
      }

      // Create search promise
      const searchPromise = this._performSearch(searchTerm, limit, additionalFilters);

      // Store pending search for deduplication
      pendingSearches.set(searchKey, searchPromise);

      // Clean up after completion (using Promise.finally, no setTimeout)
      searchPromise.finally(() => {
        pendingSearches.delete(searchKey);
      });

      return searchPromise;

    } catch (error) {
      console.error('Search operation failed:', error);
      pendingSearches.delete(searchKey);
      throw error;
    }
  }

  /**
   * Internal method to perform the actual search
   * @private
   */
  async _performSearch(searchTerm, limit, additionalFilters) {
    try {
      const searchData = {
        operation: 'search',
        searchTerm: searchTerm,
        limit: limit,
        filters: additionalFilters
      };

      const results = await this._fetch('POST', searchData);
      return results;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Subscribe to real-time changes (uses EventSource/WebSocket)
   * @param {Object} filters - Subscription filters
   * @param {Function} callback - Change callback
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(filters, callback) {
    const params = new URLSearchParams();
    
    // Add filters as query parameters
    Object.entries(filters).forEach(([key, value]) => {
      params.append(`filter_${key}`, value);
    });
    
    const url = `/api/data/${this.databaseId}/subscribe?${params.toString()}`;
    const eventSource = new EventSource(url);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('Error parsing subscription data:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      callback({
        type: 'error',
        error: 'Subscription connection error'
      });
    };
    
    return {
      unsubscribe: () => {
        eventSource.close();
      }
    };
  }

  /**
   * Enhanced fetch that returns wrapped records
   * @param {Object} query - Query parameters
   * @returns {Promise<Array<Record>>} Array of wrapped records
   */
  async fetchRecords(query = {}) {
    const results = await this.fetch(query);
    if (Array.isArray(results)) {
      return results.map(item => new Record(item, this, this.databaseId));
    }
    return [];
  }

  /**
   * Get database schema for form generation
   * @returns {Promise<Object>} Database schema object
   */
  async getSchema() {
    const url = `/api/data/${this.databaseId}/schema`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch schema');
    }
    
    return result.schema || {};
  }

  // Helper method for Record instances to update through this client
  async _updateRecord(id, data) {
    return this.update(id, data);
  }

  // Helper method for Record instances to delete through this client
  async _deleteRecord(id) {
    return this.delete(id);
  }

  // Helper method for Record instances to reload through this client
  async _reloadRecord(id) {
    const results = await this.fetch({ id });
    return results && results.length > 0 ? results[0] : null;
  }
}

// Hook for React components
export function useDatabase(databaseId) {
  // Memoize the client to prevent recreation on every render
  const client = useMemo(() => new DatabaseClient(databaseId), [databaseId]);
  return client;
}

// Alias for backward compatibility
export const useDB = useDatabase;

// Export the hook as default
export default useDatabase;