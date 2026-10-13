// POST /api/addons/booking-calendar/connections/set-primary
// Body: { id: string }
// Makes one connection the write target — where new bookings create their event.
// Every connection keeps feeding freebusy; only the write target changes.

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

    const connections = database.use('bc_connections');
    const result = await connections.fetch({ filters: { userId } });
    const rows = Array.isArray(result) ? result : (result?.data || []);
    const target = rows.find(r => String(r._id || r.id) === id);
    if (!target) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Clear the others first: if a write fails halfway we are left with no primary
    // (bookings/create falls back to the first connection), never with two.
    for (const r of rows) {
      if (r !== target && r.isPrimary) {
        await connections.update(r._id || r.id, { isPrimary: false });
      }
    }
    if (!target.isPrimary) {
      await connections.update(target._id || target.id, { isPrimary: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[booking-calendar] connections/set-primary error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
