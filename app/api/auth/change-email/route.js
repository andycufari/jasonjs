// app/api/auth/change-email/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createAuthOptions } from '@/core/auth/options';
import { getUserByEmail, validateEmail, updateUser } from '@/core/auth/lib';
import { getMongoClient } from '@/core/db/adapters/mongodb/index.js';
import { resolveSite } from '@/core/sites/resolve';
import { getSite, getAllSettings } from '@/core/sites/files';
import { getSiteInfo } from '@/core/utils/getSiteInfo';
import { getEmailService } from '@/core/services/email';
import { checkAuthRateLimit } from '@/core/auth/rateLimit';

// POST: Request email change (sends verification to new email)
export async function POST(request) {
  // Rate limit check
  const rateLimitError = checkAuthRateLimit(request, { type: 'auth' });
  if (rateLimitError) return rateLimitError;

  try {
    // Get current session
    const authOptions = await createAuthOptions();
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { newEmail } = await request.json();

    if (!newEmail) {
      return NextResponse.json(
        { error: 'New email address is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailValidation = validateEmail(newEmail);
    if (!emailValidation.isValid) {
      return NextResponse.json(
        { error: emailValidation.errors[0] },
        { status: 400 }
      );
    }

    const normalizedEmail = newEmail.toLowerCase();

    // Check if same as current email
    if (normalizedEmail === session.user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'New email must be different from current email' },
        { status: 400 }
      );
    }

    // Get domain and siteId
    const { host: domain } = await resolveSite(request);
    let siteId = null;

    if (domain) {
      try {
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

    // Check if new email is already in use
    const existingUser = await getUserByEmail(normalizedEmail, siteId);
    if (existingUser) {
      return NextResponse.json(
        { error: 'This email address is already in use' },
        { status: 400 }
      );
    }

    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store email change request
    const client = await getMongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.MONGODB_DB_NAME || 'jasonjs_universal');

    // Remove any existing email change requests for this user
    await db.collection('email_change_requests').deleteMany({
      userId: session.user.id,
      siteId
    });

    // Insert new request
    await db.collection('email_change_requests').insertOne({
      userId: session.user.id,
      currentEmail: session.user.email.toLowerCase(),
      newEmail: normalizedEmail,
      code,
      siteId,
      expiresAt,
      verified: false,
      createdAt: new Date()
    });

    // Get site info for email branding
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

    // Send verification email to new address
    const emailService = getEmailService();

    try {
      await emailService.send(domain, {
        to: normalizedEmail,
        subject: `Verify your new email for ${siteName}`,
        template: 'auto',
        title: 'Verify Email Change',
        body: `
          <p>Hi ${session.user.name || 'there'},</p>
          <p>You requested to change your email address for your ${siteName} account to this email.</p>
          <p>Enter this verification code to confirm the change:</p>
          <div style="background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 4px; color: #1a1a1a;">
              ${code}
            </div>
          </div>
          <p><strong>This code expires in 15 minutes.</strong></p>
          <p>If you didn't request this change, please ignore this email or contact support if you're concerned about your account security.</p>
        `,
        footerText: siteName
      });
    } catch (emailError) {
      console.error('Failed to send email change verification:', emailError);
      console.log(`[EMAIL CHANGE] Code for ${normalizedEmail}: ${code}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your new email address',
      // In development, return the code for testing
      ...(process.env.NODE_ENV === 'development' && { code })
    });

  } catch (error) {
    console.error('Error in change-email request:', error);
    return NextResponse.json(
      { error: 'Failed to process email change request' },
      { status: 500 }
    );
  }
}

// PUT: Verify code and complete email change
export async function PUT(request) {
  // Rate limit check
  const rateLimitError = checkAuthRateLimit(request, { type: 'verification', maxAttempts: 5 });
  if (rateLimitError) return rateLimitError;

  try {
    // Get current session
    const authOptions = await createAuthOptions();
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      );
    }

    // Get domain and siteId
    const { host: domain } = await resolveSite(request);
    let siteId = null;

    if (domain) {
      try {
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

    // Find pending email change request
    const client = await getMongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.MONGODB_DB_NAME || 'jasonjs_universal');

    const changeRequest = await db.collection('email_change_requests').findOne({
      userId: session.user.id,
      siteId,
      code,
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!changeRequest) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    // Double-check new email isn't taken (race condition protection)
    const existingUser = await getUserByEmail(changeRequest.newEmail, siteId);
    if (existingUser && existingUser.id !== session.user.id) {
      await db.collection('email_change_requests').deleteOne({ _id: changeRequest._id });
      return NextResponse.json(
        { error: 'This email address is no longer available' },
        { status: 400 }
      );
    }

    // Update user email
    const updated = await updateUser(session.user.id, {
      email: changeRequest.newEmail,
      emailVerified: new Date() // Mark as verified since we just verified it
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update email' },
        { status: 500 }
      );
    }

    // Mark request as completed
    await db.collection('email_change_requests').updateOne(
      { _id: changeRequest._id },
      { $set: { verified: true, completedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      message: 'Email address updated successfully. Please sign in again with your new email.',
      newEmail: changeRequest.newEmail,
      requiresReauth: true
    });

  } catch (error) {
    console.error('Error completing email change:', error);
    return NextResponse.json(
      { error: 'Failed to complete email change' },
      { status: 500 }
    );
  }
}
