// POST /api/addons/booking-calendar/google/url
// Build the Google authorization URL + cache state.

import { NextResponse } from 'next/server';
import { createCache, CacheTTL } from '../../../../../core/utils/cache.js';
import { makeOAuth2Client } from '../../../lib/googleClient.js';
import { issueState, cacheKeyFor, STATE_TTL_SECONDS } from '../../../lib/oauthState.js';
import { loadBookingEnv } from '../../../lib/env.js';

const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
];

const stateCache = createCache('BookingOAuthState', {
  ttl: STATE_TTL_SECONDS * 1000,
  respectDevMode: false,
  maxSize: 10000,
  keyPrefix: 'bc:oauth',
});

export async function POST(request) {
  try {
    const { session, domain } = request.addonContext;
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id || session.user.email;

    const body = await request.json().catch(() => ({}));
    const label = typeof body.label === 'string' && body.label.length <= 64
      ? body.label
      : 'Google account';

    const env = await loadBookingEnv(domain);
    const { state, nonce } = issueState(userId, label, env.BOOKING_CALENDAR_STATE_SECRET);

    // Bind state to a single-use cache entry so the callback can verify it's fresh.
    await stateCache.set(cacheKeyFor(nonce), { userId, label, issuedAt: Date.now() }, STATE_TTL_SECONDS * 1000);

    const client = makeOAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    });

    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: OAUTH_SCOPES,
      state,
      include_granted_scopes: true,
    });

    return NextResponse.json({ url });
  } catch (err) {
    if (err.code === 'ADDON_ENV_MISSING') {
      return NextResponse.json(
        { error: 'Addon not configured', missing: err.missing },
        { status: 503 }
      );
    }
    console.error('[booking-calendar] google/url error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export { stateCache };
