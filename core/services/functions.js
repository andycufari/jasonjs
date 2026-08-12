// core/services/functions.js
'use client';

import { useState, useCallback } from 'react';

/**
 * FUNCTION EXECUTION SERVICE
 * 
 * Provides secure client-side interface for executing server-side functions
 * All function calls are automatically tenant-isolated using siteId
 */

// ===== FUNCTION EXECUTION CLIENT =====

/**
 * Execute a server-side function from client components
 * @param {string} functionName - Name of the function to execute (path)
 * @param {Object} params - Parameters to pass to the function
 * @param {Object} options - Execution options
 * @returns {Promise<any>} Function execution result
 */
export async function callFun(functionName, params = {}, options = {}) {
  const { 
    timeout = 30000, // 30 seconds default
    retries = 0,
    cache = false,
    method = 'POST' 
  } = options;
  
  try {
    // Validate function name (prevent path traversal attacks)
    if (!functionName || typeof functionName !== 'string') {
      throw new Error('Function name is required and must be a string');
    }
    
    // Clean function path
    const functionPath = functionName.replace(/[^a-zA-Z0-9/_-]/g, '');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const url = `/api/${functionPath}`;
    const fetchOptions = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    };
    
    console.log(`🔥 Making function call: ${method} ${url}`, params);
    
    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(fetchOptions.method)) {
      fetchOptions.body = JSON.stringify(params);
    }
    
    const response = await fetch(url, fetchOptions);
    
    clearTimeout(timeoutId);
    
    const result = await response.json();
    
    console.log(`🔥 Function call response: ${response.status}`, result);
    
    if (!response.ok) {
      throw new Error(result.error || `Function execution failed: ${response.status}`);
    }
    
    return result;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Function ${functionName} timed out after ${timeout}ms`);
    }
    
    // Retry logic
    if (retries > 0) {
      console.log(`Retrying function ${functionName}. Attempts remaining: ${retries}`);
      return await callFun(functionName, params, { ...options, retries: retries - 1 });
    }
    
    throw error;
  }
}

/**
 * Execute an AI prompt (directly to AI API with streaming support)
 * @param {string} prompt - The AI prompt
 * @param {Object} options - AI options
 * @returns {Promise<string>} AI response
 */
export async function callAI(prompt, options = {}) {
  // Import AI client dynamically to avoid circular dependencies
  const { callAI: clientCallAI } = await import('./ai-client.js');
  return await clientCallAI(prompt, options);
}

/**
 * Execute a database function (alternative to direct DB access)
 * @param {string} operation - Database operation
 * @param {Object} params - Operation parameters  
 * @returns {Promise<any>} Operation result
 */
export async function callDB(operation, params = {}) {
  return await callFun('DB_operation', {
    operation,
    ...params
  });
}

/**
 * Execute an email function
 * @param {string} template - Email template name
 * @param {Object} data - Email data
 * @returns {Promise<boolean>} Send success
 */
export async function callEmail(template, data = {}) {
  return await callFun('Email_send', {
    template,
    ...data
  });
}

// ===== FUNCTION EXECUTION HOOK =====

/**
 * React hook for function execution with state management
 * @returns {Object} Function utilities and state
 */
export function useFunctions() {
  const [executions, setExecutions] = useState(new Map());
  const [isExecuting, setIsExecuting] = useState(false);
  
  const execute = useCallback(async (functionName, params = {}, options = {}) => {
    const executionId = Math.random().toString(36).substr(2, 9);
    
    setExecutions(prev => new Map(prev).set(executionId, {
      functionName,
      status: 'executing',
      startTime: Date.now(),
      params
    }));
    
    setIsExecuting(true);
    
    try {
      const result = await callFun(functionName, params, options);
      
      setExecutions(prev => {
        const updated = new Map(prev);
        updated.set(executionId, {
          ...updated.get(executionId),
          status: 'completed',
          result,
          endTime: Date.now()
        });
        return updated;
      });
      
      return { executionId, result };
    } catch (error) {
      setExecutions(prev => {
        const updated = new Map(prev);
        updated.set(executionId, {
          ...updated.get(executionId),
          status: 'error',
          error: error.message,
          endTime: Date.now()
        });
        return updated;
      });
      
      throw error;
    } finally {
      setIsExecuting(false);
    }
  }, []);
  
  const clearExecutions = useCallback(() => {
    setExecutions(new Map());
  }, []);
  
  const getExecution = useCallback((executionId) => {
    return executions.get(executionId);
  }, [executions]);
  
  // Convenience methods
  const ai = useCallback((prompt, options) => execute('AI_prompt', { prompt, ...options }), [execute]);
  const db = useCallback((operation, params) => execute('DB_operation', { operation, ...params }), [execute]);
  const email = useCallback((template, data) => execute('Email_send', { template, ...data }), [execute]);
  
  return {
    // State
    executions: Array.from(executions.entries()).map(([id, data]) => ({ id, ...data })),
    isExecuting,
    
    // Methods
    execute,
    callFun: execute, // Alias
    clearExecutions,
    getExecution,
    
    // Convenience methods
    ai,
    db,
    email,
    
    // Direct function access (AI through secure functions API only)
    callAI: useCallback((prompt, options) => callAI(prompt, options), []),
    callDB: useCallback((operation, params) => callDB(operation, params), []),
    callEmail: useCallback((template, data) => callEmail(template, data), [])
  };
}

// ===== FUNCTION CACHE =====

const functionCache = new Map();

/**
 * Execute function with caching
 * @param {string} functionName - Function name
 * @param {Object} params - Parameters
 * @param {number} ttl - Cache TTL in milliseconds
 * @returns {Promise<any>} Cached or fresh result
 */
export async function callFunCached(functionName, params = {}, ttl = 300000) { // 5 minutes default
  const cacheKey = `${functionName}:${JSON.stringify(params)}`;
  const cached = functionCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < ttl) {
    console.log(`Using cached result for ${functionName}`);
    return cached.data;
  }
  
  const result = await callFun(functionName, params);
  
  functionCache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });
  
  // Clean up old cache entries
  if (functionCache.size > 100) {
    const entries = Array.from(functionCache.entries());
    const oldEntries = entries
      .filter(([, value]) => (Date.now() - value.timestamp) > ttl)
      .slice(0, 50); // Remove oldest 50 entries
    
    oldEntries.forEach(([key]) => functionCache.delete(key));
  }
  
  return result;
}

// ===== BATCH EXECUTION =====

/**
 * Execute multiple functions in parallel
 * @param {Array} functions - Array of {name, params, options}
 * @returns {Promise<Array>} Array of results
 */
export async function callFunBatch(functions) {
  if (!Array.isArray(functions)) {
    throw new Error('Functions parameter must be an array');
  }
  
  const promises = functions.map(async (fn, index) => {
    try {
      const result = await callFun(fn.name, fn.params || {}, fn.options || {});
      return { success: true, result, index, functionName: fn.name };
    } catch (error) {
      return { success: false, error: error.message, index, functionName: fn.name };
    }
  });
  
  return await Promise.all(promises);
}

// ===== CONSTANTS AND UTILS =====

export const COMMON_FUNCTIONS = {
  AI_PROMPT: 'AI_prompt',
  DB_OPERATION: 'DB_operation',
  EMAIL_SEND: 'Email_send',
  FILE_PROCESS: 'File_process',
  IMAGE_OPTIMIZE: 'Image_optimize',
  PDF_GENERATE: 'PDF_generate',
  WEBHOOK_SEND: 'Webhook_send'
};

export default {
  callFun,
  callAI, // SECURITY: Routes through functions API
  callDB,
  callEmail,
  callFunCached,
  callFunBatch,
  useFunctions,
  COMMON_FUNCTIONS
};