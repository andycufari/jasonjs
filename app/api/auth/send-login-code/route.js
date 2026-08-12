// app/api/auth/send-login-code/route.js
import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/core/auth/lib';
import { getMongoClient } from '@/core/db/adapters/mongodb/index.js';
import { resolveSite } from '@/core/sites/resolve';
import { getSite } from '@/core/sites/files';
import { getSiteInfo } from '@/core/utils/getSiteInfo';
import { getAllSettings } from '@/core/sites/files';
import { sendVerificationCode } from '@/core/services/email';
import { checkAuthRateLimit } from '@/core/auth/rateLimit';

export async function POST(request) {
  // Rate limit check
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
        console.error('Error getting site for login code:', error);
      }
    }

    // Fallback to using domain if site not found (for local/standalone mode)
    if (!siteId) {
      siteId = domain;
    }

    // Check if user exists with this email and siteId
    const user = await getUserByEmail(email.toLowerCase(), siteId);
    console.log(`User lookup for ${email} with siteId ${siteId}:`, user ? 'FOUND' : 'NOT FOUND');

    if (user) {
      console.log('Found user data:', {
        id: user.id,
        email: user.email,
        siteId: user.siteId,
        emailVerified: user.emailVerified
      });
    }

    if (!user) {
      return NextResponse.json(
        {
          error: 'No account found with this email address',
          suggestion: 'Would you like to create an account instead?',
          canSignUp: true
        },
        { status: 404 }
      );
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store verification code in database
    const client = await getMongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.MONGODB_DB_NAME || 'jasonjs_universal');

    await db.collection('verification_codes').insertOne({
      email: email.toLowerCase(),
      code,
      type: 'login',
      userId: user.id,
      siteId,
      expiresAt,
      used: false,
      createdAt: new Date()
    });

    // Send verification code via email
    // Get site information for proper branding
    let siteInfo;
    try {
      siteInfo = await getSiteInfo(domain);
    } catch (error) {
      console.log('No site info found, using defaults');
      siteInfo = { name: 'JasonJS Framework' };
    }

    // Check for auth UI defaultName override
    let settings = {};
    try {
      settings = await getAllSettings(domain);
    } catch (error) {
      console.log('Error loading settings:', error);
    }

    // Use auth UI defaultName if available, otherwise use site name
    const siteName = settings.auth?.ui?.defaultName || siteInfo.name || 'JasonJS Framework';

    const siteConfig = {
      name: siteName
    };

    const emailResult = await sendVerificationCode(email, code, 'login', siteConfig, domain);
    if (!emailResult.success && !emailResult.fallbackLogged) {
      console.error('Failed to send verification email and no fallback logged');
    }

    return NextResponse.json({
      success: true,
      requiresVerification: true,
      verificationType: 'code',
      message: 'Verification code sent to your email',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      // In development, return the code for testing
      ...(process.env.NODE_ENV === 'development' && { code })
    });

  } catch (error) {
    console.error('Error sending login code:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}