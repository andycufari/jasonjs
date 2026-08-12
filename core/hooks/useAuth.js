// core/hooks/useAuth.js
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Main auth hook for client components
 * Provides user data and auth utilities
 * 
 * @returns {Object} Auth state and methods
 */
export default function useAuth() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const user = session?.user || null;
  const isLoading = status === 'loading';
  const isAuthenticated = !!user;

  // Check if user has specific role(s)
  const hasRole = useCallback((roles) => {
    if (!user) return false;
    
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
    
    return requiredRoles.some(role => userRoles.includes(role));
  }, [user]);

  // Redirect to login
  const redirectToLogin = useCallback((returnUrl) => {
    const callbackUrl = returnUrl || window.location.pathname;
    router.push(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }, [router]);

  // Redirect to access denied
  const redirectToAccessDenied = useCallback(() => {
    router.push('/auth/access-denied');
  }, [router]);

  // Refresh session
  const refreshSession = useCallback(async () => {
    await update();
  }, [update]);

  return {
    // State
    user,
    isLoading,
    isAuthenticated,
    status,
    
    // Methods
    hasRole,
    redirectToLogin,
    redirectToAccessDenied,
    refreshSession,
    
    // Computed properties
    isAdmin: hasRole('admin'),
    isOwner: hasRole('owner'),
    
    // User data shortcuts
    userId: user?.id,
    username: user?.username,
    email: user?.email,
    name: user?.name,
    role: user?.role || 'user',
    roles: user?.roles || [user?.role || 'user'],
    emailVerified: user?.emailVerified,
    startupId: user?.startupId
  };
}