'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useApp } from '@/core/hooks/useApp';

// Create a context for our reactive auth state
const AuthStateContext = createContext();

export function AuthStateProvider({ children }) {
  const { data: session, status } = useSession();
  const app = useApp();

  // Start with NextAuth session if available, but can be overridden by Event Bus
  const [authState, setAuthState] = useState({
    user: session?.user || null,
    isAuthenticated: !!session?.user,
    isLoading: status === 'loading'
  });

  // Update from NextAuth session when it changes
  useEffect(() => {
    if (session?.user) {
      setAuthState({
        user: session.user,
        isAuthenticated: true,
        isLoading: false
      });
    } else if (status !== 'loading') {
      // Only clear if NextAuth has finished loading and no session
      setAuthState(prev => ({
        ...prev,
        isLoading: false
      }));
    }
  }, [session, status]);

  // Listen to Event Bus for immediate auth updates
  useEffect(() => {
    if (!app?.events) return;

    // Listen for login events - update immediately without waiting for NextAuth
    const unsubscribeLogin = app.events.on('user.login', (result) => {
      const userData = result?.user || result;
      console.log('🔥 AuthStateProvider: User logged in via Event Bus:', userData?.name);

      // Immediately update our local auth state
      setAuthState({
        user: userData,
        isAuthenticated: true,
        isLoading: false
      });
    });

    // Listen for logout events
    const unsubscribeLogout = app.events.on('user.logout', () => {
      console.log('👋 AuthStateProvider: User logged out via Event Bus');

      // Immediately clear our local auth state
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    });

    return () => {
      unsubscribeLogin();
      unsubscribeLogout();
    };
  }, [app]);

  return (
    <AuthStateContext.Provider value={authState}>
      {children}
    </AuthStateContext.Provider>
  );
}

// Hook to use our reactive auth state
export function useAuthState() {
  const context = useContext(AuthStateContext);
  if (!context) {
    // Fallback if used outside provider
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false
    };
  }
  return context;
}