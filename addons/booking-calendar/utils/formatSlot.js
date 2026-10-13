// `locale` is optional: without it the browser's default is used.

export function formatSlotLabel(startUtc, tz, locale) {
  try {
    // Spanish: 24 h ("15:30"); es-AR alone gives "03:30 p. m.".
    const es = /^es\b/.test(locale || '');
    return new Date(startUtc).toLocaleTimeString(locale || [], {
      hour: es ? '2-digit' : 'numeric', minute: '2-digit', timeZone: tz || undefined,
      ...(es ? { hourCycle: 'h23' } : {}),
    });
  } catch {
    return startUtc;
  }
}

export function formatDayLabel(dateIso, tz, locale) {
  try {
    return new Date(dateIso).toLocaleDateString(locale || [], {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: tz || undefined,
    });
  } catch {
    return dateIso;
  }
}

export function ymdInTz(d, tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz || undefined,
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${y}-${m}-${day}`;
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** "miércoles 14 de octubre" for a slot instant, in the guest's tz. */
export function formatLongDay(startUtc, tz, locale) {
  try {
    return new Date(startUtc).toLocaleDateString(locale || [], {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: tz || undefined,
    });
  } catch {
    return startUtc;
  }
}

/** "Buenos Aires (GMT-3)" — readable name for an IANA zone. */
export function tzLabel(tz, locale) {
  const city = (tz || 'UTC').split('/').pop().replace(/_/g, ' ');
  try {
    const offset = new Intl.DateTimeFormat(locale || [], { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value;
    return offset ? `${city} (${offset})` : city;
  } catch {
    return city;
  }
}
