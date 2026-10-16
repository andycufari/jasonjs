// GET /api/addons/booking-calendar/types/public?[userId=<host>][&meetingType=<code>]
// Public: the host's active meeting types, only the fields a visitor may see.
// With meetingType, returns that one type (404 if missing or switched off).
// Each paid type lists `providers`: how it can be paid on this site (stripe, mercadopago).
// Without userId: the site's only host (see resolveHostUserId).

import { NextResponse } from 'next/server';
import { isBookable, publicType, resolveHostUserId } from '../../../lib/meetingTypes.js';
import { configuredProviders, payableProviders } from '../../../lib/payments.js';

export async function GET(request) {
  try {
    const { database, domain } = request.addonContext;
    const { searchParams } = new URL(request.url);
    const meetingType = searchParams.get('meetingType');
    const userId = await resolveHostUserId(database, searchParams.get('userId'));
    if (!userId) {
      // No host yet (nothing configured) or several (the page must pick one).
      if (meetingType) return NextResponse.json({ error: 'not_found' }, { status: 404 });
      return NextResponse.json({ types: [] });
    }

    const filters = meetingType ? { userId, meetingType } : { userId };
    const result = await database.use('bc_availability_rules').fetch({ filters });
    const configured = await configuredProviders(domain);
    const types = (Array.isArray(result) ? result : (result?.data || []))
      .filter(isBookable)
      .map(rules => ({ ...publicType(rules), providers: payableProviders(rules, configured) }))
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
