// components/system/auth/AuthGuard.jsx - Wrapper component for conditional auth rendering
'use client';
import useAuth from '@/core/hooks/useAuth';

export default function AuthGuard({ 
  children,
  fallback = null,
  requireAuth = false,
  requireRoles = null,
  showLoading = true,
  jcontext 
}) {
  const { user, isAuthenticated, isLoading, hasRole } = useAuth();

  // Loading state
  if (isLoading && showLoading) {
    return fallback || (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    return fallback || null;
  }

  // Check role requirement
  if (requireRoles && isAuthenticated && !hasRole(requireRoles)) {
    return fallback || null;
  }

  // Render children if all conditions are met
  return children;
}

AuthGuard.displayName = 'AuthGuard';
AuthGuard.isSystemComponent = true;