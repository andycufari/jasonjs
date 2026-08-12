// app/api/auth/check-user/route.js
// Check if a user exists by email (for unified auth flow)
import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/core/auth/lib';
import { resolveSite } from '@/core/sites/resolve';
import { getSite } from '@/core/sites/files';
import { checkAuthRateLimit } from '@/core/auth/rateLimit';

export async function POST(request) {
  // Rate limit check (helps prevent email enumeration attacks)
  const rateLimitError = checkAuthRateLimit(request, { type: 'auth' });
  if (rateLimitError) return rateLimitError;

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get domain and resolve to proper siteId
    const { host: domain } = await resolveSite(request);
    let siteId = null;

    if (domain) {
      try {
        const site = await getSite(domain);
        if (site && site._id) {
          siteId = typeof site._id === 'string' ? site._id : site._id.toString();
        }
      } catch (error) {
        console.error('Error getting site for user check:', error);
      }
    }

    // Fallback to using domain if site not found (for local/standalone mode)
    if (!siteId) {
      siteId = domain;
    }

    // Check if user exists with this email and siteId
    const user = await getUserByEmail(email.toLowerCase(), siteId);

    console.log('[check-user] email:', email.toLowerCase());
    console.log('[check-user] siteId:', siteId);
    console.log('[check-user] user found:', !!user);
    console.log('[check-user] user.name:', user?.name);
    console.log('[check-user] returning name:', user?.name ? user.name.split(' ')[0] : null);

    return NextResponse.json({
      exists: !!user,
      // Only return minimal info, no sensitive data
      ...(user && {
        name: user.name ? user.name.split(' ')[0] : null // First name only for greeting
      })
    });

  } catch (error) {
    console.error('Error checking user:', error);
    return NextResponse.json(
      { error: 'Failed to check user' },
      { status: 500 }
    );
  }
}
