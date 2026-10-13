// POST /api/addons/booking-calendar/types/delete
// Body: { id: string }
// Deletes a meeting type. Bookings already made for it keep working (and can be
// cancelled): they carry their own times and Google event.

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { database, session } = request.addonContext;
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id || session.user.email;

    const { id } = await request.json().catch(() => ({}));
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const coll = database.use('bc_availability_rules');
    const result = await coll.fetch({ filters: { userId } });
    const row = (Array.isArray(result) ? result : (result?.data || []))
      .find(r => String(r._id || r.id) === id);
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await coll.delete(row._id || row.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[booking-calendar] types/delete error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
