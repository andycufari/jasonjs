'use client'

/**
 * @deprecated SignupForm is deprecated in favor of UnifiedAuth component.
 *
 * UnifiedAuth provides a single, unified authentication flow that handles
 * both login and signup with email verification codes by default.
 *
 * Migration:
 * - Replace <SignupForm /> with <UnifiedAuth />
 * - UnifiedAuth automatically detects if user exists and adapts the flow
 * - Custom signup fields are configured via auth.json signup.fields
 *
 * @see UnifiedAuth for the recommended authentication component
 */

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthConfig } from '@/core/hooks/useAuthConfig';
import EmailCodeVerification from './EmailCodeVerification';
import { useAuthLanguage } from './i18n';
import {
  TextInput,
  TextareaInput,
  PhoneInput,
  LocationInput,
  SelectInput,
  DateInput,
  PriceInput,
  CheckboxInput
} from '@/components/framework/FormBuilder/inputs';

export default function SignupForm({ jcontext, onSuccess, initialEmail = '', className = '' }) {
  // Extract app object from jcontext with fallback
  const app = jcontext?.app;
  const { t } = useAuthLanguage(jcontext?.language);

  // Safety check - if no app object, we can't use centralized auth
  if (!app) {
    console.warn('SignupForm: No app object available, auth state updates may not work correctly');
  }
  const [formData, setFormData] = useState({
    email: initialEmail
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');
  const [touched, setTouched] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [verificationData, setVerificationData] = useState(null);
  const router = useRouter();

  // Load auth configuration
  const { authConfig, loading: configLoading } = useAuthConfig();

  // Update email when initialEmail prop changes
  useEffect(() => {
    if (initialEmail) {
      setFormData(prev => ({
        ...prev,
        email: initialEmail
      }));
    }
  }, [initialEmail]);

  // Merge with jcontext for backward compatibility
  const authSettings = jcontext?.auth || authConfig?.auth || {};
  const customFields = authSettings.registration?.customFields || [];

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

  // Theme-based styling
  const isDark = theme.defaultColorScheme === 'dark';
  const primaryColor = theme.colors?.primary || '#6366f1';
  const textColor = isDark
    ? (theme.colors?.text || '#f8fafc')
    : (theme.colors?.text || '#1f2937');
  const textSecondaryColor = isDark
    ? (theme.colors?.textSecondary || '#94a3b8')
    : (theme.colors?.textSecondary || '#6b7280');
  const surfaceColor = isDark
    ? (theme.colors?.surface || '#1e293b')
    : (theme.colors?.surface || '#ffffff');
  const borderColor = isDark
    ? (theme.colors?.border || '#334155')
    : (theme.colors?.border || '#e5e7eb');
  const fontFamily = theme.typography?.fontFamily || "'Inter', system-ui, sans-serif";

  const isCodeVerification = authSettings.registration?.requireEmailVerification &&
                              authSettings.registration?.emailVerificationMethod === 'code';
  const requiresPassword = !isCodeVerification;
  const termsConfig = authSettings.ui?.terms;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    setFormData(prev => ({
      ...prev,
      [name]: fieldValue
    }));
    setError('');
    setFieldErrors(prev => ({
      ...prev,
      [name]: null
    }));
  };

  const handleFieldChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
    setFieldErrors(prev => ({
      ...prev,
      [name]: null
    }));
  };

  const handleBlur = (name) => {
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
  };

  const fieldComponentMap = {
    text: TextInput,
    email: TextInput,
    tel: PhoneInput,
    textarea: TextareaInput,
    select: SelectInput,
    date: DateInput,
    location: LocationInput,
    price: PriceInput,
    checkbox: CheckboxInput
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setStatus('sending');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error === 'Email already exists'
          ? (uiMessages.emailTaken || 'Email already registered')
          : (result.error || 'Registration failed');
        throw new Error(errorMessage);
      }

      if (result.success) {
        setStatus('success');

        // Handle code verification flow (stay in modal)
        if (result.requiresVerification && result.verificationType === 'code') {
          setStatus('verification-required');
          setVerificationData({
            email: formData.email,
            type: 'registration',
            user: result.user
          });
          // DON'T call onSuccess yet - wait for verification to complete
          // The EmailCodeVerification component will call onSuccess after successful verification
          return;
        } else if (isCodeVerification) {
          setTimeout(() => {
            router.push(`/auth/verify-email?email=${encodeURIComponent(formData.email)}`);
          }, 1000);
        } else if (formData.email && formData.password) {
          try {
            const signInResult = await signIn('credentials', {
              username: formData.email,
              password: formData.password,
              redirect: false,
              callbackUrl: result.redirect || authSettings.redirects?.afterSignUp || '/'
            });

            if (signInResult?.ok) {
              if (onSuccess) {
                onSuccess(signInResult);
              } else {
                router.push(result.redirect || authSettings.redirects?.afterSignUp || '/');
              }
            } else {
              setTimeout(() => {
                router.push('/auth/login?message=' + encodeURIComponent(uiMessages.signupSuccess || 'Please sign in with your new account'));
              }, 2000);
            }
          } catch (signInError) {
            console.error('Auto sign-in error:', signInError);
            setTimeout(() => {
              router.push('/auth/login?message=' + encodeURIComponent(uiMessages.signupSuccess || 'Account created! Please sign in'));
            }, 2000);
          }
        } else {
          setTimeout(() => {
            router.push(authSettings.urls?.signIn || '/auth/login');
          }, 2000);
        }
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  if (authSettings.registration?.enabled === false) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-4">
          {t('errors.registrationClosed')}
        </h1>
        <p className="text-gray-300 mb-6">
          {t('errors.registrationClosedDesc')}
        </p>
        <Link
          href={authSettings.urls?.signIn || '/auth/login'}
          className="auth-link"
        >
          {t('success.returnToSignIn')}
        </Link>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="space-y-6 text-center">
        <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl auth-title">
          {uiMessages.signupSuccess || t('success.accountCreated')}
        </h2>
        <p className="text-gray-300 font-sans">{t('success.accountCreatedDesc')}</p>
        <div className="flex items-center justify-center space-x-2 text-purple-400">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-sans">{uiLabels.signingIn || t('success.signingIn')}</span>
        </div>
      </div>
    );
  }

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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  // Show code verification when verification is required
  if (status === 'verification-required' && verificationData) {
    return (
      <EmailCodeVerification
        jcontext={jcontext}
        email={verificationData.email}
        type={verificationData.type}
        onSuccess={async (result) => {
          // After successful code verification, sign in with NextAuth using the verification-code provider
          if (result.verified && result.user && result.code) {
            try {
              // Use NextAuth signIn with the verification-code provider (not credentials!)
              const signInResult = await signIn('verification-code', {
                email: verificationData.email,
                code: result.code,
                type: verificationData.type,
                redirect: false,
                callbackUrl: authSettings.redirects?.afterSignUp || '/'
              });

              if (signInResult?.ok) {
                // Wait a moment for the session to be established
                await new Promise(resolve => setTimeout(resolve, 500));

                // Now fetch the actual session to get the user data
                const { getSession } = await import('next-auth/react');
                const session = await getSession();

                if (session?.user) {
                  if (onSuccess) {
                    // Notify parent component (AuthModal) - it will handle app.auth.login
                    onSuccess({
                      success: true,
                      user: session.user,
                      verified: true,
                      signup: true,
                      session: session
                    });
                  } else {
                    // Not in modal - manually call app.auth.login and redirect
                    if (app?.auth?.login) {
                      app.auth.login(session.user, {
                        verified: true,
                        signup: true,
                        session: session,
                        method: 'signup_email_verification'
                      });
                    }
                    router.push(authSettings.redirects?.afterSignUp || '/');
                  }
                } else {
                  // Session not established yet, retry
                  console.error('Session not established yet after signup verification');
                  setTimeout(async () => {
                    const retrySession = await getSession();
                    if (retrySession?.user) {
                      if (onSuccess) {
                        onSuccess({
                          success: true,
                          user: retrySession.user,
                          verified: true,
                          signup: true,
                          session: retrySession
                        });
                      } else {
                        if (app?.auth?.login) {
                          app.auth.login(retrySession.user, {
                            verified: true,
                            signup: true,
                            session: retrySession,
                            method: 'signup_email_verification_retry'
                          });
                        }
                        router.push(authSettings.redirects?.afterSignUp || '/');
                      }
                    }
                  }, 1000);
                }
              } else {
                console.error('Failed to sign in after verification:', signInResult?.error);
                setError('Failed to complete sign in. Please try logging in manually.');
                setStatus('error');
              }
            } catch (error) {
              console.error('Sign in error after verification:', error);
              setError('An error occurred during sign in.');
              setStatus('error');
            }
          }
        }}
        onResend={async () => {
          // Resend the verification code
          try {
            const response = await fetch('/api/auth/send-verification-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: verificationData.email,
                type: verificationData.type || 'registration'
              })
            });

            if (response.ok) {
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

  return (
    <div className={`space-y-6 ${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium mb-2"
            style={{
              color: textSecondaryColor,
              fontFamily
            }}
          >
            {getLabel('name', 'name', 'Full name')} <span className="text-red-400 ml-1">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name || ''}
            onChange={handleChange}
            disabled={isLoading || status === 'success'}
            placeholder={uiLabels.namePlaceholder || 'John Doe'}
            className={`w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent ${inputSizeClass} ${inputRoundedClass}`}
            style={{
              '--tw-ring-color': primaryColor,
              fontFamily
            }}
            autoComplete="name"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-2"
            style={{
              color: textSecondaryColor,
              fontFamily
            }}
          >
            {getLabel('email', 'email', 'Email address')} <span className="text-red-400 ml-1">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={formData.email || ''}
            onChange={handleChange}
            disabled={isLoading || status === 'success'}
            placeholder={uiLabels.emailPlaceholder || 'name@example.com'}
            className={`w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent ${inputSizeClass} ${inputRoundedClass}`}
            style={{
              '--tw-ring-color': primaryColor,
              fontFamily
            }}
            autoComplete="email"
          />
        </div>

        {requiresPassword && (
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2"
              style={{
                color: textSecondaryColor,
                fontFamily
              }}
            >
              {getLabel('password', 'password', 'Password')} <span className="text-red-400 ml-1">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={formData.password || ''}
              onChange={handleChange}
              disabled={isLoading || status === 'success'}
              placeholder={uiLabels.passwordPlaceholder || 'Minimum 8 characters'}
              className={`w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent ${inputSizeClass} ${inputRoundedClass}`}
              style={{
                '--tw-ring-color': primaryColor,
                fontFamily
              }}
              autoComplete="new-password"
            />
          </div>
        )}

        {customFields.map((field) => {
          // For now, only handle text-based fields with consistent styling
          // Complex fields like select, date, etc. can be enhanced later
          const isTextBasedField = ['text', 'email', 'tel', 'textarea'].includes(field.type);

          if (isTextBasedField) {
            return (
              <div key={field.name}>
                <label
                  htmlFor={field.name}
                  className="block text-sm font-medium mb-2"
                  style={{
                    color: textSecondaryColor,
                    fontFamily
                  }}
                >
                  {field.label || field.name} {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={field.name}
                    name={field.name}
                    required={field.required}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                    disabled={isLoading || status === 'success'}
                    placeholder={field.placeholder || `Enter your ${field.label || field.name}`}
                    className={`w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent ${inputSizeClass} ${inputRoundedClass}`}
                    style={{
                      '--tw-ring-color': primaryColor,
                      fontFamily
                    }}
                    rows={field.rows || 3}
                  />
                ) : (
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type || 'text'}
                    required={field.required}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                    disabled={isLoading || status === 'success'}
                    placeholder={field.placeholder || `Enter your ${field.label || field.name}`}
                    className={`w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent ${inputSizeClass} ${inputRoundedClass}`}
                    style={{
                      '--tw-ring-color': primaryColor,
                      fontFamily
                    }}
                  />
                )}
                {field.help && (
                  <p
                    className="mt-1 text-sm"
                    style={{ color: textSecondaryColor }}
                  >
                    {field.help}
                  </p>
                )}
              </div>
            );
          }

          // Fall back to FormBuilder component for complex fields
          const FieldComponent = fieldComponentMap[field.type] || TextInput;
          const fieldSchema = {
            label: field.label || field.name,
            placeholder: field.placeholder || `Enter your ${field.label || field.name}`,
            required: field.required,
            help: field.help,
            ...field.validation,
            ...(field.options && { options: field.options }),
            ...(field.multiple !== undefined && { multiple: field.multiple }),
            ...(field.searchable !== undefined && { searchable: field.searchable })
          };

          return (
            <div key={field.name}>
              <FieldComponent
                name={field.name}
                fieldSchema={fieldSchema}
                value={formData[field.name] || ''}
                onChange={(value) => handleFieldChange(field.name, value)}
                onBlur={() => handleBlur(field.name)}
                error={fieldErrors[field.name]}
                touched={touched[field.name]}
                disabled={isLoading || status === 'success'}
              />
            </div>
          );
        })}

        {termsConfig && (
          <div className="flex items-start space-x-3">
            <input
              id="acceptTerms"
              name="acceptTerms"
              type="checkbox"
              required
              checked={formData.acceptTerms || false}
              onChange={handleChange}
              disabled={isLoading || status === 'success'}
              className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
            />
            <label htmlFor="acceptTerms" className="text-sm text-gray-300">
              {termsConfig.text || 'I agree to the'}{' '}
              {termsConfig.links?.terms && (
                <>
                  <a
                    href={termsConfig.links.terms}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Terms of Service
                  </a>
                  {termsConfig.links?.privacy && ' and '}
                </>
              )}
              {termsConfig.links?.privacy && (
                <a
                  href={termsConfig.links.privacy}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Privacy Policy
                </a>
              )}
            </label>
          </div>
        )}

        {error && (
          <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/20 rounded-lg">
            {typeof error === 'string' ? error : error.details?.join(', ') || 'Registration failed'}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || status === 'success' || status === 'sending'}
          className={`w-full text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${buttonSizeClass} ${buttonRoundedClass}`}
          style={{
            backgroundColor: primaryColor,
            fontFamily
          }}
        >
          {isLoading || status === 'sending' ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {status === 'success' ? (uiLabels.signingIn || 'Signing you in...') : (uiLabels.creatingAccount || 'Creating account...')}
            </span>
          ) : (uiButtons.submitText || uiLabels.register || 'Create Account')}
        </button>
      </form>
    </div>
  );
}