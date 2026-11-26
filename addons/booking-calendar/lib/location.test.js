// Standalone: node addons/booking-calendar/lib/location.test.js
import assert from 'node:assert/strict';
import { normalizeMode, normalizeLocations, resolveLocation, locationLine, isInPerson } from './location.js';
import { publicType, isListed } from './meetingTypes.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`✓ ${name}`); }

const PLACES = [
  { name: 'Bar A', address: 'Calle 1 100', mapsUrl: 'https://maps.app.goo.gl/aaa' },
  { name: 'Café B', address: 'Calle 2 200', mapsUrl: 'https://maps.app.goo.gl/bbb' },
];
const inPerson = (over = {}) => ({ mode: 'in_person', locations: PLACES, ...over });

test('mode: only in_person or online (old rows are online)', () => {
  assert.equal(normalizeMode('in_person'), 'in_person');
  for (const v of [undefined, '', 'presencial', 'online']) assert.equal(normalizeMode(v), 'online');
  assert.equal(isInPerson({}), false);
});

test('places: need a name, Maps link only if https, capped', () => {
  const out = normalizeLocations([
    { name: '  Bar A ', address: ' Calle 1 ', mapsUrl: 'https://maps.app.goo.gl/x' },
    { name: '', address: 'sin nombre' },
    { name: 'Raro', mapsUrl: 'javascript:alert(1)' },
    'basura',
  ]);
  assert.deepEqual(out, [
    { name: 'Bar A', address: 'Calle 1', mapsUrl: 'https://maps.app.goo.gl/x' },
    { name: 'Raro', address: '', mapsUrl: '' },
  ]);
  assert.equal(normalizeLocations(Array.from({ length: 30 }, (_, i) => ({ name: `p${i}` }))).length, 10);
  assert.deepEqual(normalizeLocations(null), []);
});

test('online types book without a place, whatever the guest sends', () => {
  assert.deepEqual(resolveLocation({}, { index: 0 }), { location: null });
});

test('in person: a listed place by index (number or string)', () => {
  assert.deepEqual(resolveLocation(inPerson(), { index: 1 }).location,
    { name: 'Café B', address: 'Calle 2 200', mapsUrl: 'https://maps.app.goo.gl/bbb', custom: false });
  assert.equal(resolveLocation(inPerson(), { index: '0' }).location.name, 'Bar A');
});

test('in person: no place or a place out of range is an error', () => {
  assert.equal(resolveLocation(inPerson(), undefined).error, 'location_required');
  assert.equal(resolveLocation(inPerson(), { index: 5 }).error, 'location_required');
  assert.equal(resolveLocation(inPerson(), { index: '' }).error, 'location_required');
  assert.equal(resolveLocation(inPerson(), { index: 0.5 }).error, 'location_required');
});

test('in person: a suggested place only when the type allows it', () => {
  assert.equal(resolveLocation(inPerson(), { custom: 'Mi oficina, Av. X 123' }).error, 'location_invalid');
  const ok = resolveLocation(inPerson({ allowCustomLocation: true }), { custom: '  Mi oficina, Av. X 123 ' });
  assert.deepEqual(ok.location, { name: 'Mi oficina, Av. X 123', address: '', mapsUrl: '', custom: true });
  assert.equal(resolveLocation(inPerson({ allowCustomLocation: true }), { custom: 'x'.repeat(900) }).location.name.length, 300);
  // Blank suggestion falls back to the index.
  assert.equal(resolveLocation(inPerson({ allowCustomLocation: true }), { custom: '  ', index: 0 }).location.name, 'Bar A');
});

test('in person without places: books without one, or needs a suggestion if allowed', () => {
  assert.deepEqual(resolveLocation({ mode: 'in_person', locations: [] }, {}), { location: null });
  assert.equal(resolveLocation({ mode: 'in_person', allowCustomLocation: true }, {}).error, 'location_required');
});

test('event location line', () => {
  assert.equal(locationLine({ name: 'Bar A', address: 'Calle 1 100' }), 'Bar A, Calle 1 100');
  assert.equal(locationLine({ name: 'Mi oficina', address: '' }), 'Mi oficina');
  assert.equal(locationLine(null), '');
});

test('public projection: places only for in-person types; unlisted is not listed', () => {
  const online = publicType({ meetingType: 'intro', durationMinutes: 15 });
  assert.equal(online.mode, 'online');
  assert.ok(!('locations' in online));
  const cafe = publicType({ meetingType: 'cafe', durationMinutes: 45, ...inPerson({ allowCustomLocation: true }), unlisted: true });
  assert.equal(cafe.mode, 'in_person');
  assert.equal(cafe.locations.length, 2);
  assert.equal(cafe.allowCustomLocation, true);
  assert.ok(!('unlisted' in cafe));
  assert.equal(isListed({ unlisted: true }), false);
  assert.equal(isListed({}), true);
});

console.log(`\nlocation: ${passed}/9 PASS`);
