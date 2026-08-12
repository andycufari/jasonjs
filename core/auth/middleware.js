// core/auth/middleware.js - Page-level authentication middleware
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { createAuthOptions } from './options';

/**
 * Page-level authentication middleware
 * Checks if page requires authentication and redirects if not authenticated
 * 
 * @param {Object} pageData - Page configuration data
 * @param {Object} options - Options: { checkOnly: boolean, request?: Object }
 * @returns {Object|null} - User object if authenticated, null if not required, throws redirect if required but not authenticated
 */
export async function authMiddleware(pageData, options = {}) {
  const { checkOnly = false, request = null } = options;
  
  // If checkOnly mode, always try to get session regardless of page.auth
  if (checkOnly) {
    try {
      const authOptions = await createAuthOptions(pageData);
      const session = await getServerSession(authOptions);
      return session?.user || null;
    } catch (error) {
      console.error('Error checking auth session:', error);
      return null;
    }
  }
  
  // Check if page requires authentication
  if (!pageData.auth || pageData.auth !== true) {
    // Page doesn't require auth
    return null;
  }

  try {
    // Get auth configuration and session
    const authOptions = await createAuthOptions(pageData);
    const session = await getServerSession(authOptions);

    // Check if user is authenticated
    if (!session?.user) {
      // User not authenticated - redirect to login
      const authSettings = pageData.auth_config || {};
      const signInUrl = authSettings.urls?.signIn || '/auth/login';
      
      // Get current path for return URL
      let returnUrl = '/';
      if (typeof window !== 'undefined') {
        returnUrl = window.location.pathname;
      } else if (request?.url) {
        try {
          const url = new URL(request.url);
          returnUrl = url.pathname;
        } catch (e) {
          returnUrl = request.url;
        }
      }
      
      const redirectUrl = `${signInUrl}?callbackUrl=${encodeURIComponent(returnUrl)}`;
      
      redirect(redirectUrl);
    }

    // Return authenticated user
    return session.user;
  } catch (error) {
    // Don't log NEXT_REDIRECT errors as they are expected
    if (error.message !== 'NEXT_REDIRECT') {
      console.error('Auth middleware error:', error);
    }
    
    // Re-throw redirect errors to let Next.js handle them
    if (error.digest?.includes('NEXT_REDIRECT')) {
      throw error;
    }
    
    // Fallback redirect on other errors
    redirect('/auth/login');
  }
}

/**
 * Role-based authorization middleware
 * Checks if authenticated user has required role(s)
 * SECURITY: Validates roles from database, not JWT token
 *
 * @param {Object} user - Authenticated user object from session
 * @param {string|Array} requiredRoles - Required role(s)
 * @param {Object} pageData - Page configuration data
 * @returns {boolean} - True if authorized, throws redirect if not
 */
export async function authorizeUser(user, requiredRoles, pageData = {}) {
  if (!user) {
    // Not authenticated
    const authSettings = pageData.auth_config || {};
    const signInUrl = authSettings.urls?.signIn || '/auth/login';
    redirect(signInUrl);
  }

  // SECURITY: Fetch current user roles from database instead of trusting JWT
  let actualUserRoles;
  try {
    const { getMongoClient } = await import('../db/adapters/mongodb/index.js');
    const { ObjectId } = await import('mongodb');

    const connectionString = process.env.MONGODB_URI;
    if (!connectionString) {
      console.error('MONGODB_URI not configured - falling back to JWT roles (INSECURE)');
      actualUserRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
    } else {
      const client = await getMongoClient(connectionString);
      const dbName = process.env.MONGODB_DB_NAME || 'jasonjs_universal';
      const db = client.db(dbName);

      // Query database for user's current roles
      const userId = user.id;
      let dbUser;

      // Try ObjectId format first
      if (userId.match(/^[0-9a-fA-F]{24}$/)) {
        dbUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      }

      // Fallback to string ID
      if (!dbUser) {
        dbUser = await db.collection('users').findOne({ id: userId });
      }

      if (!dbUser) {
        console.error('User not found in database:', userId);
        // User not found - force re-authentication
        const authSettings = pageData.auth_config || {};
        const signInUrl = authSettings.urls?.signIn || '/auth/login';
        redirect(signInUrl);
      }

      // Get roles from database (source of truth)
      actualUserRoles = Array.isArray(dbUser.roles) ? dbUser.roles : [dbUser.role || 'user'];
    }
  } catch (error) {
    console.error('Error fetching user roles from database:', error);
    // On error, deny access to be safe
    const authSettings = pageData.auth_config || {};
    const accessDeniedUrl = authSettings.urls?.accessDenied || '/auth/access-denied';
    redirect(accessDeniedUrl);
  }

  // Convert required roles to array
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  // ADMIN PRIVILEGE: Users with 'admin' role always have access
  const isAdmin = actualUserRoles.includes('admin');

  // Check if user has any of the required roles (from database) OR is admin
  const hasRole = isAdmin || roles.some(role => actualUserRoles.includes(role));

  if (!hasRole) {
    // User doesn't have required role - redirect to access denied
    const authSettings = pageData.auth_config || {};
    const accessDeniedUrl = authSettings.urls?.accessDenied || '/auth/access-denied';
    redirect(accessDeniedUrl);
  }

  return true;
}

/**
 * Higher-order function for page components that require authentication
 * Usage in page.jsx:
 * 
 * export default withPageAuth(async function MyPage({ params }) {
 *   // This page requires authentication
 *   // User will be automatically redirected if not authenticated
 *   return <div>Protected content</div>;
 * });
 */
export function withPageAuth(PageComponent, options = {}) {
  return async function ProtectedPage(props) {
    const { pageData } = props;
    
    // Apply authentication middleware
    const user = await authMiddleware(pageData, props.request);
    
    // Apply role authorization if specified
    if (options.roles) {
      await authorizeUser(user, options.roles, pageData);
    }

    // Render page with user context
    return <PageComponent {...props} user={user} />;
  };
}

/**
 * Check authentication status without redirecting
 * Useful for conditional rendering
 * 
 * @param {Object} pageData - Page configuration data
 * @returns {Object|null} - User object if authenticated, null otherwise
 */
export async function checkAuth(pageData) {
  try {
    const authOptions = await createAuthOptions(pageData);
    const session = await getServerSession(authOptions);
    return session?.user || null;
  } catch (error) {
    console.error('Check auth error:', error);
    return null;
  }
}

/**
 * Server action wrapper that requires authentication
 * Usage:
 * 
 * export const myAction = withAuthAction(async (formData, user) => {
 *   // This action requires authentication
 *   // user parameter is guaranteed to be present
 * });
 */
export function withAuthAction(action) {
  return async function protectedAction(formData) {
    // This would need to be implemented based on how you handle server actions
    // For now, this is a placeholder for the pattern
    throw new Error('Server action auth not implemented yet');
  };
}

export default {
  authMiddleware,
  authorizeUser,
  withPageAuth,
  checkAuth,
  withAuthAction
};