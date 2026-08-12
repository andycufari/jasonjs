// GET /api/addons/booking-calendar/slots?userId=<host>&fromUtc=<iso>&toUtc=<iso>&meetingType=default
// Public. Rate-limited per IP and per target host.

import { NextResponse } from 'next/server';
import { createCache } from '../../../../core/utils/cache.js';
import { getClientIp } from '../../../../core/utils/getClientIp.js';
import { loadBookingEnv } from '../../lib/env.js';
import { makeCalendarForConnection, fetchConnectionBusy } from '../../lib/googleClient.js';
import { computeAvailableSlots } from '../../lib/slotEngine.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_PER_MINUTE_PER_IP = 30;
const MAX_PER_DAY_PER_HOST = 200;

const rateLimitCache = createCache('BookingSlotsRateLimit', {
  ttl: WINDOW_MS,
  respectDevMode: false,
  maxSize: 50000,
  keyPrefix: 'bc:rl',
});

export async function GET(request) {
  try {
    const { database, domain } = request.addonContext;
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get('userId');
    const fromUtc = searchParams.get('fromUtc');
    const toUtc = searchParams.get('toUtc');
    const meetingType = searchParams.get('meetingType') || 'default';

    if (!userId || !fromUtc || !toUtc) {
      return NextResponse.json({ error: 'userId, fromUtc, toUtc required' }, { status: 400 });
    }
    if (new Date(fromUtc) >= new Date(toUtc)) {
      return NextResponse.json({ error: 'fromUtc must be before toUtc' }, { status: 400 });
    }

    // Rate limiting (IP + host target).
    const ip = getClientIp(request) || 'unknown';
    const ipKey = `ip:${ip}:m:${Math.floor(Date.now() / 60000)}`;
    const hostKey = `host:${userId}:d:${Math.floor(Date.now() / WINDOW_MS)}`;
    const ipCount = ((await rateLimitCache.get(ipKey, false)) || 0) + 1;
    const hostCount = ((await rateLimitCache.get(hostKey, false)) || 0) + 1;
    await rateLimitCache.set(ipKey, ipCount, 60 * 1000);
    await rateLimitCache.set(hostKey, hostCount, WINDOW_MS);
    if (ipCount > MAX_PER_MINUTE_PER_IP || hostCount > MAX_PER_DAY_PER_HOST) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    // Fetch rules (may not exist — return empty slots if so).
    const rulesResult = await database.use('bc_availability_rules').fetch({
      filters: { userId, meetingType },
      limit: 1,
    });
    const rules = Array.isArray(rulesResult) ? rulesResult[0] : (rulesResult?.data?.[0] || null);
    if (!rules) {
      return NextResponse.json({ slots: [], reason: 'no_availability' });
    }

    // Fetch all host connections.
    const connResult = await database.use('bc_connections').fetch({ filters: { userId } });
    const connections = Array.isArray(connResult) ? connResult : (connResult?.data || []);
    if (connections.length === 0) {
      return NextResponse.json({ slots: [], reason: 'no_connections' });
    }

    // Fan-out freebusy queries across all connections.
    const env = await loadBookingEnv(domain);
    const busyArrays = await Promise.all(
      connections.map(async (conn) => {
        try {
          const { calendar } = makeCalendarForConnection({
            database,
            connection: conn,
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            redirectUri: env.GOOGLE_REDIRECT_URI,
          });
          return await fetchConnectionBusy({ calendar, connection: conn, fromUtc, toUtc });
        } catch (err) {
          console.warn(`[booking-calendar] freebusy failed for connection ${conn._id || conn.id}:`, err.message);
          return [];
        }
      })
    );
    const busy = busyArrays.flat();

    // Pull confirmed bookings in the window for defense-in-depth.
    const bookingsResult = await database.use('bc_bookings').fetch({
      filters: { userId, status: 'confirmed' },
      limit: 500,
    });
    const bookingsRaw = Array.isArray(bookingsResult) ? bookingsResult : (bookingsResult?.data || []);
    const existingBookings = bookingsRaw
      .filter(b => b.startUtc && b.endUtc)
      .filter(b => new Date(b.startUtc) < new Date(toUtc) && new Date(b.endUtc) > new Date(fromUtc))
      .map(b => ({ startUtc: new Date(b.startUtc).toISOString(), endUtc: new Date(b.endUtc).toISOString() }));

    const slots = computeAvailableSlots({
      rules,
      fromUtc,
      toUtc,
      busy,
      existingBookings,
      nowUtc: new Date().toISOString(),
    });

    return NextResponse.json({ slots, timezone: rules.timezone, duration: rules.durationMinutes });
  } catch (err) {
    if (err.code === 'ADDON_ENV_MISSING') {
      return NextResponse.json({ error: 'Addon not configured', missing: err.missing }, { status: 503 });
    }
    console.error('[booking-calendar] slots error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
