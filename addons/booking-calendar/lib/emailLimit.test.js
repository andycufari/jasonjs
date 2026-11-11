// Standalone: node addons/booking-calendar/lib/emailLimit.test.js
import assert from 'node:assert/strict';
import {
  normalizeEmail, emailLimitFor, normalizeEmailLimit, findEmailConflict, DEFAULT_FREE_DAYS,
} from './emailLimit.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }

const DAY = 24 * 3600e3;
const now = new Date('2026-11-11T12:00:00Z');
const at = (days) => new Date(now.getTime() + days * DAY);
const intro = (startDays, over = {}) => ({
  guestEmail: 'ana.perez@gmail.com', status: 'confirmed', startUtc: at(startDays), ...over,
});
const check = (bookings, startDays, { email = 'ana.perez@gmail.com', limit = { days: 7 } } = {}) =>
  findEmailConflict({ limit, bookings, email, startUtc: at(startDays), now });

test('email key: case, spaces, +alias everywhere, dots only on Gmail', () => {
  assert.equal(normalizeEmail('  Ana.Perez+meet@GMail.com '), 'anaperez@gmail.com');
  assert.equal(normalizeEmail('a.n.a.perez@googlemail.com'), 'anaperez@gmail.com');
  assert.equal(normalizeEmail('ana.perez+x@empresa.com'), 'ana.perez@empresa.com');
  assert.notEqual(normalizeEmail('ana.perez@empresa.com'), normalizeEmail('anaperez@empresa.com'));
  assert.equal(normalizeEmail(null), '');
});

test('default: free types one per 7 days, paid types no limit; false turns it off', () => {
  assert.deepEqual(emailLimitFor({ priceCents: 0 }), { days: DEFAULT_FREE_DAYS });
  assert.equal(emailLimitFor({ priceCents: 7900 }), null);
  assert.equal(emailLimitFor({ priceArsCents: 9_000_000 }), null);
  assert.equal(emailLimitFor({ priceCents: 0, emailLimit: false }), null);
  assert.deepEqual(emailLimitFor({ priceCents: 7900, emailLimit: { days: 30 } }), { days: 30 });
  assert.deepEqual(emailLimitFor({ emailLimit: { days: 9999 } }), { days: 365 });
  assert.equal(emailLimitFor({ emailLimit: { days: 0 } }), null);
});

test('what the editor saves: unset stays unset (= default), 0 means off', () => {
  assert.equal(normalizeEmailLimit(undefined), undefined);
  assert.equal(normalizeEmailLimit(false), false);
  assert.equal(normalizeEmailLimit({ days: 0 }), false);
  assert.deepEqual(normalizeEmailLimit({ days: '3' }), { days: 3 });
  assert.equal(normalizeEmailLimit('7'), undefined);
});

test('the 2026-11 case: same Gmail, written differently, can\'t take a second upcoming intro', () => {
  const c = check([intro(2)], 3, { email: 'AnaPerez+2@gmail.com' });
  assert.equal(c.reason, 'upcoming');
  assert.equal(c.existingStartUtc, at(2).toISOString());
});

test('two upcoming are refused even far apart (beyond the window)', () => {
  assert.equal(check([intro(20)], 1).reason, 'upcoming');
  assert.equal(check([intro(1)], 40).reason, 'upcoming');
});

test('a past one (attended or not) blocks the window, both ways; after it, OK', () => {
  const c = check([intro(-3)], 1);
  assert.equal(c.reason, 'recent');
  assert.equal(c.nextAllowedUtc, at(4).toISOString());
  assert.equal(check([intro(-3)], 4), null, 'exactly 7 days later is allowed');
  assert.equal(check([intro(-10)], 1), null);
});

test('same day is always refused while the limit is on', () => {
  assert.equal(check([intro(-0.1)], 0.2, { limit: { days: 1 } }).reason, 'recent');
});

test('cancelled, expired or someone else\'s bookings don\'t count; no limit = no check', () => {
  assert.equal(check([intro(2, { status: 'cancelled' }), intro(-1, { status: 'expired' })], 3), null);
  assert.equal(check([intro(2, { guestEmail: 'otra@gmail.com' })], 3), null);
  assert.equal(check([intro(2)], 3, { limit: null }), null);
});

test('rows saved with guestEmailKey, or with broken dates, behave', () => {
  assert.equal(check([intro(2, { guestEmail: 'X@Y.com', guestEmailKey: 'anaperez@gmail.com' })], 3).reason, 'upcoming');
  assert.equal(check([intro(2, { startUtc: {} })], 3), null);
});

console.log(`\nemailLimit: ${passed}/9 PASS`);
