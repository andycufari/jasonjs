// app/api/auth/update-name/route.js
// Update name for existing user before authentication (edge case handling)
import { NextResponse } from 'next/server';
import { getUserByEmail, updateUser } from '@/core/auth/lib';
import { resolveSite } from '@/core/sites/resolve';
import { getSite } from '@/core/sites/files';
import { checkAuthRateLimit } from '@/core/auth/rateLimit';

export async function POST(request) {
  // Rate limit check
  const rateLimitError = checkAuthRateLimit(request, { type: 'auth' });
  if (rateLimitError) return rateLimitError;

  try {
    const { email, name, customFields } = await request.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
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

    // Validate name
    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters' },
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
        console.error('Error getting site for name update:', error);
      }
    }

    // Fallback to using domain if site not found
    if (!siteId) {
      siteId = domain;
    }

    // Check if user exists
    const user = await getUserByEmail(email.toLowerCase(), siteId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user name and custom fields
    const updateData = {
      name: name.trim(),
      ...(customFields && { customFields: { ...user.customFields, ...customFields } })
    };

    const updatedUser = await updateUser(user.id, updateData);

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Name updated successfully'
    });

  } catch (error) {
    console.error('Error updating user name:', error);
    return NextResponse.json(
      { error: 'Failed to update name' },
      { status: 500 }
    );
  }
}
