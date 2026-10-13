// `locale` is optional: without it the browser's default is used.

export function formatSlotLabel(startUtc, tz, locale) {
  try {
    return new Date(startUtc).toLocaleTimeString(locale || [], {
      hour: '2-digit', minute: '2-digit', timeZone: tz || undefined,
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
