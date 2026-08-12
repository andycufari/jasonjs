// core/services/storage.js
'use client';

import { useState, useCallback } from 'react';

/**
 * STORAGE SERVICE
 * 
 * Provides file upload, asset management, and storage utilities
 * Available to both trusted and non-trusted components
 */

// ===== ASSET URL UTILITIES =====

/**
 * Generate optimized asset URL with CDN support
 * @param {string} assetPath - Asset path or filename
 * @param {Object} options - Optimization options
 * @returns {string} Optimized asset URL
 */
export function getAssetUrl(assetPath, options = {}) {
  const { 
    width, 
    height, 
    quality = 75, 
    format, 
    resize = 'cover' 
  } = options;
  
  // Handle external URLs
  if (assetPath.startsWith('http')) {
    return assetPath;
  }
  
  // Build base URL from environment
  const baseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL || '/api/assets';
  let url = `${baseUrl}/${assetPath.replace(/^\/+/, '')}`;
  
  // Add optimization parameters
  const params = new URLSearchParams();
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  if (quality !== 75) params.set('q', quality.toString());
  if (format) params.set('f', format);
  if (resize !== 'cover') params.set('fit', resize);
  
  const queryString = params.toString();
  if (queryString) {
    url += `?${queryString}`;
  }
  
  return url;
}

// ===== FILE UPLOAD UTILITIES =====

/**
 * Upload file with progress tracking
 * @param {File} file - File to upload
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result with progress
 */
export async function uploadFile(file, options = {}) {
  const {
    path = 'uploads',
    onProgress,
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/*', 'video/*', 'audio/*', 'application/pdf']
  } = options;
  
  // Validate file size
  if (file.size > maxSize) {
    throw new Error(`File size exceeds limit of ${maxSize / 1024 / 1024}MB`);
  }
  
  // Validate file type
  const isAllowed = allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.slice(0, -1));
    }
    return file.type === type;
  });
  
  if (!isAllowed) {
    throw new Error(`File type ${file.type} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }
  
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result);
        } catch (error) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed: Network error'));
    });
    
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
}

/**
 * Upload multiple files with batch progress
 * @param {FileList|Array} files - Files to upload
 * @param {Object} options - Upload options
 * @returns {Promise<Array>} Array of upload results
 */
export async function uploadFiles(files, options = {}) {
  const fileArray = Array.from(files);
  const results = [];
  let completed = 0;
  
  const { onBatchProgress, concurrent = 3 } = options;
  
  // Process files in batches to avoid overwhelming the server
  for (let i = 0; i < fileArray.length; i += concurrent) {
    const batch = fileArray.slice(i, i + concurrent);
    
    const batchPromises = batch.map(async (file, index) => {
      try {
        const result = await uploadFile(file, {
          ...options,
          onProgress: (progress) => {
            if (onBatchProgress) {
              onBatchProgress({
                fileIndex: i + index,
                fileName: file.name,
                progress,
                completed,
                total: fileArray.length
              });
            }
          }
        });
        completed++;
        return { success: true, file: file.name, result };
      } catch (error) {
        completed++;
        return { success: false, file: file.name, error: error.message };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

// ===== STORAGE HOOK =====

/**
 * React hook for storage operations
 * @returns {Object} Storage utilities and state
 */
export function useStorage() {
  const [uploads, setUploads] = useState(new Map());
  const [isUploading, setIsUploading] = useState(false);
  
  const upload = useCallback(async (file, options = {}) => {
    const uploadId = Math.random().toString(36).substr(2, 9);
    
    setUploads(prev => new Map(prev).set(uploadId, {
      file: file.name,
      progress: 0,
      status: 'uploading'
    }));
    
    setIsUploading(true);
    
    try {
      const result = await uploadFile(file, {
        ...options,
        onProgress: (progress) => {
          setUploads(prev => {
            const updated = new Map(prev);
            updated.set(uploadId, {
              ...updated.get(uploadId),
              progress
            });
            return updated;
          });
        }
      });
      
      setUploads(prev => {
        const updated = new Map(prev);
        updated.set(uploadId, {
          ...updated.get(uploadId),
          status: 'completed',
          result
        });
        return updated;
      });
      
      return { uploadId, ...result };
    } catch (error) {
      setUploads(prev => {
        const updated = new Map(prev);
        updated.set(uploadId, {
          ...updated.get(uploadId),
          status: 'error',
          error: error.message
        });
        return updated;
      });
      
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, []);
  
  const clearUploads = useCallback(() => {
    setUploads(new Map());
  }, []);
  
  const getUploadStatus = useCallback((uploadId) => {
    return uploads.get(uploadId);
  }, [uploads]);
  
  return {
    // State
    uploads: Array.from(uploads.entries()).map(([id, data]) => ({ id, ...data })),
    isUploading,
    
    // Methods
    upload,
    uploadFiles: useCallback((files, options) => uploadFiles(files, options), []),
    clearUploads,
    getUploadStatus,
    
    // Utilities
    getAssetUrl,
    
    // Constants
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/*', 'video/*', 'audio/*', 'application/pdf']
  };
}

// ===== LOCAL STORAGE UTILITIES =====

/**
 * Enhanced localStorage with JSON support and expiration
 * NOTE: Named 'enhancedLocalStorage' to avoid shadowing the native 'localStorage' global
 * which would cause "localStorage.getItem is not a function" errors when this module
 * is bundled with code that expects the native localStorage API.
 */
export const enhancedLocalStorage = {
  set(key, value, expirationMinutes = null) {
    try {
      const item = {
        value,
        timestamp: Date.now(),
        expiration: expirationMinutes ? Date.now() + (expirationMinutes * 60 * 1000) : null
      };
      window.localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  },
  
  get(key, defaultValue = null) {
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return defaultValue;
      
      const parsed = JSON.parse(item);
      
      // Check expiration
      if (parsed.expiration && Date.now() > parsed.expiration) {
        this.remove(key);
        return defaultValue;
      }
      
      return parsed.value;
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return defaultValue;
    }
  },
  
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  },
  
  clear() {
    try {
      window.localStorage.clear();
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }
};

// Default export for convenience
export default {
  useStorage,
  uploadFile,
  uploadFiles,
  getAssetUrl,
  localStorage: enhancedLocalStorage
};