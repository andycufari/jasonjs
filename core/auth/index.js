// core/auth/index.js - Unified Auth Library for JasonJS Framework
// This provides both client and server-side auth utilities

import { getServerSession } from 'next-auth';
import { createAuthOptions } from './options';
import { authMiddleware, authorizeUser, checkAuth } from './middleware';
import { resolveSite } from '../sites/resolve';

/**
 * Server-side auth utilities
 * These can only be used in server components, route handlers, and server actions
 */
export const serverAuth = {
  /**
   * Get current user session
   * @param {Object} pageData - Page configuration (required for multi-tenant auth)
   * @returns {Object|null} User object or null if not authenticated
   */
  async getUser(pageData) {
    const authOptions = await createAuthOptions(pageData);
    const session = await getServerSession(authOptions);
    return session?.user || null;
  },

  /**
   * Check if user is authenticated (doesn't redirect)
   * @param {Object} pageData - Page configuration
   * @returns {boolean} True if authenticated
   */
  async isAuthenticated(pageData) {
    const user = await this.getUser(pageData);
    return !!user;
  },

  /**
   * Check if user has specific role(s)
   * @param {Object} pageData - Page configuration
   * @param {string|Array} roles - Required role(s)
   * @returns {boolean} True if user has role
   */
  async hasRole(pageData, roles) {
    const user = await this.getUser(pageData);
    if (!user) return false;
    
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
    
    return requiredRoles.some(role => userRoles.includes(role));
  },

  /**
   * Require authentication (redirects if not authenticated)
   * @param {Object} pageData - Page configuration
   * @returns {Object} User object (guaranteed)
   */
  async requireAuth(pageData) {
    return await authMiddleware(pageData);
  },

  /**
   * Require specific role(s) (redirects if not authorized)
   * @param {Object} pageData - Page configuration
   * @param {string|Array} roles - Required role(s)
   * @returns {Object} User object (guaranteed)
   */
  async requireRole(pageData, roles) {
    const user = await this.requireAuth(pageData);
    await authorizeUser(user, roles, pageData);
    return user;
  },

  /**
   * Create auth context for API routes
   * @param {Request} request - Next.js request object
   * @returns {Object} Auth context with user and helpers
   */
  async createApiContext(request) {
    // Extract domain from request
    const { host: domain } = await resolveSite(request);
    
    // Get page data for auth config
    const { getPage } = await import('../sites/files');
    const pageData = await getPage(domain, '/');
    
    // Get user session
    const user = await this.getUser(pageData);
    
    return {
      user,
      isAuthenticated: !!user,
      hasRole: (roles) => {
        if (!user) return false;
        const requiredRoles = Array.isArray(roles) ? roles : [roles];
        const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
        return requiredRoles.some(role => userRoles.includes(role));
      },
      requireAuth: () => {
        if (!user) {
          throw new Error('Authentication required');
        }
        return user;
      },
      requireRole: (roles) => {
        if (!user) {
          throw new Error('Authentication required');
        }
        const hasRequiredRole = this.hasRole(roles);
        if (!hasRequiredRole) {
          throw new Error('Insufficient permissions');
        }
        return user;
      }
    };
  }
};

/**
 * Client-side auth utilities
 * These are re-exported from next-auth/react for convenience
 */
export { 
  useSession,
  signIn, 
  signOut,
  getCsrfToken,
  getProviders,
  getSession 
} from 'next-auth/react';

/**
 * Custom React hooks for auth
 */
export { default as useAuth } from '../hooks/useAuth';
export { default as useRequireAuth } from '../hooks/useRequireAuth';
export { default as useRequireRole } from '../hooks/useRequireRole';

/**
 * Auth components
 */
export { default as AuthSystemProvider } from '@/components/system/auth/AuthSystemProvider';
export { default as AuthProvider } from '@/components/framework/auth/AuthProvider';
export { default as UnifiedAuth } from '@/components/framework/auth/UnifiedAuth';
export { default as AuthModal } from '@/components/framework/auth/AuthModal';

// Deprecated: Use UnifiedAuth instead
export { default as LoginForm } from '@/components/framework/auth/_LoginForm';
export { default as SignupForm } from '@/components/framework/auth/_SignupForm';

/**
 * Helper function to create auth context for components
 * This is automatically injected into jcontext by the renderer
 *
 * NOTE: This object is serialized from Server to Client Components,
 * so it can ONLY contain serializable data (no functions, no getters).
 * For hasRole() function, use app.auth.hasRole() in client components.
 */
export function createAuthContext(user, authConfig = {}) {
  // Pre-compute user roles array for reuse
  const userRoles = user ? (Array.isArray(user.roles) ? user.roles : [user.role || 'user']) : [];

  // Only expose what the client actually needs — never leak internal config
  // (security settings, email templates, provider secrets, error messages, etc.)
  const clientSafeConfig = {
    registration: {
      enabled: authConfig.registration?.enabled ?? true,
      customFields: authConfig.registration?.customFields || [],
    },
    ui: authConfig.ui ? {
      labels: authConfig.ui.labels || {},
      messages: authConfig.ui.messages || {},
      brandColor: authConfig.ui.brandColor,
      terms: authConfig.ui.terms,
      showSocialProviders: authConfig.ui.showSocialProviders,
      showForgotPassword: authConfig.ui.showForgotPassword,
      showProtectedBy: authConfig.ui.showProtectedBy,
      protectedByText: authConfig.ui.protectedByText,
      defaultName: authConfig.ui.defaultName,
    } : undefined,
    providers: authConfig.providers ? {
      // Only expose which providers are enabled, never keys/secrets
      credentials: { enabled: !!authConfig.providers.credentials?.enabled },
      email: { enabled: !!authConfig.providers.email?.enabled },
      google: { enabled: !!authConfig.providers.google?.enabled },
      github: { enabled: !!authConfig.providers.github?.enabled },
    } : undefined,
    signup: authConfig.signup ? { enabled: authConfig.signup.enabled } : undefined,
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoggedIn: !!user, // Alias for isAuthenticated (convenience)
    config: clientSafeConfig,

    // User roles array for direct access
    // Use: jcontext.auth.userRoles.includes('admin')
    // Or use app.auth.hasRole('admin') in client components
    userRoles,

    // Pre-computed admin check (boolean, not getter - must be serializable)
    isAdmin: userRoles.includes('admin'),

    // URLs for auth actions
    urls: {
      signIn: authConfig.urls?.signIn || '/auth/login',
      signUp: authConfig.urls?.signUp || '/auth/signup',
      signOut: authConfig.urls?.signOut || '/auth/logout',
      profile: authConfig.urls?.profile || '/auth/profile'
    }
  };
}

/**
 * Export middleware functions for advanced use cases
 */
export { authMiddleware, authorizeUser, checkAuth, withPageAuth } from './middleware';

/**
 * Export auth configuration helpers
 */
export { createAuthOptions, getAuthConfig } from './options';
export { DEFAULT_AUTH_CONFIG } from './defaults';

/**
 * Export validation utilities
 */
export { 
  validateUsername, 
  validateEmail, 
  validatePassword,
  getUserByUsername,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser
} from './lib';