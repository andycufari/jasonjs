'use client'

/**
 * @deprecated CodeVerificationInput is deprecated and unused.
 *
 * Use EmailCodeVerification instead, which provides a better UX with
 * individual digit inputs, auto-focus, paste support, and proper theme handling.
 *
 * This component is kept for backwards compatibility but should not be used
 * in new code.
 *
 * @see EmailCodeVerification for the recommended code verification component
 * @see UnifiedAuth for the recommended complete auth flow
 */

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useAuthLanguage } from './i18n';

export default function CodeVerificationInput({
  email,
  type = 'login',
  onVerified,
  onResendCode,
  className = '',
  theme = {},
  language = null
}) {
  const { t } = useAuthLanguage(language);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const primaryColor = theme.colors?.primary || '#6366f1';
  const textColor = theme.colors?.text || '#1f2937';
  const textSecondaryColor = theme.colors?.textSecondary || '#6b7280';
  const fontFamily = theme.typography?.fontFamily || "'Inter', system-ui, sans-serif";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError(t('verification.codeMustBe6'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code,
          type
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t('verification.invalidCode'));
      }

      if (result.verified) {
        // If user is now signed in, trigger page reload to update session
        if (result.signedIn) {
          // Small delay to ensure cookie is set before reload
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } else if (onVerified) {
          onVerified(result);
        }
      }

    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    setError('');
  };

  const handleResend = async () => {
    if (onResendCode) {
      await onResendCode();
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="text-center space-y-2">
        <div className="text-lg font-medium" style={{ color: textColor, fontFamily }}>
          {t('verification.title')}
        </div>
        <div className="text-sm" style={{ color: textSecondaryColor, fontFamily }}>
          {t('verification.codeSentTo')}<br />
          <span className="font-medium">{email}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-center">
          <input
            type="text"
            value={code}
            onChange={handleCodeChange}
            placeholder="000000"
            className="w-32 text-center text-2xl font-mono tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:border-transparent py-3"
            style={{
              '--tw-ring-color': primaryColor,
              fontFamily: 'monospace'
            }}
            autoComplete="one-time-code"
            maxLength="6"
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="text-center text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || code.length !== 6}
          className="w-full text-white font-medium disabled:opacity-50 transition-colors py-3 px-4 rounded-lg"
          style={{
            backgroundColor: primaryColor,
            fontFamily
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('verification.verifying')}
            </span>
          ) : (
            t('verification.verify')
          )}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={isLoading}
          className="w-full text-sm text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
          style={{ fontFamily }}
        >
          {t('verification.resendCode')} {t('verification.resend')}
        </button>
      </form>
    </div>
  );
}