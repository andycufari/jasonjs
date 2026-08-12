'use client';

import { useState, useEffect } from 'react';

/**
 * Detect language from browser or HTML lang attribute
 */
function detectBrowserLanguage() {
  if (typeof window === 'undefined') return 'en';

  // Try to get from HTML lang attribute
  const htmlLang = document.documentElement.lang;
  if (htmlLang) {
    return htmlLang.split('-')[0];
  }

  // Fallback to browser language
  const browserLang = navigator?.language?.split('-')[0];
  return browserLang || 'en';
}

/**
 * Hook to load auth configuration from API
 * Provides theming, labels, and provider settings for all auth components
 *
 * @param {string} language - Optional language code (e.g., 'en', 'es'). Auto-detects from browser if not provided.
 */
export function useAuthConfig(language = null) {
  const [authConfig, setAuthConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAuthConfig = async () => {
      try {
        setLoading(true);

        // Determine language to use
        const lang = language || detectBrowserLanguage();

        // Fetch config with language parameter
        const response = await fetch(`/api/auth/config?lang=${lang}`);
        const data = await response.json();

        if (data.success) {
          setAuthConfig(data.config);
        } else {
          throw new Error('Failed to load auth config');
        }
      } catch (err) {
        setError(err.message);

        // Use fallback config with JasonJS as default site name
        setAuthConfig({
          site: { name: 'JasonJS', logo: null },
          theme: {
            colors: {
              primary: '#6366f1',
              secondary: '#8b5cf6',
              background: '#0f172a',
              text: '#f8fafc',
              textSecondary: '#cbd5e1',
              surface: '#ffffff'
            },
            typography: { fontFamily: "'Inter', system-ui, sans-serif" },
            cardStyle: 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-2xl'
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
            signUp: 'Sign up',
            username: 'Email',
            password: 'Password',
            createAccount: 'Create Account',
            signingIn: 'Signing in...',
            creatingAccount: 'Creating account...',
            forgotPassword: 'Forgot password?',
            orContinueWith: 'Or continue with',
            continueWithGoogle: 'Continue with Google',
            continueWithGithub: 'Continue with GitHub',
            dontHaveAccount: "Don't have an account?",
            alreadyHaveAccount: "Already have an account?",
            name: 'Full name',
            email: 'Email address',
            profileSettings: 'Profile Settings',
            adminDashboard: 'Admin Dashboard',
            signOut: 'Sign Out'
          },
          auth: {
            providers: { credentials: { enabled: true } },
            registration: { enabled: true },
            ui: { showSocialProviders: false }
          }
        });
      } finally {
        setLoading(false);
      }
    };

    loadAuthConfig();
  }, [language]); // Re-fetch if language changes

  return { authConfig, loading, error };
}

export default useAuthConfig;