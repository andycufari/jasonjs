// components/system/auth/AuthButton.jsx - Simple auth button for any use case
'use client';
import { useState, useEffect } from 'react';

export default function AuthButton({
  action = 'add-to-favorites',
  message = 'Sign in to continue',
  mode = 'login',
  onAuthSuccess,
  children,
  className = '',
  theme = {},
  ...props
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Theme-based styling
  const isDark = theme?.defaultColorScheme === 'dark';
  const colors = isDark ? theme.darkMode?.colors || theme.colors : theme.colors;

  const styles = {
    button: {
      backgroundColor: colors?.primary || '#6366f1',
      color: '#ffffff',
      borderRadius: theme?.borders?.radius?.base || '0.5rem',
      fontSize: '1rem',
      fontWeight: '500',
      padding: '0.75rem 1.5rem',
      transition: 'all 0.2s ease',
      fontFamily: theme?.typography?.fontFamily || "'Inter', system-ui, sans-serif",
      ':hover': {
        backgroundColor: colors?.primary ? `${colors.primary}dd` : '#5855eb',
        transform: 'translateY(-1px)'
      },
      ':disabled': {
        opacity: 0.6,
        transform: 'none',
        cursor: 'not-allowed'
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Listen for auth state changes
      const unsubscribeReady = window.app?.events?.on('auth.ready', (data) => {
        setIsAuthenticated(data.isAuthenticated);
        setIsLoading(false);
      });

      const unsubscribeLogin = window.app?.events?.on('auth.login', (data) => {
        setIsAuthenticated(true);
        setIsLoading(false);
      });

      const unsubscribeLogout = window.app?.events?.on('auth.logout', () => {
        setIsAuthenticated(false);
      });

      return () => {
        unsubscribeReady?.();
        unsubscribeLogin?.();
        unsubscribeLogout?.();
      };
    }
  }, []);

  const handleClick = async (e) => {
    e.preventDefault();

    if (isAuthenticated) {
      // User is authenticated, proceed with action
      if (onAuthSuccess) {
        onAuthSuccess(window.app?.auth?.user);
      }
      return;
    }

    // User not authenticated, require login
    try {
      const user = await window.app?.auth?.requireLogin({
        mode,
        message: message || `Sign in to ${action.replace('-', ' ')}`
      });

      // User is now authenticated
      if (onAuthSuccess) {
        onAuthSuccess(user);
      }

      // Emit custom event for this action
      window.app?.events?.emit(`auth.required.${action}`, {
        user,
        action,
        timestamp: Date.now()
      });

    } catch (error) {
      // User cancelled auth
      console.log(`Auth cancelled for ${action}`);
    }
  };

  if (isLoading) {
    return (
      <button
        disabled
        className={`opacity-50 ${className}`}
        style={styles.button}
        {...props}
      >
        <div className="flex items-center space-x-2">
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
          <span>Loading...</span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={className}
      style={styles.button}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = styles.button[':hover'].backgroundColor;
        e.target.style.transform = styles.button[':hover'].transform;
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = styles.button.backgroundColor;
        e.target.style.transform = 'none';
      }}
      {...props}
    >
      {children}
    </button>
  );
}

AuthButton.displayName = 'AuthButton';
AuthButton.isSystemComponent = true;