// In-person meeting types: the guest picks where to meet instead of getting a Meet link.
//
// A type with mode "in_person" carries its own list of places ({ name, address, mapsUrl })
// and may let the guest suggest another one (allowCustomLocation). The booking stores a
// copy of the chosen place, so editing the list later doesn't rewrite past bookings.
// Online is the default: rows saved before `mode` existed keep their Meet link.

export const MODES = ['online', 'in_person'];

const MAX_LOCATIONS = 10;
const MAX_NAME = 120;
const MAX_ADDRESS = 200;
const MAX_URL = 500;
export const MAX_CUSTOM = 300;

export function normalizeMode(value) {
  return value === 'in_person' ? 'in_person' : 'online';
}

export function isInPerson(rules) {
  return rules?.mode === 'in_person';
}

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** [{ name, address, mapsUrl }] — a place needs a name; the Maps link must be https. */
export function normalizeLocations(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const l of value.slice(0, MAX_LOCATIONS)) {
    if (!l || typeof l !== 'object') continue;
    const name = text(l.name, MAX_NAME);
    if (!name) continue;
    const url = text(l.mapsUrl, MAX_URL);
    out.push({
      name,
      address: text(l.address, MAX_ADDRESS),
      mapsUrl: /^https:\/\/\S+$/i.test(url) ? url : '',
    });
  }
  return out;
}

/**
 * Where a booking takes place, from what the guest sent:
 *   { index: n }       — one of the type's places (0-based)
 *   { custom: "text" } — a place the guest suggests (only if the type allows it)
 * Online types → { location: null }. An in-person type with no places and no
 * suggestions also books without one (the description says where).
 * @returns {{ location: object|null } | { error: string }}
 */
export function resolveLocation(rules, raw) {
  if (!isInPerson(rules)) return { location: null };
  const locations = normalizeLocations(rules.locations);
  const given = raw && typeof raw === 'object' ? raw : {};

  const custom = text(given.custom, MAX_CUSTOM);
  if (custom) {
    if (rules.allowCustomLocation !== true) return { error: 'location_invalid' };
    return { location: { name: custom, address: '', mapsUrl: '', custom: true } };
  }

  const idx = typeof given.index === 'number' ? given.index
    : (given.index === '' || given.index == null ? NaN : Number(given.index));
  if (Number.isInteger(idx) && locations[idx]) {
    return { location: { ...locations[idx], custom: false } };
  }

  if (locations.length === 0 && rules.allowCustomLocation !== true) return { location: null };
  return { error: 'location_required' };
}

/** One line for the calendar event's location field (Google links it to Maps). */
export function locationLine(location) {
  if (!location) return '';
  return [location.name, location.address].filter(Boolean).join(', ');
}
