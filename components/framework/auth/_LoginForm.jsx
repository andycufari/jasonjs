'use client'

/**
 * @deprecated LoginForm is deprecated in favor of UnifiedAuth component.
 *
 * UnifiedAuth provides a single, unified authentication flow that handles
 * both login and signup with email verification codes by default.
 *
 * Migration:
 * - Replace <LoginForm /> with <UnifiedAuth />
 * - UnifiedAuth automatically detects if user exists and adapts the flow
 *
 * @see UnifiedAuth for the recommended authentication component
 */

import { useState, useEffect } from 'react';
import { signIn, getProviders } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthConfig } from '@/core/hooks/useAuthConfig';
import EmailCodeVerification from './EmailCodeVerification';
import eventBus from '@/core/services/eventBus';

export default function LoginForm({ jcontext, onSuccess, className = '' }) {
  // Extract app object from jcontext with fallback
  const app = jcontext?.app;

  // Safety check - if no app object, we can't use centralized auth
  if (!app) {
    console.warn('LoginForm: No app object available, auth state updates may not work correctly');
  }

  const [credentials, setCredentials] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');
  const [providers, setProviders] = useState({});
  const [verificationData, setVerificationData] = useState(null);
  const router = useRouter();

  // Load auth configuration
  const { authConfig, loading: configLoading } = useAuthConfig();

  // Merge with jcontext for backward compatibility
  const authSettings = jcontext?.auth || authConfig?.auth || {};
  const enabledProviders = authSettings.providers || {
    credentials: { enabled: true }
  };

  // Use auth config labels with fallback to jcontext
  const texts = authConfig?.texts || {};
  const theme = authConfig?.theme || jcontext?.theme || {};
  const uiLabels = authSettings.ui?.labels || {};
  const uiButtons = authSettings.ui?.buttons || {};
  const uiInputs = authSettings.ui?.inputs || {};
  const uiMessages = authSettings.ui?.messages || {};

  // Helper to get label with priority: uiLabels > texts > fallback
  const getLabel = (uiKey, textKey, fallback) => {
    return uiLabels[uiKey] || texts[textKey] || fallback;
  };

  const isCodeAuth = authSettings.registration?.requireEmailVerification &&
                     authSettings.registration?.emailVerificationMethod === 'code';
  const showPasswordField = enabledProviders.credentials?.enabled && !isCodeAuth;

  // Detect current color scheme
  // Priority: explicit theme config > 'light' default (we don't auto-detect system preference)
  const [colorScheme, setColorScheme] = useState(() => {
    // If theme has explicit defaultColorScheme, use it
    if (theme.defaultColorScheme) {
      return theme.defaultColorScheme;
    }
    // If theme config exists but no defaultColorScheme, assume light
    if (theme.colors || theme.typography) {
      return 'light';
    }
    // No theme config at all - default to light
    return 'light';
  });

  useEffect(() => {
    getProviders().then(setProviders);

    // Update color scheme only if theme config changes
    if (theme.defaultColorScheme) {
      setColorScheme(theme.defaultColorScheme);
    }
  }, [theme.defaultColorScheme]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setStatus('sending');

    try {
      let result;

      if (isCodeAuth) {
        const response = await fetch('/api/auth/send-login-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.username || credentials.email })
        });

        const data = await response.json();

        if (!response.ok) {
          // Handle user not found - automatically switch to signup
          if (response.status === 404 && data.canSignUp) {
            if (onSuccess) {
              onSuccess({
                switchToSignup: true,
                email: credentials.username || credentials.email,
                message: 'No account found with this email. Let\'s create one!'
              });
            }
            return;
          }
          throw new Error(data.error || 'Failed to send code');
        }

        // Handle code verification in modal instead of redirecting
        if (data.requiresVerification && data.verificationType === 'code') {
          setStatus('verification-required');
          setVerificationData({
            email: credentials.username || credentials.email,
            type: 'login',
            user: data.user
          });
          return;
        }

        // Fallback redirect (shouldn't happen with new API)
        router.push(`/auth/verify-email?email=${encodeURIComponent(credentials.username || credentials.email)}&type=login`);
        return;
      }

      if (enabledProviders.credentials?.enabled) {
        result = await signIn('credentials', {
          username: credentials.username || credentials.email,
          password: credentials.password,
          redirect: false,
          callbackUrl: authSettings.redirects?.afterSignIn || '/'
        });
      } else if (enabledProviders.email?.enabled) {
        result = await signIn('email', {
          email: credentials.email,
          redirect: false,
          callbackUrl: authSettings.redirects?.afterSignIn || '/'
        });
      } else {
        throw new Error('No authentication method enabled');
      }

      if (result?.error) {
        const errorMessage = result.error === 'CredentialsSignin'
          ? (uiMessages.invalidCredentials || 'Invalid email or password')
          : result.error;
        throw new Error(errorMessage);
      }

      if (result?.ok) {
        if (enabledProviders.credentials?.enabled) {
          if (onSuccess) {
            onSuccess(result);
          } else {
            router.push(authSettings.redirects?.afterSignIn || '/');
          }
        } else {
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
    setError('');
  };

  const handleSocialSignIn = async (provider) => {
    await signIn(provider, {
      callbackUrl: authSettings.redirects?.afterSignIn || '/'
    });
  };

  // Theme-based styling with light/dark mode support
  const isDark = colorScheme === 'dark';

  // Default colors for light mode
  const defaultLightColors = {
    primary: '#E8673E',
    primaryHover: '#D45A33',
    background: '#F5EFE0',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    textMuted: '#666666',
    textSecondary: '#8A8A8A',
    border: '#E0D5C7',
    error: '#F44336'
  };

  // Default colors for dark mode
  const defaultDarkColors = {
    primary: '#E8673E',
    primaryHover: '#D45A33',
    background: '#1C1C1C',
    surface: '#2A2A2A',
    text: '#FFFFFF',
    textMuted: '#B0B0B0',
    textSecondary: '#8A8A8A',
    border: '#3A3A3A',
    error: '#F44336'
  };

  const defaultColors = isDark ? defaultDarkColors : defaultLightColors;

  // Extract theme colors with defaults
  const themeColors = {
    primary: theme.colors?.primary || theme.buttons?.primary?.bg || defaultColors.primary,
    primaryHover: theme.colors?.['primary-hover'] || theme.buttons?.primary?.hover || defaultColors.primaryHover,
    background: isDark ? (theme.colors?.['bg-dark'] || defaultColors.background) : (theme.colors?.background || defaultColors.background),
    surface: theme.colors?.surface || defaultColors.surface,
    text: theme.colors?.text || defaultColors.text,
    textMuted: theme.colors?.['text-muted'] || defaultColors.textMuted,
    textSecondary: theme.colors?.['text-secondary'] || theme.colors?.textSecondary || defaultColors.textSecondary,
    border: theme.colors?.['border-base'] || theme.colors?.border || defaultColors.border,
    error: theme.colors?.error || defaultColors.error
  };

  const fontFamily = theme.typography?.['font-body'] || theme.typography?.fontFamily || "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const borderRadius = theme.borderRadius?.base || '12px';
  const borderRadiusSm = theme.borderRadius?.sm || '8px';

  const buttonSizeClass = {
    sm: 'py-2 px-3 text-sm',
    md: 'py-3 px-4',
    lg: 'py-4 px-6 text-lg'
  }[uiButtons.size || 'md'];

  const buttonRoundedClass = {
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  }[uiButtons.rounded || 'lg'];

  const inputSizeClass = {
    sm: 'py-2 px-3 text-sm',
    md: 'py-3 px-4',
    lg: 'py-4 px-5 text-lg'
  }[uiInputs.size || 'md'];

  const inputRoundedClass = {
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  }[uiInputs.rounded || 'md'];

  // Show loading while config loads
  if (configLoading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div
          className="animate-spin rounded-full h-6 w-6 border-b-2"
          style={{
            borderColor: themeColors.primary
          }}
        ></div>
      </div>
    );
  }

  // Show code verification input when verification is required
  if (status === 'verification-required' && verificationData) {
    return (
      <EmailCodeVerification
        jcontext={jcontext}
        email={verificationData.email}
        type={verificationData.type}
        onSuccess={async (result) => {
          // After successful code verification, sign in with NextAuth using the verification-code provider
          console.log('[LoginForm] Verification success, result:', result);

          if (result.verified && result.user && result.code) {
            try {
              console.log('[LoginForm] Attempting signIn with verification-code provider');

              // Use NextAuth signIn with the verification-code provider
              const signInResult = await signIn('verification-code', {
                email: verificationData.email,
                code: result.code,
                type: verificationData.type,
                redirect: false,
                callbackUrl: authSettings.redirects?.afterSignIn || '/'
              });

              console.log('[LoginForm] signIn result:', signInResult);

              if (signInResult?.ok) {
                // Import getSession
                const { getSession } = await import('next-auth/react');

                // Retry logic with exponential backoff - increased wait times and retries
                const maxRetries = 8;
                let session = null;

                for (let i = 0; i < maxRetries; i++) {
                  // More aggressive backoff: 300ms, 500ms, 800ms, 1200ms, 1800ms, 2500ms, 3000ms, 3000ms
                  const waitTime = i === 0 ? 300 : Math.min(300 * Math.pow(1.6, i), 3000);
                  console.log(`[LoginForm] Waiting ${Math.round(waitTime)}ms before checking session (attempt ${i + 1}/${maxRetries})`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));

                  session = await getSession();
                  console.log('[LoginForm] Session check result:', session ? 'Session found' : 'No session yet');

                  if (session?.user) {
                    console.log('[LoginForm] ✅ Session established with user:', session.user.email);
                    break;
                  }
                }

                if (session?.user) {
                  // Use centralized auth.login method if available
                  if (app?.auth?.login) {
                    console.log('[LoginForm] Calling app.auth.login');
                    app.auth.login(session.user, {
                      verified: true,
                      session: session,
                      method: 'email_verification'
                    });
                  } else {
                    // Fallback: emit Event Bus event directly
                    console.warn('LoginForm: Using fallback Event Bus emission');
                    eventBus.emit('user.login', {
                      user: session.user,
                      verified: true,
                      session: session
                    });
                  }

                  if (onSuccess) {
                    console.log('[LoginForm] Calling parent onSuccess');
                    // Notify parent component with the actual session user
                    onSuccess({
                      success: true,
                      user: session.user,
                      verified: true,
                      session: session
                    });
                  } else {
                    console.log('[LoginForm] No onSuccess callback, redirecting');
                    // Redirect after successful sign-in
                    router.push(authSettings.redirects?.afterSignIn || '/');
                  }
                } else {
                  // Session not established after all retries
                  console.error('[LoginForm] ❌ Session not established after all retries');
                  setError('Authentication successful but session is taking longer than expected. Trying one more time...');
                  setStatus('retry');

                  // Final attempt with longer delay
                  setTimeout(async () => {
                    console.log('[LoginForm] Final session check attempt...');
                    const retrySession = await getSession();
                    if (retrySession?.user) {
                      console.log('[LoginForm] ✅ Session found on final retry');
                      // Use centralized auth.login method if available
                      if (app?.auth?.login) {
                        app.auth.login(retrySession.user, {
                          verified: true,
                          session: retrySession,
                          method: 'email_verification_retry'
                        });
                      } else {
                        // Fallback: emit Event Bus event directly
                        console.warn('LoginForm: Using fallback Event Bus emission (retry)');
                        eventBus.emit('user.login', {
                          user: retrySession.user,
                          verified: true,
                          session: retrySession
                        });
                      }

                      if (onSuccess) {
                        onSuccess({
                          success: true,
                          user: retrySession.user,
                          verified: true,
                          session: retrySession
                        });
                      }
                    } else {
                      console.error('[LoginForm] ❌ Final retry failed - session not found');
                      setError('Please refresh the page to complete sign in.');
                      setStatus('error');
                    }
                  }, 2000); // Give it 2 more seconds
                }
              } else {
                console.error('Failed to sign in after verification:', signInResult?.error);
                setError('Failed to complete sign in. Please try again.');
                setStatus('idle');
                setVerificationData(null);
              }
            } catch (error) {
              console.error('Sign in error:', error);
              setError('An error occurred during sign in.');
              setStatus('idle');
              setVerificationData(null);
            }
          }
        }}
        onResend={async () => {
          // Resend the login code
          try {
            const response = await fetch('/api/auth/send-login-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: verificationData.email })
            });

            if (response.ok) {
              // Show success message briefly
              setStatus('code-resent');
              setTimeout(() => setStatus('verification-required'), 2000);
              return true;
            }
            return false;
          } catch (error) {
            console.error('Failed to resend code:', error);
            return false;
          }
        }}
        className={className}
      />
    );
  }

  // Show code resent confirmation
  if (status === 'code-resent') {
    return (
      <div className={`text-center space-y-4 ${className}`}>
        <div
          className="text-lg font-medium"
          style={{
            color: theme.colors?.success || '#4CAF50',
            fontFamily
          }}
        >
          {getLabel('codeResent', 'codeResent', 'Code Resent')}
        </div>
        <div
          style={{
            color: themeColors.text,
            fontFamily
          }}
        >
          {uiMessages.checkEmailMessage || 'Check your email.'}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {(enabledProviders.credentials?.enabled || isCodeAuth) && (
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium mb-2"
              style={{
                color: themeColors.textSecondary,
                fontFamily
              }}
            >
              {isCodeAuth
                ? getLabel('email', 'email', 'Email address')
                : getLabel('username', 'username', 'Username or Email')
              }
            </label>
            <input
              id="username"
              type={isCodeAuth ? "email" : "text"}
              required
              value={credentials.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              disabled={isLoading || status === 'sent'}
              placeholder={uiLabels.emailPlaceholder || (isCodeAuth ? 'name@example.com' : 'Enter your username or email')}
              className={`w-full focus:ring-2 focus:border-transparent ${inputSizeClass} ${inputRoundedClass}`}
              style={{
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
                borderWidth: '1px',
                borderStyle: 'solid',
                color: themeColors.text,
                borderRadius: borderRadiusSm,
                fontFamily,
                '--tw-ring-color': themeColors.primary
              }}
              autoComplete={isCodeAuth ? "email" : "username"}
            />
          </div>
        )}

        {(!enabledProviders.credentials?.enabled && !isCodeAuth && enabledProviders.email?.enabled) && (
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-2"
              style={{
                color: themeColors.textSecondary,
                fontFamily
              }}
            >
              {uiLabels.email || 'Email address'}
            </label>
            <input
              id="email"
              type="email"
              required
              value={credentials.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={isLoading || status === 'sent'}
              placeholder={uiLabels.emailPlaceholder || 'name@example.com'}
              className={`w-full focus:ring-2 focus:border-transparent ${inputSizeClass} ${inputRoundedClass}`}
              style={{
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
                borderWidth: '1px',
                borderStyle: 'solid',
                color: themeColors.text,
                borderRadius: borderRadiusSm,
                fontFamily,
                '--tw-ring-color': themeColors.primary
              }}
              autoComplete="email"
            />
          </div>
        )}

        {showPasswordField && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium"
                style={{
                  color: themeColors.textSecondary,
                  fontFamily
                }}
              >
                {getLabel('password', 'password', 'Password')}
              </label>
              {authSettings.ui?.showForgotPassword !== false && (
                <Link
                  href={authSettings.urls?.forgotPassword || '/auth/forgot-password'}
                  className="text-sm hover:underline transition-colors"
                  style={{
                    color: themeColors.primary,
                    fontFamily
                  }}
                >
                  {getLabel('forgotPassword', 'forgotPassword', 'Forgot?')}
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
              placeholder={uiLabels.passwordPlaceholder || 'Enter your password'}
              className={`w-full focus:ring-2 focus:border-transparent ${inputSizeClass} ${inputRoundedClass}`}
              style={{
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
                borderWidth: '1px',
                borderStyle: 'solid',
                color: themeColors.text,
                borderRadius: borderRadiusSm,
                fontFamily,
                '--tw-ring-color': themeColors.primary
              }}
              autoComplete="current-password"
            />
          </div>
        )}

        {error && (
          <div
            className="p-3 text-sm rounded-lg"
            style={{
              color: themeColors.error,
              backgroundColor: `${themeColors.error}20`,
              borderColor: `${themeColors.error}40`,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: borderRadiusSm,
              fontFamily
            }}
          >
            {error}
          </div>
        )}

        {status === 'sent' && (
          <div
            className="p-3 text-sm rounded-lg"
            style={{
              color: theme.colors?.success || '#4CAF50',
              backgroundColor: `${theme.colors?.success || '#4CAF50'}20`,
              borderColor: `${theme.colors?.success || '#4CAF50'}40`,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: borderRadiusSm,
              fontFamily
            }}
          >
            {uiMessages.resetLinkSent || 'Check your email for a sign in link!'}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || status === 'sent'}
          className={`w-full font-medium disabled:opacity-50 transition-colors ${buttonSizeClass} ${buttonRoundedClass}`}
          style={{
            backgroundColor: themeColors.primary,
            color: theme.buttons?.primary?.text || '#FFFFFF',
            borderRadius: borderRadius,
            fontFamily
          }}
          onMouseEnter={(e) => {
            if (!isLoading && status !== 'sent') {
              e.currentTarget.style.backgroundColor = themeColors.primaryHover;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = themeColors.primary;
          }}
        >
          {isLoading
            ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isCodeAuth
                  ? getLabel('loggingIn', 'signingIn', 'Logging in...')
                  : getLabel('signingIn', 'signingIn', 'Signing in...')
                }
              </span>
            )
            : isCodeAuth
              ? getLabel('login', 'signIn', 'Login')
              : enabledProviders.credentials?.enabled
                ? getLabel('continue', 'signIn', 'Sign in')
                : getLabel('continueWithEmail', 'signIn', 'Continue with Email')
          }
        </button>

        {authSettings.ui?.showSocialProviders && (enabledProviders.google?.enabled || enabledProviders.github?.enabled) && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div
                  className="w-full border-t"
                  style={{
                    borderColor: themeColors.border
                  }}
                ></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span
                  className="px-2"
                  style={{
                    backgroundColor: themeColors.background,
                    color: themeColors.textSecondary,
                    fontFamily
                  }}
                >
                  {getLabel('orContinueWith', 'orContinueWith', 'Or continue with')}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {enabledProviders.google?.enabled && providers.google && (
                <button
                  type="button"
                  onClick={() => handleSocialSignIn('google')}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-center text-sm font-medium disabled:opacity-50 transition-all duration-200 ${buttonSizeClass} ${buttonRoundedClass}`}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: themeColors.text,
                    borderRadius: borderRadius,
                    fontFamily
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.backgroundColor = isDark ? '#3A3A3A' : '#F9FAFB';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = themeColors.surface;
                  }}
                >
                  {getLabel('continueWithGoogle', 'continueWithGoogle', 'Continue with Google')}
                </button>
              )}

              {enabledProviders.github?.enabled && providers.github && (
                <button
                  type="button"
                  onClick={() => handleSocialSignIn('github')}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-center text-sm font-medium disabled:opacity-50 transition-all duration-200 ${buttonSizeClass} ${buttonRoundedClass}`}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: themeColors.text,
                    borderRadius: borderRadius,
                    fontFamily
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.backgroundColor = isDark ? '#3A3A3A' : '#F9FAFB';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = themeColors.surface;
                  }}
                >
                  {getLabel('continueWithGithub', 'continueWithGithub', 'Continue with GitHub')}
                </button>
              )}
            </div>
          </>
        )}

        {authSettings.ui?.terms && (
          <p
            className="text-xs text-center"
            style={{
              color: themeColors.textMuted,
              fontFamily
            }}
          >
            {authSettings.ui.terms.text}
          </p>
        )}
      </form>
    </div>
  );
}