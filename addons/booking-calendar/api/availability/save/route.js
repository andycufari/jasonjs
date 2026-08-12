// POST /api/addons/booking-calendar/availability/save
// Body: full rules object (meetingType, weeklyHours, etc.)

import { NextResponse } from 'next/server';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export async function POST(request) {
  try {
    const { database, session } = request.addonContext;
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id || session.user.email;

    const body = await request.json().catch(() => ({}));
    const validation = validate(body);
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const rules = {
      userId,
      meetingType: body.meetingType || 'default',
      durationMinutes: clampInt(body.durationMinutes, 5, 480, 30),
      bufferBeforeMin: clampInt(body.bufferBeforeMin, 0, 240, 0),
      bufferAfterMin: clampInt(body.bufferAfterMin, 0, 240, 10),
      timezone: body.timezone || 'UTC',
      weeklyHours: body.weeklyHours,
      minNoticeHours: clampInt(body.minNoticeHours, 0, 8760, 12),
      maxAdvanceDays: clampInt(body.maxAdvanceDays, 1, 365, 60),
      slotGranularityMin: clampInt(body.slotGranularityMin, 5, 120, 15),
      excludedDates: Array.isArray(body.excludedDates) ? body.excludedDates.filter(isYmd) : [],
      eventTitleTemplate: typeof body.eventTitleTemplate === 'string' && body.eventTitleTemplate.length <= 120
        ? body.eventTitleTemplate
        : '{guestName} ↔ Host',
    };

    const coll = database.use('bc_availability_rules');
    const existing = await coll.fetch({
      filters: { userId, meetingType: rules.meetingType },
      limit: 1,
    });
    const row = Array.isArray(existing) ? existing[0] : (existing?.data?.[0] || null);

    let saved;
    if (row) {
      saved = await coll.update(row._id || row.id, rules);
    } else {
      saved = await coll.add(rules);
    }

    return NextResponse.json({ rules: saved });
  } catch (err) {
    console.error('[booking-calendar] availability/save error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'body must be an object' };
  if (!body.weeklyHours || typeof body.weeklyHours !== 'object') return { error: 'weeklyHours required' };
  for (const day of WEEKDAYS) {
    const ranges = body.weeklyHours[day];
    if (ranges === undefined) continue;
    if (!Array.isArray(ranges)) return { error: `weeklyHours.${day} must be an array` };
    for (const r of ranges) {
      if (!r || typeof r !== 'object' || !isHhmm(r.start) || !isHhmm(r.end) || r.start >= r.end) {
        return { error: `weeklyHours.${day} has an invalid range` };
      }
    }
  }
  if (body.timezone !== undefined && typeof body.timezone !== 'string') {
    return { error: 'timezone must be a string' };
  }
  return { error: null };
}

function isHhmm(s) {
  return typeof s === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
}
function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function clampInt(v, min, max, def) {
  const n = typeof v === 'number' ? Math.floor(v) : parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}
