'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { detectTimezone } from '../utils/tzDetect.js';
import { formatSlotLabel, formatLongDay, ymdInTz, tzLabel } from '../utils/formatSlot.js';
import { getStrings, localeFor, pickLang, priceLabel } from '../utils/i18n.js';
import { CSS, brandVars } from '../utils/ui.js';
import { confettiBurst } from '../utils/confetti.js';

const ADDON = '/api/addons/booking-calendar';
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Public guest booking widget. Drop into any page:
 *
 *   { "component": "@addons/booking-calendar/Book",
 *     "attributes": { "meetingType": "{{params.slug}}", "lang": { "en": "en", "es": "es" },
 *                     "brand": { "primaryColor": "#FF6B2B" } } }
 *
 * userId only when the site has more than one host. No auth required for guests.
 * Steps: pick (month calendar + that day's times) → form → done. The guest's cancel link
 * points back to this page with ?cancel=<token>, which opens the cancel view instead.
 */
export default function Book({
  userId,
  meetingType = 'default',
  lang = 'es',
  showHeader = true,
  brand = {},
}) {
  const t = getStrings(lang);
  const locale = localeFor(lang);
  const primary = brand.primaryColor || '#111';
  // userId is optional: on a single-host site the API resolves the host.
  const hostParam = userId ? `userId=${encodeURIComponent(userId)}&` : '';
  const rootRef = useRef(null);
  const checkRef = useRef(null);

  // Time zone and "today" are the visitor's: only known in the browser.
  const [mounted, setMounted] = useState(false);
  const [tz, setTz] = useState('UTC');
  const [step, setStep] = useState('pick'); // pick | form | done | cancel
  const [cancelToken, setCancelToken] = useState(null);

  const [type, setType] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [month, setMonth] = useState(null); // { y, m } — m is 0-based, in the guest's tz
  const [slotsByMonth, setSlotsByMonth] = useState({});
  const [reload, setReload] = useState(0);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null); // YYYY-MM-DD in the guest's tz
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [answers, setAnswers] = useState({}); // questionKey → value (select: option index)
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { meetLink, cancelUrl, startUtc, guestName, guestEmail }
  const [notice, setNotice] = useState(null); // outcome of a checkout we came back from

  useEffect(() => {
    const zone = detectTimezone();
    setTz(zone);
    setMonth(monthOf(new Date(), zone));
    setMounted(true);

    const params = new URLSearchParams(window.location.search);
    if (params.get('cancel')) {
      setCancelToken(params.get('cancel'));
      setStep('cancel');
      return;
    }

    // Back from Stripe: ?paid=<id>&session_id=… (paid) or ?released=<id>&t=<token> (gave up).
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
          setResult({ meetLink: data.meetLink, startUtc: data.startUtc, guestEmail: data.guestEmail });
          setStep('done');
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
    fetch(`${ADDON}/types/public?${hostParam}meetingType=${encodeURIComponent(meetingType)}`)
      .then(r => r.json().then(data => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (status === 404) { setNotFound(true); return; }
        if (ok) setType(data.type);
      })
      .catch(() => {});
  }, [userId, meetingType]);

  // One request per month shown. The range overshoots by 14 h on each side so the whole
  // month is covered in any time zone; slots outside it are just not drawn.
  const monthKey = month ? `${month.y}-${month.m}` : null;
  useEffect(() => {
    if (!monthKey || step === 'cancel' || slotsByMonth[monthKey]) return;
    const from = Math.max(Date.now(), Date.UTC(month.y, month.m, 1) - 14 * HOUR_MS);
    const to = Date.UTC(month.y, month.m + 1, 1) + 14 * HOUR_MS;
    if (to <= from) { setSlotsByMonth(s => ({ ...s, [monthKey]: [] })); return; }
    let stale = false;
    setError(null);
    fetch(`${ADDON}/slots?${hostParam}meetingType=${encodeURIComponent(meetingType)}&fromUtc=${encodeURIComponent(new Date(from).toISOString())}&toUtc=${encodeURIComponent(new Date(to).toISOString())}`)
      .then(r => r.json().then(data => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (stale) return;
        if (status === 404) { setNotFound(true); return; }
        if (!ok) { setError(errorMessage(status, data, t)); return; }
        setSlotsByMonth(s => ({ ...s, [monthKey]: data.slots || [] }));
      })
      .catch(() => { if (!stale) setError(t.genericError); });
    return () => { stale = true; };
  }, [monthKey, meetingType, userId, step === 'cancel', reload]);

  const slots = monthKey ? slotsByMonth[monthKey] : undefined;
  const loading = !!month && !slots && !error;

  const byDay = useMemo(() => {
    const map = new Map();
    for (const s of slots || []) {
      const key = ymdInTz(new Date(s.startUtc), tz);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return map;
  }, [slots, tz]);

  const today = mounted ? monthOf(new Date(), tz) : null;
  const canPrev = !!month && !!today && month.y * 12 + month.m > today.y * 12 + today.m;
  const canNext = !!month && Date.UTC(month.y, month.m + 1, 1) < Date.now() + (type?.maxAdvanceDays || 365) * DAY_MS;
  const openDays = useMemo(() => {
    if (!month) return [];
    const prefix = `${month.y}-${pad(month.m + 1)}-`;
    return [...byDay.keys()].filter(k => k.startsWith(prefix)).sort();
  }, [byDay, month]);

  // Land on the first open day; skip up to two empty months on arrival.
  const autoSkips = useRef(0);
  useEffect(() => {
    if (!slots) return;
    if (openDays.length === 0) {
      if (autoSkips.current < 2 && canNext) {
        autoSkips.current++;
        setMonth(m => shiftMonth(m, 1));
      }
      return;
    }
    autoSkips.current = 99;
    if (!openDays.includes(selectedDay)) setSelectedDay(openDays[0]);
  }, [slots, openDays]);

  // Celebrate.
  useEffect(() => {
    if (step !== 'done') return;
    const id = setTimeout(() => {
      const themePrimary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
      confettiBurst(checkRef.current, [primary, themePrimary || primary, '#ffffff', primary]);
    }, 250);
    return () => clearTimeout(id);
  }, [step]);

  const go = (next) => {
    setStep(next);
    const top = rootRef.current?.getBoundingClientRect().top;
    if (top !== undefined && top < 0) rootRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const questions = type?.questions || [];
  const isPaid = (type?.priceCents || 0) > 0;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedSlot) return;
    if (!guestName.trim() || !guestEmail.trim() || !subject.trim()) {
      setError(t.nameEmailRequired);
      return;
    }
    const missing = questions.find(q => q.required && (answers[q.key] === undefined || answers[q.key] === ''));
    if (missing) {
      setError(t.required(pickLang(missing.label, lang)));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${ADDON}/bookings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(userId ? { userId } : {}),
          meetingType,
          startUtc: selectedSlot.startUtc,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          subject: subject.trim(),
          whatsapp: whatsapp.trim(),
          answers,
          timezoneGuest: tz,
          returnPath: window.location.pathname,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitting(false);
        if (res.status === 409) {
          // Taken meanwhile: back to the calendar, with fresh times.
          setSlotsByMonth({});
          setReload(n => n + 1);
          setError(null);
          setNotice(t.slotTaken);
          go('pick');
          return;
        }
        setError(errorMessage(res.status, data, t, questions, lang));
        return;
      }
      if (data.checkoutUrl) {
        // Paid type: the slot is held while the guest pays; keep the button busy.
        window.location.href = data.checkoutUrl;
        return;
      }
      setResult({
        meetLink: data.meetLink, cancelUrl: data.cancelUrl, startUtc: selectedSlot.startUtc,
        guestName: guestName.trim(), guestEmail: guestEmail.trim(),
      });
      setSubmitting(false);
      go('done');
    } catch {
      setError(t.genericError);
      setSubmitting(false);
    }
  };

  const typeName = pickLang(type?.name, lang);
  const when = (startUtc) => {
    const start = formatSlotLabel(startUtc, tz, locale);
    const end = type?.durationMinutes
      ? ` – ${formatSlotLabel(new Date(new Date(startUtc).getTime() + type.durationMinutes * 60000), tz, locale)}`
      : '';
    return { day: capitalize(formatLongDay(startUtc, tz, locale)), time: `${start}${end}` };
  };

  const shell = (children) => (
    <div ref={rootRef} className="bc" style={brandVars(primary)}>
      {/* Raw: React would escape the quotes in the CSS when rendering on the server. */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {children}
    </div>
  );

  if (!mounted) return shell(null);

  if (step === 'cancel') {
    return shell(
      <CancelView
        token={cancelToken} t={t} lang={lang} locale={locale} tz={tz}
        onRebook={() => { clearQuery(); setStep('pick'); }}
      />
    );
  }

  if (notFound) return shell(<p className="bc-empty">{t.notFound}</p>);

  if (step === 'done' && result) {
    const w = result.startUtc ? when(result.startUtc) : null;
    return shell(
      <div className="bc-panel bc-done">
        <div className="bc-check" ref={checkRef}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h2 className="bc-done-title">{t.doneTitle(firstName(result.guestName))}</h2>
        <p className="bc-done-sub">{t.doneSub}</p>
        <div className="bc-details">
          {w && (
            <div className="bc-detail">
              <span className="bc-detail-icon">🗓</span>
              <span>
                <strong>{typeName}</strong>
                {w.day} · {w.time}
                <span className="bc-muted"> · {tzLabel(tz, locale)}</span>
              </span>
            </div>
          )}
          <div className="bc-detail">
            <span className="bc-detail-icon">✉️</span>
            <span>{t.inviteIn(result.guestEmail)}</span>
          </div>
          {result.meetLink && (
            <a className="bc-btn" href={result.meetLink} target="_blank" rel="noopener noreferrer">{t.joinMeet} ↗</a>
          )}
          <p className="bc-fine">
            {result.cancelUrl
              ? <>{t.cantMakeIt} <a className="bc-link" href={result.cancelUrl}>{t.cancelMeeting}</a></>
              : t.cancelInInvite}
          </p>
        </div>
      </div>
    );
  }

  const header = showHeader && type && (
    <div className="bc-head">
      <h2 className="bc-title">{typeName}</h2>
      <div className="bc-badges">
        <span className="bc-badge">{priceLabel(type.priceCents, type.currency, lang)}</span>
        {type.durationMinutes ? <span className="bc-badge">⏱ {t.minutes(type.durationMinutes)}</span> : null}
      </div>
      {pickLang(type.description, lang) && <p className="bc-desc">{pickLang(type.description, lang)}</p>}
    </div>
  );

  if (step === 'form' && selectedSlot) {
    const w = when(selectedSlot.startUtc);
    const submitLabel = submitting
      ? (isPaid ? t.redirecting : t.confirming)
      : (isPaid ? t.payAndBook(priceLabel(type.priceCents, type.currency, lang)) : t.confirm);
    return shell(
      <>
        {header}
        <div className="bc-panel">
          <div className="bc-summary">
            <div>
              <div className="bc-summary-when">{w.day}</div>
              <div className="bc-muted">{w.time} · {tzLabel(tz, locale)}</div>
            </div>
            <button type="button" className="bc-link" onClick={() => { setError(null); go('pick'); }}>{t.change}</button>
          </div>
          {error && <p className="bc-error">{error}</p>}
          <form onSubmit={handleSubmit} className="bc-form">
            <div className="bc-row2">
              <Field label={t.name}>
                <input type="text" required maxLength={120} autoComplete="name" value={guestName}
                  onChange={(e) => setGuestName(e.target.value)} className="bc-input" />
              </Field>
              <Field label={t.email}>
                <input type="email" required autoComplete="email" value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)} className="bc-input" />
              </Field>
            </div>
            <Field label={t.subject}>
              <input type="text" required maxLength={200} placeholder={t.subjectPlaceholder} value={subject}
                onChange={(e) => setSubject(e.target.value)} className="bc-input" />
            </Field>
            <Field label={t.whatsapp} hint={t.optional}>
              <input type="tel" autoComplete="tel" placeholder={lang === 'en' ? '+1 555 123 4567' : '+54 9 11 1234 5678'}
                value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="bc-input" />
            </Field>

            {/* The meeting type's own questions */}
            {questions.map(q => {
              const value = answers[q.key] ?? '';
              const set = (v) => setAnswers(a => ({ ...a, [q.key]: v }));
              return (
                <Field key={q.key} label={pickLang(q.label, lang)} hint={q.required ? null : t.optional}>
                  {q.type === 'textarea' && (
                    <textarea rows={3} maxLength={2000} value={value}
                      onChange={(e) => set(e.target.value)} className="bc-input" />
                  )}
                  {q.type === 'select' && (
                    <select value={value} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
                      className="bc-input">
                      <option value="">{t.choose}</option>
                      {q.options.map((o, i) => <option key={i} value={i}>{pickLang(o, lang)}</option>)}
                    </select>
                  )}
                  {(q.type === 'text' || q.type === 'url') && (
                    <input type={q.type === 'url' ? 'url' : 'text'} maxLength={q.type === 'url' ? 500 : 200}
                      placeholder={q.type === 'url' ? 'https://' : ''} value={value}
                      onChange={(e) => set(e.target.value)} className="bc-input" />
                  )}
                </Field>
              );
            })}

            <button type="submit" disabled={submitting} className="bc-btn">{submitLabel}</button>
            <p className="bc-fine">{isPaid ? t.paidFine : t.freeFine}</p>
          </form>
        </div>
      </>
    );
  }

  // step === 'pick'
  const daySlots = (selectedDay && byDay.get(selectedDay)) || [];
  return shell(
    <>
      {header}
      {notice && <p className="bc-notice">{notice}</p>}
      <div className="bc-picker">
        <div className="bc-panel">
          <div className="bc-month-head">
            <div className="bc-month-title">{month && capitalize(monthTitle(month, locale))}</div>
            <div className="bc-nav">
              <button type="button" className="bc-icon-btn" aria-label={t.prevMonth} disabled={!canPrev}
                onClick={() => setMonth(m => shiftMonth(m, -1))}>‹</button>
              <button type="button" className="bc-icon-btn" aria-label={t.nextMonth} disabled={!canNext}
                onClick={() => setMonth(m => shiftMonth(m, 1))}>›</button>
            </div>
          </div>
          {month && (
            <MonthGrid
              month={month} locale={locale} weekStart={lang === 'en' ? 0 : 1}
              todayKey={ymdInTz(new Date(), tz)} loading={loading}
              countFor={(key) => byDay.get(key)?.length || 0}
              selectedDay={selectedDay}
              onPick={(key) => { setSelectedDay(key); setNotice(null); }}
            />
          )}
          <TimezonePicker tz={tz} locale={locale} label={t.timesIn} onChange={setTz} />
        </div>

        <div className="bc-panel">
          {error ? (
            <p className="bc-error">{error}</p>
          ) : loading ? (
            <p className="bc-empty">{t.loading}</p>
          ) : daySlots.length > 0 ? (
            <>
              <div className="bc-times-title">{capitalize(formatLongDay(daySlots[0].startUtc, tz, locale))}</div>
              <div className="bc-times">
                {daySlots.map(slot => (
                  <button key={slot.startUtc} type="button" className="bc-time"
                    onClick={() => { setSelectedSlot(slot); setError(null); go('form'); }}>
                    {formatSlotLabel(slot.startUtc, tz, locale)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="bc-empty">{openDays.length ? t.pickDay : (canNext ? t.noSlotsMonth : t.noSlotsAhead)}</p>
          )}
        </div>
      </div>
    </>
  );
}

function MonthGrid({ month, locale, weekStart, todayKey, loading, countFor, selectedDay, onPick }) {
  const daysInMonth = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(month.y, month.m, 1)).getUTCDay() - weekStart + 7) % 7;
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const longFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  // 2024-01-07 was a Sunday.
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(Date.UTC(2024, 0, 7 + weekStart + i)).replace('.', ''));

  return (
    <div className={`bc-grid${loading ? ' is-loading' : ''}`}>
      {weekdays.map(w => <div key={w} className="bc-wd" aria-hidden="true">{w}</div>)}
      {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} />)}
      {Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const key = `${month.y}-${pad(month.m + 1)}-${pad(d)}`;
        const open = !loading && countFor(key) > 0;
        const cls = ['bc-day', open && 'is-open', key === selectedDay && open && 'is-selected', key === todayKey && 'is-today']
          .filter(Boolean).join(' ');
        return (
          <button key={key} type="button" className={cls} disabled={!open} aria-pressed={key === selectedDay}
            aria-label={longFmt.format(Date.UTC(month.y, month.m, d))} onClick={() => onPick(key)}>
            {d}
          </button>
        );
      })}
    </div>
  );
}

function TimezonePicker({ tz, locale, label, onChange }) {
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return all.includes(tz) ? all : [tz, ...all];
  }, [tz]);
  return (
    <label className="bc-tz">
      <span>🌎 {label}</span>
      <select value={tz} onChange={(e) => onChange(e.target.value)}>
        {zones.map(z => <option key={z} value={z}>{z === tz ? tzLabel(z, locale) : z.replace(/_/g, ' ')}</option>)}
      </select>
    </label>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="bc-field">
      <span className="bc-label">{label}{hint ? <> · {hint}</> : null}</span>
      {children}
    </label>
  );
}

// The guest's cancel link lands here: show which meeting, ask why, cancel.
function CancelView({ token, t, lang, locale, tz, onRebook }) {
  const [state, setState] = useState('loading'); // loading | ready | missing | already | past | done | kept
  const [info, setInfo] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${ADDON}/bookings/lookup?token=${encodeURIComponent(token)}`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) { setState('missing'); return; }
        setInfo(data);
        if (['cancelled', 'expired', 'refunded', 'payment_failed'].includes(data.status)) setState('already');
        else if (new Date(data.startUtc) <= new Date()) setState('past');
        else setState('ready');
      })
      .catch(() => setState('missing'));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) { setError(t.reasonRequired); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${ADDON}/bookings/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { clearQuery(); setState('done'); }
      else if (data.error === 'already_started') setState('past');
      else setError(t.genericError);
    } catch {
      setError(t.genericError);
    }
    setBusy(false);
  };

  const rebook = <button type="button" className="bc-btn" onClick={onRebook}>{t.rebook}</button>;

  if (state === 'loading') return <p className="bc-empty">{t.loading}</p>;
  if (state === 'missing') return <div className="bc-panel bc-form"><p>{t.cancelMissing}</p>{rebook}</div>;
  if (state === 'already') return <div className="bc-panel bc-form"><p>{t.cancelAlready}</p>{rebook}</div>;
  if (state === 'past') return <div className="bc-panel"><p>{t.cancelPast}</p></div>;
  if (state === 'kept') return <div className="bc-panel"><p>{t.keptTitle}</p></div>;
  if (state === 'done') {
    return (
      <div className="bc-panel bc-form">
        <div>
          <h2 className="bc-title">{t.cancelledTitle}</h2>
          <p className="bc-fine">{t.cancelledSub}</p>
        </div>
        {rebook}
      </div>
    );
  }

  const time = formatSlotLabel(info.startUtc, tz, locale);
  const end = info.endUtc ? ` – ${formatSlotLabel(info.endUtc, tz, locale)}` : '';
  return (
    <div className="bc-panel">
      <h2 className="bc-title">{t.cancelTitle}</h2>
      <div className="bc-detail" style={{ margin: '16px 0 20px' }}>
        <span className="bc-detail-icon">🗓</span>
        <span>
          <strong>{pickLang(info.name, lang)}</strong>
          {capitalize(formatLongDay(info.startUtc, tz, locale))} · {time}{end}
          <span className="bc-muted"> · {tzLabel(tz, locale)}</span>
        </span>
      </div>
      {info.paid && info.amountCents > 0 && (
        <p className="bc-notice">{t.cancelPaid(priceLabel(info.amountCents, info.currency, lang))}</p>
      )}
      {error && <p className="bc-error">{error}</p>}
      <form onSubmit={submit} className="bc-form">
        <Field label={t.cancelReason}>
          <textarea rows={3} maxLength={1000} required value={reason} placeholder={t.cancelReasonPlaceholder}
            onChange={(e) => setReason(e.target.value)} className="bc-input" />
        </Field>
        <button type="submit" disabled={busy} className="bc-btn bc-btn-danger">{busy ? t.cancelling : t.cancelConfirm}</button>
        <button type="button" className="bc-link" style={{ justifySelf: 'center' }}
          onClick={() => { clearQuery(); setState('kept'); }}>{t.keep}</button>
      </form>
    </div>
  );
}

function errorMessage(status, data, t, questions = [], lang = 'es') {
  const err = data?.error || '';
  if (err === 'payment_unavailable') return t.paymentUnavailable;
  if (err === 'whatsapp_invalid') return t.whatsappInvalid;
  const [kind, key] = err.split(':');
  const q = questions.find(x => x.key === key);
  if (q && kind === 'required') return t.required(pickLang(q.label, lang));
  if (q && kind === 'invalid_url') return t.invalidUrl(pickLang(q.label, lang));
  if (status === 503 && data?.error !== 'Addon not configured') return t.calendarUnavailable;
  if (status === 409) return t.slotTaken;
  return t.genericError;
}

function monthOf(date, tz) {
  const [y, m] = ymdInTz(date, tz).split('-').map(Number);
  return { y, m: m - 1 };
}

function shiftMonth({ y, m }, delta) {
  const total = y * 12 + m + delta;
  return { y: Math.floor(total / 12), m: total % 12 };
}

function monthTitle({ y, m }, locale) {
  return new Date(Date.UTC(y, m, 1)).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function pad(n) { return String(n).padStart(2, '0'); }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function firstName(name) { return (name || '').trim().split(/\s+/)[0] || ''; }
function clearQuery() { window.history.replaceState({}, '', window.location.pathname); }
