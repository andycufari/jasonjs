// GET /api/addons/booking-calendar/types/list
// Host: every meeting type of the current user, active or not, full rows.

import { NextResponse } from 'next/server';
import { idOf } from '../../../lib/db.js';

export async function GET(request) {
  try {
    const { database, session } = request.addonContext;
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id || session.user.email;

    const result = await database.use('bc_availability_rules').fetch({ filters: { userId } });
    const rows = (Array.isArray(result) ? result : (result?.data || []))
      .map(r => ({ ...r, id: idOf(r) }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    return NextResponse.json({ types: rows });
  } catch (err) {
    console.error('[booking-calendar] types/list error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
