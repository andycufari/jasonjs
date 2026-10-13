// GET /api/addons/booking-calendar/bookings/status?id=<bookingId>&s=<stripeSessionId>
// Public, for the guest coming back from checkout: has the payment confirmed the booking?
// Needs the Stripe session id too — only the payer has it (Stripe puts it in the return URL).

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
    if (!row || !row.stripeSessionId || row.stripeSessionId !== sessionId) {
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
