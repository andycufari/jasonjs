// POST /api/addons/booking-calendar/connections/disconnect
// Body: { id: string }

import { NextResponse } from 'next/server';
import { revokeRefreshToken } from '../../../lib/googleClient.js';

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
    const result = await connections.fetch({ filters: { _id: id, userId }, limit: 1 });
    const row = Array.isArray(result) ? result[0] : (result?.data?.[0] || null);
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Best-effort revoke on Google's side (ignore failure).
    await revokeRefreshToken(row.refreshToken);

    await connections.delete(row._id || row.id);

    // If we just deleted the primary, promote another connection if any.
    if (row.isPrimary) {
      const remaining = await connections.fetch({ filters: { userId }, sort: { createdAt: 'asc' }, limit: 1 });
      const next = Array.isArray(remaining) ? remaining[0] : (remaining?.data?.[0] || null);
      if (next) {
        await connections.update(next._id || next.id, { isPrimary: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[booking-calendar] connections/disconnect error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
