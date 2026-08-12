// components/system/SessionProvider.jsx
'use client';
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export default function SessionProvider({ children }) {
  return (
    <NextAuthSessionProvider
      refetchInterval={0} // Disable automatic polling since we use Event Bus for immediate updates
      refetchOnWindowFocus={false} // Disable window focus refetch since we have reactive auth state
    >
      {children}
    </NextAuthSessionProvider>
  );
}