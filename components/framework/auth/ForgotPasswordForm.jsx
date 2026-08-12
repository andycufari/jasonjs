'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuthConfig } from '@/core/hooks/useAuthConfig';
import { useAuthLanguage } from './i18n';

export default function ForgotPasswordForm({ jcontext, className = '' }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, sent, error
  const [error, setError] = useState('');

  // Load auth configuration
  const { authConfig } = useAuthConfig();
  const { t } = useAuthLanguage(jcontext?.language);

  // Merge with jcontext for backward compatibility
  const authSettings = jcontext?.auth || authConfig?.auth || {};

  // Theme handling - respect defaultColorScheme
  const theme = jcontext?.theme || authConfig?.theme || {};
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('errors.genericError'));
      }

      setStatus('sent');
    } catch (err) {
      setError(err.message || t('errors.genericError'));
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'sent') {
    return (
      <div className={`space-y-4 ${className}`} style={{ fontFamily }}>
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: `${colors.success}15`,
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: `${colors.success}40`,
            color: colors.text
          }}
        >
          <div className="flex items-center space-x-3">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke={colors.success}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="font-medium">{t('success.passwordReset')}</p>
              <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                {email}
              </p>
            </div>
          </div>
        </div>
        <p className="text-sm text-center" style={{ color: colors.textSecondary }}>
          Check your email for password reset instructions. The link expires in 1 hour.
        </p>
        <div className="text-center">
          <Link
            href={authSettings.urls?.signIn || '/auth/login'}
            className="text-sm hover:underline"
            style={{ color: colors.primary }}
          >
            {t('success.returnToSignIn')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} style={{ fontFamily }}>
      <div className="text-center space-y-2">
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold" style={{ color: colors.text }}>
          {t('auth.forgotPassword').replace('?', '')}
        </h2>
        <p style={{ color: colors.textSecondary }}>
          Enter your email address and we'll send you instructions to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            className="p-3 rounded-lg text-sm"
            style={{
              backgroundColor: `${colors.error}15`,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: `${colors.error}40`,
              color: colors.error
            }}
          >
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-2"
            style={{ color: colors.textSecondary }}
          >
            {t('auth.email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all"
            style={{
              backgroundColor: colors.surface,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: colors.border,
              color: colors.text,
              '--tw-ring-color': colors.primary
            }}
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !email}
          className="w-full py-3 px-4 rounded-lg font-medium text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
          style={{
            backgroundColor: colors.primary
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('auth.sending')}
            </span>
          ) : (
            'Send Reset Instructions'
          )}
        </button>

        <div className="text-center">
          <Link
            href={authSettings.urls?.signIn || '/auth/login'}
            className="text-sm hover:underline"
            style={{ color: colors.primary }}
          >
            {t('success.returnToSignIn')}
          </Link>
        </div>
      </form>
    </div>
  );
}
