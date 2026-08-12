// components/system/auth/AuthSystemProvider.jsx - Server Component
import { getAuthContext } from '@/lib/auth-config';
import ClientAuthProvider from '@/components/framework/auth/AuthProvider';

export default async function AuthSystemProvider({ children }) {
  // Server-side tenant resolution (secure, fast)
  const { config, siteId, domain, theme } = await getAuthContext();

  return (
    <ClientAuthProvider
      config={config}
      siteId={siteId}
      domain={domain}
      theme={theme}
    >
      {children}
    </ClientAuthProvider>
  );
}

// Export the context getter for use in other server components
export { getAuthContext };