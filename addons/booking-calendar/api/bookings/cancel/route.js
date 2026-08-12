// Cancel a booking. Two auth paths:
//   1. Host authenticated session (POST with {id}).
//   2. Guest with cancelToken (GET with ?token=..., or POST with {token}).
// Deletes the Google event, marks the booking cancelled, returns 200.

import { NextResponse } from 'next/server';
import { loadBookingEnv } from '../../../lib/env.js';
import { makeCalendarForConnection, deleteEvent } from '../../../lib/googleClient.js';

async function handle(request, params) {
  try {
    const { database, session, domain } = request.addonContext;
    const bookings = database.use('bc_bookings');

    let row = null;
    if (params.token) {
      const result = await bookings.fetch({ filters: { cancelToken: params.token }, limit: 1 });
      row = Array.isArray(result) ? result[0] : (result?.data?.[0] || null);
    } else if (params.id) {
      const userId = session?.user?.id || session?.user?.email;
      if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const result = await bookings.fetch({ filters: { _id: params.id, userId }, limit: 1 });
      row = Array.isArray(result) ? result[0] : (result?.data?.[0] || null);
    } else {
      return NextResponse.json({ error: 'id or token required' }, { status: 400 });
    }

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (row.status === 'cancelled') return NextResponse.json({ ok: true, alreadyCancelled: true });

    // Best-effort Google event delete — fetch the host's primary connection.
    if (row.googleEventId) {
      try {
        const env = await loadBookingEnv(domain);
        const connResult = await database.use('bc_connections').fetch({
          filters: { userId: row.userId, isPrimary: true },
          limit: 1,
        });
        const primary = Array.isArray(connResult) ? connResult[0] : (connResult?.data?.[0] || null);
        if (primary) {
          const { calendar } = makeCalendarForConnection({
            database, connection: primary,
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            redirectUri: env.GOOGLE_REDIRECT_URI,
          });
          await deleteEvent({
            calendar,
            calendarId: row.googleCalendarId || primary.writeCalendarId || 'primary',
            eventId: row.googleEventId,
          });
        }
      } catch (err) {
        console.warn('[booking-calendar] cancel: google delete failed (continuing):', err.message);
      }
    }

    await bookings.update(row._id || row.id, { status: 'cancelled' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[booking-calendar] bookings/cancel error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return handle(request, { token: searchParams.get('token') });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return handle(request, { id: body.id, token: body.token });
}
