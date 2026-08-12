'use client'
import { useState, useEffect } from 'react';
import { signIn, getProviders } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AuthForm({ jcontext }) {
  const [credentials, setCredentials] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');
  const [providers, setProviders] = useState({});
  const router = useRouter();

  // Get auth settings from jcontext with defaults
  const authSettings = jcontext?.auth || {};
  const enabledProviders = authSettings.providers || { 
    credentials: { enabled: true } // Default to credentials enabled
  };
  const uiLabels = authSettings.ui?.labels || {};

  useEffect(() => {
    getProviders().then(setProviders);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setStatus('sending');

    try {
      let result;

      // Determine which provider to use based on configuration
      if (enabledProviders.credentials?.enabled) {
        // Use credentials provider (username/password)
        result = await signIn('credentials', {
          username: credentials.username || credentials.email,
          password: credentials.password,
          redirect: false,
          callbackUrl: authSettings.redirects?.afterSignIn || '/'
        });
      } else if (enabledProviders.email?.enabled) {
        // Use email provider (magic link)
        result = await signIn('email', {
          email: credentials.email,
          redirect: false,
          callbackUrl: authSettings.redirects?.afterSignIn || '/'
        });
      } else {
        throw new Error('No authentication method enabled');
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      if (result?.ok) {
        if (enabledProviders.credentials?.enabled) {
          // Redirect immediately for credentials
          router.push(authSettings.redirects?.afterSignIn || '/');
        } else {
          // Show success message for email magic link
          setStatus('sent');
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
    setError(''); // Clear error when user types
  };

  return (
    <div className="space-y-6">

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username/Email field for credentials provider */}
        {enabledProviders.credentials?.enabled && (
          <div>
            <label 
              htmlFor="username" 
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              {uiLabels.username || 'Username or Email'}
            </label>
            <input
              id="username"
              type="text"
              required
              value={credentials.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              disabled={isLoading || status === 'sent'}
              placeholder={enabledProviders.credentials.fields?.username?.label || 'Enter your username or email'}
              className="auth-input"
              autoComplete="username"
            />
          </div>
        )}

        {/* Email field for email provider or fallback */}
        {(enabledProviders.email?.enabled || !enabledProviders.credentials?.enabled) && (
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              {uiLabels.email || 'Email address'}
            </label>
            <input
              id="email"
              type="email"
              required={!enabledProviders.credentials?.enabled}
              value={credentials.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={isLoading || status === 'sent'}
              placeholder="name@example.com"
              className="auth-input"
              autoComplete="email"
            />
          </div>
        )}

        {/* Password field for credentials provider */}
        {enabledProviders.credentials?.enabled && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-slate-300"
              >
                {uiLabels.password || 'Password'}
              </label>
              {authSettings.ui?.showForgotPassword !== false && (
                <Link 
                  href={authSettings.urls?.forgotPassword || '/auth/forgot-password'}
                  className="text-sm auth-link"
                >
                  Forgot?
                </Link>
              )}
            </div>
            <input
              id="password"
              type="password"
              required
              value={credentials.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              disabled={isLoading || status === 'sent'}
              placeholder="Enter your password"
              className="auth-input"
              autoComplete="current-password"
            />
          </div>
        )}

        {error && (
          <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/20 rounded-lg">
            {error}
          </div>
        )}

        {status === 'sent' && (
          <div className="p-3 text-sm text-green-400 bg-green-900/20 border border-green-900/20 rounded-lg">
            Check your email for a sign in link!
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || status === 'sent'}
          className="auth-button"
        >
          {isLoading 
            ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            )
            : enabledProviders.credentials?.enabled 
              ? (uiLabels.continue || 'Sign in')
              : 'Continue with Email'
          }
        </button>

        {/* OAuth Providers */}
        {authSettings.ui?.showSocialProviders && (
          <div className="space-y-2">
            {enabledProviders.google?.enabled && providers.google && (
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: authSettings.redirects?.afterSignIn || '/' })}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 border border-white/20 rounded-lg text-sm font-medium text-white bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-all duration-200"
              >
                Continue with Google
              </button>
            )}

            {enabledProviders.github?.enabled && providers.github && (
              <button
                type="button"
                onClick={() => signIn('github', { callbackUrl: authSettings.redirects?.afterSignIn || '/' })}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 border border-white/20 rounded-lg text-sm font-medium text-white bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-all duration-200"
              >
                Continue with GitHub
              </button>
            )}
          </div>
        )}

        {/* Divider */}
        {authSettings.ui?.showSocialProviders && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white/10 text-gray-400">Or continue with</span>
            </div>
          </div>
        )}

        {/* Terms */}
        {authSettings.ui?.terms && (
          <p className="text-xs text-gray-400 text-center">
            {authSettings.ui.terms.text}
          </p>
        )}
      </form>
    </div>
  );
}