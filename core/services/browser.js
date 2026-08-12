// core/services/browser.js
'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * BROWSER UTILITIES SERVICE
 * 
 * Provides browser-specific information and capabilities
 * Location, IP, locale, device info, permissions, etc.
 */

// ===== LOCATION UTILITIES =====

/**
 * Get user's current location (requests permission)
 * @param {Object} options - Geolocation options
 * @returns {Promise<Object>} Location data
 */
export async function getLocation(options = {}) {
  const {
    enableHighAccuracy = false,
    timeout = 10000,
    maximumAge = 300000 // 5 minutes cache
  } = options;
  
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    
    const geoOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge
    };
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: new Date(position.timestamp)
        });
      },
      (error) => {
        let message = 'Unknown location error';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }
        
        reject(new Error(message));
      },
      geoOptions
    );
  });
}

/**
 * Watch user's location changes
 * @param {Function} callback - Called with location updates
 * @param {Object} options - Geolocation options
 * @returns {number} Watch ID for clearing
 */
export function watchLocation(callback, options = {}) {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by this browser');
  }
  
  const {
    enableHighAccuracy = false,
    timeout = 10000,
    maximumAge = 60000 // 1 minute cache for watching
  } = options;
  
  const geoOptions = {
    enableHighAccuracy,
    timeout,
    maximumAge
  };
  
  return navigator.geolocation.watchPosition(
    (position) => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp)
      });
    },
    (error) => {
      callback({ error: error.message });
    },
    geoOptions
  );
}

/**
 * Stop watching location
 * @param {number} watchId - Watch ID from watchLocation
 */
export function clearLocationWatch(watchId) {
  if (navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}

// ===== IP AND NETWORK UTILITIES =====

/**
 * Get user's public IP address and network info
 * @returns {Promise<Object>} IP and network information
 */
export async function getNetworkInfo() {
  try {
    // Use multiple IP services for reliability
    const services = [
      'https://api.ipify.org?format=json',
      'https://httpbin.org/ip',
      'https://api.myip.com'
    ];
    
    for (const service of services) {
      try {
        const response = await fetch(service);
        if (response.ok) {
          const data = await response.json();
          
          // Normalize response format
          const ip = data.ip || data.origin || data.query;
          
          if (ip) {
            return {
              ip,
              service: service,
              timestamp: new Date(),
              // Additional network info if available
              connection: getConnectionInfo()
            };
          }
        }
      } catch (serviceError) {
        console.warn(`IP service ${service} failed:`, serviceError);
        continue;
      }
    }
    
    throw new Error('All IP services failed');
    
  } catch (error) {
    console.error('Failed to get network info:', error);
    return {
      ip: 'unknown',
      error: error.message,
      timestamp: new Date(),
      connection: getConnectionInfo()
    };
  }
}

/**
 * Get connection information
 * @returns {Object} Connection details
 */
function getConnectionInfo() {
  if ('connection' in navigator) {
    const conn = navigator.connection;
    return {
      effectiveType: conn.effectiveType || 'unknown',
      type: conn.type || 'unknown',
      downlink: conn.downlink || null,
      rtt: conn.rtt || null,
      saveData: conn.saveData || false
    };
  }
  
  return { effectiveType: 'unknown' };
}

// ===== LOCALE AND LANGUAGE UTILITIES =====

/**
 * Get user's locale and language preferences
 * @returns {Object} Locale information
 */
export function getLocaleInfo() {
  const languages = navigator.languages || [navigator.language];
  const primary = navigator.language;
  
  // Parse primary language
  const [lang, region] = primary.split('-');
  
  return {
    primary,
    languages: [...languages],
    language: lang,
    region: region || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    currency: getCurrencyInfo(),
    formats: getFormatInfo(),
    rtl: isRTLLanguage(lang)
  };
}

/**
 * Get currency information based on locale
 * @returns {Object} Currency details
 */
function getCurrencyInfo() {
  try {
    const formatter = new Intl.NumberFormat(navigator.language, {
      style: 'currency',
      currency: 'USD' // Default, would need region detection for accurate currency
    });
    
    const parts = formatter.formatToParts(1);
    const currencyPart = parts.find(part => part.type === 'currency');
    
    return {
      symbol: currencyPart?.value || '$',
      code: 'USD', // Would need geo-location for accurate detection
      format: formatter.format(1234.56)
    };
  } catch (error) {
    return { symbol: '$', code: 'USD', format: '$1,234.56' };
  }
}

/**
 * Get formatting information for numbers/dates
 * @returns {Object} Format examples
 */
function getFormatInfo() {
  const date = new Date('2024-12-25');
  const number = 1234.56;
  
  return {
    date: {
      short: date.toLocaleDateString(navigator.language, { dateStyle: 'short' }),
      medium: date.toLocaleDateString(navigator.language, { dateStyle: 'medium' }),
      long: date.toLocaleDateString(navigator.language, { dateStyle: 'long' })
    },
    number: {
      decimal: number.toLocaleString(navigator.language),
      currency: number.toLocaleString(navigator.language, { style: 'currency', currency: 'USD' }),
      percent: (number / 100).toLocaleString(navigator.language, { style: 'percent' })
    },
    time: {
      hour12: new Date().toLocaleTimeString(navigator.language, { hour12: true }),
      hour24: new Date().toLocaleTimeString(navigator.language, { hour12: false })
    }
  };
}

/**
 * Check if language is right-to-left
 * @param {string} lang - Language code
 * @returns {boolean} True if RTL
 */
function isRTLLanguage(lang) {
  const rtlLangs = ['ar', 'he', 'fa', 'ur', 'ps', 'sd'];
  return rtlLangs.includes(lang.toLowerCase());
}

// ===== DEVICE AND BROWSER INFO =====

/**
 * Get comprehensive device and browser information
 * @returns {Object} Device details
 */
export function getDeviceInfo() {
  // Check if we're running on the server side
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      browser: { name: 'Unknown', version: 'Unknown' },
      os: { name: 'Unknown', version: 'Unknown' },
      device: 'desktop',
      screen: getScreenInfo(), // This function now handles server-side
      capabilities: { touch: false, geolocation: false, storage: false },
      performance: { memory: 0, cores: 1, connection: 'unknown' },
      userAgent: 'Server-Side-Rendering'
    };
  }
  
  const ua = navigator.userAgent;
  
  return {
    // Browser
    browser: getBrowserInfo(),
    
    // Operating System
    os: getOSInfo(),
    
    // Device Type
    device: getDeviceType(),
    
    // Screen
    screen: getScreenInfo(),
    
    // Capabilities
    capabilities: getCapabilities(),
    
    // Performance
    performance: getPerformanceInfo(),
    
    // Raw user agent
    userAgent: ua
  };
}

function getBrowserInfo() {
  if (typeof navigator === 'undefined') {
    return { name: 'Unknown', version: 'Unknown' };
  }
  
  const ua = navigator.userAgent;
  
  let browser = 'Unknown';
  let version = 'Unknown';
  
  if (ua.includes('Chrome')) {
    browser = 'Chrome';
    version = ua.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Firefox')) {
    browser = 'Firefox';
    version = ua.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Safari')) {
    browser = 'Safari';
    version = ua.match(/Version\/([0-9.]+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Edge')) {
    browser = 'Edge';
    version = ua.match(/Edge\/([0-9.]+)/)?.[1] || 'Unknown';
  }
  
  return {
    name: browser,
    version,
    engine: getEngineInfo()
  };
}

function getOSInfo() {
  const ua = navigator.userAgent;
  
  if (ua.includes('Windows')) return { name: 'Windows', version: getWindowsVersion(ua) };
  if (ua.includes('Mac')) return { name: 'macOS', version: getMacVersion(ua) };
  if (ua.includes('Linux')) return { name: 'Linux', version: 'Unknown' };
  if (ua.includes('Android')) return { name: 'Android', version: getAndroidVersion(ua) };
  if (ua.includes('iOS')) return { name: 'iOS', version: getiOSVersion(ua) };
  
  return { name: 'Unknown', version: 'Unknown' };
}

function getDeviceType() {
  if (typeof navigator === 'undefined') {
    return 'desktop';
  }
  
  const ua = navigator.userAgent;
  
  if (ua.includes('Mobile') || ua.includes('Android')) return 'mobile';
  if (ua.includes('Tablet') || ua.includes('iPad')) return 'tablet';
  return 'desktop';
}

function getScreenInfo() {
  // Check if we're running on the client side
  if (typeof window === 'undefined' || typeof screen === 'undefined') {
    return {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1080,
      colorDepth: 24,
      pixelDepth: 24,
      pixelRatio: 1,
      orientation: 'landscape-primary'
    };
  }
  
  return {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    pixelRatio: window.devicePixelRatio || 1,
    orientation: screen.orientation?.type || 'unknown'
  };
}

function getCapabilities() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      cookies: false,
      localStorage: false,
      sessionStorage: false,
      geolocation: false,
      notification: false,
      serviceWorker: false,
      webRTC: false,
      webGL: false,
      touch: false
    };
  }
  
  return {
    cookies: navigator.cookieEnabled,
    localStorage: typeof Storage !== 'undefined',
    sessionStorage: typeof sessionStorage !== 'undefined',
    geolocation: 'geolocation' in navigator,
    notification: 'Notification' in window,
    serviceWorker: 'serviceWorker' in navigator,
    webRTC: 'RTCPeerConnection' in window,
    webGL: !!document.createElement('canvas').getContext('webgl'),
    webAssembly: typeof WebAssembly === 'object',
    touchScreen: 'ontouchstart' in window,
    vibration: 'vibrate' in navigator,
    battery: 'getBattery' in navigator,
    camera: 'mediaDevices' in navigator,
    microphone: 'mediaDevices' in navigator
  };
}

function getPerformanceInfo() {
  return {
    memory: performance.memory ? {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit
    } : null,
    connection: getConnectionInfo(),
    cores: navigator.hardwareConcurrency || null
  };
}

// Helper functions for OS version detection
function getWindowsVersion(ua) {
  if (ua.includes('Windows NT 10.0')) return '10';
  if (ua.includes('Windows NT 6.3')) return '8.1';
  if (ua.includes('Windows NT 6.2')) return '8';
  if (ua.includes('Windows NT 6.1')) return '7';
  return 'Unknown';
}

function getMacVersion(ua) {
  const match = ua.match(/Mac OS X ([0-9_]+)/);
  return match ? match[1].replace(/_/g, '.') : 'Unknown';
}

function getAndroidVersion(ua) {
  const match = ua.match(/Android ([0-9.]+)/);
  return match ? match[1] : 'Unknown';
}

function getiOSVersion(ua) {
  const match = ua.match(/OS ([0-9_]+)/);
  return match ? match[1].replace(/_/g, '.') : 'Unknown';
}

function getEngineInfo() {
  const ua = navigator.userAgent;
  
  if (ua.includes('WebKit')) return 'WebKit';
  if (ua.includes('Gecko')) return 'Gecko';
  if (ua.includes('Trident')) return 'Trident';
  
  return 'Unknown';
}

// ===== PERMISSIONS UTILITIES =====

/**
 * Check or request browser permissions
 * @param {string} permission - Permission name
 * @returns {Promise<string>} Permission state
 */
export async function checkPermission(permission) {
  if (!navigator.permissions) {
    throw new Error('Permissions API not supported');
  }
  
  try {
    const result = await navigator.permissions.query({ name: permission });
    return result.state; // 'granted', 'denied', or 'prompt'
  } catch (error) {
    console.error(`Failed to check ${permission} permission:`, error);
    return 'unknown';
  }
}

/**
 * Request notification permission
 * @returns {Promise<string>} Permission result
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  
  const permission = await Notification.requestPermission();
  return permission;
}

// ===== REACT HOOK =====

/**
 * React hook for browser utilities
 * @returns {Object} Browser utilities and state
 */
export function useBrowser() {
  const [location, setLocation] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [localeInfo, setLocaleInfo] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  
  // Initialize device info on mount
  useEffect(() => {
    setDeviceInfo(getDeviceInfo());
    setLocaleInfo(getLocaleInfo());
  }, []);
  
  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const getCurrentLocation = useCallback(async (options) => {
    try {
      const loc = await getLocation(options);
      setLocation(loc);
      return loc;
    } catch (error) {
      setLocation({ error: error.message });
      throw error;
    }
  }, []);
  
  const getNetwork = useCallback(async () => {
    try {
      const info = await getNetworkInfo();
      setNetworkInfo(info);
      return info;
    } catch (error) {
      setNetworkInfo({ error: error.message });
      throw error;
    }
  }, []);
  
  return {
    // State
    location,
    networkInfo,
    deviceInfo,
    localeInfo,
    isOnline,
    
    // Methods
    getCurrentLocation,
    getNetwork,
    checkPermission,
    requestNotificationPermission,
    
    // Utilities
    getDeviceInfo,
    getLocaleInfo,
    watchLocation,
    clearLocationWatch
  };
}

export default {
  getLocation,
  watchLocation,
  clearLocationWatch,
  getNetworkInfo,
  getLocaleInfo,
  getDeviceInfo,
  checkPermission,
  requestNotificationPermission,
  useBrowser
};