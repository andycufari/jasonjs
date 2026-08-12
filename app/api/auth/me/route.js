// app/api/auth/me/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getPage } from '@/core/sites/files';
import { createAuthOptions } from '@/core/auth/options';
import { resolveSite } from '@/core/sites/resolve';

export async function GET(request) {
  try {
    // Get site configuration to determine the site and auth settings
    const { host: domain } = await resolveSite(request);
    
    let pageData;
    try {
      pageData = await getPage('/', domain);
    } catch (error) {
      return NextResponse.json(
        { error: 'Site configuration not found' },
        { status: 404 }
      );
    }

    // Get auth configuration and session
    const authOptions = await createAuthOptions(pageData);
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Return user data (sensitive data already filtered in session callback)
    return NextResponse.json({
      user: session.user
    });

  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}