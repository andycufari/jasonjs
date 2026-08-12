// middleware/withStartupAuth.js
import { NextResponse } from 'next/server';
import { getStartup } from '@/core/sites/files';
import { getServerSession } from "next-auth/next";
import { createAuthOptions } from "@/studio/core/auth/options";
import { createStudioAuthOptions } from "@/studio/core/auth/.studio";
import { headers } from 'next/headers';
import { getJson } from '@/studio/core/utils/getJson';

async function isStudioDomain() {
  const headersList = headers();
  const host = headersList.get('host') || '';
  const studioDomain = process.env.STUDIO_DOMAIN || 'localhost';
  
  return host.includes('localhost') || host.includes(studioDomain);
}

export async function withStartupAuth(request) {
  const url = new URL(request.url);
  const host = url.hostname;

  // Get the startup based on the host
  const startup = await getStartup(host);
  if (!startup) {
    return NextResponse.json({ error: 'Startup not found' }, { status: 404 });
  }

  // Check if authentication is required for this startup
  if (startup.authConfig && startup.authConfig.enabled) {
    const isStudio = await isStudioDomain();
    let authOptions;
    
    if (isStudio) {
      authOptions = await createStudioAuthOptions();
    } else {
      const pageData = await getJson({ params: { slug: ['auth'] } }); 
      authOptions = await createAuthOptions(pageData);
    }

    const session = await getServerSession(authOptions);

    if (!session) {
      // Redirect to login or return unauthorized based on the request type
      if (request.headers.get('accept').includes('application/json')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      } else {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    // Attach the session to the request for use in the API routes
    request.session = session;
  }

  // Continue to the API route
  return NextResponse.next();
}