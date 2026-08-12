// components/system/auth/SignUpButton.jsx - Clerk-style SignUpButton component
'use client';
import useAuth from '@/core/hooks/useAuth';

export default function SignUpButton({ 
  children,
  mode = 'redirect', // 'redirect' | 'modal'
  afterSignUpUrl = '/',
  appearance = {},
  className = '',
  jcontext 
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const theme = jcontext?.theme || {};
  const authConfig = jcontext?.auth?.config || {};

  // Don't show if already authenticated or registration disabled
  if (isAuthenticated || !authConfig.registration?.enabled) {
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

  const handleSignUp = async (e) => {
    e.preventDefault();
    
    if (mode === 'modal') {
      // TODO: Implement modal sign-up (future enhancement)
      console.warn('Modal mode not implemented yet, falling back to redirect');
    }
    
    // Redirect to sign-up page
    const signUpUrl = authConfig.urls?.signUp || '/auth/signup';
    const callbackUrl = afterSignUpUrl || '/';
    
    window.location.href = `${signUpUrl}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  };

  // Default button styles with theme integration
  const defaultClasses = `
    inline-flex items-center justify-center px-4 py-2 rounded-md
    text-sm font-medium transition-colors focus:outline-none
    focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
    ${appearance.variant === 'outline' 
      ? 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50' 
      : 'text-white bg-blue-600 hover:bg-blue-700'
    }
    ${className}
  `;

  const buttonStyle = {
    backgroundColor: appearance.variant === 'outline' 
      ? undefined 
      : (appearance.backgroundColor || theme.primaryColor || '#3B82F6'),
    borderColor: appearance.variant === 'outline' 
      ? (appearance.borderColor || theme.borderColor || '#D1D5DB')
      : undefined
  };

  return (
    <button
      onClick={handleSignUp}
      className={defaultClasses}
      style={buttonStyle}
    >
      {children || (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Sign up
        </>
      )}
    </button>
  );
}

SignUpButton.displayName = 'SignUpButton';
SignUpButton.isSystemComponent = true;