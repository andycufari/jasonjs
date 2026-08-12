// app/api/auth/reset-password/route.js
import { NextResponse } from 'next/server';
import { updatePassword, validatePassword } from '@/core/auth/lib';
import { getMongoClient } from '@/core/db/adapters/mongodb/index.js';
import { resolveSite } from '@/core/sites/resolve';
import { getSite } from '@/core/sites/files';
import { checkAuthRateLimit } from '@/core/auth/rateLimit';
import crypto from 'crypto';

export async function POST(request) {
  // Rate limit check
  const rateLimitError = checkAuthRateLimit(request, { type: 'auth' });
  if (rateLimitError) return rateLimitError;

  try {
    const { token, password } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: passwordValidation.errors[0] },
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
        console.error('Error getting site for password reset:', error);
      }
    }

    if (!siteId) {
      siteId = domain;
    }

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid reset token
    const client = await getMongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.MONGODB_DB_NAME || 'jasonjs_universal');

    const resetToken = await db.collection('password_reset_tokens').findOne({
      tokenHash,
      siteId,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token. Please request a new password reset.' },
        { status: 400 }
      );
    }

    // Update user password
    const passwordUpdated = await updatePassword(resetToken.userId, password);

    if (!passwordUpdated) {
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Mark token as used
    await db.collection('password_reset_tokens').updateOne(
      { _id: resetToken._id },
      { $set: { used: true, usedAt: new Date() } }
    );

    // Invalidate all other reset tokens for this user
    await db.collection('password_reset_tokens').updateMany(
      { userId: resetToken.userId, siteId, _id: { $ne: resetToken._id } },
      { $set: { used: true, usedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });

  } catch (error) {
    console.error('Error in reset-password:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}

// GET endpoint to verify token is valid (for UI to show appropriate message)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Get domain and resolve to proper siteId
    const { host: domain } = await resolveSite(request);
    let siteId = null;

    if (domain) {
      try {
        const { getSite } = await import('@/core/sites/files');
        const site = await getSite(domain);
        if (site && site._id) {
          siteId = typeof site._id === 'string' ? site._id : site._id.toString();
        }
      } catch (error) {
        console.error('Error getting site:', error);
      }
    }

    if (!siteId) {
      siteId = domain;
    }

    // Hash the token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Check if token exists and is valid
    const client = await getMongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.MONGODB_DB_NAME || 'jasonjs_universal');

    const resetToken = await db.collection('password_reset_tokens').findOne({
      tokenHash,
      siteId,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetToken) {
      return NextResponse.json({
        valid: false,
        error: 'This reset link is invalid or has expired. Please request a new password reset.'
      });
    }

    return NextResponse.json({
      valid: true,
      email: resetToken.email
    });

  } catch (error) {
    console.error('Error validating reset token:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate token' },
      { status: 500 }
    );
  }
}
