'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/core/hooks/useApp';
import UnifiedAuth from './UnifiedAuth';
import { useAuthLanguage } from './i18n';

export default function AuthModal() {
  const app = useApp();
  const { t } = useAuthLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [currentResolver, setCurrentResolver] = useState(null);
  const [prefilledEmail, setPrefilledEmail] = useState('');
  const [authConfig, setAuthConfig] = useState(null);

  // Load auth configuration
  useEffect(() => {
    const loadAuthConfig = async () => {
      try {
        const response = await fetch('/api/auth/config');
        const data = await response.json();
        if (data.success) {
          setAuthConfig(data.config);
        }
      } catch (error) {
        console.error('Failed to load auth config:', error);
        // Use fallback config - default to light mode
        setAuthConfig({
          site: { name: 'JasonJS', logo: null },
          theme: {
            defaultColorScheme: 'light',
            colors: {
              primary: '#6366f1',
              secondary: '#8b5cf6',
              background: '#f8fafc',
              'bg-dark': '#0f172a',
              text: '#1f2937',
              textSecondary: '#6b7280',
              surface: '#ffffff'
            },
            typography: { fontFamily: "'Inter', system-ui, sans-serif" },
            buttons: {},
            cardStyle: ''
          },
          modalBackground: {
            transparent: false,
            color: null,
            blur: true,
            showGradient: true
          },
          texts: {
            welcomeBack: 'Welcome back',
            signIn: 'Sign in',
            signUp: 'Sign up'
          },
          auth: {
            providers: { credentials: { enabled: true } },
            registration: { enabled: true }
          }
        });
      }
    };

    loadAuthConfig();
  }, []);

  useEffect(() => {
    // Listen for auth requirements
    const unsubscribe = app.events.on('auth.requireLogin', ({ resolve, reject, options = {} }) => {
      setIsOpen(true);
      setPrefilledEmail(options.email || '');
      setCurrentResolver({ resolve, reject });
    });

    return unsubscribe;
  }, [app]);

  const handleSuccess = (result) => {
    console.log('[AuthModal] handleSuccess called with:', result);

    // Handle both direct user object and result object with user property
    const user = result?.user || result;

    // Validate that we actually have a user object with required fields
    if (!user || (!user.id && !user._id && !user.email)) {
      console.error('[AuthModal] Invalid user object received:', user, 'from result:', result);
      return;
    }

    console.log('[AuthModal] Valid user received, closing modal:', user);
    setIsOpen(false);
    setPrefilledEmail('');

    if (currentResolver) {
      console.log('[AuthModal] Resolving promise with user');
      currentResolver.resolve(user);
      setCurrentResolver(null);
    }

    // Note: app.auth.login is already called by UnifiedAuth
    // No need to call it again here to avoid duplicate event emissions
  };

  const handleClose = () => {
    setIsOpen(false);
    setPrefilledEmail('');

    if (currentResolver) {
      // Resolve with null if user closes without authenticating (not an error)
      currentResolver.resolve(null);
      setCurrentResolver(null);
    }
  };

  if (!isOpen || !authConfig) return null;

  const { site, theme } = authConfig;
  const isDark = theme.defaultColorScheme === 'dark';
  const primaryColor = theme.colors?.primary || '#6366f1';
  const secondaryColor = theme.colors?.secondary || '#8b5cf6';
  const backgroundColor = isDark
    ? (theme.colors?.['bg-dark'] || theme.colors?.background || '#0f172a')
    : (theme.colors?.background || '#f8fafc');
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

  // Create gradient background style like the auth page
  const gradientStyle = {
    background: `linear-gradient(135deg, ${backgroundColor} 0%, ${primaryColor}15 25%, ${secondaryColor}15 75%, ${backgroundColor} 100%)`,
    minHeight: '100vh'
  };

  return (
    <>
      {/* Enhanced backdrop - configurable transparency */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{
          backgroundColor: authConfig.modalBackground?.transparent
            ? 'rgba(0, 0, 0, 0.4)'
            : authConfig.modalBackground?.color || 'rgba(0, 0, 0, 0.9)',
          backdropFilter: authConfig.modalBackground?.blur ? 'blur(8px)' : 'none',
          zIndex: 999999
        }}
        onClick={handleClose}
      >
        {/* Background gradient overlay - only show if configured */}
        {authConfig.modalBackground?.showGradient && (
          <div
            className="absolute inset-0"
            style={gradientStyle}
            onClick={handleClose}
          >
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div
                className="absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"
                style={{ backgroundColor: primaryColor }}
              ></div>
              <div
                className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"
                style={{ backgroundColor: secondaryColor }}
              ></div>
              <div
                className="absolute top-40 left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-blob animation-delay-4000"
                style={{ backgroundColor: primaryColor }}
              ></div>
            </div>
          </div>
        )}

        {/* Modal Content */}
        <div
          className={`relative w-full max-w-md rounded-2xl overflow-hidden flex flex-col ${theme.cardStyle || ''}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontFamily: theme.typography?.fontFamily,
            zIndex: 1000000,
            backgroundColor: surfaceColor,
            border: `1px solid ${borderColor}`,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxHeight: 'calc(100vh - 2rem)'
          }}
        >
          {/* Header */}
          <div
            className="px-8 py-6 flex-shrink-0"
            style={{ borderBottom: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center justify-between">
              {/* Logo or Brand */}
              <div className="flex items-center space-x-3">
                {site.logo ? (
                  <img
                    src={site.logo}
                    alt={site.name}
                    className="h-8 w-auto"
                  />
                ) : site.name ? (
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <span
                        className="font-bold text-sm"
                        style={{ color: theme.colors?.surface || '#ffffff' }}
                      >
                        {site.name[0]}
                      </span>
                    </div>
                    <span
                      className="text-lg font-semibold"
                      style={{
                        color: textColor,
                        fontFamily: theme.typography?.headings?.fontFamily
                      }}
                    >
                      {site.name}
                    </span>
                  </div>
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: theme.colors?.surface || '#ffffff' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                )}
              </div>

              <button
                onClick={handleClose}
                className="p-2 rounded-lg transition-colors"
                style={{ color: textSecondaryColor }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Title */}
            <div className="mt-4">
              <h2
                className="text-2xl font-bold"
                style={{
                  color: textColor,
                  fontFamily: theme.typography?.headings?.fontFamily,
                  fontWeight: theme.typography?.headings?.fontWeight || '700'
                }}
              >
                {t('auth.welcome')}
              </h2>
            </div>
          </div>

          {/* Content - UnifiedAuth handles everything */}
          <div className="px-8 py-6 flex-1 overflow-y-auto">
            <UnifiedAuth
              jcontext={{ ...app.context, auth: authConfig.auth, theme, app }}
              onSuccess={handleSuccess}
              onCancel={handleClose}
              initialEmail={prefilledEmail}
              className="space-y-4"
            />
          </div>
        </div>
      </div>

      {/* Inline styles for animations */}
      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </>
  );
}

AuthModal.displayName = 'AuthModal';
AuthModal.isSystemComponent = true;
