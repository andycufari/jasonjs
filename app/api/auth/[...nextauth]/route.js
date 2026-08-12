// app/api/auth/[...nextauth]/route.js
import NextAuth from 'next-auth';
import { createAuthOptions } from '@/core/auth/options';
import { loadPageDefinition } from '@/core/render/loadPage';
import { resolveSite } from '@/core/sites/resolve';

export const dynamic = 'force-dynamic';

// Helper function to get auth options for other API routes
export async function getAuthOptions() {
  let pageData;
  try {
    pageData = await loadPageDefinition({ params: { slug: ['auth'] } });
  } catch (error) {
    pageData = null;
  }

  // If no auth configuration found, use defaults
  if (!pageData) {
    const { host } = await resolveSite();
    pageData = {
      domain: host,
      auth: {
        providers: {
          credentials: { enabled: true }
        }
      }
    };
  }

  return await createAuthOptions(pageData);
}

// Export authOptions for compatibility - use the function directly
export { getAuthOptions as authOptions };

export async function GET(request, context) {
  const authOptions = await getAuthOptions();
  return NextAuth(authOptions)(request, context);
}

export async function POST(request, context) {
  const authOptions = await getAuthOptions();
  return NextAuth(authOptions)(request, context);
}
