// core/services/mobile.js
'use client';

/**
 * JasonJS Mobile Bridge Service
 *
 * Provides native device access when running in the JasonJS native app shell.
 * Falls back to web APIs when running in browser.
 *
 * @module mobile
 */

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

let mobileConfig = {
  enabled: true,
  bridgeSecret: '',
  autoInit: true,
  permissions: {
    gps: true,
    camera: true,
    haptics: true,
    biometrics: true,
    contacts: false,
    notifications: true,
    sensors: true,
    clipboard: true,
    sharing: true
  },
  fallbacks: {
    enabled: true,
    gps: true,
    clipboard: true,
    sharing: true,
    haptics: true
  }
};

let configLoaded = false;

/**
 * Set mobile configuration from server-side settings
 * Called automatically when jcontext.mobile is available
 * @param {Object} config - Mobile config from site settings
 */
function setConfig(config) {
  if (!config || typeof config !== 'object') return;

  mobileConfig = {
    ...mobileConfig,
    ...config,
    permissions: {
      ...mobileConfig.permissions,
      ...(config.permissions || {})
    },
    fallbacks: {
      ...mobileConfig.fallbacks,
      ...(config.fallbacks || {})
    }
  };
  configLoaded = true;

  // Trigger auto-init if configured
  if (typeof window !== 'undefined' && mobileConfig.autoInit) {
    autoInit();
  }
}

/**
 * Get current mobile configuration
 * @returns {Object}
 */
function getConfig() {
  return { ...mobileConfig };
}

// ═══════════════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if running in native context
 * A real native bridge is injected by Expo/React Native and has a _request method.
 * This module creates a stub __STARTUP_STUDIO_BRIDGE__ on all browsers for
 * postMessage fallback — that stub does NOT mean we're in native context.
 * @returns {boolean}
 */
function isNative() {
  if (typeof window === 'undefined') return false;

  // Real native bridge has _request method (injected by Expo shell)
  const hasRealStudioBridge = !!(window.__STARTUP_STUDIO_BRIDGE__ && window.__STARTUP_STUDIO_BRIDGE__._request);
  const hasReactNativeWebView = !!window.ReactNativeWebView;

  return hasRealStudioBridge || hasReactNativeWebView;
}

/**
 * Get detailed bridge status for debugging
 * @returns {Object}
 */
function getBridgeStatus() {
  if (typeof window === 'undefined') {
    return {
      environment: 'server',
      isNative: false,
      available: false
    };
  }

  return {
    environment: 'browser',
    isNative: isNative(),
    hasStudioBridge: !!window.__STARTUP_STUDIO_BRIDGE__,
    hasReactNativeWebView: !!window.ReactNativeWebView,
    studioBridgeMethods: window.__STARTUP_STUDIO_BRIDGE__
      ? Object.keys(window.__STARTUP_STUDIO_BRIDGE__)
      : [],
    reactNativeWebViewMethods: window.ReactNativeWebView
      ? Object.keys(window.ReactNativeWebView)
      : [],
    configLoaded: configLoaded,
    authenticated: bridgeAuthenticated,
    config: { ...mobileConfig, bridgeSecret: mobileConfig.bridgeSecret ? '[HIDDEN]' : '' }
  };
}

/**
 * Log detailed debug info to console
 */
function debug() {
  const status = getBridgeStatus();
  console.log('═══════════════════════════════════════════════════');
  console.log('  JasonJS Mobile Bridge Debug');
  console.log('═══════════════════════════════════════════════════');
  console.log('Environment:', status.environment);
  console.log('Is Native:', status.isNative);
  console.log('Has __STARTUP_STUDIO_BRIDGE__:', status.hasStudioBridge);
  console.log('Has ReactNativeWebView:', status.hasReactNativeWebView);
  if (status.hasStudioBridge) {
    console.log('Studio Bridge Methods:', status.studioBridgeMethods);
  }
  if (status.hasReactNativeWebView) {
    console.log('ReactNativeWebView Methods:', status.reactNativeWebViewMethods);
  }
  console.log('Config Loaded:', status.configLoaded);
  console.log('Authenticated:', status.authenticated);
  console.log('Config:', status.config);
  console.log('═══════════════════════════════════════════════════');
  return status;
}

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION STATE
// ═══════════════════════════════════════════════════════════════

let bridgeAuthenticated = false;
let initPromise = null;

// ═══════════════════════════════════════════════════════════════
// REQUEST MANAGEMENT (for postMessage fallback)
// ═══════════════════════════════════════════════════════════════

let requestId = 0;
const pendingRequests = new Map();
const eventListeners = new Map();
const REQUEST_TIMEOUT = 30000;

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize the mobile bridge with secret
 * @param {string} secret - Bridge secret from mobile.json
 * @returns {Promise<{success: boolean, mode: string}>}
 */
async function init(secret) {
  // Return existing promise if already initializing
  if (initPromise) {
    return initPromise;
  }

  initPromise = _doInit(secret);
  return initPromise;
}

async function _doInit(secret) {
  if (!isNative()) {
    console.log('[Mobile] Not in native context, using web fallbacks');
    bridgeAuthenticated = true;
    return { success: true, mode: 'web' };
  }

  if (!window.__STARTUP_STUDIO_BRIDGE__) {
    // Wait a bit for bridge to be injected
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!window.__STARTUP_STUDIO_BRIDGE__) {
      console.warn('[Mobile] Native bridge not found');
      bridgeAuthenticated = true; // Allow web fallbacks
      return { success: true, mode: 'web-fallback' };
    }
  }

  try {
    // Authenticate with bridge if it supports authentication
    if (typeof window.__STARTUP_STUDIO_BRIDGE__.authenticate === 'function') {
      const result = await window.__STARTUP_STUDIO_BRIDGE__.authenticate(secret);
      bridgeAuthenticated = result.success;

      if (result.success) {
        console.log(`[Mobile] Bridge authenticated (${result.mode} mode)`);
      } else {
        console.error('[Mobile] Bridge authentication failed:', result.error);
      }

      return result;
    } else {
      // Bridge doesn't require authentication (older version)
      bridgeAuthenticated = true;
      console.log('[Mobile] Bridge connected (no auth required)');
      return { success: true, mode: 'native' };
    }
  } catch (error) {
    console.error('[Mobile] Bridge initialization failed:', error);
    bridgeAuthenticated = false;
    return { success: false, mode: 'error', error: error.message };
  }
}

/**
 * Auto-init if configured
 */
async function autoInit() {
  if (!mobileConfig.enabled || !mobileConfig.autoInit) return;

  // If native bridge with _request exists, auto-authenticate
  // The native shell has already proven its identity by injecting the bridge
  if (isNative() && window.__STARTUP_STUDIO_BRIDGE__?._request) {
    bridgeAuthenticated = true;
    return;
  }

  // Web mode - always authenticated (uses web fallbacks)
  if (!isNative()) {
    bridgeAuthenticated = true;
  }
}

// ═══════════════════════════════════════════════════════════════
// NATIVE REQUEST HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * Make a native request
 * @param {string} service - Service name (e.g., 'gps', 'camera')
 * @param {string} method - Method name
 * @param {Object} params - Parameters
 * @returns {Promise<any>}
 */
async function nativeRequest(service, method, params = {}) {
  if (!bridgeAuthenticated) {
    throw new Error('Mobile bridge not initialized. Ensure mobile settings are configured.');
  }

  if (!isNative()) {
    throw new Error(`${service}.${method} requires native context`);
  }

  // Use direct _request if available (preferred)
  if (window.__STARTUP_STUDIO_BRIDGE__?._request) {
    return window.__STARTUP_STUDIO_BRIDGE__._request(service, method, params);
  }

  // Fallback to postMessage protocol
  return callNativeViaPostMessage(service, method, params);
}

/**
 * Call native via postMessage (fallback)
 */
function callNativeViaPostMessage(service, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;

    pendingRequests.set(id, {
      resolve,
      reject,
      service,
      method,
      timestamp: Date.now()
    });

    const message = JSON.stringify({
      type: 'STARTUP_STUDIO_BRIDGE',
      id,
      service,
      method,
      params
    });

    if (window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(message);
    } else {
      pendingRequests.delete(id);
      reject(new Error('No message channel available'));
      return;
    }

    // Timeout
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${service}.${method}`));
      }
    }, REQUEST_TIMEOUT);
  });
}

/**
 * Subscribe to native events
 * @param {string} eventType - Event type
 * @param {Function} callback - Callback
 * @returns {Function} Unsubscribe function
 */
function subscribeToEvent(eventType, callback) {
  if (!eventListeners.has(eventType)) {
    eventListeners.set(eventType, new Set());
  }
  eventListeners.get(eventType).add(callback);

  return () => {
    const listeners = eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        eventListeners.delete(eventType);
      }
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// BRIDGE RESPONSE HANDLERS
// ═══════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  // Only set up our own bridge if native hasn't already injected one with _request
  // If Expo injected a bridge with _request, it has its own handleResponse - don't overwrite!
  const nativeBridgeExists = window.__STARTUP_STUDIO_BRIDGE__?._request;

  if (!nativeBridgeExists) {
    // No native bridge - set up our own for postMessage fallback
    window.__STARTUP_STUDIO_BRIDGE__ = window.__STARTUP_STUDIO_BRIDGE__ || {};

    // Handle responses from native (only used with postMessage fallback)
    window.__STARTUP_STUDIO_BRIDGE__.handleResponse = function({ id, success, data, error }) {
      const pending = pendingRequests.get(id);
      if (pending) {
        pendingRequests.delete(id);
        if (success) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(error || 'Unknown native error'));
        }
      }
    };
  }

  // Event handling - safe to add/merge since it doesn't interfere with _request
  window.__STARTUP_STUDIO_BRIDGE__ = window.__STARTUP_STUDIO_BRIDGE__ || {};

  // Only set handleEvent if not already defined
  if (!window.__STARTUP_STUDIO_BRIDGE__.handleEvent) {
    window.__STARTUP_STUDIO_BRIDGE__.handleEvent = function({ type, data }) {
      const listeners = eventListeners.get(type);
      if (listeners) {
        listeners.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in event listener for ${type}:`, error);
          }
        });
      }
    };
  }

  // Subscribe/unsubscribe helpers - only add if not present
  if (!window.__STARTUP_STUDIO_BRIDGE__.on) {
    window.__STARTUP_STUDIO_BRIDGE__.on = subscribeToEvent;
  }
  if (!window.__STARTUP_STUDIO_BRIDGE__.off) {
    window.__STARTUP_STUDIO_BRIDGE__.off = function(eventType) {
      eventListeners.delete(eventType);
    };
  }

  // Dispatch ready event
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('jasonjs:mobile:ready'));
  }, 0);
}

// ═══════════════════════════════════════════════════════════════
// GPS SERVICE
// ═══════════════════════════════════════════════════════════════

const gps = {
  /**
   * Request location permission
   * @returns {Promise<{granted: boolean}>}
   */
  async requestPermission() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('gps', 'requestPermission');
    }

    // Web fallback
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ granted: false });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => resolve({ granted: true }),
        () => resolve({ granted: false }),
        { timeout: 5000 }
      );
    });
  },

  /**
   * Get current position
   * @param {Object} options
   * @param {string} options.accuracy - 'low' | 'balanced' | 'high' | 'highest'
   * @param {number} options.timeout - Timeout in ms
   * @returns {Promise<{latitude, longitude, altitude, accuracy, heading, speed, timestamp}>}
   */
  async getCurrentPosition(options = {}) {
    const { accuracy = 'balanced', timeout = 15000 } = options;

    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('gps', 'getCurrentPosition', { accuracy, timeout });
    }

    // Web fallback
    if (!mobileConfig.fallbacks?.gps) {
      throw new Error('GPS requires native context');
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp
        }),
        (error) => {
          let message = 'Failed to get location';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'Location permission denied';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = 'Location unavailable';
          } else if (error.code === error.TIMEOUT) {
            message = 'Location request timed out';
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: accuracy === 'high' || accuracy === 'highest',
          timeout,
          maximumAge: accuracy === 'low' ? 60000 : 0
        }
      );
    });
  },

  /**
   * Watch position continuously
   * @param {Function} callback - Called with position updates
   * @param {Object} options
   * @returns {Promise<Function>} - Stop function
   */
  async watchPosition(callback, options = {}) {
    const { accuracy = 'balanced', distanceInterval = 10 } = options;

    if (isNative() && bridgeAuthenticated) {
      // Use bridge event system
      if (window.__STARTUP_STUDIO_BRIDGE__.on) {
        window.__STARTUP_STUDIO_BRIDGE__.on('gps:position', callback);
      }
      await nativeRequest('gps', 'watchPosition', { accuracy, distanceInterval });

      return async () => {
        if (window.__STARTUP_STUDIO_BRIDGE__.off) {
          window.__STARTUP_STUDIO_BRIDGE__.off('gps:position');
        }
        return nativeRequest('gps', 'stopWatching');
      };
    }

    // Web fallback
    if (!mobileConfig.fallbacks?.gps) {
      throw new Error('GPS requires native context');
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      const watchId = navigator.geolocation.watchPosition(
        (pos) => callback({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp
        }),
        (error) => callback({ error: error.message }),
        { enableHighAccuracy: accuracy === 'high' || accuracy === 'highest' }
      );

      resolve(async () => {
        navigator.geolocation.clearWatch(watchId);
      });
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// CAMERA SERVICE
// ═══════════════════════════════════════════════════════════════

const camera = {
  /**
   * Request camera permission
   * @returns {Promise<{camera: boolean, mediaLibrary: boolean}>}
   */
  async requestPermission() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('camera', 'requestPermission');
    }

    // Web fallback — on desktop browsers, camera access via getUserMedia
    // is often blocked by Permissions Policy (especially in iframes).
    // File input picker always works, so grant mediaLibrary unconditionally.
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Check Permissions API first to avoid triggering a policy violation
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const status = await navigator.permissions.query({ name: 'camera' });
            if (status.state === 'denied') {
              return { camera: false, mediaLibrary: true };
            }
          } catch (e) {
            // permissions.query('camera') not supported, skip
          }
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Stop tracks immediately — we only needed to check permission
        stream.getTracks().forEach(t => t.stop());
        return { camera: true, mediaLibrary: true };
      }
    } catch (error) {
      // NotAllowedError = user denied; SecurityError = Permissions Policy blocked
      return { camera: false, mediaLibrary: true };
    }
    return { camera: false, mediaLibrary: true };
  },

  /**
   * Take a photo
   * @param {Object} options
   * @param {number} options.quality - 0-1
   * @param {boolean} options.base64 - Include base64 data
   * @param {boolean} options.allowsEditing - Allow editing
   * @returns {Promise<{canceled, uri, base64, width, height}>}
   */
  async takePhoto(options = {}) {
    const { quality = 0.8, base64 = true, allowsEditing = false } = options;

    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('camera', 'takePhoto', { quality, base64, allowsEditing });
    }

    // Web fallback using file input
    // Only set capture attribute on mobile devices — on desktop it can
    // trigger camera permission errors or Permissions Policy violations
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      const isMobileUA = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobileUA) {
        input.capture = 'environment';
      }

      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve({ canceled: true });
          return;
        }

        const result = {
          canceled: false,
          uri: URL.createObjectURL(file),
          type: file.type,
          fileName: file.name
        };

        if (base64) {
          const reader = new FileReader();
          reader.onload = () => {
            result.base64 = reader.result.split(',')[1];

            const img = new Image();
            img.onload = () => {
              result.width = img.width;
              result.height = img.height;
              resolve(result);
            };
            img.src = reader.result;
          };
          reader.readAsDataURL(file);
        } else {
          resolve(result);
        }
      };

      input.click();
    });
  },

  /**
   * Pick image from library
   * @param {Object} options
   * @param {number} options.quality - 0-1
   * @param {boolean} options.base64 - Include base64 data
   * @param {boolean} options.multiple - Allow multiple selection
   * @param {number} options.limit - Max images
   * @returns {Promise<{canceled, assets}>}
   */
  async pickImage(options = {}) {
    const { quality = 0.8, base64 = true, multiple = false, limit = 10 } = options;

    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('camera', 'pickImage', { quality, base64, multiple, limit });
    }

    // Web fallback using file input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = multiple;

      input.onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) {
          resolve({ canceled: true });
          return;
        }

        const assets = await Promise.all(
          files.slice(0, limit).map(async (file) => {
            return new Promise((resolveFile) => {
              const reader = new FileReader();
              reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                  resolveFile({
                    uri: URL.createObjectURL(file),
                    base64: base64 ? reader.result.split(',')[1] : undefined,
                    width: img.width,
                    height: img.height,
                    type: file.type,
                    fileName: file.name
                  });
                };
                img.src = reader.result;
              };
              reader.readAsDataURL(file);
            });
          })
        );

        resolve({
          canceled: false,
          assets: multiple ? assets : assets[0]
        });
      };

      input.click();
    });
  },

  /**
   * Pick video from library
   * @param {Object} options
   * @param {number} options.maxDuration - Max duration in seconds
   * @returns {Promise<{canceled, uri, duration}>}
   */
  async pickVideo(options = {}) {
    const { maxDuration = 60 } = options;

    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('camera', 'pickVideo', { maxDuration });
    }

    // Web fallback
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';

      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
          resolve({ canceled: true });
          return;
        }

        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          resolve({
            canceled: false,
            uri: URL.createObjectURL(file),
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
            type: file.type,
            fileName: file.name
          });
        };
        video.src = URL.createObjectURL(file);
      };

      input.click();
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// HAPTICS SERVICE
// ═══════════════════════════════════════════════════════════════

const haptics = {
  /**
   * Trigger impact feedback
   * @param {'light' | 'medium' | 'heavy'} style
   */
  async impact(style = 'medium') {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('haptics', 'impact', { style });
    }

    // Web fallback using vibration API
    if (mobileConfig.fallbacks?.haptics && navigator.vibrate) {
      const duration = { light: 10, medium: 20, heavy: 30 }[style] || 20;
      navigator.vibrate(duration);
      return { success: true };
    }

    return { success: false };
  },

  /**
   * Trigger notification feedback
   * @param {'success' | 'warning' | 'error'} type
   */
  async notification(type = 'success') {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('haptics', 'notification', { type });
    }

    // Web fallback
    if (mobileConfig.fallbacks?.haptics && navigator.vibrate) {
      const patterns = {
        success: [10, 50, 10],
        warning: [20, 50, 20],
        error: [30, 50, 30, 50, 30]
      };
      navigator.vibrate(patterns[type] || [20]);
      return { success: true };
    }

    return { success: false };
  },

  /**
   * Trigger selection feedback
   */
  async selection() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('haptics', 'selection');
    }

    if (mobileConfig.fallbacks?.haptics && navigator.vibrate) {
      navigator.vibrate(5);
      return { success: true };
    }

    return { success: false };
  }
};

// ═══════════════════════════════════════════════════════════════
// SENSORS SERVICE
// ═══════════════════════════════════════════════════════════════

const sensors = {
  /**
   * Check sensor availability
   * @returns {Promise<{accelerometer: boolean, gyroscope: boolean}>}
   */
  async isAvailable() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('sensors', 'isAvailable');
    }

    return {
      accelerometer: typeof DeviceMotionEvent !== 'undefined',
      gyroscope: typeof DeviceOrientationEvent !== 'undefined',
      magnetometer: false
    };
  },

  accelerometer: {
    /**
     * Start accelerometer updates
     * @param {Function} callback - Receives {x, y, z}
     * @param {number} interval - Update interval in ms
     * @returns {Promise<Function>} - Stop function
     */
    async start(callback, interval = 100) {
      if (isNative() && bridgeAuthenticated) {
        if (window.__STARTUP_STUDIO_BRIDGE__.on) {
          window.__STARTUP_STUDIO_BRIDGE__.on('sensors:accelerometer', callback);
        }
        await nativeRequest('sensors', 'startAccelerometer', { interval });

        return async () => {
          if (window.__STARTUP_STUDIO_BRIDGE__.off) {
            window.__STARTUP_STUDIO_BRIDGE__.off('sensors:accelerometer');
          }
          return nativeRequest('sensors', 'stopAccelerometer');
        };
      }

      // Web fallback
      return new Promise((resolve, reject) => {
        if (typeof DeviceMotionEvent === 'undefined') {
          reject(new Error('Accelerometer not available'));
          return;
        }

        // Request permission on iOS 13+
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
          DeviceMotionEvent.requestPermission()
            .then((permission) => {
              if (permission !== 'granted') {
                reject(new Error('Motion permission denied'));
                return;
              }
              startListening();
            })
            .catch(reject);
        } else {
          startListening();
        }

        function startListening() {
          const handler = (e) => {
            if (e.accelerationIncludingGravity) {
              callback({
                x: e.accelerationIncludingGravity.x || 0,
                y: e.accelerationIncludingGravity.y || 0,
                z: e.accelerationIncludingGravity.z || 0,
                timestamp: Date.now()
              });
            }
          };

          window.addEventListener('devicemotion', handler);
          resolve(() => window.removeEventListener('devicemotion', handler));
        }
      });
    },

    async stop() {
      if (isNative() && bridgeAuthenticated) {
        return nativeRequest('sensors', 'stopAccelerometer');
      }
    }
  },

  gyroscope: {
    /**
     * Start gyroscope updates
     * @param {Function} callback - Receives {x, y, z}
     * @param {number} interval - Update interval in ms
     * @returns {Promise<Function>} - Stop function
     */
    async start(callback, interval = 100) {
      if (isNative() && bridgeAuthenticated) {
        if (window.__STARTUP_STUDIO_BRIDGE__.on) {
          window.__STARTUP_STUDIO_BRIDGE__.on('sensors:gyroscope', callback);
        }
        await nativeRequest('sensors', 'startGyroscope', { interval });

        return async () => {
          if (window.__STARTUP_STUDIO_BRIDGE__.off) {
            window.__STARTUP_STUDIO_BRIDGE__.off('sensors:gyroscope');
          }
          return nativeRequest('sensors', 'stopGyroscope');
        };
      }

      // Web fallback
      return new Promise((resolve, reject) => {
        if (typeof DeviceOrientationEvent === 'undefined') {
          reject(new Error('Gyroscope not available'));
          return;
        }

        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          DeviceOrientationEvent.requestPermission()
            .then((permission) => {
              if (permission !== 'granted') {
                reject(new Error('Orientation permission denied'));
                return;
              }
              startListening();
            })
            .catch(reject);
        } else {
          startListening();
        }

        function startListening() {
          let lastTimestamp = 0;

          const handler = (e) => {
            const now = Date.now();
            if (now - lastTimestamp < interval) return;
            lastTimestamp = now;

            callback({
              alpha: e.alpha || 0,
              beta: e.beta || 0,
              gamma: e.gamma || 0,
              x: e.alpha || 0,
              y: e.beta || 0,
              z: e.gamma || 0,
              timestamp: now
            });
          };

          window.addEventListener('deviceorientation', handler);
          resolve(() => window.removeEventListener('deviceorientation', handler));
        }
      });
    },

    async stop() {
      if (isNative() && bridgeAuthenticated) {
        return nativeRequest('sensors', 'stopGyroscope');
      }
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// BIOMETRICS SERVICE
// ═══════════════════════════════════════════════════════════════

const biometrics = {
  /**
   * Check biometrics availability
   * @returns {Promise<{available, hasHardware, isEnrolled, types[]}>}
   */
  async isAvailable() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('biometrics', 'isAvailable');
    }

    // Web fallback - check for WebAuthn
    const available = typeof PublicKeyCredential !== 'undefined';
    return {
      available,
      hasHardware: available,
      isEnrolled: available,
      types: available ? ['webauthn'] : []
    };
  },

  /**
   * Authenticate with biometrics
   * @param {Object} options
   * @param {string} options.promptMessage
   * @param {string} options.cancelLabel
   * @param {string} options.fallbackLabel
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async authenticate(options = {}) {
    const {
      promptMessage = 'Authenticate',
      cancelLabel = 'Cancel',
      fallbackLabel = 'Use passcode'
    } = options;

    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('biometrics', 'authenticate', {
        promptMessage,
        cancelLabel,
        fallbackLabel
      });
    }

    console.warn('Biometric authentication requires native context');
    return { success: false, error: 'Not available on web' };
  }
};

// ═══════════════════════════════════════════════════════════════
// CLIPBOARD SERVICE
// ═══════════════════════════════════════════════════════════════

const clipboard = {
  /**
   * Copy text to clipboard
   * @param {string} text
   * @returns {Promise<{success: boolean}>}
   */
  async copy(text) {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('clipboard', 'copy', { text });
    }

    // Web fallback
    if (mobileConfig.fallbacks?.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return { success: true };
      } catch (error) {
        // Fallback for older browsers
        try {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
    }

    throw new Error('Clipboard requires native context');
  },

  /**
   * Get text from clipboard
   * @returns {Promise<{text: string}>}
   */
  async paste() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('clipboard', 'paste');
    }

    // Web fallback
    if (mobileConfig.fallbacks?.clipboard && navigator.clipboard) {
      try {
        const text = await navigator.clipboard.readText();
        return { text };
      } catch (error) {
        return { text: '', error: 'Clipboard read not allowed' };
      }
    }

    throw new Error('Clipboard requires native context');
  },

  /**
   * Check if clipboard has content
   * @returns {Promise<{hasContent: boolean}>}
   */
  async hasContent() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('clipboard', 'hasContent');
    }

    return { hasContent: true }; // Assume true for web
  }
};

// ═══════════════════════════════════════════════════════════════
// SHARING SERVICE
// ═══════════════════════════════════════════════════════════════

const sharing = {
  /**
   * Check if sharing is available
   * @returns {Promise<{available: boolean}>}
   */
  async isAvailable() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('sharing', 'isAvailable');
    }

    return { available: typeof navigator.share === 'function' };
  },

  /**
   * Share content
   * @param {Object} options
   * @param {string} options.message - Text to share
   * @param {string} options.title - Title
   * @param {string} options.url - URL to share
   * @param {string} options.dialogTitle - Dialog title (Android)
   * @returns {Promise<{success: boolean}>}
   */
  async share(options = {}) {
    const { message, title, url, dialogTitle } = options;

    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('sharing', 'share', { message, title, url, dialogTitle });
    }

    // Web fallback
    if (mobileConfig.fallbacks?.sharing && navigator.share) {
      try {
        await navigator.share({
          title: title || dialogTitle,
          text: message,
          url
        });
        return { success: true };
      } catch (error) {
        if (error.name === 'AbortError') {
          return { success: false, canceled: true };
        }
        return { success: false, error: error.message };
      }
    }

    throw new Error('Sharing requires native context');
  }
};

// ═══════════════════════════════════════════════════════════════
// CONTACTS SERVICE
// ═══════════════════════════════════════════════════════════════

const contacts = {
  /**
   * Request contacts permission
   * @returns {Promise<{granted: boolean}>}
   */
  async requestPermission() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('contacts', 'requestPermission');
    }

    return { granted: false, error: 'Contacts requires native context' };
  },

  /**
   * Get all contacts
   * @param {Object} options
   * @param {number} options.limit
   * @param {number} options.offset
   * @returns {Promise<{contacts: Array}>}
   */
  async getAll(options = {}) {
    const { limit = 100, offset = 0 } = options;

    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('contacts', 'getAll', { limit, offset });
    }

    // Web fallback using Contact Picker API
    try {
      if ('contacts' in navigator) {
        const props = ['name', 'tel', 'email'];
        const contactsList = await navigator.contacts.select(props, { multiple: true });

        return {
          contacts: contactsList.map((c, i) => ({
            id: `contact-${i}`,
            name: c.name?.[0] || '',
            firstName: c.name?.[0]?.split(' ')[0] || '',
            lastName: c.name?.[0]?.split(' ').slice(1).join(' ') || '',
            phones: c.tel || [],
            emails: c.email || [],
            hasImage: false
          }))
        };
      }
    } catch (error) {
      // Contact Picker not supported
    }

    throw new Error('Contacts requires native context');
  }
};

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS SERVICE
// ═══════════════════════════════════════════════════════════════

const notifications = {
  /**
   * Request notification permission
   * @returns {Promise<{granted: boolean}>}
   */
  async requestPermission() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('notifications', 'requestPermission');
    }

    // Web fallback
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      return { granted: result === 'granted' };
    }

    return { granted: false };
  },

  /**
   * Get Expo push token (native only)
   * @returns {Promise<{token: string}>}
   */
  async getExpoPushToken() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('notifications', 'getExpoPushToken');
    }

    return { token: null, error: 'Push tokens require native context' };
  },

  /**
   * Schedule a local notification
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.body
   * @param {Object} options.data
   * @param {Object} options.trigger - { seconds: number } or null for immediate
   * @returns {Promise<{scheduled: boolean, id?: string}>}
   */
  async scheduleLocal(options = {}) {
    const { title, body, data, trigger } = options;

    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('notifications', 'scheduleLocal', { title, body, data, trigger });
    }

    // Web fallback (immediate only)
    if ('Notification' in window && Notification.permission === 'granted') {
      const delay = trigger?.seconds ? trigger.seconds * 1000 : 0;
      const id = `notif-${Date.now()}`;

      if (delay > 0) {
        setTimeout(() => {
          new Notification(title, { body, data });
        }, delay);
      } else {
        new Notification(title, { body, data });
      }

      return { scheduled: true, id };
    }

    throw new Error('Notification permission not granted');
  },

  /**
   * Cancel all scheduled notifications
   * @returns {Promise<{canceled: boolean}>}
   */
  async cancelAll() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('notifications', 'cancelAll');
    }

    return { canceled: true };
  },

  /**
   * Get badge count
   * @returns {Promise<{count: number}>}
   */
  async getBadgeCount() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('notifications', 'getBadgeCount');
    }

    return { count: 0 };
  },

  /**
   * Set badge count
   * @param {number} count
   * @returns {Promise<{success: boolean}>}
   */
  async setBadgeCount(count) {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('notifications', 'setBadgeCount', { count });
    }

    // Web fallback using Badging API
    try {
      if ('setAppBadge' in navigator) {
        if (count > 0) {
          await navigator.setAppBadge(count);
        } else {
          await navigator.clearAppBadge();
        }
        return { success: true };
      }
    } catch (error) {
      // Ignore
    }

    return { success: false };
  }
};

// ═══════════════════════════════════════════════════════════════
// DEVICE SERVICE
// ═══════════════════════════════════════════════════════════════

const device = {
  /**
   * Get device info
   * @returns {Promise<{platform, version, brand, isDevice}>}
   */
  async getInfo() {
    if (isNative() && bridgeAuthenticated) {
      return nativeRequest('device', 'getInfo');
    }

    // Web fallback
    const ua = navigator.userAgent;
    let platform = 'web';
    let version = '';
    let brand = 'Browser';

    if (/iPhone|iPad|iPod/.test(ua)) {
      platform = 'ios';
      const match = ua.match(/OS (\d+[_.\d]*)/);
      version = match ? match[1].replace(/_/g, '.') : '';
      brand = 'Apple';
    } else if (/Android/.test(ua)) {
      platform = 'android';
      const match = ua.match(/Android\s(\d+[.\d]*)/);
      version = match ? match[1] : '';
      const brandMatch = ua.match(/;\s*([^;]+)\s*Build/);
      brand = brandMatch ? brandMatch[1].trim() : 'Unknown';
    } else if (/Windows/.test(ua)) {
      platform = 'windows';
      const match = ua.match(/Windows NT (\d+[.\d]*)/);
      version = match ? match[1] : '';
      brand = 'Microsoft';
    } else if (/Macintosh/.test(ua)) {
      platform = 'macos';
      const match = ua.match(/Mac OS X (\d+[_.\d]*)/);
      version = match ? match[1].replace(/_/g, '.') : '';
      brand = 'Apple';
    } else if (/Linux/.test(ua)) {
      platform = 'linux';
    }

    return {
      platform,
      version,
      brand,
      isDevice: /Mobile|Android|iPhone|iPad|iPod/.test(ua),
      modelName: brand,
      manufacturer: brand,
      osName: platform,
      osVersion: version,
      deviceType: /Mobile|Android|iPhone|iPod/.test(ua) ? 'phone' :
                  /iPad|Tablet/.test(ua) ? 'tablet' : 'desktop'
    };
  }
};

// ═══════════════════════════════════════════════════════════════
// MAIN MOBILE SERVICE EXPORT
// ═══════════════════════════════════════════════════════════════

const mobileService = {
  // State
  get isNative() { return isNative(); },
  get isAuthenticated() { return bridgeAuthenticated; },
  get isReady() { return bridgeAuthenticated; },
  get configLoaded() { return configLoaded; },
  version: '1.0.0',
  get config() { return mobileConfig; },

  // Configuration
  setConfig,
  getConfig,

  // Debug
  debug,
  getBridgeStatus,

  // Methods
  init,

  /**
   * Wait for mobile bridge to be ready
   * @param {number} timeout - Timeout in ms (default 5000)
   * @returns {Promise<boolean>}
   */
  async waitForReady(timeout = 5000) {
    if (bridgeAuthenticated) return true;

    return new Promise((resolve) => {
      const checkInterval = 50;
      let elapsed = 0;

      const check = () => {
        if (bridgeAuthenticated) {
          resolve(true);
          return;
        }
        elapsed += checkInterval;
        if (elapsed >= timeout) {
          resolve(false);
          return;
        }
        setTimeout(check, checkInterval);
      };

      check();
    });
  },

  // Services
  gps,
  camera,
  haptics,
  sensors,
  biometrics,
  clipboard,
  sharing,
  contacts,
  notifications,
  device,

  // Low-level bridge access (for advanced use)
  _bridge: {
    nativeRequest,
    subscribeToEvent,
    get pendingRequests() { return pendingRequests.size; },
    get eventListeners() { return Array.from(eventListeners.keys()); }
  }
};

// ═══════════════════════════════════════════════════════════════
// AUTO-INIT
// ═══════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  // Check for embedded config from server-side rendering
  // This config is set by MobileConfigLoader component from jcontext.mobile
  const checkForEmbeddedConfig = () => {
    if (window.__JASONJS_MOBILE_CONFIG__) {
      setConfig(window.__JASONJS_MOBILE_CONFIG__);
    }
  };

  // Check on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkForEmbeddedConfig);
  } else {
    checkForEmbeddedConfig();
  }

  // Also listen for native ready event
  window.addEventListener('startupstudio:native:ready', autoInit);

  // Listen for config injection event (from MobileConfigLoader)
  window.addEventListener('jasonjs:mobile:config', (event) => {
    if (event.detail) {
      setConfig(event.detail);
    }
  });

}

// ═══════════════════════════════════════════════════════════════
// REACT HOOK
// ═══════════════════════════════════════════════════════════════

/**
 * React hook for mobile capabilities
 * @returns {Object} Mobile utilities with reactive state
 */
export function useMobile() {
  const [isNativeState, setIsNativeState] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [location, setLocation] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [networkState, setNetworkState] = useState(null);

  useEffect(() => {
    setIsNativeState(isNative());
    setIsReady(bridgeAuthenticated);

    // Wait for bridge if in native context
    if (isNative()) {
      mobileService.waitForReady().then(setIsReady);
    }
  }, []);

  useEffect(() => {
    mobileService.device.getInfo().then(setDeviceInfo);
  }, []);

  const getCurrentLocation = useCallback(async (options) => {
    try {
      const pos = await mobileService.gps.getCurrentPosition(options);
      setLocation(pos);
      return pos;
    } catch (error) {
      setLocation({ error: error.message });
      throw error;
    }
  }, []);

  return {
    // State
    isNative: isNativeState,
    isReady,
    location,
    deviceInfo,
    networkState,

    // Methods
    init: mobileService.init,
    getCurrentLocation,

    // Services (pass-through)
    gps: mobileService.gps,
    camera: mobileService.camera,
    haptics: mobileService.haptics,
    sensors: mobileService.sensors,
    biometrics: mobileService.biometrics,
    clipboard: mobileService.clipboard,
    sharing: mobileService.sharing,
    contacts: mobileService.contacts,
    notifications: mobileService.notifications,
    device: mobileService.device
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export default mobileService;
export {
  mobileService as mobile,
  gps,
  camera,
  haptics,
  sensors,
  biometrics,
  clipboard,
  sharing,
  contacts,
  notifications,
  device,
  isNative,
  init,
  setConfig,
  getConfig,
  debug,
  getBridgeStatus
};
