// GET /api/addons/booking-calendar/google/callback
// Exchange auth code for tokens, persist connection row, redirect back to Settings.

import { NextResponse } from 'next/server';
import { createCache, CacheTTL } from '../../../../../core/utils/cache.js';
import { exchangeCodeForTokens } from '../../../lib/googleClient.js';
import { verifyState, cacheKeyFor, STATE_TTL_SECONDS } from '../../../lib/oauthState.js';
import { loadBookingEnv } from '../../../lib/env.js';

const stateCache = createCache('BookingOAuthState', {
  ttl: STATE_TTL_SECONDS * 1000,
  respectDevMode: false,
  maxSize: 10000,
  keyPrefix: 'bc:oauth',
});

export async function GET(request) {
  try {
    const { database, domain } = request.addonContext;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return redirectBack(request, { error });
    }
    if (!code || !state) {
      return redirectBack(request, { error: 'missing_code_or_state' });
    }

    const env = await loadBookingEnv(domain);
    const verified = verifyState(state, env.BOOKING_CALENDAR_STATE_SECRET);
    if (!verified) {
      return redirectBack(request, { error: 'invalid_state' });
    }

    // Cache-bound single-use check.
    const key = cacheKeyFor(verified.nonce);
    const cached = await stateCache.get(key, false);
    if (!cached) {
      return redirectBack(request, { error: 'state_expired' });
    }
    await stateCache.invalidate(key);

    const { tokens, email } = await exchangeCodeForTokens({
      code,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    });

    if (!tokens.refresh_token) {
      // Google only issues refresh_token on first consent with prompt=consent.
      // If the user had previously connected without revoking, we won't get one.
      return redirectBack(request, { error: 'no_refresh_token' });
    }

    const connections = database.use('bc_connections');

    // Dedupe by (userId, googleAccountEmail).
    const existing = await connections.fetch({
      filters: { userId: verified.userId, googleAccountEmail: email || '' },
      limit: 1,
    });
    const existingRow = Array.isArray(existing) ? existing[0] : (existing?.data?.[0] || null);

    const patch = {
      userId: verified.userId,
      label: verified.label || 'Google account',
      googleAccountEmail: email,
      scope: tokens.scope || '',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      calendarIds: ['primary'],
      writeCalendarId: 'primary',
    };

    if (existingRow) {
      await connections.update(existingRow._id || existingRow.id, patch);
    } else {
      // First connection becomes primary.
      const existingPrimary = await connections.fetch({
        filters: { userId: verified.userId, isPrimary: true },
        limit: 1,
      });
      const hasPrimary = Array.isArray(existingPrimary)
        ? existingPrimary.length > 0
        : (existingPrimary?.data?.length > 0);
      await connections.add({ ...patch, isPrimary: !hasPrimary });
    }

    return redirectBack(request, { connected: '1' });
  } catch (err) {
    if (err.code === 'ADDON_ENV_MISSING') {
      return redirectBack(request, { error: 'addon_not_configured' });
    }
    console.error('[booking-calendar] google/callback error:', err);
    return redirectBack(request, { error: 'internal' });
  }
}

function redirectBack(request, params) {
  const url = new URL('/admin/booking', request.url);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url, 302);
}
