// Standalone: node addons/booking-calendar/lib/meetingTypes.test.js
import assert from 'node:assert/strict';
import {
  SLUG_RE, normalizeName, isBookable, publicType, slotLockFor, isDuplicateKeyError,
} from './meetingTypes.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }

test('URL codes: lowercase, digits, dashes; nothing else', () => {
  for (const ok of ['intro', 'consulta', 'co-build', 'sesion-75']) assert.ok(SLUG_RE.test(ok), ok);
  for (const bad of ['', 'Intro', 'sesión', 'a b', '-intro', '../admin', 'x'.repeat(41)]) assert.ok(!SLUG_RE.test(bad), bad);
});

test('names accept a plain string or { es, en } and are capped', () => {
  assert.deepEqual(normalizeName('👋 Intro'), { es: '👋 Intro', en: '' });
  assert.deepEqual(normalizeName({ es: ' Consulta ', en: 'Consult', fr: 'x' }), { es: 'Consulta', en: 'Consult' });
  assert.equal(normalizeName({ es: 'x'.repeat(200) }).es.length, 80);
  assert.deepEqual(normalizeName(null), { es: '', en: '' });
});

test('switched-off or missing types are not bookable', () => {
  assert.equal(isBookable(null), false);
  assert.equal(isBookable({ active: false }), false);
  assert.equal(isBookable({}), true); // rows saved before `active` existed
});

test('public projection hides internals, and the duration when asked', () => {
  const row = {
    _id: 'x', userId: 'u1', meetingType: 'consulta', weeklyHours: {}, eventTitleTemplate: 't',
    name: { es: 'Consulta' }, priceCents: 7900, currency: 'USD', durationMinutes: 35, showDuration: false,
  };
  const p = publicType(row);
  assert.equal(p.durationMinutes, null);
  assert.equal(p.priceCents, 7900);
  for (const k of ['_id', 'userId', 'weeklyHours', 'eventTitleTemplate']) assert.ok(!(k in p), k);
  assert.equal(publicType({ ...row, showDuration: true }).durationMinutes, 35);
});

test('slotLock is the same for the same host + instant, whatever the input format', () => {
  assert.equal(slotLockFor('u1', '2026-10-14T13:00:00Z'), slotLockFor('u1', new Date('2026-10-14T10:00:00-03:00')));
  assert.notEqual(slotLockFor('u1', '2026-10-14T13:00:00Z'), slotLockFor('u2', '2026-10-14T13:00:00Z'));
});

test('duplicate-key errors are recognised by code or message', () => {
  assert.ok(isDuplicateKeyError({ code: 11000 }));
  assert.ok(isDuplicateKeyError(new Error('E11000 duplicate key error collection: x index: slot_lock_unique')));
  assert.ok(!isDuplicateKeyError(new Error('timeout')));
});

console.log(`\nmeetingTypes: ${passed}/6 PASS`);
