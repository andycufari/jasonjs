// GET /api/addons/booking-calendar/connections/list
// Returns the authenticated user's connected Google accounts.
// Strips token fields from the response (they're encrypted anyway, but don't send them over the wire).

import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { database, session } = request.addonContext;
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id || session.user.email;

    const result = await database.use('bc_connections').fetch({
      filters: { userId },
      sort: { createdAt: 'asc' },
    });
    const rows = Array.isArray(result) ? result : (result?.data || []);
    const sanitized = rows.map(r => ({
      id: r._id || r.id,
      label: r.label,
      googleAccountEmail: r.googleAccountEmail,
      calendarIds: r.calendarIds || ['primary'],
      writeCalendarId: r.writeCalendarId || 'primary',
      isPrimary: !!r.isPrimary,
      expiryAt: r.expiryAt,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ connections: sanitized });
  } catch (err) {
    console.error('[booking-calendar] connections/list error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
