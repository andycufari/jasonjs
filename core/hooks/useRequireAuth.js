// core/hooks/useRequireAuth.js
'use client';

import { useEffect } from 'react';
import useAuth from './useAuth';

/**
 * Hook that requires authentication
 * Redirects to login if not authenticated
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.redirectTo - Custom redirect URL after login
 * @param {boolean} options.disableRedirect - Disable automatic redirect
 * @returns {Object} Auth state (guaranteed authenticated after loading)
 */
export default function useRequireAuth(options = {}) {
  const auth = useAuth();
  const { redirectTo, disableRedirect = false } = options;

  useEffect(() => {
    // Skip during loading
    if (auth.isLoading) return;

    // Redirect if not authenticated
    if (!auth.isAuthenticated && !disableRedirect) {
      auth.redirectToLogin(redirectTo);
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.redirectToLogin, redirectTo, disableRedirect]);

  return {
    ...auth,
    // Override isAuthenticated to indicate required auth
    isAuthenticated: auth.isLoading ? false : auth.isAuthenticated,
    requiresAuth: true
  };
}