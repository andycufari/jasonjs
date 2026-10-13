// GET /api/addons/booking-calendar/types/public?userId=<host>[&meetingType=<code>]
// Public: the host's active meeting types, only the fields a visitor may see.
// With meetingType, returns that one type (404 if missing or switched off).

import { NextResponse } from 'next/server';
import { isBookable, publicType } from '../../../lib/meetingTypes.js';

export async function GET(request) {
  try {
    const { database } = request.addonContext;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const meetingType = searchParams.get('meetingType');
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const filters = meetingType ? { userId, meetingType } : { userId };
    const result = await database.use('bc_availability_rules').fetch({ filters });
    const types = (Array.isArray(result) ? result : (result?.data || []))
      .filter(isBookable)
      .map(publicType)
      .sort((a, b) => a.order - b.order);

    if (meetingType) {
      if (types.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ type: types[0] });
    }
    return NextResponse.json({ types });
  } catch (err) {
    console.error('[booking-calendar] types/public error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
