// GET /api/addons/booking-calendar/bookings/status?id=<bookingId>&s=<statusToken>
// Public, for the guest coming back from checkout: has the payment confirmed the booking?
// Needs the booking's statusToken too — only the payer has it (it's in the return URL).
// Bookings made before statusToken existed match their Stripe session id instead.

import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { database } = request.addonContext;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const sessionId = searchParams.get('s');
    if (!id || !sessionId) {
      return NextResponse.json({ error: 'id and s required' }, { status: 400 });
    }

    const result = await database.use('bc_bookings').fetch({ filters: { _id: id }, limit: 1 });
    const row = Array.isArray(result) ? result[0] : (result?.data?.[0] || null);
    const proof = row?.statusToken || row?.stripeSessionId;
    if (!proof || proof !== sessionId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: row.status,
      startUtc: row.startUtc,
      guestEmail: row.guestEmail,
      meetLink: row.status === 'confirmed' ? row.meetLink || null : null,
    });
  } catch (err) {
    console.error('[booking-calendar] bookings/status error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
