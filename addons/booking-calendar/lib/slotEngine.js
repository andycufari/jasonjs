// Pure slot-computation engine. No I/O. No luxon in the arguments —
// callers feed ISO strings and a rules object, slotEngine returns UTC ISO slot tuples.
//
// This is the core of booking-calendar. It's a pure function so we can unit-test
// every edge case (DST, buffer overlap, multi-calendar union, excluded dates)
// without mocking Google.

import {
  DateTime,
  zonedDateTime,
  zonedFromWallClock,
  addMinutes,
  weekdayKey,
  ymd,
  eachDayBetween,
} from './timezones.js';

/**
 * Compute free slots.
 *
 * @param {Object} args
 * @param {Object} args.rules          bc_availability_rules doc
 * @param {string} args.fromUtc        window start (ISO UTC)
 * @param {string} args.toUtc          window end   (ISO UTC)
 * @param {Array}  args.busy           flat [{start, end}] across all connections (ISO UTC)
 * @param {Array}  args.existingBookings  [{startUtc, endUtc}] confirmed host bookings
 * @param {string} args.nowUtc         current time (ISO UTC) — passed in so tests are deterministic
 * @returns {Array<{startUtc: string, endUtc: string}>}
 */
export function computeAvailableSlots({
  rules,
  fromUtc,
  toUtc,
  busy = [],
  existingBookings = [],
  nowUtc,
}) {
  if (!rules) return [];
  const zone = rules.timezone || 'UTC';
  const duration = rules.durationMinutes || 30;
  const granularity = rules.slotGranularityMin || 15;
  const bufferBefore = rules.bufferBeforeMin || 0;
  const bufferAfter = rules.bufferAfterMin || 0;
  const minNoticeHours = rules.minNoticeHours || 0;
  const maxAdvanceDays = rules.maxAdvanceDays || 365;
  const excludedDates = new Set(rules.excludedDates || []);
  const weeklyHours = rules.weeklyHours || {};

  const now = zonedDateTime(nowUtc, 'UTC');
  const windowStartUtc = zonedDateTime(fromUtc, 'UTC');
  const windowEndUtc = zonedDateTime(toUtc, 'UTC');
  const windowStart = windowStartUtc.setZone(zone);
  const windowEnd = windowEndUtc.setZone(zone);
  const earliestAllowed = now.plus({ hours: minNoticeHours });
  const latestAllowed = now.plus({ days: maxAdvanceDays });

  // Normalize busy and bookings to epoch millis for fast overlap checks.
  const busyIntervals = busy
    .map(b => toInterval(b.start, b.end))
    .filter(Boolean)
    .sort((a, b) => a.startMs - b.startMs);

  const bookingIntervals = existingBookings
    .map(b => toInterval(b.startUtc, b.endUtc))
    .filter(Boolean);

  const candidates = [];

  for (const day of eachDayBetween(windowStart, windowEnd)) {
    const dayYmd = ymd(day);
    if (excludedDates.has(dayYmd)) continue;
    const ranges = weeklyHours[weekdayKey(day)] || [];
    for (const range of ranges) {
      if (!range || !range.start || !range.end) continue;
      const rangeStart = zonedFromWallClock(dayYmd, range.start, zone);
      const rangeEnd = zonedFromWallClock(dayYmd, range.end, zone);
      if (!rangeStart.isValid || !rangeEnd.isValid) continue;

      let cursor = rangeStart;
      // Emit slots of `duration` length stepping by `granularity`,
      // ensuring slot+duration fits within the range.
      while (addMinutes(cursor, duration) <= rangeEnd) {
        const slotStart = cursor.toUTC();
        const slotEnd = addMinutes(cursor, duration).toUTC();

        // Drop slots outside the requested UTC window.
        if (slotStart < windowStartUtc) {
          cursor = addMinutes(cursor, granularity);
          continue;
        }
        if (slotStart >= windowEndUtc) break;

        // Drop slots earlier than min-notice or later than max-advance.
        if (slotStart < earliestAllowed.toUTC()) {
          cursor = addMinutes(cursor, granularity);
          continue;
        }
        if (slotStart > latestAllowed.toUTC()) break;

        const guardStartMs = slotStart.toMillis() - bufferBefore * 60 * 1000;
        const guardEndMs = slotEnd.toMillis() + bufferAfter * 60 * 1000;

        if (!intersectsAny(guardStartMs, guardEndMs, busyIntervals) &&
            !intersectsAny(guardStartMs, guardEndMs, bookingIntervals)) {
          candidates.push({
            startUtc: slotStart.toISO({ suppressMilliseconds: true }),
            endUtc: slotEnd.toISO({ suppressMilliseconds: true }),
          });
        }
        cursor = addMinutes(cursor, granularity);
      }
    }
  }

  candidates.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return candidates;
}

/**
 * True if a candidate slot (guarded by buffers) matches a given startUtc —
 * used by createBooking to verify a slot is still free before writing.
 */
export function isSlotStillAvailable({
  rules,
  targetStartUtc,
  busy = [],
  existingBookings = [],
  nowUtc,
}) {
  const duration = rules.durationMinutes || 30;
  const target = DateTime.fromISO(targetStartUtc, { zone: 'UTC' });
  if (!target.isValid) return false;
  // Re-run slot computation for a tight window around the target to confirm it was offered.
  const pad = Math.max(duration, 60);
  const fromUtc = target.minus({ minutes: pad }).toISO();
  const toUtc = target.plus({ minutes: pad + duration }).toISO();
  const slots = computeAvailableSlots({
    rules,
    fromUtc,
    toUtc,
    busy,
    existingBookings,
    nowUtc,
  });
  return slots.some(s => s.startUtc === target.toISO({ suppressMilliseconds: true }));
}

// --- helpers ---

function toInterval(startIso, endIso) {
  const s = DateTime.fromISO(startIso, { zone: 'UTC' });
  const e = DateTime.fromISO(endIso, { zone: 'UTC' });
  if (!s.isValid || !e.isValid) return null;
  return { startMs: s.toMillis(), endMs: e.toMillis() };
}

function intersectsAny(startMs, endMs, intervals) {
  for (const iv of intervals) {
    // Half-open intersection: [start, end) overlaps [iv.start, iv.end)
    if (startMs < iv.endMs && endMs > iv.startMs) return true;
  }
  return false;
}
