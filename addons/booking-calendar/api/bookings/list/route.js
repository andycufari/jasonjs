// GET /api/addons/booking-calendar/bookings/list?from=<iso>&to=<iso>&status=confirmed
// Host only. Lists their own bookings.

import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { database, session } = request.addonContext;
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id || session.user.email;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'confirmed';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

    const filters = { userId, status };
    const result = await database.use('bc_bookings').fetch({
      filters,
      sort: { startUtc: 'asc' },
      limit,
    });
    const rows = Array.isArray(result) ? result : (result?.data || []);
    // Strip cancelToken on list (only return to the owner on direct access).
    const sanitized = rows.map(({ cancelToken, ...rest }) => ({
      id: rest._id || rest.id,
      ...rest,
    }));

    return NextResponse.json({ bookings: sanitized });
  } catch (err) {
    console.error('[booking-calendar] bookings/list error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
