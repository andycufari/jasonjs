// GET /api/addons/booking-calendar/availability/get?meetingType=default
// Returns the authenticated user's availability rules (creates default if missing).

import { NextResponse } from 'next/server';

const DEFAULT_RULES = {
  meetingType: 'default',
  durationMinutes: 30,
  bufferBeforeMin: 0,
  bufferAfterMin: 10,
  timezone: 'America/Argentina/Buenos_Aires',
  weeklyHours: {
    mon: [{ start: '10:00', end: '13:00' }, { start: '15:00', end: '18:00' }],
    tue: [{ start: '10:00', end: '13:00' }, { start: '15:00', end: '18:00' }],
    wed: [{ start: '10:00', end: '13:00' }, { start: '15:00', end: '18:00' }],
    thu: [{ start: '10:00', end: '13:00' }, { start: '15:00', end: '18:00' }],
    fri: [{ start: '10:00', end: '13:00' }, { start: '15:00', end: '18:00' }],
    sat: [],
    sun: [],
  },
  minNoticeHours: 12,
  maxAdvanceDays: 60,
  slotGranularityMin: 15,
  excludedDates: [],
  eventTitleTemplate: '{guestName} ↔ Host',
};

export async function GET(request) {
  try {
    const { database, session } = request.addonContext;
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id || session.user.email;

    const { searchParams } = new URL(request.url);
    const meetingType = searchParams.get('meetingType') || 'default';

    const result = await database.use('bc_availability_rules').fetch({
      filters: { userId, meetingType },
      limit: 1,
    });
    const row = Array.isArray(result) ? result[0] : (result?.data?.[0] || null);

    return NextResponse.json({
      rules: row || { userId, ...DEFAULT_RULES, meetingType },
      isDefault: !row,
    });
  } catch (err) {
    console.error('[booking-calendar] availability/get error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
