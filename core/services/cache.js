// core/services/cache.js
'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * CLIENT-SIDE CACHE SERVICE
 * 
 * Simple, secure caching utilities for client components
 * SECURITY: Only client-side data, no server-side access
 */

// In-memory cache store
const cacheStore = new Map();
const cacheMetadata = new Map();

// ===== CACHE UTILITIES =====

/**
 * Set cache item with TTL and size limits
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - TTL in milliseconds (default: 5 minutes)
 * @returns {boolean} Success status
 */
export function setCacheItem(key, value, ttl = 5 * 60 * 1000) {
  try {
    // SECURITY: Prevent potential attacks through cache keys
    if (typeof key !== 'string' || key.length > 200) {
      console.warn('Invalid cache key');
      return false;
    }
    
    // Size check to prevent memory exhaustion
    const serialized = JSON.stringify(value);
    if (serialized.length > 1024 * 1024) { // 1MB limit per item
      console.warn('Cache item too large:', key);
      return false;
    }
    
    // Store the item
    cacheStore.set(key, value);
    cacheMetadata.set(key, {
      timestamp: Date.now(),
      ttl,
      size: serialized.length
    });
    
    // Cleanup old items if cache gets too large
    if (cacheStore.size > 100) {
      cleanupExpiredItems();
    }
    
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
}

/**
 * Get cache item with expiration check
 * @param {string} key - Cache key
 * @param {any} defaultValue - Default value if not found/expired
 * @returns {any} Cached value or default
 */
export function getCacheItem(key, defaultValue = null) {
  try {
    if (!cacheStore.has(key)) {
      return defaultValue;
    }
    
    const metadata = cacheMetadata.get(key);
    if (!metadata) {
      // Metadata missing, remove item
      cacheStore.delete(key);
      return defaultValue;
    }
    
    // Check if expired
    if (Date.now() > metadata.timestamp + metadata.ttl) {
      cacheStore.delete(key);
      cacheMetadata.delete(key);
      return defaultValue;
    }
    
    return cacheStore.get(key);
  } catch (error) {
    console.error('Cache get error:', error);
    return defaultValue;
  }
}

/**
 * Remove specific cache item
 * @param {string} key - Cache key
 * @returns {boolean} Success status
 */
export function removeCacheItem(key) {
  try {
    const existed = cacheStore.has(key);
    cacheStore.delete(key);
    cacheMetadata.delete(key);
    return existed;
  } catch (error) {
    console.error('Cache remove error:', error);
    return false;
  }
}

/**
 * Clear all cache items
 * @param {string} pattern - Optional pattern to match keys (simple glob)
 * @returns {number} Number of items cleared
 */
export function clearCache(pattern = null) {
  try {
    if (!pattern) {
      const size = cacheStore.size;
      cacheStore.clear();
      cacheMetadata.clear();
      return size;
    }
    
    // Pattern matching (simple glob support)
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let cleared = 0;
    
    for (const key of cacheStore.keys()) {
      if (regex.test(key)) {
        cacheStore.delete(key);
        cacheMetadata.delete(key);
        cleared++;
      }
    }
    
    return cleared;
  } catch (error) {
    console.error('Cache clear error:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  let totalSize = 0;
  let expired = 0;
  const now = Date.now();
  
  for (const [key, metadata] of cacheMetadata.entries()) {
    totalSize += metadata.size;
    if (now > metadata.timestamp + metadata.ttl) {
      expired++;
    }
  }
  
  return {
    totalItems: cacheStore.size,
    totalSize,
    expired,
    maxItems: 100,
    maxItemSize: 1024 * 1024
  };
}

/**
 * Cleanup expired cache items
 * @returns {number} Number of items cleaned up
 */
export function cleanupExpiredItems() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, metadata] of cacheMetadata.entries()) {
    if (now > metadata.timestamp + metadata.ttl) {
      cacheStore.delete(key);
      cacheMetadata.delete(key);
      cleaned++;
    }
  }
  
  // If still too large, remove oldest items
  if (cacheStore.size > 100) {
    const entries = Array.from(cacheMetadata.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, cacheStore.size - 80); // Keep newest 80 items
    
    for (const [key] of entries) {
      cacheStore.delete(key);
      cacheMetadata.delete(key);
      cleaned++;
    }
  }
  
  return cleaned;
}

// ===== MEMOIZATION UTILITIES =====

/**
 * Simple memoization function with cache
 * @param {Function} fn - Function to memoize
 * @param {number} ttl - TTL in milliseconds
 * @param {Function} keyGenerator - Custom key generator
 * @returns {Function} Memoized function
 */
export function memoize(fn, ttl = 5 * 60 * 1000, keyGenerator = null) {
  return function memoized(...args) {
    const key = keyGenerator 
      ? keyGenerator(...args)
      : `memo:${fn.name}:${JSON.stringify(args)}`;
    
    let cached = getCacheItem(key);
    if (cached !== null) {
      return cached;
    }
    
    const result = fn(...args);
    setCacheItem(key, result, ttl);
    return result;
  };
}

// ===== CACHE HOOK =====

/**
 * React hook for cache operations
 * @returns {Object} Cache utilities and state
 */
export function useCache() {
  const [cacheHits, setCacheHits] = useState(0);
  const [cacheMisses, setCacheMisses] = useState(0);
  const intervalRef = useRef(null);
  
  const set = useCallback((key, value, ttl) => {
    return setCacheItem(key, value, ttl);
  }, []);
  
  const get = useCallback((key, defaultValue = null) => {
    const result = getCacheItem(key, defaultValue);
    
    if (result !== defaultValue) {
      setCacheHits(prev => prev + 1);
    } else {
      setCacheMisses(prev => prev + 1);
    }
    
    return result;
  }, []);
  
  const remove = useCallback((key) => {
    return removeCacheItem(key);
  }, []);
  
  const clear = useCallback((pattern) => {
    const cleared = clearCache(pattern);
    // Reset stats when clearing all cache
    if (!pattern) {
      setCacheHits(0);
      setCacheMisses(0);
    }
    return cleared;
  }, []);
  
  const stats = useCallback(() => {
    return {
      ...getCacheStats(),
      hits: cacheHits,
      misses: cacheMisses,
      hitRate: cacheHits + cacheMisses > 0 ? cacheHits / (cacheHits + cacheMisses) : 0
    };
  }, [cacheHits, cacheMisses]);
  
  // Start cleanup interval on mount
  React.useEffect(() => {
    intervalRef.current = setInterval(() => {
      cleanupExpiredItems();
    }, 60 * 1000); // Cleanup every minute
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  return {
    // Basic operations
    set,
    get,
    remove,
    clear,
    
    // Statistics
    stats,
    cacheHits,
    cacheMisses,
    
    // Utilities
    memoize: useCallback((fn, ttl) => memoize(fn, ttl), []),
    cleanup: useCallback(() => cleanupExpiredItems(), [])
  };
}

// ===== COMPONENT CACHE UTILITIES =====

/**
 * Higher-order component for caching component render results
 * @param {Component} Component - Component to cache
 * @param {Function} keyGenerator - Generate cache key from props
 * @param {number} ttl - TTL in milliseconds
 * @returns {Component} Cached component
 */
export function withCache(Component, keyGenerator, ttl = 5 * 60 * 1000) {
  const CachedComponent = React.memo((props) => {
    const key = keyGenerator ? keyGenerator(props) : `component:${Component.name}:${JSON.stringify(props)}`;
    
    // Note: This is a simplified example. In practice, you'd need more sophisticated
    // React caching mechanisms
    return <Component {...props} />;
  });
  
  CachedComponent.displayName = `Cached(${Component.displayName || Component.name})`;
  return CachedComponent;
}

export default {
  setCacheItem,
  getCacheItem,
  removeCacheItem,
  clearCache,
  getCacheStats,
  cleanupExpiredItems,
  memoize,
  useCache,
  withCache
};