// GET /api/addons/booking-calendar/slots?userId=<host>&fromUtc=<iso>&toUtc=<iso>&meetingType=default
// Public. Rate-limited per IP and per target host.

import { NextResponse } from 'next/server';
import { createCache } from '../../../../core/utils/cache.js';
import { getClientIp } from '../../../../core/utils/getClientIp.js';
import { loadBookingEnv } from '../../lib/env.js';
import { fetchAllBusy } from '../../lib/googleClient.js';
import { computeAvailableSlots } from '../../lib/slotEngine.js';
import { fetchRules, isBookable, fetchActiveBookings } from '../../lib/meetingTypes.js';

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

    const rules = await fetchRules(database, userId, meetingType);
    if (!isBookable(rules)) {
      return NextResponse.json({ slots: [], reason: 'not_found' }, { status: 404 });
    }

    // Fetch all host connections.
    const connResult = await database.use('bc_connections').fetch({ filters: { userId } });
    const connections = Array.isArray(connResult) ? connResult : (connResult?.data || []);
    if (connections.length === 0) {
      return NextResponse.json({ slots: [], reason: 'no_connections' });
    }

    const env = await loadBookingEnv(domain);
    const busy = await fetchAllBusy({ database, connections, env, fromUtc, toUtc });

    // Bookings of ANY meeting type hold their time — defense-in-depth on top of freebusy.
    const existingBookings = (await fetchActiveBookings(database, userId))
      .filter(b => new Date(b.startUtc) < new Date(toUtc) && new Date(b.endUtc) > new Date(fromUtc));

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
    if (err.code === 'CALENDAR_UNAVAILABLE') {
      return NextResponse.json({ slots: [], reason: 'calendar_unavailable' }, { status: 503 });
    }
    if (err.code === 'ADDON_ENV_MISSING') {
      return NextResponse.json({ error: 'Addon not configured', missing: err.missing }, { status: 503 });
    }
    console.error('[booking-calendar] slots error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
