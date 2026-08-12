// core/services/analytics.js
'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * ANALYTICS CLIENT SERVICE
 * 
 * Mixpanel-like analytics service for client components
 * All tracking is tenant-isolated server-side automatically
 */

// ===== ANALYTICS CLIENT =====

/**
 * Track an event
 * @param {string} event - Event name
 * @param {Object} properties - Event properties
 * @returns {Promise<boolean>} Success status
 */
export async function trackEvent(event, properties = {}) {
  try {
    // Add client-side context
    const clientProperties = {
      ...properties,
      $browser: getBrowserInfo(),
      $os: getOSInfo(),
      $device: getDeviceInfo(),
      $referrer: document.referrer || null,
      $url: window.location.href,
      $sessionId: getSessionId(),
      $timestamp: new Date().toISOString()
    };

    const response = await fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        properties: clientProperties
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analytics request failed');
    }
    
    return true;
    
  } catch (error) {
    console.error('Analytics tracking failed:', error);
    return false;
  }
}

/**
 * Track page view
 * @param {string} page - Page path
 * @param {Object} properties - Additional properties
 * @returns {Promise<boolean>} Success status
 */
export async function trackPageView(page = null, properties = {}) {
  const currentPage = page || window.location.pathname;
  
  return await trackEvent('$page_view', {
    $page: currentPage,
    $title: document.title,
    ...properties
  });
}

/**
 * Identify user
 * @param {Object} traits - User traits
 * @returns {Promise<boolean>} Success status
 */
export async function identifyUser(traits = {}) {
  try {
    const response = await fetch('/api/analytics/identify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        traits: {
          ...traits,
          $identifiedAt: new Date().toISOString()
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'User identification failed');
    }
    
    return true;
    
  } catch (error) {
    console.error('User identification failed:', error);
    return false;
  }
}

/**
 * Track funnel step
 * @param {string} funnelName - Funnel name
 * @param {string} step - Step name
 * @param {Object} properties - Step properties
 * @returns {Promise<boolean>} Success status
 */
export async function trackFunnel(funnelName, step, properties = {}) {
  return await trackEvent(`funnel_${funnelName}_${step}`, {
    $funnel: funnelName,
    $step: step,
    ...properties
  });
}

// ===== ANALYTICS HOOK =====

/**
 * React hook for analytics with state management
 * @returns {Object} Analytics utilities and state
 */
export function useAnalytics() {
  const [isTracking, setIsTracking] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [sessionId] = useState(() => getSessionId());
  
  const track = useCallback(async (event, properties = {}) => {
    setIsTracking(true);
    
    try {
      const success = await trackEvent(event, {
        ...properties,
        $sessionId: sessionId
      });
      
      setLastEvent({
        event,
        properties,
        timestamp: new Date(),
        success
      });
      
      return success;
    } catch (error) {
      setLastEvent({
        event,
        properties,
        timestamp: new Date(),
        success: false,
        error: error.message
      });
      
      throw error;
    } finally {
      setIsTracking(false);
    }
  }, [sessionId]);
  
  const page = useCallback(async (pagePath = null, properties = {}) => {
    return await trackPageView(pagePath, {
      ...properties,
      $sessionId: sessionId
    });
  }, [sessionId]);
  
  const identify = useCallback(async (traits = {}) => {
    return await identifyUser({
      ...traits,
      $sessionId: sessionId
    });
  }, [sessionId]);
  
  const funnel = useCallback(async (funnelName, step, properties = {}) => {
    return await trackFunnel(funnelName, step, {
      ...properties,
      $sessionId: sessionId
    });
  }, [sessionId]);
  
  // Auto-track page views on mount
  useEffect(() => {
    page();
  }, [page]);
  
  return {
    // State
    isTracking,
    lastEvent,
    sessionId,
    
    // Methods
    track,
    page,
    identify,
    funnel,
    
    // Convenience methods
    trackEvent: track,
    trackPageView: page,
    identifyUser: identify,
    trackFunnel: funnel
  };
}

// ===== UTILITY FUNCTIONS =====

/**
 * Get or generate session ID
 */
function getSessionId() {
  if (typeof window === 'undefined') return null;
  
  let sessionId = sessionStorage.getItem('analytics_session_id');
  
  if (!sessionId) {
    sessionId = Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  
  return sessionId;
}

/**
 * Get browser information
 */
function getBrowserInfo() {
  if (typeof window === 'undefined') return null;
  
  const ua = navigator.userAgent;
  
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Opera')) return 'Opera';
  
  return 'Unknown';
}

/**
 * Get OS information
 */
function getOSInfo() {
  if (typeof window === 'undefined') return null;
  
  const ua = navigator.userAgent;
  
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS')) return 'iOS';
  
  return 'Unknown';
}

/**
 * Get device information
 */
function getDeviceInfo() {
  if (typeof window === 'undefined') return null;
  
  const ua = navigator.userAgent;
  
  if (ua.includes('Mobile') || ua.includes('Android')) return 'mobile';
  if (ua.includes('Tablet') || ua.includes('iPad')) return 'tablet';
  
  return 'desktop';
}

// ===== AUTO-TRACKING =====

/**
 * Automatically track page views on route changes
 */
export function enableAutoPageTracking() {
  if (typeof window === 'undefined') return;
  
  let currentPath = window.location.pathname;
  
  const observer = new MutationObserver(() => {
    const newPath = window.location.pathname;
    if (newPath !== currentPath) {
      trackPageView(newPath);
      currentPath = newPath;
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also listen to popstate events
  window.addEventListener('popstate', () => {
    trackPageView();
  });
}

/**
 * Track clicks on elements with data-track attributes
 */
export function enableAutoClickTracking() {
  if (typeof window === 'undefined') return;
  
  document.addEventListener('click', (event) => {
    const element = event.target.closest('[data-track]');
    
    if (element) {
      const eventName = element.getAttribute('data-track');
      const properties = {};
      
      // Extract data-track-* attributes
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('data-track-')) {
          const propName = attr.name.replace('data-track-', '');
          properties[propName] = attr.value;
        }
      });
      
      trackEvent(eventName, {
        $elementType: element.tagName.toLowerCase(),
        $elementText: element.textContent?.trim(),
        $elementId: element.id || null,
        $elementClass: element.className || null,
        ...properties
      });
    }
  });
}

export default {
  // Core methods
  track: trackEvent,
  page: trackPageView,
  identify: identifyUser,
  group: (groupId, traits = {}) => identifyUser({ ...traits, groupId }),
  
  // Original method names
  trackEvent,
  trackPageView,
  identifyUser,
  trackFunnel,
  useAnalytics,
  enableAutoPageTracking,
  enableAutoClickTracking
};