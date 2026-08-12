// components/system/auth/SignInButton.jsx - Clerk-style SignInButton component
'use client';
import useAuth from '@/core/hooks/useAuth';

export default function SignInButton({ 
  children,
  options = {},
  className = ''
}) {
  // Use useAuth hook since this is a trusted system component
  const { isAuthenticated, isLoading } = useAuth();
  
  // Merge default options with user provided options
  const config = {
    mode: options.mode || 'redirect', // 'redirect' | 'modal'
    afterSignInUrl: options.afterSignInUrl || '/',
    signInUrl: options.signInUrl || '/auth/login',
    appearance: {
      variant: 'default', // 'default' | 'outline'
      ...options.appearance
    },
    labels: {
      signIn: 'Sign in',
      loading: 'Loading...',
      ...options.labels
    },
    ...options
  };

  // Don't show if already authenticated
  if (isAuthenticated) {
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
        {config.labels.loading}
      </button>
    );
  }

  const handleSignIn = async (e) => {
    e.preventDefault();
    
    if (config.mode === 'modal') {
      // TODO: Implement modal sign-in (future enhancement)
      console.warn('Modal mode not implemented yet, falling back to redirect');
    }
    
    // Redirect to sign-in page
    const callbackUrl = config.afterSignInUrl;
    window.location.href = `${config.signInUrl}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  };

  // Default button styles
  const defaultClasses = `
    inline-flex items-center justify-center px-4 py-2 rounded-md
    text-sm font-medium transition-colors focus:outline-none
    focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
    ${config.appearance.variant === 'outline' 
      ? 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50' 
      : 'text-white bg-blue-600 hover:bg-blue-700'
    }
    ${className}
  `;

  return (
    <button
      onClick={handleSignIn}
      className={defaultClasses}
    >
      {children || (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          {config.labels.signIn}
        </>
      )}
    </button>
  );
}

SignInButton.displayName = 'SignInButton';
SignInButton.isSystemComponent = true;