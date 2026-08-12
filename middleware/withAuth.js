// middleware/withAuth.js
import { getServerSession } from "next-auth/next";
import { createStudioAuthOptions } from "@/studio/core/auth/.studio";
import { createAuthOptions } from "@/studio/core/auth/options";
import { NextResponse } from 'next/server';
import { clientPromise } from '@/core/databases/mongodb';
import { ObjectId } from 'mongodb';
import { headers } from 'next/headers';
import { getJson } from '@/studio/core/utils/getJson';

async function isStudioDomain() {
  const headersList = headers();
  const host = headersList.get('host') || '';
  const studioDomain = process.env.STUDIO_DOMAIN || 'localhost';
  
  return host.includes('localhost') || host.includes(studioDomain);
}

export function withAuth(handler) {
  return async function(request) {
    console.log('Middleware: Starting authentication check');
    
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
      console.log('Middleware: No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const startupIndex = pathParts.findIndex(part => part === '.studio') + 1;
    const startupId = pathParts[startupIndex];

    console.log('Middleware: Extracted startupId', startupId);

    if (startupId !== 'startups') {
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB_NAME);

      const user = await db.collection('users').findOne({ email: session.user.email });

      if (!user) {
        console.log('Middleware: User not found in database');
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (user.isAdmin) {
        console.log('Middleware: User is admin, allowing access');
        return handler(request, session, startupId);
      }

      const startup = await db.collection('startups').findOne({ 
        _id: new ObjectId(startupId),
        $or: [
          { owner_id: user._id },
          { collaborators: user._id }
        ]
      });

      if (!startup) {
        console.log('Middleware: Startup access forbidden');
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    console.log('Middleware: All checks passed, calling handler');
    return handler(request, session, startupId);
  }
}