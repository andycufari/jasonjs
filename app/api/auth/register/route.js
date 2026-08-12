// app/api/auth/register/route.js
import { NextResponse } from 'next/server';
import {
  createUser,
  getUserByUsername,
  getUserByEmail,
  validatePassword,
  validateUsername,
  validateEmail
} from '@/core/auth/lib';
import { getAuthConfig } from '@/core/auth/options';
import { resolveSite } from '@/core/sites/resolve';
import { getSite } from '@/core/sites/files';
import { checkAuthRateLimit } from '@/core/auth/rateLimit';
import { createErrorResponse } from '@/core/utils/apiError';

export async function POST(request) {
  // Rate limit check (prevent registration spam)
  const rateLimitError = checkAuthRateLimit(request, { type: 'auth' });
  if (rateLimitError) return rateLimitError;

  try {
    const { username, email, password, name, ...otherFields } = await request.json();

    console.log('Registration attempt:', { username, email, hasPassword: !!password, name, otherFields });

    // Get domain for multi-tenancy
    const { host: domain } = await resolveSite(request);

    // Get site object to extract proper siteId
    let siteId = null;
    if (domain) {
      try {
        const site = await getSite(domain);
        if (site && site._id) {
          siteId = typeof site._id === 'string' ? site._id : site._id.toString();
        }
      } catch (error) {
        console.error('Error getting site for registration:', error);
      }
    }

    // Fallback to using domain if site not found (for local/standalone mode)
    if (!siteId) {
      siteId = domain;
    }

    // Get the actual auth configuration from settings/auth.json
    let pageData;
    try {
      const { getSettings } = await import('@/core/sites/files');
      const authConfig = await getSettings(domain, 'auth');
      if (authConfig) {
        pageData = {
          domain: domain,
          auth: authConfig
        };
      }
    } catch (error) {
      console.error('Error loading site auth config:', error);
    }

    // Fallback to basic config if auth config not found
    if (!pageData) {
      pageData = {
        domain: domain,
        auth: {
          providers: {
            credentials: { enabled: true }
          },
          registration: {
            enabled: true
          }
        }
      };
    }

    const { settings } = await getAuthConfig(pageData);

    // Check if registration is enabled
    if (!settings.registration?.enabled) {
      return NextResponse.json(
        { error: 'Registration is currently disabled' },
        { status: 403 }
      );
    }

    // Check if this is code-based registration (passwordless)
    // Default to passwordless (code auth) - this is the zero-config default
    // Password is only required if:
    // 1. credentials.requirePassword is explicitly set to true in auth.json
    // 2. OR a password was provided in the request (user chose password auth)
    const requirePasswordExplicit = settings.providers?.credentials?.requirePassword === true;
    const isCodeAuth = !requirePasswordExplicit && !password;

    console.log('Registration mode:', { isCodeAuth, requirePasswordExplicit, hasPassword: !!password });

    // Validate core required fields (framework handles these)
    const errors = [];

    // Generate username from email if not provided
    let finalUsername = username;
    if (!username || username.trim() === '') {
      if (!email || !email.includes('@')) {
        errors.push('Email is required to generate username');
      } else {
        // Generate username from email (part before @)
        finalUsername = email.split('@')[0].toLowerCase();
        // Ensure username is valid
        finalUsername = finalUsername.replace(/[^a-z0-9_]/g, '');

        // If username is too short after cleaning, add random suffix
        if (finalUsername.length < 3) {
          finalUsername = finalUsername + Math.random().toString(36).substring(2, 5);
        }
      }
    } else {
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.isValid) {
        errors.push(...usernameValidation.errors);
      }
    }

    // Email validation (required)
    if (!email || email.trim() === '') {
      errors.push('Email is required');
    } else {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        errors.push(...emailValidation.errors);
      }
    }

    // Password validation (only required for credentials mode, not code mode)
    if (!isCodeAuth) {
      if (!password || password.trim() === '') {
        errors.push('Password is required');
      } else {
        const passwordValidation = validatePassword(password, settings.registration.passwordPolicy);
        if (!passwordValidation.isValid) {
          errors.push(...passwordValidation.errors);
        }
      }
    }

    // Build unified custom-fields list from both shapes:
    //   1. Legacy:  registration.customFields = [{ name, label, ... }, ...]
    //   2. Current: signup.fields            = { name: { label, ... }, ... }
    const legacyCustomFields = Array.isArray(settings.registration?.customFields)
      ? settings.registration.customFields
      : [];
    const signupFieldsObj = settings.signup?.fields && typeof settings.signup.fields === 'object'
      ? settings.signup.fields
      : {};
    const signupFieldsArr = Object.entries(signupFieldsObj).map(([name, config]) => ({
      name,
      ...(typeof config === 'string' ? { type: config } : config)
    }));
    // signup.fields takes priority; merge any legacy fields not already present
    const seen = new Set(signupFieldsArr.map(f => f.name));
    const customFields = [
      ...signupFieldsArr,
      ...legacyCustomFields.filter(f => !seen.has(f.name))
    ];

    console.log('[Register] customFields resolved:', JSON.stringify({
      fromRegistration: legacyCustomFields.map(f => f.name),
      fromSignup: signupFieldsArr.map(f => f.name),
      merged: customFields.map(f => f.name),
      domain
    }));

    // Helper: a value counts as "missing" if it's undefined, null, '', or [].
    const isEmpty = (v) =>
      v === undefined || v === null ||
      (typeof v === 'string' && v.trim() === '') ||
      (Array.isArray(v) && v.length === 0);

    for (const field of customFields) {
      const value = otherFields[field.name];

      if (field.required && isEmpty(value)) {
        errors.push(`${field.label || field.name} is required`);
        continue;
      }

      // Skip validation if field is not provided and not required
      if (isEmpty(value)) continue;

      // Custom field validation (only for string-shaped values)
      if (field.validation && typeof value === 'string') {
        if (field.validation.minLength && value.length < field.validation.minLength) {
          errors.push(`${field.label || field.name} must be at least ${field.validation.minLength} characters`);
        }
        if (field.validation.maxLength && value.length > field.validation.maxLength) {
          errors.push(`${field.label || field.name} must be less than ${field.validation.maxLength} characters`);
        }
        if (field.validation.pattern && !new RegExp(field.validation.pattern).test(value)) {
          errors.push(`${field.label || field.name} format is invalid`);
        }
      }
    }

    if (errors.length > 0) {
      console.error('Registration validation failed:', errors);
      return NextResponse.json(
        { error: 'Validation failed', details: errors, message: errors.join(', ') },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUserByUsername = await getUserByUsername(finalUsername, siteId);
    if (existingUserByUsername) {
      // If generated username exists, add random suffix
      if (!username) {
        finalUsername = finalUsername + Math.random().toString(36).substring(2, 5);
      } else {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 409 }
        );
      }
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingUserByEmail = await getUserByEmail(email, siteId);
      if (existingUserByEmail) {
        return NextResponse.json(
          { error: 'Email address already registered' },
          { status: 409 }
        );
      }
    }

    // Create user data object
    const userData = {
      username: finalUsername.toLowerCase(),
      email: email.toLowerCase(),
      siteId,
      role: 'user',
      roles: ['user'], // Array for multiple roles support
      emailVerified: isCodeAuth ? false : !settings.security?.requireEmailVerification
    };

    // Only add password for credentials mode, not code mode
    if (!isCodeAuth && password) {
      userData.password = password;
    }

    console.log('Creating user with siteId:', siteId, 'for domain:', domain);

    // Add name if provided
    if (name) userData.name = name;

    // Add custom fields grouped in customFields object
    const customFieldsData = {};
    for (const field of customFields) {
      const value = otherFields[field.name];
      if (value !== undefined) {
        customFieldsData[field.name] = value;
      }
    }

    // Only add customFields if there are any
    if (Object.keys(customFieldsData).length > 0) {
      userData.customFields = customFieldsData;
    }

    // Create the user
    const user = await createUser(userData);

    // 🔔 Emit auth:signup event (fire-and-forget, non-blocking)
    try {
      const { emitWorkerEvent, FRAMEWORK_EVENTS } = await import('@/core/worker/events.js');
      emitWorkerEvent({
        siteId,
        domain,
        eventName: FRAMEWORK_EVENTS.AUTH_SIGNUP,
        payload: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt
          },
          isCodeAuth,
          registrationMethod: isCodeAuth ? 'code' : 'credentials'
        },
        userId: user.id
      }).catch(err => {
        // Don't fail registration if event emission fails
        console.warn('[Auth] Failed to emit auth:signup event:', err.message);
      });
    } catch (err) {
      // Module load error - worker system might not be initialized
      console.debug('[Auth] Worker event system not available:', err.message);
    }

    // For code-based auth, send verification code and return verification needed status
    if (isCodeAuth) {
      try {
        // Build the URL from the current request to avoid hardcoding localhost
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host');
        const baseUrl = `${protocol}://${host}`;

        // Send verification code via email
        const response = await fetch(`${baseUrl}/api/auth/send-verification-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userData.email,
            type: 'registration',
            userId: user.id
          })
        });

        if (!response.ok) {
          console.error('Failed to send verification code');
          // Don't fail registration, just log the error
        }

        return NextResponse.json({
          success: true,
          requiresVerification: true,
          verificationType: 'code',
          message: 'Account created. Please check your email for verification code.',
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        }, { status: 201 });

      } catch (error) {
        console.error('Error sending verification code:', error);
        // Fall through to normal response if code sending fails
      }
    }

    // Normal registration response (with redirect)
    const responseUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt
    };

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      user: responseUser,
      redirect: settings.redirects?.afterSignUp || '/'
    }, { status: 201 });

  } catch (error) {
    // Handle specific MongoDB duplicate key errors with user-friendly messages
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const message = field === 'username' ? 'Username already exists' :
                     field === 'email' ? 'Email address already registered' :
                     'This information is already registered';

      return NextResponse.json(
        { error: message, code: 'DUPLICATE_ENTRY' },
        { status: 409 }
      );
    }

    return createErrorResponse(error, { context: 'auth-register' });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}