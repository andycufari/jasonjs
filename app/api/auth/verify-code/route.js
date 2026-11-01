// app/api/auth/verify-code/route.js
import { NextResponse } from 'next/server';
import { getMongoClient } from '@/core/db/adapters/mongodb/index.js';
import { ObjectId } from 'mongodb';
import { checkCodeVerificationLimit, resetCodeVerificationLimit } from '@/core/auth/rateLimit';
import { checkVerificationCode, clearVerificationAttempts } from '@/core/auth/codeAttempts';

export async function POST(request) {
  // Strict rate limit for code verification (prevent brute force)
  const rateLimitError = checkCodeVerificationLimit(request);
  if (rateLimitError) return rateLimitError;

  try {
    const { email, code, type } = await request.json();

    if (!email || !code || !type) {
      return NextResponse.json(
        { error: 'Email, code, and type are required' },
        { status: 400 }
      );
    }

    // Just validate the code exists and return success
    // The actual authentication will be handled by NextAuth via signIn
    const client = await getMongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.MONGODB_DB_NAME || 'jasonjs_universal');

    // Per-email attempt cap (the per-IP limit above trusts X-Forwarded-For, so it can be dodged)
    const check = await checkVerificationCode(db, { email, code, type });

    if (check.status === 'locked') {
      return NextResponse.json(
        { error: 'Too many verification attempts. Request a new code and try again later.', retryAfter: check.retryAfter },
        { status: 429, headers: { 'Retry-After': String(check.retryAfter) } }
      );
    }

    if (check.status !== 'ok') {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    // Get user details for response - lookup by email (more robust than userId)
    const user = await db.collection('users').findOne({
      email: email.toLowerCase()
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please register first.' },
        { status: 404 }
      );
    }

    // Reset rate limits on successful verification
    resetCodeVerificationLimit(request);
    await clearVerificationAttempts(db, { email, type });

    return NextResponse.json({
      success: true,
      verified: true,
      message: type === 'registration' ? 'Email verified successfully' : 'Login successful',
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        siteId: user.siteId,
        emailVerified: user.emailVerified
      },
      // Tell frontend to use NextAuth signIn
      useNextAuth: true,
      type
    });

  } catch (error) {
    console.error('Error verifying code:', error);
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    );
  }
}