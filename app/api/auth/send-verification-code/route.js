// app/api/auth/send-verification-code/route.js
import { NextResponse } from 'next/server';
import { getMongoClient } from '@/core/db/adapters/mongodb/index.js';
import { resolveSite } from '@/core/sites/resolve';
import { getSiteInfo } from '@/core/utils/getSiteInfo';
import { getAllSettings } from '@/core/sites/files';
import { sendVerificationCode } from '@/core/services/email';
import { checkAuthRateLimit } from '@/core/auth/rateLimit';

export async function POST(request) {
  // Rate limit check
  const rateLimitError = checkAuthRateLimit(request, { type: 'auth' });
  if (rateLimitError) return rateLimitError;

  try {
    const { email, type, userId } = await request.json();

    if (!email || !type) {
      return NextResponse.json(
        { error: 'Email and type are required' },
        { status: 400 }
      );
    }

    // Get domain from request
    const { host: domain } = await resolveSite(request);

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store verification code in database
    const client = await getMongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.MONGODB_DB_NAME || 'jasonjs_universal');

    await db.collection('verification_codes').insertOne({
      email: email.toLowerCase(),
      code,
      type, // 'registration', 'login', 'password-reset'
      userId,
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

    const emailResult = await sendVerificationCode(email, code, type, siteConfig, domain);
    if (!emailResult.success && !emailResult.fallbackLogged) {
      console.error('Failed to send verification email and no fallback logged');
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
      emailSent: emailResult.success,
      // In development, return the code for testing
      ...(process.env.NODE_ENV === 'development' && { code })
    });

  } catch (error) {
    console.error('Error sending verification code:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}