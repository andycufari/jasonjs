// core/services/index.js
// Service Registry for JasonJS Framework Components

import { DatabaseClient, useDatabase, useDB } from '../client/db';
import useAuth from '../hooks/useAuth.js';
import storageService from './storage.js';
import functionsService from './functions.js';
import analyticsService from './analytics.js';
import cacheService from './cache.js';
import browserService from './browser.js';
import mobileService, { useMobile } from './mobile.js';
// AI service removed from direct import - available only through functions API

/**
 * SERVICE REGISTRY
 * 
 * Defines all available services for different component types:
 * - TRUSTED: Server-side cached components (trust: true)
 * - CLIENT: Client-side only components (trust: false/undefined)
 */

// ===== CORE SERVICES =====

export const CoreServices = {
  // Database service - SECURE with server-side tenant isolation
  database: {
    id: 'database',
    name: 'Secure Database Service',
    description: 'Database client with SERVER-SIDE tenant isolation - siteId enforced by API based on user session',
    client: true,
    trusted: true,
    imports: {
      '@/core/client/db': { useDatabase, useDB, DatabaseClient },
      '@database': { useDatabase, useDB, DatabaseClient },
    },
    trustedExtensions: {
      // Enhanced database access for trusted components
      '@/core/client/db/admin': 'adminDatabase'
    },
    example: `
      import { useDatabase } from '@database';
      
      // Server automatically scopes to user's siteId based on session
      const db = useDatabase('my-collection');
      const [data, setData] = useState([]);
      
      useEffect(() => {
        // All operations are tenant-isolated server-side
        db.query().limit(10).exec().then(setData);
      }, []);
    `
  },

  // Auth service - enhanced for trusted, limited for client
  auth: {
    id: 'auth',
    name: 'Authentication Service',
    description: 'User authentication and authorization utilities',
    client: true,
    trusted: true,
    imports: {
      '@/core/hooks/useAuth': { default: useAuth },
      '@auth': { useAuth },
    },
    trustedExtensions: {
      // Additional server-side auth utilities for trusted components
      '@/core/auth/session': 'serverSideAuth',
      '@/core/auth/db': 'authDatabase'
    },
    example: `
      import { useAuth } from '@auth';
      
      const { user, isAuthenticated, hasRole } = useAuth();
      
      if (!isAuthenticated) return <LoginPrompt />;
      if (!hasRole('admin')) return <AccessDenied />;
    `
  },

  // Storage service - file and asset management
  storage: {
    id: 'storage',
    name: 'Storage Service',
    description: 'File upload, asset management, and CDN services',
    client: true,
    trusted: true,
    imports: {
      '@/core/services/storage': storageService,
      '@storage': storageService,
    },
    trustedExtensions: {
      // Server-side file operations for trusted components
      '@/core/services/storage/server': 'serverStorage'
    }
  },

  // Cache service - secure client-side caching with memory limits
  cache: {
    id: 'cache',
    name: 'Cache Service',
    description: 'Secure client-side caching and memoization utilities with memory/size limits',
    client: true,
    trusted: true,
    imports: {
      '@/core/services/cache': cacheService,
      '@cache': cacheService,
    },
    example: `
      import { useCache, setCacheItem, getCacheItem, memoize } from '@cache';
      
      // Basic caching
      setCacheItem('user:123', userData, 300000); // 5 minutes
      const cached = getCacheItem('user:123');
      
      // React hook
      const { get, set, clear, stats } = useCache();
      set('key', 'value', 60000); // 1 minute TTL
      const value = get('key');
      
      // Memoization
      const expensiveFunction = memoize(calculateSomething, 600000); // 10 minutes
      
      // Cache statistics
      const { totalItems, hitRate, totalSize } = stats();
    `
  },

  // Analytics service - secure Mixpanel-like tracking with tenant isolation
  analytics: {
    id: 'analytics',
    name: 'Analytics Service',
    description: 'Secure event tracking, metrics collection, and analytics with automatic tenant isolation',
    client: true,
    trusted: true,
    imports: {
      '@/core/services/analytics': analyticsService,
      '@analytics': analyticsService,
    },
    trustedExtensions: {
      // Server-side analytics access for trusted components
      '@/core/services/tracking/analytics': 'serverAnalytics'
    },
    example: `
      import { trackEvent, trackPageView, useAnalytics } from '@analytics';
      
      // Track custom events
      await trackEvent('button_clicked', { 
        buttonId: 'signup',
        page: 'homepage' 
      });
      
      // Track page views
      await trackPageView('/dashboard');
      
      // Identify users
      await identifyUser({ 
        name: 'John Doe',
        plan: 'premium' 
      });
      
      // Track funnel steps
      await trackFunnel('onboarding', 'step_1', { source: 'email' });
      
      // Use React hook
      const { track, identify, funnel } = useAnalytics();
      await track('user_action', { action: 'export' });
    `
  },

  // Functions service - server-side function execution
  functions: {
    id: 'functions',
    name: 'Function Execution Service',
    description: 'Execute server-side functions from client components with automatic tenant isolation',
    client: true,
    trusted: true,
    imports: {
      '@/core/services/functions': functionsService,
      '@functions': functionsService,
    },
    example: `
      import { callFun, callAI, useFunctions } from '@functions';
      
      // Execute AI prompt
      const result = await callAI('Write a haiku about coding');
      
      // Execute custom function
      const data = await callFun('MyCustomFunction', { param: 'value' });
      
      // Use hook for state management
      const { execute, ai, isExecuting } = useFunctions();
      const response = await ai('Hello world');
    `
  },

  // Note: AI service access removed from direct import
  // AI is only available through the secure functions API (@functions callAI)
  // This prevents malicious console access and ensures proper tenant isolation

  // Browser utilities - client information and capabilities
  browser: {
    id: 'browser',
    name: 'Browser Utilities',
    description: 'Get location, IP, locale, device info, and browser capabilities',
    client: true,
    trusted: true,
    imports: {
      '@/core/services/browser': browserService,
      '@browser': browserService,
    },
    example: `
      import { getLocation, getNetworkInfo, getDeviceInfo, useBrowser } from '@browser';

      // Get user location (requests permission)
      const location = await getLocation({ enableHighAccuracy: true });
      console.log(location.latitude, location.longitude);

      // Get IP and network info
      const network = await getNetworkInfo();
      console.log('IP:', network.ip);

      // Get device information
      const device = getDeviceInfo();
      console.log('OS:', device.os.name, device.browser.name);

      // React hook with state management
      const { getCurrentLocation, getNetwork, isOnline } = useBrowser();
      const loc = await getCurrentLocation();
    `
  },

  // Mobile bridge - native mobile capabilities via the JasonJS native app shell
  mobile: {
    id: 'mobile',
    name: 'Mobile Bridge Service',
    description: 'Native mobile capabilities (GPS, Camera, Haptics, Sensors, etc.) when running in the JasonJS native app shell. Falls back to web APIs when not in native context.',
    client: true,
    trusted: true,
    imports: {
      '@/core/services/mobile': mobileService,
      '@mobile': mobileService,
    },
    example: `
      import mobile, { useMobile } from '@mobile';

      // Check if running in native app
      if (mobile.isNative) {
        console.log('Running in the native app shell!');
      }

      // GPS - Get current location
      const position = await mobile.gps.getCurrentPosition({ accuracy: 'high' });
      console.log(position.latitude, position.longitude);

      // GPS - Watch position changes
      const stopWatching = await mobile.gps.watchPosition((pos) => {
        console.log('New position:', pos);
      }, { distanceInterval: 10 });
      // Later: await stopWatching();

      // Camera - Take photo
      const photo = await mobile.camera.takePhoto({ quality: 0.8, base64: true });
      if (!photo.canceled) {
        console.log('Photo URI:', photo.uri);
      }

      // Camera - Pick image from library
      const result = await mobile.camera.pickImage({ multiple: true, limit: 5 });

      // Haptics - Trigger feedback
      await mobile.haptics.impact('medium');
      await mobile.haptics.notification('success');
      await mobile.haptics.selection();

      // Sensors - Accelerometer
      const stopAccel = await mobile.sensors.accelerometer.start((data) => {
        console.log('Acceleration:', data.x, data.y, data.z);
      }, 100);

      // Biometrics - Face ID / Touch ID
      const bioResult = await mobile.biometrics.authenticate({
        promptMessage: 'Confirm your identity'
      });

      // Clipboard
      await mobile.clipboard.copy('Hello World');
      const { text } = await mobile.clipboard.paste();

      // Sharing
      await mobile.sharing.share({
        message: 'Check out this app!',
        url: 'https://example.com'
      });

      // Notifications
      await mobile.notifications.scheduleLocal({
        title: 'Reminder',
        body: 'Don\\'t forget!',
        trigger: { seconds: 60 }
      });

      // Device info
      const info = await mobile.device.getInfo();
      console.log('Platform:', info.platform, 'Version:', info.version);

      // React hook with state management
      const { isNative, isReady, location, deviceInfo, networkState } = useMobile();
    `
  }
};

// ===== THIRD-PARTY SERVICES (AVAILABLE ON-DEMAND) =====

export const ThirdPartyServices = {
  // Services are registered but not imported until needed
  // This prevents import errors for services that aren't implemented yet
  
  stripe: {
    id: 'stripe',
    name: 'Stripe Payment Service', 
    description: 'Payment processing with Stripe (install: npm install @stripe/stripe-js)',
    client: true,
    trusted: true,
    available: false, // Set to true when implemented
    installCommand: 'npm install @stripe/stripe-js',
    imports: {
      // Dynamic imports are handled in component loader when available
    }
  },

  email: {
    id: 'email',
    name: 'Email Service',
    description: 'Send emails, manage templates, and notifications',
    client: false,
    trusted: true,
    available: false, // Available through function context only
    imports: {
      // Email only available in server functions via context.sendEmail
    }
  }
};

// ===== SERVICE REGISTRY MANAGER =====

export class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    // Register all core services
    Object.values(CoreServices).forEach(service => {
      this.register(service);
    });

    // Register all third-party services
    Object.values(ThirdPartyServices).forEach(service => {
      this.register(service);
    });
  }

  register(service) {
    this.services.set(service.id, service);
  }

  getService(id) {
    return this.services.get(id);
  }

  getAvailableServices(componentType = 'client') {
    const available = [];
    
    for (const service of this.services.values()) {
      if (componentType === 'trusted' && service.trusted) {
        available.push(service);
      } else if (componentType === 'client' && service.client) {
        available.push(service);
      }
    }
    
    return available;
  }

  /**
   * Get the import map for a specific component type
   * @param {string} componentType - 'client' or 'trusted'
   * @returns {Object} Import map for DynamicComponentLoader
   */
  getImportMap(componentType = 'client') {
    const importMap = {};
    const services = this.getAvailableServices(componentType);
    
    for (const service of services) {
      // Only add imports if service is available and has actual imports
      if (service.available !== false && service.imports) {
        // Add base imports (only static imports, skip dynamic ones)
        Object.entries(service.imports).forEach(([path, moduleExports]) => {
          // Skip dynamic imports (functions) - these are loaded on-demand
          if (typeof moduleExports !== 'function') {
            importMap[path] = moduleExports;
          }
        });
        
        // Add trusted extensions if applicable
        if (componentType === 'trusted' && service.trustedExtensions) {
          Object.assign(importMap, service.trustedExtensions);
        }
      }
    }
    
    return importMap;
  }

  /**
   * Generate documentation for available services
   * @param {string} componentType - 'client' or 'trusted'
   * @returns {string} Markdown documentation
   */
  generateDocs(componentType = 'client') {
    const services = this.getAvailableServices(componentType);
    let docs = `# Available Services (${componentType})\n\n`;
    
    for (const service of services) {
      docs += `## ${service.name}\n`;
      docs += `**ID**: ${service.id}\n`;
      docs += `**Description**: ${service.description}\n\n`;
      
      docs += `### Import Options:\n`;
      Object.entries(service.imports).forEach(([importPath, exports]) => {
        docs += `- \`${importPath}\` → ${JSON.stringify(exports)}\n`;
      });
      
      if (componentType === 'trusted' && service.trustedExtensions) {
        docs += `\n### Additional (Trusted Only):\n`;
        Object.entries(service.trustedExtensions).forEach(([importPath, feature]) => {
          docs += `- \`${importPath}\` → ${feature}\n`;
        });
      }
      
      if (service.example) {
        docs += `\n### Example:\n\`\`\`javascript${service.example}\`\`\`\n\n`;
      }
      
      docs += `---\n\n`;
    }
    
    return docs;
  }
}

// Global registry instance
export const serviceRegistry = new ServiceRegistry();

export default serviceRegistry;