// app/api/auth/forgot-password/route.js
import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/core/auth/lib';
import { getMongoClient } from '@/core/db/adapters/mongodb/index.js';
import { resolveSite } from '@/core/sites/resolve';
import { getSite } from '@/core/sites/files';
import { getSiteInfo } from '@/core/utils/getSiteInfo';
import { getAllSettings } from '@/core/sites/files';
import { getEmailService } from '@/core/services/email';
import { checkAuthRateLimit } from '@/core/auth/rateLimit';
import crypto from 'crypto';

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
        console.error('Error getting site for password reset:', error);
      }
    }

    // Fallback to using domain if site not found
    if (!siteId) {
      siteId = domain;
    }

    // Check if user exists
    const user = await getUserByEmail(email.toLowerCase(), siteId);

    // Always return success to prevent email enumeration attacks
    // But only send email if user exists
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive reset instructions.'
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database
    const client = await getMongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.MONGODB_DB_NAME || 'jasonjs_universal');

    // Remove any existing reset tokens for this user
    await db.collection('password_reset_tokens').deleteMany({
      userId: user.id,
      siteId
    });

    // Insert new token
    await db.collection('password_reset_tokens').insertOne({
      userId: user.id,
      email: email.toLowerCase(),
      tokenHash: resetTokenHash,
      siteId,
      expiresAt,
      used: false,
      createdAt: new Date()
    });

    // Get site info for branding
    let siteInfo;
    try {
      siteInfo = await getSiteInfo(domain);
    } catch (error) {
      siteInfo = { name: 'JasonJS Framework' };
    }

    let settings = {};
    try {
      settings = await getAllSettings(domain);
    } catch (error) {
      console.log('Error loading settings:', error);
    }

    const siteName = settings.auth?.ui?.defaultName || siteInfo.name || 'JasonJS Framework';

    // Build reset URL
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const resetUrl = `${protocol}://${domain}/auth/reset-password?token=${resetToken}`;

    // Send password reset email
    const emailService = getEmailService();

    try {
      await emailService.send(domain, {
        to: email,
        subject: `Reset your password for ${siteName}`,
        template: 'auto',
        title: 'Password Reset',
        body: `
          <p>Hi ${user.name || 'there'},</p>
          <p>You requested to reset your password for your ${siteName} account.</p>
          <p>Click the button below to set a new password:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" class="email-button">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6366f1;">${resetUrl}</p>
          <p><strong>This link expires in 1 hour.</strong></p>
          <p>If you didn't request this, you can safely ignore this email. Your password won't be changed.</p>
        `,
        footerText: siteName
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Log fallback for development
      console.log(`[PASSWORD RESET] Token for ${email}: ${resetToken}`);
      console.log(`[PASSWORD RESET] URL: ${resetUrl}`);
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive reset instructions.',
      // In development, return the token for testing
      ...(process.env.NODE_ENV === 'development' && { resetToken, resetUrl })
    });

  } catch (error) {
    console.error('Error in forgot-password:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
