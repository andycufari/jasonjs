// app/api/auth/delete-account/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createAuthOptions } from '@/core/auth/options';
import { deleteUser, verifyPassword, getUserById } from '@/core/auth/lib';
import { getMongoClient } from '@/core/db/adapters/mongodb/index.js';
import { resolveSite } from '@/core/sites/resolve';
import { getSite, getAllSettings } from '@/core/sites/files';
import { getSiteInfo } from '@/core/utils/getSiteInfo';
import { getEmailService } from '@/core/services/email';
import { checkAuthRateLimit } from '@/core/auth/rateLimit';

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

    const { confirmation, password } = await request.json();

    // Require explicit confirmation
    if (confirmation !== 'DELETE') {
      return NextResponse.json(
        { error: 'Please type DELETE to confirm account deletion' },
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

    const client = await getMongoClient(process.env.MONGODB_URI);
    const db = client.db(process.env.MONGODB_DB_NAME || 'jasonjs_universal');

    // Get user to check if they have a password (credentials auth)
    const { ObjectId } = await import('mongodb');
    const user = await db.collection('users').findOne({ _id: new ObjectId(session.user.id) });

    // If user has password auth, require password verification
    if (user?.password && password) {
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Incorrect password' },
          { status: 400 }
        );
      }
    }

    // Store deletion record for audit/recovery purposes
    const deletionRecord = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      siteId,
      deletedAt: new Date(),
      reason: 'user_requested',
      // Store minimal user data for potential recovery within grace period
      userData: {
        email: user?.email,
        name: user?.name,
        createdAt: user?.createdAt,
        role: user?.role
      }
    };

    await db.collection('deleted_accounts').insertOne(deletionRecord);

    // Clean up user-related data
    const userId = session.user.id;

    // Delete verification codes
    await db.collection('verification_codes').deleteMany({ userId, siteId });

    // Delete password reset tokens
    await db.collection('password_reset_tokens').deleteMany({ userId, siteId });

    // Delete email change requests
    await db.collection('email_change_requests').deleteMany({ userId, siteId });

    // Delete sessions (NextAuth sessions if using database adapter)
    await db.collection('sessions').deleteMany({ userId });

    // Delete the user account
    const deleted = await deleteUser(userId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      );
    }

    // Send confirmation email
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

    const emailService = getEmailService();

    try {
      await emailService.send(domain, {
        to: session.user.email,
        subject: `Your ${siteName} account has been deleted`,
        template: 'auto',
        title: 'Account Deleted',
        body: `
          <p>Hi ${session.user.name || 'there'},</p>
          <p>Your ${siteName} account has been permanently deleted as requested.</p>
          <p>All your personal data has been removed from our systems.</p>
          <p>If you didn't request this deletion, please contact our support team immediately.</p>
          <p>Thank you for being a part of ${siteName}. We hope to see you again in the future!</p>
        `,
        footerText: siteName
      });
    } catch (emailError) {
      console.error('Failed to send account deletion confirmation:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Your account has been permanently deleted.'
    });

  } catch (error) {
    console.error('Error in delete-account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
