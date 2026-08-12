// app/api/auth/profile/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  updateUser,
  updatePassword,
  updateUserCustomField,
  getUserCustomField,
  deleteUserCustomField,
  validatePassword,
  validateUsername,
  validateEmail,
  getUserByUsername,
  getUserByEmail
} from '@/core/auth/lib';
import { getPage } from '@/core/sites/files';
import { createAuthOptions } from '@/core/auth/options';
import { createErrorResponse } from '@/core/utils/apiError';
import { resolveSite } from '@/core/sites/resolve';

// Get user profile
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

    // Return user profile (sensitive data already filtered in session callback)
    return NextResponse.json({
      user: session.user
    });

  } catch (error) {
    return createErrorResponse(error, { context: 'auth-profile' });
  }
}

// Update user profile
export async function PUT(request) {
  try {
    const { username, email, name, image, currentPassword, newPassword, ...customFields } = await request.json();
    
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

    const userId = session.user.id;
    const startupId = session.user.startupId;
    const errors = [];

    // Validate username if provided
    if (username && username !== session.user.username) {
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.isValid) {
        errors.push(...usernameValidation.errors);
      } else {
        // Check if username is already taken
        const existingUser = await getUserByUsername(username, startupId);
        if (existingUser && existingUser.id !== userId) {
          errors.push('Username already taken');
        }
      }
    }

    // Validate email if provided
    if (email && email !== session.user.email) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        errors.push(...emailValidation.errors);
      } else {
        // Check if email is already taken
        const existingUser = await getUserByEmail(email, startupId);
        if (existingUser && existingUser.id !== userId) {
          errors.push('Email already taken');
        }
      }
    }

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        errors.push('Current password is required to change password');
      } else {
        // Validate new password
        const { settings } = pageData.auth_config || {};
        const passwordPolicy = settings?.registration?.passwordPolicy || {};
        const passwordValidation = validatePassword(newPassword, passwordPolicy);
        if (!passwordValidation.isValid) {
          errors.push(...passwordValidation.errors);
        }

        // TODO: Verify current password (would need to get user with password from DB)
        // For now, we'll trust the current password verification to NextAuth
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData = {};

    if (username && username !== session.user.username) {
      updateData.username = username.toLowerCase();
    }

    if (email && email !== session.user.email) {
      updateData.email = email.toLowerCase();
      updateData.emailVerified = false; // Require re-verification for new email
    }

    if (name !== undefined) {
      updateData.name = name;
    }

    // Handle profile image
    if (image !== undefined) {
      updateData.image = image;
    }

    // Handle custom fields - store in customFields object
    if (Object.keys(customFields).length > 0) {
      // Merge with existing customFields using dot notation for MongoDB
      Object.keys(customFields).forEach(key => {
        updateData[`customFields.${key}`] = customFields[key];
      });
    }

    // Update user profile
    let updatedUser = null;
    if (Object.keys(updateData).length > 0) {
      updatedUser = await updateUser(userId, updateData);
    }

    // Update password separately if provided
    if (newPassword) {
      const passwordUpdated = await updatePassword(userId, newPassword);
      if (!passwordUpdated) {
        return NextResponse.json(
          { error: 'Failed to update password' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser || session.user
    });

  } catch (error) {
    return createErrorResponse(error, { context: 'auth-profile' });
  }
}

// Update single custom field (PATCH)
export async function PATCH(request) {
  try {
    const { field, value, action = 'set' } = await request.json();

    if (!field) {
      return NextResponse.json(
        { error: 'Field name is required' },
        { status: 400 }
      );
    }

    // Get site configuration
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

    const userId = session.user.id;

    // Handle different actions
    if (action === 'delete') {
      const success = await deleteUserCustomField(userId, field);
      if (!success) {
        return NextResponse.json(
          { error: 'Failed to delete field' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        message: `Field '${field}' deleted successfully`
      });
    }

    if (action === 'get') {
      const fieldValue = await getUserCustomField(userId, field);
      return NextResponse.json({
        field,
        value: fieldValue
      });
    }

    // Default action: set
    const updatedUser = await updateUserCustomField(userId, field, value);
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Failed to update field' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Field '${field}' updated successfully`,
      customFields: updatedUser.customFields
    });

  } catch (error) {
    return createErrorResponse(error, { context: 'auth-profile' });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}