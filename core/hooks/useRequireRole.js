// core/hooks/useRequireRole.js
'use client';

import { useEffect } from 'react';
import useAuth from './useAuth';

/**
 * Hook that requires specific role(s)
 * Redirects to access denied if user doesn't have required role
 * 
 * @param {string|Array} roles - Required role(s)
 * @param {Object} options - Configuration options
 * @param {boolean} options.disableRedirect - Disable automatic redirect
 * @returns {Object} Auth state (guaranteed authorized after loading)
 */
export default function useRequireRole(roles, options = {}) {
  const auth = useAuth();
  const { disableRedirect = false } = options;

  useEffect(() => {
    // Skip during loading
    if (auth.isLoading) return;

    // First check authentication
    if (!auth.isAuthenticated && !disableRedirect) {
      auth.redirectToLogin();
      return;
    }

    // Then check authorization
    if (auth.isAuthenticated && !auth.hasRole(roles) && !disableRedirect) {
      auth.redirectToAccessDenied();
    }
  }, [
    auth.isLoading, 
    auth.isAuthenticated, 
    auth.hasRole, 
    auth.redirectToLogin, 
    auth.redirectToAccessDenied,
    roles, 
    disableRedirect
  ]);

  return {
    ...auth,
    // Additional properties
    requiredRoles: Array.isArray(roles) ? roles : [roles],
    isAuthorized: auth.isLoading ? false : auth.hasRole(roles),
    requiresRole: true
  };
}