'use client'

import { useState, useEffect, useMemo } from 'react';
import { signIn, getSession, getProviders } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuthConfig } from '@/core/hooks/useAuthConfig';
import { useAuthLanguage } from './i18n';
import eventBus from '@/core/services/eventBus';

/**
 * UnifiedAuth - Single component for login/signup flow
 *
 * Flow:
 * 1. EMAIL_INPUT - User enters email
 * 2. System checks if user exists
 * 3a. EXISTS → CODE_SENT → verify → login
 * 3b. NEW → NEW_USER_INFO (collect name + custom fields) → CODE_SENT → verify → create
 */

const STATES = {
  EMAIL_INPUT: 'email_input',
  CODE_SENT: 'code_sent',
  NEW_USER_INFO: 'new_user_info',
  LOADING: 'loading',
  SUCCESS: 'success'
};

export default function UnifiedAuth({
  jcontext,
  onSuccess,
  onCancel,
  initialEmail = '',
  className = ''
}) {
  const router = useRouter();
  const { t, language } = useAuthLanguage(jcontext?.language);
  const { authConfig, loading: configLoading } = useAuthConfig();

  // State
  const [state, setState] = useState(STATES.EMAIL_INPUT);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [formData, setFormData] = useState({ name: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userExists, setUserExists] = useState(null);
  const [providers, setProviders] = useState({});
  const [resendStatus, setResendStatus] = useState('idle');

  // Extract app object
  const app = jcontext?.app;

  // Config with defaults
  const authSettings = useMemo(() => {
    const settings = jcontext?.auth || authConfig?.auth || {};
    return {
      password: settings.password || false,
      providers: settings.providers || {},
      signup: {
        enabled: settings.signup?.enabled !== false && settings.registration?.enabled !== false,
        fields: settings.signup?.fields || settings.registration?.customFields || {},
        terms: settings.signup?.terms || settings.registration?.terms,
        privacy: settings.signup?.privacy || settings.registration?.privacy
      },
      redirects: {
        afterLogin: settings.redirects?.afterLogin || settings.redirects?.afterSignIn || '/',
        afterSignup: settings.redirects?.afterSignup || settings.redirects?.afterSignUp || '/'
      }
    };
  }, [jcontext?.auth, authConfig?.auth]);

  // Theme
  const theme = authConfig?.theme || jcontext?.theme || {};
  const isDark = theme.defaultColorScheme === 'dark';

  const colors = useMemo(() => ({
    primary: theme.colors?.primary || '#6366f1',
    primaryHover: theme.colors?.['primary-hover'] || '#4f46e5',
    background: isDark ? (theme.colors?.background || '#1e293b') : (theme.colors?.background || '#ffffff'),
    surface: isDark ? (theme.colors?.surface || '#334155') : (theme.colors?.surface || '#f8fafc'),
    text: isDark ? (theme.colors?.text || '#f8fafc') : (theme.colors?.text || '#1e293b'),
    textSecondary: isDark ? (theme.colors?.textSecondary || '#94a3b8') : (theme.colors?.textSecondary || '#64748b'),
    border: isDark ? (theme.colors?.border || '#475569') : (theme.colors?.border || '#e2e8f0'),
    error: theme.colors?.error || '#ef4444',
    success: theme.colors?.success || '#22c55e'
  }), [theme, isDark]);

  const fontFamily = theme.typography?.fontFamily || "'Inter', system-ui, sans-serif";

  // Custom texts override (from auth.json)
  const customTexts = authConfig?.texts || jcontext?.auth?.texts || {};

  // Helper to get text with priority: customTexts > i18n default
  const getText = (key, replacements = {}) => {
    if (customTexts[key]) {
      // Support i18n object in customTexts
      if (typeof customTexts[key] === 'object') {
        return customTexts[key][language] || customTexts[key].en || t(key, replacements);
      }
      return customTexts[key];
    }
    return t(key, replacements);
  };

  // Load OAuth providers
  useEffect(() => {
    getProviders().then(p => setProviders(p || {}));
  }, []);

  // Check if user exists
  const checkUser = async (emailToCheck) => {
    try {
      const response = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToCheck })
      });
      const data = await response.json();
      console.log('[UnifiedAuth] checkUser response:', data); // DEBUG
      return data; // Return full data object with exists and name
    } catch (err) {
      console.error('Error checking user:', err);
      return null;
    }
  };

  // Send verification code
  const sendCode = async (emailToSend, isNewUser = false) => {
    const endpoint = isNewUser ? '/api/auth/send-verification-code' : '/api/auth/send-login-code';
    const codeType = isNewUser ? 'registration' : 'login';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailToSend, type: codeType })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || getText('errors.genericError'));
    }

    return response.json();
  };

  // Register new user
  const registerUser = async () => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name: formData.name,
        ...formData
      })
    });

    if (!response.ok) {
      const data = await response.json();
      const detail = data.message
        || (Array.isArray(data.details) && data.details.length > 0 ? data.details.join(', ') : null);
      throw new Error(detail || data.error || getText('errors.genericError'));
    }

    return response.json();
  };

  // Verify code and sign in
  const verifyAndSignIn = async (codeValue, isNewUser = false) => {
    // Verify code
    const verifyResponse = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        code: codeValue,
        type: isNewUser ? 'registration' : 'login'
      })
    });

    if (!verifyResponse.ok) {
      const data = await verifyResponse.json();
      throw new Error(data.error || getText('verification.invalidCode'));
    }

    const verifyResult = await verifyResponse.json();

    if (!verifyResult.verified) {
      throw new Error(getText('verification.invalidCode'));
    }

    // Sign in with NextAuth
    const signInResult = await signIn('verification-code', {
      email,
      code: codeValue,
      type: isNewUser ? 'registration' : 'login',
      redirect: false
    });

    if (!signInResult?.ok) {
      throw new Error(getText('errors.genericError'));
    }

    // Wait for session
    let session = null;
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
      session = await getSession();
      if (session?.user) break;
    }

    return { session, verifyResult };
  };

  // Handle email submission
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(getText('errors.emailRequired'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const userData = await checkUser(email);
      const exists = userData?.exists;
      const hasName = userData?.name && userData.name.trim() !== '';
      setUserExists(exists);

      console.log('[UnifiedAuth] exists:', exists, 'hasName:', hasName, 'name value:', userData?.name); // DEBUG

      if (exists) {
        if (hasName) {
          // Existing user with name - send login code directly
          await sendCode(email, false);
          setState(STATES.CODE_SENT);
        } else {
          // Existing user but no name (edge case: created via IDE without name)
          // Ask for name first, then send code
          console.log('[UnifiedAuth] User exists but no name - asking for name'); // DEBUG
          setState(STATES.NEW_USER_INFO);
        }
      } else {
        // New user - collect info first
        if (!authSettings.signup.enabled) {
          setError(getText('errors.userNotFound'));
          return;
        }
        setState(STATES.NEW_USER_INFO);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle new user info submission
  const handleNewUserSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setError(getText('errors.nameRequired'));
      return;
    }

    // Check terms acceptance if configured (only for new users, not existing users updating name)
    if (!userExists && (authSettings.signup.terms || authSettings.signup.privacy) && !formData.acceptTerms) {
      setError(getText('legal.mustAgree'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (userExists) {
        // Existing user updating their name - update via API then send login code
        const updateResponse = await fetch('/api/auth/update-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name: formData.name,
            customFields: Object.keys(formData).reduce((acc, key) => {
              if (key !== 'name' && key !== 'acceptTerms') {
                acc[key] = formData[key];
              }
              return acc;
            }, {})
          })
        });

        if (!updateResponse.ok) {
          const data = await updateResponse.json();
          throw new Error(data.error || getText('errors.genericError'));
        }

        // Now send login code
        await sendCode(email, false);
      } else {
        // New user - register (this also sends the verification code with userId)
        await registerUser();
      }
      setState(STATES.CODE_SENT);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle code input
  const handleCodeChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-input-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-submit when complete
    if (newCode.every(d => d !== '') && index === 5) {
      handleCodeSubmit(newCode.join(''));
    }
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleCodePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData?.getData('text') || '';
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');

    if (digits.length === 6) {
      setCode(digits);
      handleCodeSubmit(digits.join(''));
    }
  };

  // Handle code submission
  const handleCodeSubmit = async (codeValue) => {
    setIsLoading(true);
    setError('');

    try {
      const isNewUser = userExists === false;
      const { session } = await verifyAndSignIn(codeValue, isNewUser);

      if (session?.user) {
        setState(STATES.SUCCESS);

        // Notify auth system
        if (app?.auth?.login) {
          app.auth.login(session.user, {
            verified: true,
            signup: isNewUser,
            session,
            method: isNewUser ? 'signup_email_verification' : 'email_verification'
          });
        } else {
          eventBus.emit('user.login', {
            user: session.user,
            verified: true,
            session
          });
        }

        // Callback or redirect
        if (onSuccess) {
          onSuccess({
            success: true,
            user: session.user,
            verified: true,
            signup: isNewUser,
            session
          });
        } else {
          const redirectUrl = isNewUser
            ? authSettings.redirects.afterSignup
            : authSettings.redirects.afterLogin;
          router.push(redirectUrl);
        }
      } else {
        throw new Error(getText('errors.genericError'));
      }
    } catch (err) {
      setError(err.message);
      setCode(['', '', '', '', '', '']);
      document.getElementById('code-input-0')?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend code
  const handleResend = async () => {
    setResendStatus('sending');
    try {
      await sendCode(email, userExists === false);
      setResendStatus('sent');
      setCode(['', '', '', '', '', '']);
      setTimeout(() => setResendStatus('idle'), 3000);
    } catch (err) {
      setError(err.message);
      setResendStatus('idle');
    }
  };

  // Handle OAuth
  const handleOAuth = async (provider) => {
    await signIn(provider, {
      callbackUrl: authSettings.redirects.afterLogin
    });
  };

  // Custom fields from schema
  const customFields = useMemo(() => {
    const fields = authSettings.signup.fields || {};
    return Object.entries(fields).map(([name, config]) => ({
      name,
      ...(typeof config === 'string' ? { type: config } : config)
    }));
  }, [authSettings.signup.fields]);

  // Loading state
  if (configLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: colors.primary }}
        />
      </div>
    );
  }

  // Success state
  if (state === STATES.SUCCESS) {
    const isNewUser = userExists === false;
    return (
      <div className={`text-center space-y-4 p-6 ${className}`}>
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${colors.success}20` }}
        >
          <svg className="w-8 h-8" fill="none" stroke={colors.success} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2
          className="text-xl font-semibold"
          style={{ color: colors.text, fontFamily }}
        >
          {isNewUser ? getText('auth.welcome') : getText('auth.welcomeBack')}
        </h2>
        {isNewUser && (
          <p style={{ color: colors.textSecondary, fontFamily }}>
            {getText('success.accountCreatedDesc')}
          </p>
        )}
      </div>
    );
  }

  // Code verification state
  if (state === STATES.CODE_SENT) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center space-y-3">
          <div
            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${colors.primary}20` }}
          >
            <svg className="w-8 h-8" fill="none" stroke={colors.primary} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <p style={{ color: colors.textSecondary, fontFamily }}>
            {getText('verification.codeSentTo')}
          </p>
          <p className="font-medium" style={{ color: colors.text, fontFamily }}>
            {email}
          </p>
        </div>

        {/* 6-digit code input */}
        <div className="flex justify-center gap-2">
          {code.map((digit, index) => (
            <input
              key={index}
              id={`code-input-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleCodeKeyDown(index, e)}
              onPaste={handleCodePaste}
              disabled={isLoading}
              className="w-12 h-14 text-center text-2xl font-bold rounded-lg focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: colors.surface,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: colors.border,
                color: colors.text,
                fontFamily: 'monospace',
                '--tw-ring-color': colors.primary
              }}
              autoFocus={index === 0}
            />
          ))}
        </div>

        {error && (
          <div
            className="p-3 text-sm rounded-lg text-center"
            style={{
              color: colors.error,
              backgroundColor: `${colors.error}10`,
              borderColor: `${colors.error}30`,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            {error}
          </div>
        )}

        {resendStatus === 'sent' && (
          <div
            className="p-3 text-sm rounded-lg text-center"
            style={{
              color: colors.success,
              backgroundColor: `${colors.success}10`
            }}
          >
            {getText('verification.codeSent')}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center space-x-2" style={{ color: colors.primary }}>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span style={{ fontFamily }}>{getText('verification.verifying')}</span>
          </div>
        )}

        <div className="text-center space-y-2">
          <button
            onClick={handleResend}
            disabled={isLoading || resendStatus === 'sent'}
            className="text-sm hover:underline disabled:opacity-50"
            style={{ color: colors.primary, fontFamily }}
          >
            {resendStatus === 'sending'
              ? getText('verification.resending')
              : getText('verification.resendCode') + ' ' + getText('verification.resend')
            }
          </button>

          <div>
            <button
              onClick={() => {
                setState(STATES.EMAIL_INPUT);
                setCode(['', '', '', '', '', '']);
                setError('');
              }}
              className="text-sm hover:underline"
              style={{ color: colors.textSecondary, fontFamily }}
            >
              {getText('auth.changeEmail')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // New user info state
  if (state === STATES.NEW_USER_INFO) {
    const isExistingUser = userExists === true;
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center space-y-2">
          <p style={{ color: colors.textSecondary, fontFamily }}>
            {isExistingUser ? 'Please complete your profile' : getText('auth.letsSetup')}
          </p>
        </div>

        <form onSubmit={handleNewUserSubmit} className="space-y-4">
          {/* Name field */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium mb-2"
              style={{ color: colors.textSecondary, fontFamily }}
            >
              {getText('auth.fullName')} <span style={{ color: colors.error }}>*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={isLoading}
              placeholder="John Doe"
              className="w-full py-3 px-4 rounded-lg focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: colors.surface,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: colors.border,
                color: colors.text,
                fontFamily,
                '--tw-ring-color': colors.primary
              }}
              autoFocus
            />
          </div>

          {/* Custom fields */}
          {customFields.map((field) => {
            const localize = (val, fallback) =>
              typeof val === 'object' && val !== null
                ? (val[language] || val.en || fallback)
                : (val || fallback);

            const labelText = localize(field.label, field.name);
            const isMultiSelect =
              (field.type === 'array' && Array.isArray(field.options)) ||
              (field.type === 'select' && field.multiple === true);
            const isCheckbox = field.type === 'checkbox' || field.type === 'boolean';
            const isRadio = field.type === 'radio';

            const inputStyle = {
              backgroundColor: colors.surface,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: colors.border,
              color: colors.text,
              fontFamily,
              '--tw-ring-color': colors.primary
            };

            // Single boolean checkbox: inline layout, no top label
            if (isCheckbox) {
              return (
                <div key={field.name} className="flex items-start gap-2">
                  <input
                    id={field.name}
                    type="checkbox"
                    required={field.required}
                    checked={!!formData[field.name]}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.checked }))}
                    disabled={isLoading}
                    className="mt-1 h-4 w-4 rounded focus:ring-2"
                    style={{ accentColor: colors.primary, '--tw-ring-color': colors.primary }}
                  />
                  <label
                    htmlFor={field.name}
                    className="text-sm font-medium select-none"
                    style={{ color: colors.textSecondary, fontFamily }}
                  >
                    {labelText}
                    {field.required && <span style={{ color: colors.error }}> *</span>}
                  </label>
                </div>
              );
            }

            // Multi-select native <select multiple> (FormBuilder-compatible)
            //   type: 'array' + options    (FormBuilder convention)
            //   type: 'select' + multiple  (HTML convention)
            if (isMultiSelect) {
              const current = Array.isArray(formData[field.name]) ? formData[field.name] : [];
              return (
                <div key={field.name}>
                  <label
                    htmlFor={field.name}
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.textSecondary, fontFamily }}
                  >
                    {labelText}
                    {field.required && <span style={{ color: colors.error }}> *</span>}
                  </label>
                  <select
                    id={field.name}
                    multiple
                    required={field.required}
                    value={current}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, o => o.value);
                      setFormData(prev => ({ ...prev, [field.name]: selected }));
                    }}
                    disabled={isLoading}
                    size={Math.min((field.options || []).length, field.size || 5)}
                    className="w-full py-2 px-3 rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={inputStyle}
                  >
                    {(field.options || []).map((opt, i) => (
                      <option key={i} value={opt.value ?? opt}>
                        {localize(opt.label, opt.value ?? opt)}
                      </option>
                    ))}
                  </select>
                  <p
                    className="text-xs mt-1"
                    style={{ color: colors.textSecondary, fontFamily, opacity: 0.7 }}
                  >
                    {language === 'es' ? 'Mantén Cmd/Ctrl para seleccionar varios' : 'Hold Cmd/Ctrl to select multiple'}
                  </p>
                </div>
              );
            }

            // Radio group (single value, exposed UI)
            if (isRadio) {
              return (
                <div key={field.name}>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.textSecondary, fontFamily }}
                  >
                    {labelText}
                    {field.required && <span style={{ color: colors.error }}> *</span>}
                  </label>
                  <div className="space-y-2">
                    {(field.options || []).map((opt, i) => {
                      const optVal = opt.value ?? opt;
                      const optLabel = localize(opt.label, opt.value ?? opt);
                      const id = `${field.name}-${i}`;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            id={id}
                            type="radio"
                            name={field.name}
                            value={optVal}
                            required={field.required}
                            checked={formData[field.name] === optVal}
                            onChange={() => setFormData(prev => ({ ...prev, [field.name]: optVal }))}
                            disabled={isLoading}
                            className="h-4 w-4 focus:ring-2"
                            style={{ accentColor: colors.primary, '--tw-ring-color': colors.primary }}
                          />
                          <label
                            htmlFor={id}
                            className="text-sm select-none"
                            style={{ color: colors.text, fontFamily }}
                          >
                            {optLabel}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // Default block layout (label above input)
            return (
              <div key={field.name}>
                <label
                  htmlFor={field.name}
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.textSecondary, fontFamily }}
                >
                  {labelText}
                  {field.required && <span style={{ color: colors.error }}> *</span>}
                </label>

                {field.type === 'select' ? (
                  <select
                    id={field.name}
                    required={field.required}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={inputStyle}
                  >
                    <option value="">{localize(field.placeholder, 'Select...')}</option>
                    {(field.options || []).map((opt, i) => (
                      <option key={i} value={opt.value ?? opt}>
                        {localize(opt.label, opt.value ?? opt)}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={field.name}
                    required={field.required}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                    disabled={isLoading}
                    placeholder={localize(field.placeholder, '')}
                    rows={field.rows || 3}
                    className="w-full py-3 px-4 rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={inputStyle}
                  />
                ) : (
                  <input
                    id={field.name}
                    type={field.type || 'text'}
                    required={field.required}
                    value={formData[field.name] || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                    disabled={isLoading}
                    placeholder={localize(field.placeholder, '')}
                    className="w-full py-3 px-4 rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={inputStyle}
                  />
                )}
              </div>
            );
          })}

          {/* Terms & Privacy - only show for NEW users, not existing users updating name */}
          {!isExistingUser && (authSettings.signup.terms || authSettings.signup.privacy) && (
            <div className="flex items-start space-x-3">
              <input
                id="acceptTerms"
                type="checkbox"
                required
                checked={formData.acceptTerms || false}
                onChange={(e) => setFormData(prev => ({ ...prev, acceptTerms: e.target.checked }))}
                disabled={isLoading}
                className="mt-1 h-4 w-4 rounded"
                style={{ accentColor: colors.primary }}
              />
              <label htmlFor="acceptTerms" className="text-sm" style={{ color: colors.textSecondary, fontFamily }}>
                {getText('legal.agreeToTerms')}{' '}
                {authSettings.signup.terms && (
                  <a
                    href={typeof authSettings.signup.terms === 'string' ? authSettings.signup.terms : authSettings.signup.terms.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                    style={{ color: colors.primary }}
                  >
                    {getText('legal.termsOfService')}
                  </a>
                )}
                {authSettings.signup.terms && authSettings.signup.privacy && ` ${getText('legal.and')} `}
                {authSettings.signup.privacy && (
                  <a
                    href={typeof authSettings.signup.privacy === 'string' ? authSettings.signup.privacy : authSettings.signup.privacy.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                    style={{ color: colors.primary }}
                  >
                    {getText('legal.privacyPolicy')}
                  </a>
                )}
              </label>
            </div>
          )}

          {error && (
            <div
              className="p-3 text-sm rounded-lg"
              style={{
                color: colors.error,
                backgroundColor: `${colors.error}10`,
                borderColor: `${colors.error}30`,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
            style={{
              backgroundColor: colors.primary,
              fontFamily
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {isExistingUser ? getText('auth.checkingAccount') : getText('auth.creatingAccount')}
              </span>
            ) : (isExistingUser ? getText('auth.continue') : getText('auth.createAccount'))}
          </button>

          <button
            type="button"
            onClick={() => {
              setState(STATES.EMAIL_INPUT);
              setError('');
            }}
            className="w-full text-sm hover:underline"
            style={{ color: colors.textSecondary, fontFamily }}
          >
            {getText('auth.changeEmail')}
          </button>
        </form>
      </div>
    );
  }

  // Email input state (default)
  return (
    <div className={`space-y-4 ${className}`}>
      <form onSubmit={handleEmailSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-2"
            style={{ color: colors.textSecondary, fontFamily }}
          >
            {getText('auth.email')}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            disabled={isLoading}
            placeholder="name@example.com"
            className="w-full py-3 px-4 rounded-lg focus:outline-none focus:ring-2 transition-all"
            style={{
              backgroundColor: colors.surface,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: colors.border,
              color: colors.text,
              fontFamily,
              '--tw-ring-color': colors.primary
            }}
            autoFocus
            autoComplete="email"
          />
        </div>

        {error && (
          <div
            className="p-3 text-sm rounded-lg"
            style={{
              color: colors.error,
              backgroundColor: `${colors.error}10`,
              borderColor: `${colors.error}30`,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
          style={{
            backgroundColor: colors.primary,
            fontFamily
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {getText('auth.checkingAccount')}
            </span>
          ) : getText('auth.continue')}
        </button>
      </form>

      {/* OAuth providers - only show if providers are both configured AND available */}
      {((authSettings.providers.google && providers.google) || (authSettings.providers.github && providers.github)) && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: colors.border }} />
            </div>
            <div className="relative flex justify-center text-sm">
              <span
                className="px-3"
                style={{ backgroundColor: colors.surface, color: colors.textSecondary, fontFamily }}
              >
                {getText('auth.continueWith')}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {authSettings.providers.google && providers.google && (
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-3 transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: colors.border,
                  color: colors.text,
                  fontFamily
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {getText('providers.google')}
              </button>
            )}

            {authSettings.providers.github && providers.github && (
              <button
                type="button"
                onClick={() => handleOAuth('github')}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-3 transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: colors.border,
                  color: colors.text,
                  fontFamily
                }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
                </svg>
                {getText('providers.github')}
              </button>
            )}
          </div>
        </>
      )}

      {onCancel && (
        <div className="text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm hover:underline"
            style={{ color: colors.textSecondary, fontFamily }}
          >
            {getText('auth.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}
