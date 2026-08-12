// core/app/client.js
// Client-side app implementation

'use client';

import { DatabaseClient, useDatabase } from '../client/db';
import { callFun, callAI } from '../services/functions';
import { getLocation, getNetworkInfo, getDeviceInfo } from '../services/browser';
import storageService from '../services/storage';
import analyticsService from '../services/analytics';
import cacheService from '../services/cache';
import { calculateDistance, formatCoordinates, getBoundingBox } from '../utils/geospatial';
import eventBus from '../services/eventBus';
import { createClientAI } from './ai-client'; // Client-only AI module (no server dependencies)
import * as billingService from '../services/billing';

// Mobile service - only loaded when mobile settings are configured
// This is a lazy getter to avoid loading the module until needed
let _mobileService = null;
function getMobileService() {
  if (!_mobileService) {
    // Dynamic require to allow tree-shaking when not used
    _mobileService = require('../services/mobile').default;
  }
  return _mobileService;
}

/**
 * Create client-side app instance
 * Includes all features: UI, browser APIs, full database access
 * @param {Object} context - Optional context (jcontext data for database components)
 */
export function createAppClient(context = {}) {
  // Internal state - initialize with context if provided
  let currentDb = null;
  let currentUser = context.user || null;
  let currentContext = {
    params: context.params || {},
    pathname: context.pathname || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    domain: context.domain || (typeof window !== 'undefined' ? window.location.hostname : 'localhost'),
    siteId: context.siteId || null,
    ...context
  };

  // Listen to Event Bus for auth state updates across all app instances
  const loginUnsubscribe = eventBus.on('user.login', (eventData) => {
    currentUser = eventData.user;
  });

  const logoutUnsubscribe = eventBus.on('user.logout', () => {
    currentUser = null;
  });

  // Database wrapper with all methods at top level
  const database = {
    // Core database operations
    use(databaseId) {
      currentDb = new DatabaseClient(databaseId);
      return currentDb; // Return the actual DatabaseClient instance for consistent API
    },

    // Query operations - auto-create database if needed
    async query(filters = {}) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.query(filters);
    },

    async fetch(query = {}) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.fetch(query);
    },

    async create(data) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.create(data);
    },

    async update(id, data) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.update(id, data);
    },

    async delete(id) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.delete(id);
    },

    async getById(id) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.getById(id);
    },

    // Real-time subscriptions
    subscribe(filters, callback) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.subscribe(filters, callback);
    },

    // Geospatial queries
    async nearBy(field, coordinates, maxDistance, minDistance = null) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.nearBy(field, coordinates, maxDistance, minDistance);
    },

    // Intelligent search
    async search(searchTerm, limit = 10, additionalFilters = {}) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.search(searchTerm, limit, additionalFilters);
    },

    // Query builder shortcuts
    where(field, value) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.query({ [field]: value });
    },

    orderBy(field, direction = 'asc') {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.query().orderBy(field, direction);
    },

    limit(count) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.query().limit(count);
    },

    skip(count) {
      if (!currentDb) currentDb = new DatabaseClient('default');
      return currentDb.query().skip(count);
    }
  };

  // UI utilities - client-side only
  const ui = {
    // Helper: read a CSS variable as HSL color string
    _hsl(varName) {
      const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      return val ? `hsl(${val})` : null;
    },

    // Helper: create themed dialog (shared by confirm and alert)
    _createDialog(message, options = {}) {
      const {
        title,
        type = 'default',
        okText = 'OK',
        cancelText = 'Cancel',
        showCancel = true
      } = options;

      const hsl = (v) => {
        const val = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
        return val ? `hsl(${val})` : null;
      };

      const bg = hsl('--background') || '#ffffff';
      const fg = hsl('--foreground') || '#111827';
      const mutedFg = hsl('--muted-foreground') || '#6b7280';
      const border = hsl('--border') || '#e5e7eb';
      const primary = hsl('--primary') || '#3b82f6';
      const primaryFg = hsl('--primary-foreground') || '#ffffff';
      const destructive = hsl('--destructive') || '#ef4444';
      const destructiveFg = hsl('--destructive-foreground') || '#ffffff';
      const muted = hsl('--muted') || '#f3f4f6';
      const accent = hsl('--accent') || '#f3f4f6';
      const accentFg = hsl('--accent-foreground') || '#111827';
      const radius = getComputedStyle(document.documentElement).getPropertyValue('--radius').trim() || '0.75rem';

      const isDestructive = type === 'destructive' || type === 'danger';
      const confirmBg = isDestructive ? destructive : primary;
      const confirmFgColor = isDestructive ? destructiveFg : primaryFg;

      return new Promise((resolve) => {
        // Overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed; inset: 0; z-index: 50000;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 150ms ease;
          font-family: system-ui, -apple-system, sans-serif;
        `;

        // Dialog container
        const dialog = document.createElement('div');
        dialog.style.cssText = `
          background: ${bg}; color: ${fg};
          border: 1px solid ${border};
          border-radius: ${radius};
          padding: 24px;
          max-width: 400px; width: calc(100% - 32px);
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
          transform: scale(0.95); opacity: 0;
          transition: transform 150ms ease, opacity 150ms ease;
        `;

        // Title
        if (title) {
          const titleEl = document.createElement('div');
          titleEl.textContent = title;
          titleEl.style.cssText = `
            font-size: 1.1rem; font-weight: 600; line-height: 1.4;
            margin-bottom: 8px; color: ${fg};
          `;
          dialog.appendChild(titleEl);
        }

        // Message
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.cssText = `
          font-size: 0.875rem; line-height: 1.5;
          color: ${mutedFg};
          ${title ? '' : 'margin-top: 4px;'}
        `;
        dialog.appendChild(messageEl);

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = `
          display: flex; justify-content: flex-end; gap: 8px;
          margin-top: 24px;
        `;

        const btnBase = `
          padding: 8px 16px; font-size: 0.875rem; font-weight: 500;
          border-radius: calc(${radius} - 4px);
          cursor: pointer; border: none; outline: none;
          transition: opacity 150ms ease, filter 150ms ease;
          font-family: inherit; line-height: 1.25;
        `;

        // Cancel button
        if (showCancel) {
          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = cancelText;
          cancelBtn.style.cssText = `
            ${btnBase}
            background: ${bg}; color: ${accentFg};
            border: 1px solid ${border};
          `;
          cancelBtn.onmouseenter = () => { cancelBtn.style.background = accent; };
          cancelBtn.onmouseleave = () => { cancelBtn.style.background = bg; };
          cancelBtn.onclick = () => cleanup(false);
          footer.appendChild(cancelBtn);
        }

        // Confirm / OK button
        const okBtn = document.createElement('button');
        okBtn.textContent = okText;
        okBtn.style.cssText = `
          ${btnBase}
          background: ${confirmBg}; color: ${confirmFgColor};
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        `;
        okBtn.onmouseenter = () => { okBtn.style.filter = 'brightness(0.9)'; };
        okBtn.onmouseleave = () => { okBtn.style.filter = 'none'; };
        okBtn.onclick = () => cleanup(true);
        footer.appendChild(okBtn);

        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => {
          overlay.style.opacity = '1';
          dialog.style.transform = 'scale(1)';
          dialog.style.opacity = '1';
          okBtn.focus();
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) cleanup(false);
        });

        // Close on Escape
        const onKey = (e) => {
          if (e.key === 'Escape') cleanup(false);
          if (e.key === 'Enter') cleanup(true);
        };
        document.addEventListener('keydown', onKey);

        function cleanup(result) {
          document.removeEventListener('keydown', onKey);
          overlay.style.opacity = '0';
          dialog.style.transform = 'scale(0.95)';
          dialog.style.opacity = '0';
          setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            resolve(result);
          }, 150);
        }
      });
    },

    // Confirmation dialog
    async confirm(message, options = {}) {
      const {
        title = 'Confirm',
        okText = 'OK',
        cancelText = 'Cancel',
        type = 'default'
      } = options;

      return this._createDialog(message, { title, okText, cancelText, type, showCancel: true });
    },

    // Alert dialog
    async alert(message, options = {}) {
      const {
        title = 'Alert',
        okText = 'OK',
        type = 'info'
      } = options;

      return this._createDialog(message, { title, okText, type, showCancel: false });
    },

    // Toast notification
    toast(message, options = {}) {
      const {
        type = 'info',
        duration = 4000,
        position = 'top-right'
      } = options;

      // Create toast element
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.style.cssText = `
        position: fixed;
        ${position.includes('top') ? 'top: 20px' : 'bottom: 20px'};
        ${position.includes('right') ? 'right: 20px' : 'left: 20px'};
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transform: translateX(${position.includes('right') ? '100%' : '-100%'});
        transition: transform 0.3s ease;
      `;
      toast.textContent = message;

      document.body.appendChild(toast);

      // Animate in
      setTimeout(() => {
        toast.style.transform = 'translateX(0)';
      }, 100);

      // Auto remove
      setTimeout(() => {
        toast.style.transform = `translateX(${position.includes('right') ? '100%' : '-100%'})`;
        setTimeout(() => {
          document.body.removeChild(toast);
        }, 300);
      }, duration);
    },

    // Loading state
    loading(show = true) {
      const existingLoader = document.getElementById('app-loader');
      
      if (show && !existingLoader) {
        const loader = document.createElement('div');
        loader.id = 'app-loader';
        loader.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10001;
        `;
        loader.innerHTML = '<div style="width:40px;height:40px;border:4px solid #f3f3f3;border-top:4px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;"></div>';
        
        // Add spin animation
        const style = document.createElement('style');
        style.textContent = '@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}';
        document.head.appendChild(style);
        
        document.body.appendChild(loader);
      } else if (!show && existingLoader) {
        document.body.removeChild(existingLoader);
      }
    },

    // Theme management
    theme: {
      toggle() {
        if (typeof window === 'undefined') return;
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.set(newTheme);
      },

      set(theme) {
        if (typeof window === 'undefined') return;
        document.documentElement.setAttribute('data-theme', theme);
        window.localStorage.setItem('app-theme', theme);
      },

      get current() {
        if (typeof window === 'undefined') return 'light';
        return document.documentElement.getAttribute('data-theme') || 'light';
      }
    }
  };

  // Authentication - client-side methods
  const auth = {
    get user() {
      return currentUser;
    },

    get isAuthenticated() {
      return !!currentUser;
    },

    // Alias for isAuthenticated (matches jcontext.auth.isLoggedIn)
    get isLoggedIn() {
      return !!currentUser;
    },

    get isLoading() {
      return false; // This would be managed by React hook
    },

    hasRole(roles) {
      if (!currentUser) return false;
      if (!Array.isArray(roles)) roles = [roles];

      const userRoles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.role || 'user'];
      return roles.some(role => userRoles.includes(role));
    },

    get isAdmin() {
      return this.hasRole(['admin']);
    },

    get userRoles() {
      if (!currentUser) return [];
      return Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.role || 'user'];
    },

    async signIn(provider = 'credentials', options = {}) {
      // Integration with NextAuth or custom auth
      const { signIn } = await import('next-auth/react');
      return signIn(provider, options);
    },

    async signOut() {
      const { signOut } = await import('next-auth/react');
      return signOut();
    },

    redirectToLogin(returnUrl) {
      const callbackUrl = returnUrl || window.location.pathname;
      window.location.href = `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    },

    async refreshSession() {
      const { useSession } = await import('next-auth/react');
      const { update } = useSession();
      await update();
    },

    /**
     * Seamless authentication modal - No redirects, preserves context
     * @param {Object} options - Auth options
     * @param {string} options.mode - 'login' or 'signup' (default: 'login')
     * @param {string} options.message - Custom message to show in modal
     * @param {Function} options.onSuccess - Callback on successful auth
     * @returns {Promise<Object>} User object if authenticated
     */
    async requireLogin(options = {}) {
      // If already authenticated, return user immediately
      if (this.isAuthenticated) {
        return this.user;
      }

      // Create promise and emit event for AuthModal to handle
      return new Promise((resolve, reject) => {
        // Emit event with resolver functions and options
        events.emit('auth.requireLogin', {
          resolve,
          reject,
          options: {
            mode: options.mode || 'login',
            message: options.message || '',
            onSuccess: options.onSuccess
          }
        });
      });
    },

    /**
     * Show auth modal manually
     * @param {Object} options - Modal options
     */
    async showModal(options = {}) {
      return this.requireLogin(options);
    },

    /**
     * Centralized login method - Updates auth state and emits events
     * @param {Object} user - User object
     * @param {Object} options - Additional options (verified, signup, session, etc.)
     */
    login(user, options = {}) {
      // Update internal auth state
      currentUser = user;

      // Emit Event Bus event for immediate UI updates
      events.emit('user.login', {
        user,
        verified: options.verified !== false, // Default to true
        signup: options.signup || false,
        session: options.session || null,
        ...options
      });

      // Optional analytics tracking
      if (analytics) {
        analytics.track('user_login', {
          userId: user.id,
          method: options.method || 'unknown',
          verified: options.verified !== false
        });
      }

      return user;
    },

    /**
     * Centralized logout method - Clears auth state and emits events
     * @param {Object} options - Additional options
     */
    logout(options = {}) {
      const wasAuthenticated = !!currentUser;
      const userId = currentUser?.id;

      // Clear internal auth state
      currentUser = null;

      // Emit Event Bus event for immediate UI updates
      events.emit('user.logout', {
        wasAuthenticated,
        userId,
        ...options
      });

      // Optional analytics tracking
      if (analytics && wasAuthenticated) {
        analytics.track('user_logout', {
          userId,
          method: options.method || 'unknown'
        });
      }

      return true;
    }
  };

  // Functions and AI
  const functions = {
    async call(functionName, params = {}, options = {}) {
      return callFun(functionName, params, options);
    },

    async ai(prompt, options = {}) {
      return callAI(prompt, options);
    },

    // WebSocket connections for real-time features
    socket: {
      connect(url, options = {}) {
        if (typeof window === 'undefined') return null;
        
        const ws = new WebSocket(url);
        
        // Add event handlers if provided
        if (options.onOpen) ws.onopen = options.onOpen;
        if (options.onMessage) ws.onmessage = options.onMessage;
        if (options.onClose) ws.onclose = options.onClose;
        if (options.onError) ws.onerror = options.onError;
        
        return ws;
      },

      // Helper for JSON messaging
      connectJSON(url, handlers = {}) {
        const ws = this.connect(url, {
          onMessage: (event) => {
            try {
              const data = JSON.parse(event.data);
              if (handlers.onMessage) handlers.onMessage(data);
            } catch (error) {
              console.error('WebSocket JSON parse error:', error);
            }
          },
          ...handlers
        });

        if (ws) {
          ws.sendJSON = (data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(data));
            }
          };
        }

        return ws;
      }
    }
  };

  // Browser and device information
  const browser = {
    location: {
      async get(options = {}) {
        return getLocation(options);
      },

      watch(callback, options = {}) {
        return watchLocation(callback, options);
      },

      get coords() {
        // Return cached coordinates if available
        const cached = sessionStorage.getItem('app-location');
        return cached ? JSON.parse(cached) : null;
      }
    },

    device: getDeviceInfo(),

    async network() {
      return getNetworkInfo();
    },

    get locale() {
      return {
        language: navigator.language,
        languages: navigator.languages,
        country: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    }
  };

  // Storage operations
  const storage = {
    // File operations - enhanced with direct S3 integration
    async upload(file, options = {}) {
      try {
        // Use our upload API for client-side uploads
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            path: options.path || 'uploads',
            maxSize: options.maxSize,
            allowedTypes: options.allowedTypes
          })
        });

        if (!response.ok) {
          throw new Error(`Upload preparation failed: ${response.statusText}`);
        }

        const { data: uploadData } = await response.json();

        // Upload directly to S3 using pre-signed URL
        const uploadResponse = await fetch(uploadData.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }

        return {
          success: true,
          url: uploadData.publicUrl,
          key: uploadData.key,
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString()
        };

      } catch (error) {
        console.error('Client file upload error:', error);
        throw error;
      }
    },

    async getUrl(key, options = {}) {
      try {
        const params = new URLSearchParams();
        params.set('key', key);
        if (options.width) params.set('width', options.width);
        if (options.height) params.set('height', options.height);
        if (options.quality) params.set('quality', options.quality);
        if (options.format) params.set('format', options.format);

        const response = await fetch(`/api/upload?${params}`);
        if (!response.ok) {
          throw new Error(`Failed to get file URL: ${response.statusText}`);
        }

        const { url } = await response.json();
        return url;
      } catch (error) {
        console.error('Error getting file URL:', error);
        throw error;
      }
    },

    async delete(key) {
      try {
        const response = await fetch('/api/upload', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ key })
        });

        if (!response.ok) {
          throw new Error(`Delete failed: ${response.statusText}`);
        }

        const result = await response.json();
        return result.success;
      } catch (error) {
        console.error('Error deleting file:', error);
        return false;
      }
    },

    async list(prefix = '', options = {}) {
      try {
        // This would need a new API endpoint for listing files
        console.warn('app.storage.list() not yet implemented for client-side');
        return { files: [], nextContinuationToken: null, isTruncated: false };
      } catch (error) {
        console.error('Error listing files:', error);
        return { files: [], nextContinuationToken: null, isTruncated: false };
      }
    },

    // Key-value storage (localStorage/sessionStorage)
    async get(key) {
      return storageService.get(key);
    },

    async set(key, value, ttl) {
      return storageService.set(key, value, ttl);
    },

    async remove(key) {
      return storageService.remove(key);
    },

    async clear() {
      return storageService.clear();
    },

    get local() {
      return typeof window !== 'undefined' ? window.localStorage : {};
    },

    get session() {
      return typeof window !== 'undefined' ? window.sessionStorage : {};
    }
  };

  // Analytics
  const analytics = {
    async track(event, properties = {}) {
      return analyticsService.track(event, properties);
    },

    async identify(userId, traits = {}) {
      return analyticsService.identify(userId, traits);
    },

    async page(name, properties = {}) {
      return analyticsService.page(name, properties);
    },

    async group(groupId, traits = {}) {
      return analyticsService.group(groupId, traits);
    }
  };

  // Cache operations
  const cache = {
    get(key) {
      return cacheService.get(key);
    },

    set(key, value, ttl) {
      return cacheService.set(key, value, ttl);
    },

    has(key) {
      return cacheService.has(key);
    },

    delete(key) {
      return cacheService.delete(key);
    },

    clear() {
      return cacheService.clear();
    },

    stats() {
      return cacheService.stats();
    }
  };

  // Context information
  const contextObj = {
    get params() {
      return currentContext.params || {};
    },

    get searchParams() {
      const urlParams = new URLSearchParams(window.location.search);
      return Object.fromEntries(urlParams.entries());
    },

    get pathname() {
      return window.location.pathname;
    },

    get domain() {
      return window.location.hostname;
    },

    get siteId() {
      return currentContext.siteId || null;
    },

    get userId() {
      return currentUser?.id || null;
    },

    get env() {
      // Only expose safe env vars to client
      return {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
      };
    }
  };

  // Utility functions
  const utils = {
    formatDate(date, format = 'YYYY-MM-DD') {
      const d = new Date(date);
      return d.toLocaleDateString();
    },

    formatCurrency(amount, currency = 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }).format(amount);
    },

    formatNumber(number, options = {}) {
      return new Intl.NumberFormat('en-US', options).format(number);
    },

    calculateDistance,
    formatCoordinates,
    getBoundingBox,

    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    throttle(func, wait) {
      let inThrottle;
      return function executedFunction(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, wait);
        }
      };
    },

    generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    validateEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    validatePhone(phone) {
      return /^[\+]?[1-9][\d]{0,15}$/.test(phone.replace(/\s/g, ''));
    }
  };

  // URL and asset helpers - client-side CDN utilities
  const helpers = {
    /**
     * Create asset URL with automatic CDN detection
     * @param {string} assetPath - Asset path (can be relative or absolute URL)
     * @param {Object} options - Optimization options
     * @returns {string} Optimized asset URL
     */
    createAssetUrl(assetPath, options = {}) {
      if (!assetPath) return '';

      // If it's already a full URL (http/https), handle differently
      if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
        // External URL (S3, Notion, etc.) - try to convert to CDN
        return this.createCDNUrl(assetPath, options);
      }

      // Internal asset path - use local assets route with CDN
      const cleanPath = assetPath.startsWith('/') ? assetPath.substring(1) : assetPath;
      const baseUrl = this.getCDNBaseUrl();

      if (baseUrl) {
        // Get current domain context for tenant isolation
        const domain = currentContext.domain || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
        const siteId = currentContext.siteId || domain.replace(/\./g, '_');

        // Build CDN URL with tenant isolation
        let url = `${baseUrl}/${siteId}/assets/${cleanPath}`;

        // Add optimization parameters
        const params = new URLSearchParams();
        if (options.width) params.set('w', options.width.toString());
        if (options.height) params.set('h', options.height.toString());
        if (options.quality) params.set('q', options.quality.toString());
        if (options.format) params.set('f', options.format);
        if (options.fit) params.set('fit', options.fit);

        const queryString = params.toString();
        if (queryString) {
          url += `?${queryString}`;
        }

        return url;
      }

      // Fallback to local assets route
      let url = `/assets/${cleanPath}`;

      // Add optimization parameters to local route
      const params = new URLSearchParams();
      if (options.width) params.set('w', options.width.toString());
      if (options.height) params.set('h', options.height.toString());
      if (options.quality) params.set('q', options.quality.toString());
      if (options.format) params.set('f', options.format);

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      return url;
    },

    /**
     * Convert any URL to CDN URL if possible
     * @param {string} url - Original URL
     * @param {Object} options - Optimization options
     * @returns {string} CDN URL or original URL
     */
    createCDNUrl(url, options = {}) {
      if (!url) return '';

      const cdnBaseUrl = this.getCDNBaseUrl();
      if (!cdnBaseUrl) return url;

      try {
        // Parse the URL to extract the path
        const urlObj = new URL(url);

        // Check if it's an S3 URL we can convert
        if (urlObj.hostname.includes('s3') || urlObj.hostname.includes('amazonaws')) {
          const s3Key = urlObj.pathname.substring(1); // Remove leading slash
          let cdnUrl = `${cdnBaseUrl}/${s3Key}`;

          // Add optimization parameters
          const params = new URLSearchParams();
          if (options.width) params.set('w', options.width.toString());
          if (options.height) params.set('h', options.height.toString());
          if (options.quality) params.set('q', options.quality.toString());
          if (options.format) params.set('f', options.format);
          if (options.fit) params.set('fit', options.fit);

          const queryString = params.toString();
          if (queryString) {
            cdnUrl += `?${queryString}`;
          }

          return cdnUrl;
        }

        // For other URLs (Notion, etc.), return as-is
        return url;
      } catch (error) {
        // If URL parsing fails, return original
        return url;
      }
    },

    /**
     * Get thumbnail URL for any asset
     * @param {string} assetPath - Asset path or URL
     * @param {Object} options - Thumbnail options
     * @returns {string} Thumbnail URL
     */
    createThumbnailUrl(assetPath, options = {}) {
      const { size = 150, format = 'webp', quality = 80 } = options;

      return this.createAssetUrl(assetPath, {
        width: size,
        height: size,
        format,
        quality,
        fit: 'cover'
      });
    },

    /**
     * Get responsive image URLs
     * @param {string} assetPath - Asset path or URL
     * @param {Array} sizes - Array of widths
     * @param {Object} options - Base options
     * @returns {Object} Responsive URLs object
     */
    createResponsiveUrls(assetPath, sizes = [400, 800, 1200, 1600], options = {}) {
      const responsive = {};
      const srcSetParts = [];

      sizes.forEach(width => {
        const url = this.createAssetUrl(assetPath, { ...options, width });
        responsive[width] = url;
        srcSetParts.push(`${url} ${width}w`);
      });

      return {
        original: this.createAssetUrl(assetPath, options),
        responsive,
        srcSet: srcSetParts.join(', ')
      };
    },

    /**
     * Get CDN base URL
     * @returns {string|null} CDN base URL
     */
    getCDNBaseUrl() {
      // Check for browser environment variable
      if (typeof window !== 'undefined' && window.location) {
        // Try to get from meta tag first (set by server)
        const metaTag = document.querySelector('meta[name="cdn-base-url"]');
        if (metaTag) {
          return metaTag.getAttribute('content');
        }
      }

      // Fallback to environment variable (available in client via Next.js)
      return process.env.NEXT_PUBLIC_ASSET_BASE_URL || null;
    },

    /**
     * Check if CDN is configured
     * @returns {boolean} True if CDN is available
     */
    isCDNEnabled() {
      return !!this.getCDNBaseUrl();
    }
  };

  // Update internal state (used by React hook)
  const _internal = {
    setUser(user) {
      currentUser = user;
    },
    setContext(ctx) {
      currentContext = ctx;
    },
    cleanup() {
      // Clean up Event Bus listeners to prevent memory leaks
      if (loginUnsubscribe) loginUnsubscribe();
      if (logoutUnsubscribe) logoutUnsubscribe();
    }
  };

  // User service for aggregate operations (counts, stats, etc.)
  // NOTE: Individual profiles are auto-joined in database queries
  const users = {
    // Get user count for current site
    async count() {
      try {
        const response = await fetch('/api/users/stats');
        const data = await response.json();
        return data.count || 0;
      } catch (error) {
        console.error('Failed to get user count:', error);
        return 0;
      }
    },

    // Get user stats (online, active, etc.)
    async stats() {
      try {
        const response = await fetch('/api/users/stats');
        const data = await response.json();
        return {
          total: data.count || 0,
          active: data.activeCount || 0,
          online: data.onlineCount || 0
        };
      } catch (error) {
        console.error('Failed to get user stats:', error);
        return { total: 0, active: 0, online: 0 };
      }
    }
  };

  // User object for current authenticated user operations
  const user = {
    /**
     * Get current user data
     * @returns {Object|null} Current user or null if not authenticated
     */
    get current() {
      return currentUser;
    },

    /**
     * Get user's custom fields object
     * @returns {Object} Custom fields object (empty object if none)
     */
    get customFields() {
      return currentUser?.customFields || {};
    },

    /**
     * Get a single custom field value
     * @param {string} fieldName - Name of the custom field
     * @param {any} defaultValue - Default value if field doesn't exist
     * @returns {any} Field value or default
     */
    getField(fieldName, defaultValue = null) {
      if (!currentUser?.customFields) return defaultValue;
      return currentUser.customFields[fieldName] ?? defaultValue;
    },

    /**
     * Set a custom field value (persists to database)
     * @param {string} fieldName - Name of the custom field
     * @param {any} value - Value to set
     * @returns {Promise<Object>} Updated custom fields object
     */
    async setField(fieldName, value) {
      if (!currentUser) {
        throw new Error('User must be authenticated to set custom fields');
      }

      try {
        const response = await fetch('/api/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            field: fieldName,
            value: value,
            action: 'set'
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update custom field');
        }

        const data = await response.json();

        // Update local user state
        if (currentUser) {
          currentUser.customFields = data.customFields || {};
        }

        // Emit event for UI updates
        events.emit('user.customFieldUpdated', {
          field: fieldName,
          value: value,
          customFields: data.customFields
        });

        return data.customFields;
      } catch (error) {
        console.error('Failed to set custom field:', error);
        throw error;
      }
    },

    /**
     * Delete a custom field (removes from database)
     * @param {string} fieldName - Name of the custom field to delete
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async deleteField(fieldName) {
      if (!currentUser) {
        throw new Error('User must be authenticated to delete custom fields');
      }

      try {
        const response = await fetch('/api/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            field: fieldName,
            action: 'delete'
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete custom field');
        }

        // Update local user state
        if (currentUser?.customFields) {
          delete currentUser.customFields[fieldName];
        }

        // Emit event for UI updates
        events.emit('user.customFieldDeleted', {
          field: fieldName,
          customFields: currentUser?.customFields || {}
        });

        return true;
      } catch (error) {
        console.error('Failed to delete custom field:', error);
        throw error;
      }
    },

    /**
     * Set multiple custom fields at once
     * @param {Object} fields - Object with field names and values
     * @returns {Promise<Object>} Updated custom fields object
     */
    async setFields(fields) {
      if (!currentUser) {
        throw new Error('User must be authenticated to set custom fields');
      }

      try {
        const response = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update custom fields');
        }

        const data = await response.json();

        // Update local user state with returned custom fields
        if (currentUser && data.user?.customFields) {
          currentUser.customFields = data.user.customFields;
        }

        // Emit event for UI updates
        events.emit('user.customFieldsUpdated', {
          fields: fields,
          customFields: currentUser?.customFields || {}
        });

        return currentUser?.customFields || {};
      } catch (error) {
        console.error('Failed to set custom fields:', error);
        throw error;
      }
    },

    /**
     * Check if user has a specific custom field
     * @param {string} fieldName - Name of the custom field
     * @returns {boolean} True if field exists
     */
    hasField(fieldName) {
      return currentUser?.customFields?.hasOwnProperty(fieldName) || false;
    }
  };

  // Events - Inter-component communication
  const events = {
    /**
     * Emit data to a channel
     * @param {string} channel - Channel name (e.g., 'user.login', 'cart.update')
     * @param {any} data - Data to emit
     * @param {Object} options - Emit options
     * @returns {number} Number of listeners that received the event
     */
    emit(channel, data, options = {}) {
      return eventBus.emit(channel, data, options);
    },

    /**
     * Subscribe to a channel
     * @param {string} channelPattern - Channel pattern (supports wildcards: 'user.*')
     * @param {Function} callback - Callback function
     * @param {Object} options - Subscription options
     * @returns {Function} Unsubscribe function
     */
    on(channelPattern, callback, options = {}) {
      return eventBus.on(channelPattern, callback, options);
    },

    /**
     * Subscribe to a channel (one-time only)
     * @param {string} channelPattern - Channel pattern
     * @param {Function} callback - Callback function
     * @param {Object} options - Subscription options
     * @returns {Function} Unsubscribe function
     */
    once(channelPattern, callback, options = {}) {
      return eventBus.once(channelPattern, callback, options);
    },

    /**
     * Unsubscribe from a channel
     * @param {string} channelPattern - Channel pattern
     * @param {Function} callback - Callback function to remove
     * @returns {boolean} True if listener was removed
     */
    off(channelPattern, callback) {
      return eventBus.off(channelPattern, callback);
    },

    /**
     * Clear all listeners for a channel pattern
     * @param {string} channelPattern - Channel pattern (optional, clears all if not provided)
     * @returns {boolean} True if listeners were cleared
     */
    clear(channelPattern) {
      return eventBus.clear(channelPattern);
    },

    /**
     * Get the last emitted data for a channel
     * @param {string} channel - Exact channel name
     * @returns {any|null} Last emitted data or null
     */
    getLastEvent(channel) {
      return eventBus.getLastEvent(channel);
    },

    /**
     * Get list of active channels
     * @returns {Array<string>} Array of channel patterns
     */
    getChannels() {
      return eventBus.getChannels();
    },

    /**
     * Get event bus statistics
     * @returns {Object} EventBus statistics
     */
    getStats() {
      return eventBus.getStats();
    },

    /**
     * Configure the event bus
     * @param {Object} config - Configuration options
     */
    configure(config) {
      return eventBus.configure(config);
    },

    /**
     * Enable/disable debug mode
     * @param {boolean} enabled - Debug enabled
     */
    setDebug(enabled) {
      return eventBus.setDebug(enabled);
    }
  };

  // AI module - client-side API access
  const ai = createClientAI({
    domain: currentContext.domain,
    userId: currentUser?.id,
    user: currentUser
  });

  // Billing - Payment and subscription management
  const billing = {
    // ==========================================
    // API Methods
    // ==========================================

    async createCheckoutSession(planId, options = {}) {
      return billingService.createCheckoutSession(planId, options);
    },

    async createPaymentLink(paymentLinkId, metadata = {}) {
      return billingService.createPaymentLink(paymentLinkId, metadata);
    },

    async createCustomCheckout(items, options = {}) {
      return billingService.createCustomCheckout(items, options);
    },

    // Guest (anonymous, no-login) one-time checkout. Requires options.email + options.orderId.
    async guestCheckout(items, options = {}) {
      return billingService.guestCheckout(items, options);
    },

    async getSubscriptionStatus() {
      return billingService.getSubscriptionStatus();
    },

    async cancelSubscription(options = {}) {
      return billingService.cancelSubscription(options);
    },

    async getPayments(limit = 10) {
      return billingService.getPayments(limit);
    },

    async getPublicConfig() {
      return billingService.getPublicConfig();
    },

    hasPlan(planId, subscription) {
      return billingService.hasPlan(planId, subscription);
    },

    getUserPlan(subscription, billingConfig) {
      return billingService.getUserPlan(subscription, billingConfig);
    },

    formatCurrency(amount, currency = 'USD', locale = 'en-US') {
      return billingService.formatCurrency(amount, currency, locale);
    },

    // ==========================================
    // UI Methods - Open modals programmatically
    // ==========================================

    /**
     * Show plan selection modal
     * @param {Object} options - Modal options
     * @param {string} options.highlightPlan - Plan ID to highlight
     * @param {Function} options.onSelect - Callback when plan selected
     * @param {Function} options.onClose - Callback when modal closed
     * @returns {Promise<string|null>} Selected plan ID or null if closed
     *
     * @example
     * // Simple usage - wait for selection
     * const planId = await app.billing.showPlans();
     * if (planId) {
     *   console.log('User selected:', planId);
     * }
     *
     * @example
     * // With options
     * await app.billing.showPlans({
     *   highlightPlan: 'pro',
     *   onSelect: (planId) => console.log('Selected:', planId)
     * });
     */
    showPlans(options = {}) {
      return new Promise((resolve) => {
        events.emit('billing:showPlans', {
          resolve,
          options: {
            highlightPlan: options.highlightPlan || null,
            onSelect: options.onSelect || null,
            onClose: options.onClose || null,
          }
        });
      });
    },

    /**
     * Show full billing management modal
     * @param {Object} options - Modal options
     * @param {string} options.tab - Initial tab ('plan' | 'history' | 'settings')
     * @param {Function} options.onClose - Callback when modal closed
     * @returns {Promise<void>}
     *
     * @example
     * // Show billing modal
     * await app.billing.showBillingModal();
     *
     * @example
     * // Show specific tab
     * await app.billing.showBillingModal({ tab: 'history' });
     */
    showBillingModal(options = {}) {
      return new Promise((resolve) => {
        events.emit('billing:showBillingModal', {
          resolve,
          options: {
            tab: options.tab || 'plan',
            onClose: options.onClose || null,
          }
        });
      });
    },

    /**
     * Require user to have a specific plan - shows upgrade modal if not
     * Similar to app.auth.requireLogin() but for plans
     * @param {string|string[]} planIds - Required plan ID(s)
     * @param {Object} options - Options
     * @param {string} options.message - Custom message to show
     * @param {boolean} options.allowCancel - Allow user to cancel (default: true)
     * @returns {Promise<Object>} Subscription object if user has plan
     * @throws {Error} If user cancels or doesn't upgrade
     *
     * @example
     * // Require pro plan
     * try {
     *   await app.billing.requirePlan('pro');
     *   // User has pro plan, continue...
     * } catch (e) {
     *   // User cancelled or doesn't have plan
     * }
     *
     * @example
     * // Require any of multiple plans
     * await app.billing.requirePlan(['pro', 'enterprise']);
     *
     * @example
     * // With custom message
     * await app.billing.requirePlan('pro', {
     *   message: 'Upgrade to Pro to export your data'
     * });
     */
    async requirePlan(planIds, options = {}) {
      // Normalize to array
      const requiredPlans = Array.isArray(planIds) ? planIds : [planIds];

      // Check current subscription
      const subscription = await this.getSubscriptionStatus();

      // If user has one of the required plans, return immediately
      if (subscription && requiredPlans.includes(subscription.planId)) {
        return subscription;
      }

      // User needs to upgrade - show plan selection
      return new Promise((resolve, reject) => {
        events.emit('billing:requirePlan', {
          resolve,
          reject,
          options: {
            requiredPlans,
            currentSubscription: subscription,
            message: options.message || null,
            allowCancel: options.allowCancel !== false,
          }
        });
      });
    },

    /**
     * Quick check if user can access a feature (has required plan)
     * Non-blocking, just returns boolean
     * @param {string|string[]} planIds - Required plan ID(s)
     * @returns {Promise<boolean>} True if user has access
     *
     * @example
     * if (await app.billing.canAccess('pro')) {
     *   showProFeature();
     * } else {
     *   showUpgradeButton();
     * }
     */
    async canAccess(planIds) {
      const requiredPlans = Array.isArray(planIds) ? planIds : [planIds];
      const subscription = await this.getSubscriptionStatus();
      return subscription && requiredPlans.includes(subscription.planId);
    },

    /**
     * Subscribe to a plan with full flow (auth check + checkout)
     * Handles authentication if needed
     * @param {string} planId - Plan ID to subscribe to
     * @param {Object} options - Options
     * @returns {Promise<void>} Redirects to checkout
     *
     * @example
     * // One-liner subscription
     * await app.billing.subscribe('pro');
     */
    async subscribe(planId, options = {}) {
      // Check authentication first
      if (!auth.isAuthenticated) {
        try {
          await auth.requireLogin({
            message: options.authMessage || 'Sign in to subscribe'
          });
        } catch {
          throw new Error('Authentication cancelled');
        }
      }

      // Create checkout session
      const { url } = await this.createCheckoutSession(planId, options);

      // Emit event before redirect
      events.emit('billing:checkoutStarted', { planId, url });

      // Redirect to checkout
      if (typeof window !== 'undefined') {
        window.location.href = url;
      }
    },

    // ==========================================
    // Event Helpers
    // ==========================================

    // ==========================================
    // Events - Use app.events.on('billing:*') instead
    // ==========================================
    // Available events:
    // - 'billing:subscribed' - User subscribed to a plan
    // - 'billing:canceled' - Subscription canceled
    // - 'billing:upgraded' - User upgraded plan
    // - 'billing:downgraded' - User downgraded plan
    // - 'billing:paymentSucceeded' - Payment completed
    // - 'billing:paymentFailed' - Payment failed
    //
    // @example
    // app.events.on('billing:subscribed', ({ planId, subscription }) => {
    //   console.log('User subscribed to:', planId);
    //   analytics.track('subscription_created', { planId });
    // });
  };

  // Scripts - Bridge to external scripts loaded via page config
  // Allows components to access libraries like js-dos, Three.js, etc.
  // Scripts are declared in page JSON with "expose" property
  //
  // IMPORTANT: "expose" should only list globals that the script ACTUALLY sets on window.
  // For example, js-dos.js sets window.Dos, so expose: "Dos".
  // Do NOT list internal modules - e.g., "emulators" is an internal js-dos dependency,
  // not a global. Those are loaded automatically by the library via pathPrefix.
  const scripts = {
    /**
     * Get an exposed script library
     * Scripts must be loaded via page config with "expose" property.
     * Only expose globals that the script actually sets on window.
     *
     * @example
     * // Page config (js-dos sets window.Dos):
     * { "scripts": { "custom": [{ "src": "https://v8.js-dos.com/latest/js-dos.js", "expose": "Dos" }] } }
     *
     * // Component usage:
     * const Dos = app.scripts.get('Dos');
     * // or
     * const Dos = app.scripts.Dos;
     *
     * @param {string} name - Name of the exposed script (must be a global set by the script)
     * @returns {any} The script library or undefined if not available
     */
    get(name) {
      if (typeof window === 'undefined') return undefined;

      const exposed = window.__JASONJS_EXPOSED_SCRIPTS__ || [];
      if (!exposed.includes(name)) {
        console.warn(`[app.scripts] Script "${name}" is not exposed. Available: ${exposed.join(', ') || 'none'}`);
        return undefined;
      }

      return window[name];
    },

    /**
     * Check if a script is available
     * @param {string} name - Script name
     * @returns {boolean} True if script is loaded and exposed
     */
    has(name) {
      if (typeof window === 'undefined') return false;

      const exposed = window.__JASONJS_EXPOSED_SCRIPTS__ || [];
      return exposed.includes(name) && window[name] !== undefined;
    },

    /**
     * Get list of all exposed script names
     * @returns {string[]} Array of exposed script names
     */
    list() {
      if (typeof window === 'undefined') return [];
      return window.__JASONJS_EXPOSED_SCRIPTS__ || [];
    },

    /**
     * Wait for a script to be available (useful for async loaded scripts)
     * @param {string} name - Script name
     * @param {number} timeout - Max wait time in ms (default: 10000)
     * @returns {Promise<any>} The script library
     */
    async waitFor(name, timeout = 10000) {
      if (typeof window === 'undefined') {
        throw new Error('Scripts are only available in browser environment');
      }

      const exposed = window.__JASONJS_EXPOSED_SCRIPTS__ || [];
      if (!exposed.includes(name)) {
        throw new Error(`Script "${name}" is not configured. Add it to page scripts with "expose": "${name}"`);
      }

      // If already available, return immediately
      if (window[name] !== undefined) {
        return window[name];
      }

      // Wait for script to load
      return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkInterval = setInterval(() => {
          if (window[name] !== undefined) {
            clearInterval(checkInterval);
            resolve(window[name]);
          } else if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            // Provide helpful error message
            const hint = name === 'emulators'
              ? ' Note: "emulators" is an internal js-dos module, not a global. Only expose and waitFor "Dos".'
              : ` Check that the script actually sets window.${name} - some libraries use internal modules.`;
            reject(new Error(`Timeout waiting for script "${name}" to load.${hint}`));
          }
        }, 50);
      });
    }
  };

  // Create a Proxy to allow direct property access like app.scripts.Dos
  const scriptsProxy = new Proxy(scripts, {
    get(target, prop) {
      // If it's a method on the scripts object, return it
      if (prop in target) {
        return target[prop];
      }

      // Otherwise, try to get the script from window
      if (typeof window !== 'undefined') {
        const exposed = window.__JASONJS_EXPOSED_SCRIPTS__ || [];
        if (exposed.includes(prop)) {
          return window[prop];
        }
      }

      return undefined;
    },

    has(target, prop) {
      if (prop in target) return true;
      if (typeof window !== 'undefined') {
        const exposed = window.__JASONJS_EXPOSED_SCRIPTS__ || [];
        return exposed.includes(prop);
      }
      return false;
    }
  });

  // Navigation - Client-side routing
  // Note: When used in DynamicComponentLoader (sandboxed components),
  // this object is automatically enhanced with Next.js router for SPA navigation.
  // Otherwise, falls back to full page reload via window.location
  const navigate = {
    /**
     * Navigate to a URL
     * In DynamicComponentLoader: Uses Next.js router (SPA, no reload)
     * Otherwise: Full page reload via window.location
     * @param {string} url - URL to navigate to
     */
    to(url) {
      if (typeof window !== 'undefined') {
        window.location.href = url;
      }
    },

    /**
     * Replace current URL (no history entry)
     * In DynamicComponentLoader: Uses Next.js router (SPA, no reload)
     * Otherwise: Full page reload via window.location.replace
     * @param {string} url - URL to navigate to
     */
    replace(url) {
      if (typeof window !== 'undefined') {
        window.location.replace(url);
      }
    },

    /**
     * Reload the current page
     * @param {boolean} forceReload - Force reload from server (bypass cache)
     */
    reload(forceReload = false) {
      if (typeof window !== 'undefined') {
        window.location.reload(forceReload);
      }
    },

    /**
     * Navigate back in browser history
     */
    back() {
      if (typeof window !== 'undefined' && window.history) {
        window.history.back();
      }
    },

    /**
     * Navigate forward in browser history
     */
    forward() {
      if (typeof window !== 'undefined' && window.history) {
        window.history.forward();
      }
    },

    /**
     * Navigate to an external URL (opens in new tab by default)
     * @param {string} url - External URL to navigate to
     * @param {Object} options - Navigation options
     * @param {boolean} options.newTab - Open in new tab (default: true)
     * @param {string} options.target - Window target (default: '_blank')
     * @param {string} options.rel - Rel attribute for security (default: 'noopener noreferrer')
     */
    external(url, options = {}) {
      if (typeof window === 'undefined') return;

      const {
        newTab = true,
        target = '_blank',
        rel = 'noopener noreferrer'
      } = options;

      if (newTab) {
        window.open(url, target, rel);
      } else {
        window.location.href = url;
      }
    },

    /**
     * Get current URL information
     */
    get current() {
      if (typeof window === 'undefined') return null;
      return {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        host: window.location.host,
        hostname: window.location.hostname,
        port: window.location.port,
        protocol: window.location.protocol
      };
    }
  };

  // Return the complete app object
  const app = {
    db: database,        // Short alias (recommended)
    database: database,  // Full name (compatibility)
    ui,
    auth,
    user, // Current user with customFields management
    functions,
    ai, // New AI module
    billing, // Payment and subscription management
    browser,
    storage,
    analytics,
    cache,
    context: contextObj,
    utils,
    users, // User aggregate operations (counts, stats)
    helpers, // Client-side URL creation helpers
    events, // Inter-component communication
    navigate, // Top-level navigation API
    scripts: scriptsProxy, // Bridge to external scripts loaded via page config
    _internal
  };

  // Only add mobile bridge if mobile settings are configured for this site
  // This keeps the bundle size smaller for sites that don't use native features
  if (context.mobile) {
    const mobileService = getMobileService();
    if (mobileService) {
      app.mobile = mobileService;
      // Set config from context if available
      if (typeof mobileService.setConfig === 'function') {
        mobileService.setConfig(context.mobile);
      }
    }
  }

  // Addon extension support
  // Client-side addons must be pre-loaded via context.addons
  // Server-side addon loading is handled in server.js
  // This keeps the client bundle small by not including fs/path modules

  // Check if addons were pre-loaded via context
  if (context.addons && typeof context.addons === 'object') {
    for (const [namespace, addon] of Object.entries(context.addons)) {
      if (addon && typeof addon === 'object') {
        app[namespace] = addon;
      }
    }
  }

  return app;
}