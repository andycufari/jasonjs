// components/system/auth/UserMenu.jsx - Event Bus-powered user menu
'use client';
import { useState, useEffect } from 'react';

export default function UserMenu({ className = '', theme = {} }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Theme-based styling
  const isDark = theme?.defaultColorScheme === 'dark';
  const colors = isDark ? theme.darkMode?.colors || theme.colors : theme.colors;

  const styles = {
    container: {
      fontFamily: theme?.typography?.fontFamily || "'Inter', system-ui, sans-serif"
    },
    userInfo: {
      backgroundColor: colors?.surface || (isDark ? '#1e293b' : '#f8fafc'),
      color: colors?.text || (isDark ? '#f8fafc' : '#1e293b'),
      borderColor: colors?.border || (isDark ? '#334155' : '#e2e8f0'),
      borderRadius: theme?.borders?.radius?.base || '0.5rem',
      padding: '0.75rem 1rem'
    },
    button: {
      backgroundColor: colors?.primary || '#6366f1',
      color: '#ffffff',
      borderRadius: theme?.borders?.radius?.base || '0.5rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      padding: '0.5rem 1rem',
      transition: 'all 0.2s ease',
      ':hover': {
        backgroundColor: colors?.primary ? `${colors.primary}dd` : '#5855eb',
        transform: 'translateY(-1px)'
      }
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      color: colors?.textSecondary || (isDark ? '#cbd5e1' : '#64748b'),
      borderRadius: theme?.borders?.radius?.base || '0.5rem',
      fontSize: '0.875rem',
      padding: '0.5rem 1rem',
      transition: 'all 0.2s ease',
      ':hover': {
        color: colors?.text || (isDark ? '#f8fafc' : '#1e293b'),
        backgroundColor: colors?.hover || (isDark ? '#334155' : '#f1f5f9')
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Listen for all auth events via Event Bus
      const unsubscribeLogin = window.app?.events?.on('auth.login', (data) => {
        setUser(data.user);
        setIsAuthenticated(true);
        setIsLoading(false);

        // Show welcome message
        if (window.app?.ui?.toast) {
          window.app.ui.toast(`Welcome back, ${data.user.name}!`, { type: 'success' });
        }
      });

      const unsubscribeLogout = window.app?.events?.on('auth.logout', () => {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
      });

      const unsubscribeReady = window.app?.events?.on('auth.ready', (data) => {
        setUser(data.user || null);
        setIsAuthenticated(data.isAuthenticated);
        setIsLoading(false);
      });

      const unsubscribeError = window.app?.events?.on('auth.error', (data) => {
        console.error('Auth error:', data.error);
        if (window.app?.ui?.toast) {
          window.app.ui.toast(`Authentication error: ${data.error}`, { type: 'error' });
        }
      });

      const unsubscribeCancelled = window.app?.events?.on('auth.cancelled', (data) => {
        console.log('Auth cancelled for mode:', data.mode);
      });

      // Cleanup on unmount
      return () => {
        unsubscribeLogin?.();
        unsubscribeLogout?.();
        unsubscribeReady?.();
        unsubscribeError?.();
        unsubscribeCancelled?.();
      };
    }
  }, []);

  const handleLoginClick = async () => {
    try {
      const user = await window.app?.auth?.requireLogin({
        message: 'Sign in to access your account'
      });

      // User is now authenticated, component already updated via events
      console.log('Login successful:', user);

    } catch (error) {
      console.log('Login cancelled');
    }
  };

  const handleSignupClick = async () => {
    try {
      const user = await window.app?.auth?.requireLogin({
        mode: 'signup',
        message: 'Create an account to get started'
      });

      console.log('Signup successful:', user);

    } catch (error) {
      console.log('Signup cancelled');
    }
  };

  const handleSignOut = async () => {
    if (window.app?.auth?.signOut) {
      await window.app.auth.signOut();
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center ${className}`} style={styles.container}>
        <div className="animate-pulse flex space-x-2">
          <div
            className="h-8 w-16 rounded"
            style={{ backgroundColor: colors?.border || (isDark ? '#334155' : '#e2e8f0') }}
          ></div>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className={`flex items-center space-x-3 ${className}`} style={styles.container}>
        <div
          className="px-3 py-2 border rounded-lg"
          style={styles.userInfo}
        >
          <span className="text-sm">
            Welcome, <strong>{user.name || user.email}</strong>
          </span>
        </div>

        <button
          onClick={handleSignOut}
          style={styles.secondaryButton}
          onMouseEnter={(e) => {
            e.target.style.color = styles.secondaryButton[':hover'].color;
            e.target.style.backgroundColor = styles.secondaryButton[':hover'].backgroundColor;
          }}
          onMouseLeave={(e) => {
            e.target.style.color = styles.secondaryButton.color;
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`} style={styles.container}>
      <button
        onClick={handleLoginClick}
        style={styles.secondaryButton}
        onMouseEnter={(e) => {
          e.target.style.color = styles.secondaryButton[':hover'].color;
          e.target.style.backgroundColor = styles.secondaryButton[':hover'].backgroundColor;
        }}
        onMouseLeave={(e) => {
          e.target.style.color = styles.secondaryButton.color;
          e.target.style.backgroundColor = 'transparent';
        }}
      >
        Sign In
      </button>

      <button
        onClick={handleSignupClick}
        style={styles.button}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = styles.button[':hover'].backgroundColor;
          e.target.style.transform = styles.button[':hover'].transform;
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = styles.button.backgroundColor;
          e.target.style.transform = 'none';
        }}
      >
        Sign Up
      </button>
    </div>
  );
}

UserMenu.displayName = 'UserMenu';
UserMenu.isSystemComponent = true;