// components/system/auth/ProtectedContent.jsx
'use client';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function ProtectedContent({ 
  children, 
  roles = null, 
  fallback = null,
  loginMessage = "Please sign in to view this content",
  accessDeniedMessage = "You don't have permission to view this content",
  jcontext 
}) {
  const { data: session, status } = useSession();
  const authSettings = jcontext?.auth || {};
  
  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!session?.user) {
    if (fallback) {
      return fallback;
    }

    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Authentication Required
        </h3>
        <p className="text-gray-600 mb-6">
          {loginMessage}
        </p>
        <div className="space-x-3">
          <Link
            href={authSettings.urls?.signIn || '/auth/login'}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
          {authSettings.registration?.enabled && (
            <Link
              href={authSettings.urls?.signUp || '/auth/signup'}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Create Account
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Check role-based authorization
  if (roles) {
    const userRoles = Array.isArray(session.user.roles) 
      ? session.user.roles 
      : [session.user.role || 'user'];
    
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-900 mb-2">
            Access Denied
          </h3>
          <p className="text-red-600 mb-4">
            {accessDeniedMessage}
          </p>
          <p className="text-sm text-red-500 mb-6">
            Required role(s): {requiredRoles.join(', ')}
            <br />
            Your role: {session.user.role || 'user'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            Go Back
          </Link>
        </div>
      );
    }
  }

  // User is authenticated and authorized - render protected content
  return children;
}

ProtectedContent.displayName = 'ProtectedContent';
ProtectedContent.isSystemComponent = true;