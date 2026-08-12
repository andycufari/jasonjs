// components/system/auth/SignOutButton.jsx - Clerk-style SignOutButton component
'use client';
import { signOut } from 'next-auth/react';
import useAuth from '@/core/hooks/useAuth';

export default function SignOutButton({ 
  children,
  afterSignOutUrl = '/',
  appearance = {},
  className = '',
  jcontext 
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const theme = jcontext?.theme || {};

  // Don't show if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <button 
        disabled
        className={`
          inline-flex items-center px-4 py-2 rounded-md text-sm font-medium
          bg-gray-100 text-gray-400 cursor-not-allowed
          ${className}
        `}
      >
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-transparent mr-2"></div>
        Loading...
      </button>
    );
  }

  const handleSignOut = async (e) => {
    e.preventDefault();
    await signOut({ callbackUrl: afterSignOutUrl });
  };

  // Default button styles with theme integration
  const defaultClasses = `
    inline-flex items-center justify-center px-4 py-2 rounded-md
    text-sm font-medium transition-colors focus:outline-none
    focus:ring-2 focus:ring-offset-2 focus:ring-red-500
    ${appearance.variant === 'outline' 
      ? 'border border-red-300 text-red-700 bg-white hover:bg-red-50' 
      : 'text-white bg-red-600 hover:bg-red-700'
    }
    ${className}
  `;

  const buttonStyle = {
    backgroundColor: appearance.variant === 'outline' 
      ? undefined 
      : (appearance.backgroundColor || '#DC2626'),
    borderColor: appearance.variant === 'outline' 
      ? (appearance.borderColor || '#FCA5A5')
      : undefined
  };

  return (
    <button
      onClick={handleSignOut}
      className={defaultClasses}
      style={buttonStyle}
    >
      {children || (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </>
      )}
    </button>
  );
}

SignOutButton.displayName = 'SignOutButton';
SignOutButton.isSystemComponent = true;