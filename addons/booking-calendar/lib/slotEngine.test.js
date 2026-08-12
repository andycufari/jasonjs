/**
 * Slot engine tests. No network, no DB — pure function.
 *
 * Run: node addons/booking-calendar/lib/slotEngine.test.js
 */

import { computeAvailableSlots, isSlotStillAvailable } from './slotEngine.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('✅ PASS: ' + msg); passed++; }
  else { console.error('❌ FAIL: ' + msg); failed++; }
}

function assertEqual(actual, expected, msg) {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// Baseline rules — Monday 10:00–12:00 in Buenos Aires (UTC-3, no DST).
const rulesBA = {
  timezone: 'America/Argentina/Buenos_Aires',
  durationMinutes: 30,
  slotGranularityMin: 30,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  minNoticeHours: 0,
  maxAdvanceDays: 365,
  weeklyHours: {
    mon: [{ start: '10:00', end: '12:00' }],
    tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
  },
};

console.log('\n=== baseline: Monday 10:00–12:00 BA → 4 slots ===');
{
  // Monday 2026-04-20 in BA.
  const slots = computeAvailableSlots({
    rules: rulesBA,
    fromUtc: '2026-04-20T00:00:00Z',
    toUtc: '2026-04-21T00:00:00Z',
    busy: [],
    existingBookings: [],
    nowUtc: '2026-04-19T00:00:00Z',
  });
  assertEqual(slots.length, 4, 'four 30-min slots between 10:00 and 12:00');
  // 10:00 BA == 13:00 UTC
  assertEqual(slots[0].startUtc, '2026-04-20T13:00:00Z', 'first slot at 13:00 UTC');
  assertEqual(slots[3].startUtc, '2026-04-20T14:30:00Z', 'last slot at 14:30 UTC');
}

console.log('\n=== granularity 15-min with 30-min duration ===');
{
  const rules = { ...rulesBA, slotGranularityMin: 15 };
  const slots = computeAvailableSlots({
    rules,
    fromUtc: '2026-04-20T00:00:00Z',
    toUtc: '2026-04-21T00:00:00Z',
    busy: [],
    existingBookings: [],
    nowUtc: '2026-04-19T00:00:00Z',
  });
  // 10:00, 10:15, 10:30, ..., 11:30 → 7 slots (last one starts at 11:30, ends at 12:00)
  assertEqual(slots.length, 7, 'seven 30-min slots at 15-min granularity');
}

console.log('\n=== busy interval drops overlapping slots ===');
{
  // Busy from 13:30 to 14:00 UTC kills the 10:30 BA slot.
  const slots = computeAvailableSlots({
    rules: rulesBA,
    fromUtc: '2026-04-20T00:00:00Z',
    toUtc: '2026-04-21T00:00:00Z',
    busy: [{ start: '2026-04-20T13:30:00Z', end: '2026-04-20T14:00:00Z' }],
    existingBookings: [],
    nowUtc: '2026-04-19T00:00:00Z',
  });
  assertEqual(slots.length, 3, '4 - 1 (dropped 10:30 BA) = 3 slots');
  assertEqual(slots.map(s => s.startUtc), [
    '2026-04-20T13:00:00Z',
    '2026-04-20T14:00:00Z',
    '2026-04-20T14:30:00Z',
  ], 'correct slots remain after busy interval');
}

console.log('\n=== buffer guard drops adjacent slots ===');
{
  const rules = { ...rulesBA, bufferAfterMin: 15 };
  // Busy 13:30–14:00 UTC. With 15-min after-buffer, slot 13:00 (ends 13:30) overlaps guard.
  const slots = computeAvailableSlots({
    rules,
    fromUtc: '2026-04-20T00:00:00Z',
    toUtc: '2026-04-21T00:00:00Z',
    busy: [{ start: '2026-04-20T13:30:00Z', end: '2026-04-20T14:00:00Z' }],
    existingBookings: [],
    nowUtc: '2026-04-19T00:00:00Z',
  });
  // 13:00 slot: guardEnd = 13:30 + 15min = 13:45, overlaps busy 13:30–14:00. Dropped.
  assert(!slots.some(s => s.startUtc === '2026-04-20T13:00:00Z'), '13:00 slot dropped due to after-buffer');
}

console.log('\n=== minNoticeHours excludes slots too close to now ===');
{
  const rules = { ...rulesBA, minNoticeHours: 24 };
  const slots = computeAvailableSlots({
    rules,
    fromUtc: '2026-04-20T00:00:00Z',
    toUtc: '2026-04-21T00:00:00Z',
    busy: [],
    existingBookings: [],
    nowUtc: '2026-04-20T12:00:00Z', // only 12h before Monday 10 BA — within notice window for all Monday slots
  });
  assertEqual(slots.length, 0, 'all Monday slots dropped by 24h min notice when now is 12h out');
}

console.log('\n=== maxAdvanceDays caps window ===');
{
  const rules = { ...rulesBA, maxAdvanceDays: 7 };
  // Fetch a 30-day window, expect slots capped to ~first 7 days.
  const slots = computeAvailableSlots({
    rules,
    fromUtc: '2026-04-20T00:00:00Z',
    toUtc: '2026-05-20T00:00:00Z',
    busy: [],
    existingBookings: [],
    nowUtc: '2026-04-20T00:00:00Z',
  });
  const maxStart = '2026-04-27T00:00:00Z';
  assert(slots.every(s => s.startUtc < maxStart), 'no slot beyond maxAdvanceDays');
}

console.log('\n=== excludedDates skips the day entirely ===');
{
  // Monday 2026-04-20 is excluded.
  const rules = { ...rulesBA, excludedDates: ['2026-04-20'] };
  const slots = computeAvailableSlots({
    rules,
    fromUtc: '2026-04-20T00:00:00Z',
    toUtc: '2026-04-21T00:00:00Z',
    busy: [],
    existingBookings: [],
    nowUtc: '2026-04-19T00:00:00Z',
  });
  assertEqual(slots.length, 0, 'excluded date yields zero slots');
}

console.log('\n=== existingBookings are subtracted (DB defense-in-depth) ===');
{
  const slots = computeAvailableSlots({
    rules: rulesBA,
    fromUtc: '2026-04-20T00:00:00Z',
    toUtc: '2026-04-21T00:00:00Z',
    busy: [],
    existingBookings: [{ startUtc: '2026-04-20T13:00:00Z', endUtc: '2026-04-20T13:30:00Z' }],
    nowUtc: '2026-04-19T00:00:00Z',
  });
  assert(!slots.some(s => s.startUtc === '2026-04-20T13:00:00Z'), '13:00 slot dropped by existing booking');
  assertEqual(slots.length, 3, 'remaining slots unchanged');
}

console.log('\n=== multi-calendar union: overlapping busy from 2 calendars ===');
{
  // Simulates fan-out: busy array already contains entries from both calendars.
  // Any overlap from any calendar kills the slot.
  const slots = computeAvailableSlots({
    rules: rulesBA,
    fromUtc: '2026-04-20T00:00:00Z',
    toUtc: '2026-04-21T00:00:00Z',
    busy: [
      { start: '2026-04-20T13:00:00Z', end: '2026-04-20T13:15:00Z' }, // cal A
      { start: '2026-04-20T14:30:00Z', end: '2026-04-20T15:00:00Z' }, // cal B
    ],
    existingBookings: [],
    nowUtc: '2026-04-19T00:00:00Z',
  });
  const starts = slots.map(s => s.startUtc);
  assert(!starts.includes('2026-04-20T13:00:00Z'), '13:00 dropped (cal A overlap)');
  assert(!starts.includes('2026-04-20T14:30:00Z'), '14:30 dropped (cal B overlap)');
  assertEqual(slots.length, 2, 'two slots survive the union of busy');
}

console.log('\n=== multi-range day: two windows in one day ===');
{
  const rules = {
    ...rulesBA,
    weeklyHours: {
      ...rulesBA.weeklyHours,
      mon: [
        { start: '10:00', end: '11:00' },
        { start: '15:00', end: '16:00' },
      ],
    },
  };
  const slots = computeAvailableSlots({
    rules,
    fromUtc: '2026-04-20T00:00:00Z',
    toUtc: '2026-04-21T00:00:00Z',
    busy: [],
    existingBookings: [],
    nowUtc: '2026-04-19T00:00:00Z',
  });
  assertEqual(slots.length, 4, '2 slots per range × 2 ranges = 4');
  assertEqual(slots.map(s => s.startUtc), [
    '2026-04-20T13:00:00Z', // 10:00 BA
    '2026-04-20T13:30:00Z',
    '2026-04-20T18:00:00Z', // 15:00 BA
    '2026-04-20T18:30:00Z',
  ], 'slots sorted chronologically across ranges');
}

console.log('\n=== DST transition — New York spring forward ===');
{
  // 2026-03-08: NY spring forward 02:00 → 03:00 EDT.
  // Monday the next day (2026-03-09) rule: 10:00–11:00 NY.
  const rules = {
    ...rulesBA,
    timezone: 'America/New_York',
    weeklyHours: {
      ...rulesBA.weeklyHours,
      mon: [{ start: '10:00', end: '11:00' }],
    },
  };
  const slots = computeAvailableSlots({
    rules,
    fromUtc: '2026-03-09T00:00:00Z',
    toUtc: '2026-03-10T00:00:00Z',
    busy: [],
    existingBookings: [],
    nowUtc: '2026-03-08T00:00:00Z',
  });
  // After spring forward, NY is UTC-4 (EDT). 10:00 NY = 14:00 UTC.
  assertEqual(slots.length, 2, 'two 30-min slots');
  assertEqual(slots[0].startUtc, '2026-03-09T14:00:00Z', 'EDT offset applied (UTC-4)');
}

console.log('\n=== Slots outside weeklyHours yield nothing ===');
{
  // Rules only allow Monday. Ask for Tuesday through Saturday window.
  const slots = computeAvailableSlots({
    rules: rulesBA,
    fromUtc: '2026-04-21T00:00:00Z',
    toUtc: '2026-04-25T00:00:00Z',
    busy: [],
    existingBookings: [],
    nowUtc: '2026-04-20T00:00:00Z',
  });
  assertEqual(slots.length, 0, 'no slots when requested window has no matching weekdays');
}

console.log('\n=== isSlotStillAvailable verifies a specific slot ===');
{
  // The 13:00 slot on Mon 2026-04-20 should be available.
  assert(
    isSlotStillAvailable({
      rules: rulesBA,
      targetStartUtc: '2026-04-20T13:00:00Z',
      busy: [],
      existingBookings: [],
      nowUtc: '2026-04-19T00:00:00Z',
    }),
    '13:00 is verifiable as available'
  );
  // If a booking exists at 13:00, it's no longer available.
  assert(
    !isSlotStillAvailable({
      rules: rulesBA,
      targetStartUtc: '2026-04-20T13:00:00Z',
      busy: [],
      existingBookings: [{ startUtc: '2026-04-20T13:00:00Z', endUtc: '2026-04-20T13:30:00Z' }],
      nowUtc: '2026-04-19T00:00:00Z',
    }),
    '13:00 unavailable when existing booking occupies it'
  );
  // A random time not in weeklyHours is unavailable.
  assert(
    !isSlotStillAvailable({
      rules: rulesBA,
      targetStartUtc: '2026-04-20T20:00:00Z', // 17:00 BA — outside 10:00–12:00
      busy: [],
      existingBookings: [],
      nowUtc: '2026-04-19T00:00:00Z',
    }),
    'target outside weeklyHours is not verifiable'
  );
}

console.log('\n=== Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
