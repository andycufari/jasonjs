'use client';

import { useState, useEffect, useMemo } from 'react';
import { detectTimezone } from '../utils/tzDetect.js';
import { formatSlotLabel, formatDayLabel, ymdInTz } from '../utils/formatSlot.js';
import { getStrings, localeFor, pickLang, priceLabel } from '../utils/i18n.js';

const ADDON = '/api/addons/booking-calendar';

/**
 * Public guest booking widget. Drop into any page:
 *
 *   { "component": "@addons/booking-calendar/Book",
 *     "attributes": { "userId": "<host id>", "meetingType": "{{params.slug}}",
 *                     "lang": { "en": "en", "es": "es" } } }
 *
 * No auth required for guests. Shows the meeting type (name, description, price),
 * fetches slots for a 14-day window, lets guest pick a day + slot, collects
 * name/email, submits.
 */
export default function Book({
  userId,
  meetingType = 'default',
  lang = 'es',
  showHeader = true,
  brand = {},
  styles = {},
}) {
  const t = getStrings(lang);
  const locale = localeFor(lang);
  const primary = brand.primaryColor || '#111';
  const tz = useMemo(detectTimezone, []);

  // Window: today → +14 days (widget shows a 7-day strip, slides by one page).
  const [pageStart, setPageStart] = useState(() => startOfTomorrowUtc());
  const windowDays = 14;
  const stripDays = 7;

  const [type, setType] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState(null);

  const [selectedDay, setSelectedDay] = useState(null); // YYYY-MM-DD in guest tz
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestNotes, setGuestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null); // outcome of a checkout we came back from

  // Back from Stripe: ?paid=<id>&session_id=… (paid) or ?released=<id>&t=<token> (gave up).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paidId = params.get('paid');
    const sessionId = params.get('session_id');
    const releasedToken = params.get('released') && params.get('t');
    if (!paidId && !releasedToken) return;
    window.history.replaceState({}, '', window.location.pathname);

    if (releasedToken) {
      fetch(`${ADDON}/bookings/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: releasedToken }),
      }).catch(() => {}).finally(() => setNotice(t.paymentAbandoned));
      return;
    }

    // The webhook confirms the booking a few seconds after payment: poll for it.
    let tries = 0;
    let stopped = false;
    setNotice(t.checkingPayment);
    const poll = async () => {
      if (stopped) return;
      tries++;
      try {
        const res = await fetch(`${ADDON}/bookings/status?id=${encodeURIComponent(paidId)}&s=${encodeURIComponent(sessionId || '')}`);
        const data = await res.json();
        if (res.ok && data.status === 'confirmed') {
          setNotice(null);
          setGuestEmail(data.guestEmail || '');
          setResult({ meetLink: data.meetLink });
          return;
        }
        if (res.ok && data.status === 'refunded') { setNotice(t.paymentRefunded); return; }
        if (res.ok && data.status === 'payment_failed') { setNotice(t.paymentFailed); return; }
      } catch {}
      if (tries >= 20) { setNotice(t.paymentPending); return; }
      setTimeout(poll, 2000);
    };
    poll();
    return () => { stopped = true; };
  }, []);

  // The meeting type itself: what the visitor is booking.
  useEffect(() => {
    if (!userId) return;
    fetch(`${ADDON}/types/public?userId=${encodeURIComponent(userId)}&meetingType=${encodeURIComponent(meetingType)}`)
      .then(r => r.json().then(data => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (status === 404) { setNotFound(true); return; }
        if (ok) setType(data.type);
      })
      .catch(() => {});
  }, [userId, meetingType]);

  // Fetch slots whenever the page window changes.
  useEffect(() => {
    if (!userId) return;
    const fromUtc = new Date(pageStart).toISOString();
    const toUtc = new Date(pageStart.getTime() + windowDays * 24 * 60 * 60 * 1000).toISOString();
    setLoadingSlots(true);
    setError(null);
    fetch(`${ADDON}/slots?userId=${encodeURIComponent(userId)}&meetingType=${encodeURIComponent(meetingType)}&fromUtc=${encodeURIComponent(fromUtc)}&toUtc=${encodeURIComponent(toUtc)}`)
      .then(r => r.json().then(data => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (status === 404) { setNotFound(true); return; }
        if (!ok) { setError(errorMessage(status, data, t)); return; }
        setSlots(data.slots || []);
      })
      .catch(() => setError(t.genericError))
      .finally(() => setLoadingSlots(false));
  }, [userId, meetingType, pageStart]);

  // Bucket slots by day in guest tz.
  const slotsByDay = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      const d = new Date(s.startUtc);
      const key = ymdInTz(d, tz);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return map;
  }, [slots, tz]);

  const stripDaysList = useMemo(() => {
    const out = [];
    for (let i = 0; i < stripDays; i++) {
      const d = new Date(pageStart.getTime() + i * 24 * 60 * 60 * 1000);
      out.push({ date: d, key: ymdInTz(d, tz) });
    }
    return out;
  }, [pageStart, tz]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedSlot) return;
    if (!guestName.trim() || !guestEmail.trim()) {
      setError(t.nameEmailRequired);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${ADDON}/bookings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          meetingType,
          startUtc: selectedSlot.startUtc,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          guestNotes: guestNotes.trim(),
          timezoneGuest: tz,
          returnPath: window.location.pathname,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(errorMessage(res.status, data, t)); setSubmitting(false); return; }
      if (data.checkoutUrl) {
        // Paid type: the slot is held while the guest pays; keep the button busy.
        window.location.href = data.checkoutUrl;
        return;
      }
      setResult(data);
      setSubmitting(false);
    } catch {
      setError(t.genericError);
      setSubmitting(false);
    }
  };

  const isPaid = (type?.priceCents || 0) > 0;
  const submitLabel = submitting
    ? (isPaid ? t.redirecting : t.confirming)
    : (isPaid ? t.payAndBook(priceLabel(type.priceCents, type.currency, lang)) : t.confirm);

  if (notFound) {
    return <p className="text-sm text-muted-foreground">{t.notFound}</p>;
  }

  const header = showHeader && type && (
    <div className="mb-6">
      <h2 className="text-2xl font-bold">{pickLang(type.name, lang)}</h2>
      <p className="text-sm font-medium mt-1" style={{ color: primary }}>
        {[priceLabel(type.priceCents, type.currency, lang), type.durationMinutes ? t.minutes(type.durationMinutes) : null]
          .filter(Boolean).join(' · ')}
      </p>
      {pickLang(type.description, lang) && (
        <p className="text-muted-foreground mt-2">{pickLang(type.description, lang)}</p>
      )}
    </div>
  );

  if (result) {
    return (
      <div>
        {header}
        <div className={styles.confirmed || 'border rounded-lg p-6 bg-green-50 dark:bg-green-900/10'}>
          <h3 className="text-xl font-semibold mb-2">{t.booked}</h3>
          <p className="text-sm mb-4">{t.inviteSent(guestEmail)}</p>
          {result.meetLink && (
            <p className="text-sm mb-2">
              {t.meetLink} <a href={result.meetLink} target="_blank" rel="noopener noreferrer" className="underline">{result.meetLink}</a>
            </p>
          )}
          {result.cancelUrl && (
            <p className="text-xs text-muted-foreground">
              {t.needCancel} <a href={result.cancelUrl} className="underline">{t.useLink}</a>.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container || ''}>
      {header}
      {notice && <p className="text-sm border rounded p-3 mb-4">{notice}</p>}

      {/* Day strip */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          className="px-3 py-1 rounded border hover:bg-accent"
          onClick={() => setPageStart(new Date(pageStart.getTime() - stripDays * 24 * 60 * 60 * 1000))}
        >←</button>
        <div className="flex-1 grid grid-cols-7 gap-2">
          {stripDaysList.map(({ date, key }) => {
            const count = slotsByDay.get(key)?.length || 0;
            const isSelected = selectedDay === key;
            const isAvailable = count > 0;
            return (
              <button
                key={key}
                type="button"
                disabled={!isAvailable}
                onClick={() => { setSelectedDay(key); setSelectedSlot(null); }}
                className={`p-2 rounded border text-xs text-center ${
                  isSelected ? 'ring-2 ring-offset-1' : ''
                } ${
                  isAvailable ? 'hover:bg-accent' : 'opacity-40 cursor-not-allowed'
                } ${styles.day || ''}`}
                style={isSelected ? { borderColor: primary } : {}}
              >
                <div className="font-medium">{formatDayLabel(date.toISOString(), tz, locale)}</div>
                <div className="text-muted-foreground mt-1">{count > 0 ? t.slots(count) : '—'}</div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="px-3 py-1 rounded border hover:bg-accent"
          onClick={() => setPageStart(new Date(pageStart.getTime() + stripDays * 24 * 60 * 60 * 1000))}
        >→</button>
      </div>

      {loadingSlots && <p className="text-sm text-muted-foreground">{t.loading}</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {!loadingSlots && !error && slots.length === 0 && (
        <p className="text-sm text-muted-foreground">{t.noSlots}</p>
      )}

      {/* Slots for selected day */}
      {selectedDay && !loadingSlots && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-6">
          {(slotsByDay.get(selectedDay) || []).map(slot => {
            const isSelected = selectedSlot?.startUtc === slot.startUtc;
            return (
              <button
                key={slot.startUtc}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className={`p-2 rounded border text-sm hover:bg-accent ${
                  isSelected ? 'ring-2 ring-offset-1' : ''
                } ${styles.slot || ''}`}
                style={isSelected ? { borderColor: primary } : {}}
              >
                {formatSlotLabel(slot.startUtc, tz, locale)}
              </button>
            );
          })}
        </div>
      )}

      {/* Booking form */}
      {selectedSlot && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <strong>
              {t.booking(
                formatDayLabel(selectedSlot.startUtc, tz, locale),
                formatSlotLabel(selectedSlot.startUtc, tz, locale),
                tz
              )}
            </strong>
          </div>
          <input
            type="text"
            required
            placeholder={t.yourName}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full p-2 rounded border"
          />
          <input
            type="email"
            required
            placeholder={t.yourEmail}
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            className="w-full p-2 rounded border"
          />
          <textarea
            placeholder={t.notes}
            value={guestNotes}
            onChange={(e) => setGuestNotes(e.target.value)}
            rows={3}
            className="w-full p-2 rounded border"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full p-2 rounded text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: primary }}
          >
            {submitLabel}
          </button>
        </form>
      )}
    </div>
  );
}

function errorMessage(status, data, t) {
  if (data?.error === 'payment_unavailable') return t.paymentUnavailable;
  if (status === 503 && data?.error !== 'Addon not configured') return t.calendarUnavailable;
  if (status === 409) return t.slotTaken;
  return t.genericError;
}

function startOfTomorrowUtc() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
