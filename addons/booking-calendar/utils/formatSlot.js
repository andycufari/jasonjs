export function formatSlotLabel(startUtc, tz) {
  try {
    return new Date(startUtc).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', timeZone: tz || undefined,
    });
  } catch {
    return startUtc;
  }
}

export function formatDayLabel(dateIso, tz) {
  try {
    return new Date(dateIso).toLocaleDateString([], {
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
