// Thin wrapper around luxon so slotEngine stays free of luxon references
// in its signature (helps future migration if we ever replace luxon).

import { DateTime } from 'luxon';

export function zonedDateTime(isoOrDate, zone) {
  if (typeof isoOrDate === 'string') {
    return DateTime.fromISO(isoOrDate, { zone });
  }
  return DateTime.fromJSDate(isoOrDate, { zone });
}

export function toUtcIso(dateTime) {
  return dateTime.toUTC().toISO({ suppressMilliseconds: true });
}

export function zonedFromWallClock(ymd, hhmm, zone) {
  return DateTime.fromFormat(`${ymd} ${hhmm}`, 'yyyy-MM-dd HH:mm', { zone });
}

export function addMinutes(dt, minutes) {
  return dt.plus({ minutes });
}

export function weekdayKey(dt) {
  // luxon weekday: 1=Mon .. 7=Sun
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][dt.weekday - 1];
}

export function ymd(dt) {
  return dt.toFormat('yyyy-MM-dd');
}

export function eachDayBetween(startDt, endDt) {
  const out = [];
  let cursor = startDt.startOf('day');
  const last = endDt.startOf('day');
  while (cursor <= last) {
    out.push(cursor);
    cursor = cursor.plus({ days: 1 });
  }
  return out;
}

export { DateTime };
