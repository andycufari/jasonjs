// components/framework/auth/AuthProvider.jsx
'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import AuthModal from './AuthModal';

const AuthContext = createContext();

// Client Auth Provider Component
export function ClientAuthProvider({ children, config, siteId, domain, theme }) {
  const { data: session, status } = useSession();
  const [modalState, setModalState] = useState({ isOpen: false });

  // Event Bus integration for auth state
  useEffect(() => {
    if (typeof window !== 'undefined' && window.app?.events) {
      // Listen for auth requests from any component
      const handleAuthRequest = (options = {}) => {
        return new Promise((resolve, reject) => {
          if (session?.user) {
            resolve(session.user);
            return;
          }

          setModalState({
            isOpen: true,
            mode: options.mode || 'login',
            message: options.message,
            onSuccess: (user) => {
              setModalState({ isOpen: false });

              // Emit login success to Event Bus
              window.app.events.emit('auth.login', {
                user,
                timestamp: Date.now(),
                method: options.mode === 'signup' ? 'registration' : 'login'
              });

              if (options.onSuccess) options.onSuccess(user);
              resolve(user);
            },
            onCancel: () => {
              setModalState({ isOpen: false });

              // Emit auth cancelled event
              window.app.events.emit('auth.cancelled', {
                mode: options.mode,
                timestamp: Date.now()
              });

              // Resolve with null (not an error - user just cancelled)
              resolve(null);
            }
          });
        });
      };

      // Make requireLogin available globally
      if (!window.app) window.app = {};
      if (!window.app.auth) window.app.auth = {};

      window.app.auth = {
        ...window.app.auth,
        isAuthenticated: !!session?.user,
        user: session?.user || null,
        isLoading: status === 'loading',
        config,
        siteId,

        // Main auth function (replaces requireLogin)
        requireLogin: handleAuthRequest,
        showModal: handleAuthRequest, // Alias

        // Quick access methods
        signOut: async () => {
          const { signOut } = await import('next-auth/react');
          await signOut();

          window.app.events.emit('auth.logout', {
            timestamp: Date.now()
          });
        }
      };

      // Emit initial auth state
      if (session?.user) {
        window.app.events.emit('auth.ready', {
          user: session.user,
          isAuthenticated: true
        });
      } else {
        window.app.events.emit('auth.ready', {
          isAuthenticated: false
        });
      }
    }
  }, [session, status, config, siteId]);

  return (
    <AuthContext.Provider value={{ session, config, siteId, theme }}>
      {children}

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        message={modalState.message}
        config={config}
        theme={theme}
        onSuccess={modalState.onSuccess}
        onCancel={modalState.onCancel}
      />
    </AuthContext.Provider>
  );
}

// Main AuthProvider that wraps everything
export default function AuthProvider({ children, config, siteId, domain, theme }) {
  return (
    <SessionProvider>
      <ClientAuthProvider config={config} siteId={siteId} domain={domain} theme={theme}>
        {children}
      </ClientAuthProvider>
    </SessionProvider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};