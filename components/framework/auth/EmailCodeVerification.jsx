'use client'

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuthLanguage } from './i18n';

export default function EmailCodeVerification({ jcontext, email, type = 'login', onSuccess, onResend, className = '' }) {
  const { t } = useAuthLanguage(jcontext?.language);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resendStatus, setResendStatus] = useState('idle');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const inputRefs = useRef([]);

  const authSettings = jcontext?.auth || {};
  const uiLabels = authSettings.ui?.labels || {};
  const uiMessages = authSettings.ui?.messages || {};

  // Theme handling - respect defaultColorScheme like other auth components
  const theme = jcontext?.theme || {};
  const isDark = theme.defaultColorScheme === 'dark';

  const colors = useMemo(() => ({
    primary: theme.colors?.primary || '#6366f1',
    background: isDark ? (theme.colors?.background || '#1e293b') : (theme.colors?.background || '#ffffff'),
    surface: isDark ? (theme.colors?.surface || '#334155') : (theme.colors?.surface || '#f8fafc'),
    text: isDark ? (theme.colors?.text || '#f8fafc') : (theme.colors?.text || '#1e293b'),
    textSecondary: isDark ? (theme.colors?.textSecondary || '#94a3b8') : (theme.colors?.textSecondary || '#64748b'),
    border: isDark ? (theme.colors?.border || '#475569') : (theme.colors?.border || '#e2e8f0'),
    error: theme.colors?.error || '#ef4444',
    success: theme.colors?.success || '#22c55e'
  }), [theme, isDark]);

  const fontFamily = theme.typography?.fontFamily || "'Inter', system-ui, sans-serif";

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newCode.every(digit => digit !== '') && index === 5) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Handle paste
    if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handlePaste(e);
    }
  };

  const handlePaste = async (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData?.getData('text') || await navigator.clipboard.readText();
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');

    if (digits.length === 6) {
      setCode(digits);
      inputRefs.current[5]?.focus();
      handleVerify(digits.join(''));
    }
  };

  const handleVerify = async (codeValue) => {
    setIsVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: codeValue,
          type
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t('verification.invalidCode'));
      }

      if (onSuccess) {
        // Show logging in animation
        setIsLoggingIn(true);

        // Add a small delay to show the animation, then call onSuccess
        setTimeout(() => {
          onSuccess({
            ...result,
            code: codeValue // Include the actual code for NextAuth sign-in
          });
        }, 800);
      }
    } catch (err) {
      setError(err.message || t('verification.invalidCode'));
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError('');
    setResendStatus('sending');

    try {
      // Use appropriate endpoint based on type
      const endpoint = type === 'registration'
        ? '/api/auth/send-verification-code'
        : '/api/auth/send-login-code';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, type }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t('errors.genericError'));
      }

      setResendStatus('sent');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();

      if (onResend) {
        onResend(result);
      }

      // Reset resend status after 3 seconds
      setTimeout(() => {
        setResendStatus('idle');
      }, 3000);
    } catch (err) {
      setError(err.message || t('errors.genericError'));
      setResendStatus('error');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`} style={{ fontFamily }}>
      <div className="text-center space-y-3">
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: `${colors.primary}20` }}
        >
          <svg
            className="w-8 h-8"
            fill="none"
            stroke={colors.primary}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h2
          className="text-2xl font-semibold"
          style={{ color: colors.text }}
        >
          {uiLabels.verifyEmail || t('verification.title')}
        </h2>

        <p style={{ color: colors.textSecondary }}>
          {t('verification.codeSentTo')}
        </p>
        {email && (
          <p className="font-medium" style={{ color: colors.text }}>{email}</p>
        )}
        <p className="text-sm" style={{ color: colors.textSecondary }}>
          {t('verification.enterCode')}
        </p>
      </div>

      {/* 6-Digit Code Input */}
      <div className="flex justify-center gap-2">
        {code.map((digit, index) => (
          <input
            key={index}
            ref={el => inputRefs.current[index] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={isVerifying || isLoggingIn}
            className="w-12 h-14 text-center text-2xl font-bold rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{
              backgroundColor: colors.surface,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: colors.border,
              color: colors.text,
              fontFamily: 'monospace',
              '--tw-ring-color': colors.primary
            }}
          />
        ))}
      </div>

      {error && (
        <div
          className="p-3 text-sm rounded-lg text-center"
          style={{
            color: colors.error,
            backgroundColor: `${colors.error}10`,
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: `${colors.error}30`
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
            backgroundColor: `${colors.success}10`,
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: `${colors.success}30`
          }}
        >
          {uiMessages.resetLinkSent || t('verification.codeSent')}
        </div>
      )}

      {isVerifying && (
        <div className="flex items-center justify-center space-x-2" style={{ color: colors.primary }}>
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{t('verification.verifying')}</span>
        </div>
      )}

      {isLoggingIn && (
        <div className="flex flex-col items-center justify-center space-y-3" style={{ color: colors.success }}>
          {/* Success checkmark animation */}
          <div className="relative w-16 h-16">
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ backgroundColor: `${colors.success}20` }}
            ></div>
            <div
              className="absolute inset-2 rounded-full animate-ping"
              style={{ backgroundColor: `${colors.success}30` }}
            ></div>
            <div
              className="relative w-full h-full rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${colors.success}20` }}
            >
              <svg className="w-8 h-8 animate-bounce" fill="none" stroke={colors.success} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 text-center">
        <button
          onClick={handleResend}
          disabled={isResending || resendStatus === 'sent' || isVerifying || isLoggingIn}
          className="text-sm hover:underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ color: colors.primary }}
        >
          {isResending ? (
            t('verification.resending')
          ) : resendStatus === 'sent' ? (
            t('verification.codeSent')
          ) : (
            uiLabels.resendVerification || t('verification.resend')
          )}
        </button>

        <div>
          <Link
            href={authSettings.urls?.signIn || '/auth/login'}
            className="text-sm hover:underline transition-colors"
            style={{ color: colors.primary }}
          >
            {uiLabels.backToLogin || t('auth.signIn')}
          </Link>
        </div>
      </div>
    </div>
  );
}
