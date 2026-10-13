// GET /api/addons/booking-calendar/bookings/lookup?token=<cancelToken>
// Public, for the guest's cancel view: which meeting the link is for. Only the holder of
// the cancel link has the token.

import { NextResponse } from 'next/server';
import { fetchRules } from '../../../lib/meetingTypes.js';

export async function GET(request) {
  try {
    const { database } = request.addonContext;
    const token = new URL(request.url).searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

    const result = await database.use('bc_bookings').fetch({ filters: { cancelToken: token }, limit: 1 });
    const row = Array.isArray(result) ? result[0] : (result?.data?.[0] || null);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const rules = await fetchRules(database, row.userId, row.meetingType).catch(() => null);
    return NextResponse.json({
      status: row.status,
      meetingType: row.meetingType,
      name: rules?.name || { es: row.meetingType, en: '' },
      startUtc: row.startUtc,
      endUtc: rules?.showDuration === false ? null : row.endUtc,
      guestName: row.guestName,
      paid: !!row.paymentId,
      amountCents: row.amountCents || 0,
      currency: row.currency || null,
    });
  } catch (err) {
    console.error('[booking-calendar] bookings/lookup error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
