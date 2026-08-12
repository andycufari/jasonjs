'use client'

import { useState } from 'react';
import Link from 'next/link';

export default function VerifyEmailNotice({ jcontext, email, onResend, className = '' }) {
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('idle');
  const [error, setError] = useState('');

  const authSettings = jcontext?.auth || {};
  const uiLabels = authSettings.ui?.labels || {};
  const uiButtons = authSettings.ui?.buttons || {};
  const uiMessages = authSettings.ui?.messages || {};

  const handleResend = async () => {
    setIsResending(true);
    setError('');
    setResendStatus('sending');

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resend verification email');
      }

      setResendStatus('sent');
      if (onResend) {
        onResend(result);
      }
    } catch (err) {
      setError(err.message || 'Failed to resend verification email');
      setResendStatus('error');
    } finally {
      setIsResending(false);
    }
  };

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

  return (
    <div className={`space-y-6 text-center ${className}`}>
      <div className="w-16 h-16 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl auth-title">
          {uiLabels.verifyEmail || 'Verify your email'}
        </h2>
        <p className="text-gray-300 font-sans">
          We've sent a verification link to
        </p>
        {email && (
          <p className="text-white font-medium">{email}</p>
        )}
        <p className="text-gray-400 text-sm font-sans">
          Click the link in the email to verify your account
        </p>
      </div>

      {resendStatus === 'sent' && (
        <div className="p-3 text-sm text-green-400 bg-green-900/20 border border-green-900/20 rounded-lg">
          {uiMessages.resetLinkSent || 'Verification email sent! Check your inbox.'}
        </div>
      )}

      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/20 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <button
          onClick={handleResend}
          disabled={isResending || resendStatus === 'sent'}
          className={`auth-button disabled:opacity-50 disabled:cursor-not-allowed ${buttonSizeClass} ${buttonRoundedClass}`}
        >
          {isResending ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </span>
          ) : resendStatus === 'sent' ? (
            'Verification email sent'
          ) : (
            uiLabels.resendVerification || 'Resend verification email'
          )}
        </button>

        <div>
          <Link
            href={authSettings.urls?.signIn || '/auth/login'}
            className="text-sm auth-link"
          >
            {uiLabels.backToLogin || 'Back to login'}
          </Link>
        </div>
      </div>
    </div>
  );
}