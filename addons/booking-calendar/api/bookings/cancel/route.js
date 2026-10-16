// Cancel a booking.
//   POST {id, reason?}     host, with an authenticated session (Settings → Bookings).
//   POST {token, reason?}  guest, with the cancelToken from their link (Book's cancel view).
//   GET  ?token=           never cancels — mail scanners open every link in an email. It
//                          redirects to the page the guest booked on (Book opens its cancel
//                          view on ?cancel=) or, for rows without a pagePath, serves a bare
//                          confirm form that POSTs back here.
// Deletes the Google event (Google emails the guest), marks the row cancelled and, when the
// guest cancelled, emails the host with their reason.

import { NextResponse } from 'next/server';
import { loadBookingEnv } from '../../../lib/env.js';
import { makeCalendarForConnection, deleteEvent } from '../../../lib/googleClient.js';
import { expireBookingCheckout } from '../../../lib/payments.js';
import { idOf, updateOrThrow } from '../../../lib/db.js';
import { fetchRules } from '../../../lib/meetingTypes.js';
import { typeNameOf, bookingForEmail } from '../../../lib/confirmBooking.js';
import { notifyHostOfCancellation } from '../../../lib/notify.js';
import { publicOrigin } from '../../../lib/publicOrigin.js';

const MAX_REASON = 1000;

async function findByToken(bookings, token) {
  if (typeof token !== 'string' || !token) return null;
  const result = await bookings.fetch({ filters: { cancelToken: token }, limit: 1 });
  return Array.isArray(result) ? result[0] : (result?.data?.[0] || null);
}

/** @returns {Promise<{ status: number, body: object }>} */
async function cancel(request, { id, token, reason }) {
  const { database, session, domain } = request.addonContext;
  const bookings = database.use('bc_bookings');
  const byGuest = !!token;

  let row = null;
  if (token) {
    row = await findByToken(bookings, token);
  } else if (id) {
    const userId = session?.user?.id || session?.user?.email;
    if (!userId) return { status: 401, body: { error: 'Authentication required' } };
    const result = await bookings.fetch({ filters: { _id: id, userId }, limit: 1 });
    row = Array.isArray(result) ? result[0] : (result?.data?.[0] || null);
  } else {
    return { status: 400, body: { error: 'id or token required' } };
  }

  if (!row) return { status: 404, body: { error: 'Not found' } };
  if (row.status === 'cancelled') return { status: 200, body: { ok: true, alreadyCancelled: true } };

  // Abandoned checkout (guest came back without paying): close the checkout so nobody
  // can pay for a slot we're releasing. A payment that slips in anyway is handled by
  // hooks/billing.js (re-takes the slot or refunds).
  if (row.status === 'pending_payment' && !row.paymentId) {
    if (row.checkoutId || row.stripeSessionId) {
      try {
        await expireBookingCheckout(domain, row);
      } catch (err) {
        console.warn('[booking-calendar] cancel: could not expire checkout session (continuing):', err.message);
      }
    }
    await updateOrThrow(bookings, idOf(row), { status: 'cancelled', slotLock: null });
    return { status: 200, body: { ok: true } };
  }

  if (byGuest && new Date(row.startUtc) <= new Date()) {
    return { status: 409, body: { error: 'already_started' } };
  }

  const connResult = await database.use('bc_connections').fetch({ filters: { userId: row.userId } });
  // The event lives in whichever account was primary when it was booked, and the primary
  // can be changed in Settings since — so try the current primary first, then the others.
  const conns = (Array.isArray(connResult) ? connResult : (connResult?.data || []))
    .sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
  let holder = null;

  // Best-effort Google event delete.
  if (row.googleEventId && conns.length) {
    try {
      const env = await loadBookingEnv(domain);
      for (const conn of conns) {
        const { calendar } = makeCalendarForConnection({
          database, connection: conn,
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri: env.GOOGLE_REDIRECT_URI,
        });
        const deleted = await deleteEvent({
          calendar,
          calendarId: row.googleCalendarId || conn.writeCalendarId || 'primary',
          eventId: row.googleEventId,
        });
        if (deleted) { holder = conn; break; }
      }
      if (!holder) {
        console.warn(`[booking-calendar] cancel: event ${row.googleEventId} not deleted in any connection (continuing)`);
      }
    } catch (err) {
      console.warn('[booking-calendar] cancel: google delete failed (continuing):', err.message);
    }
  }

  // slotLock null frees the slot in the unique index. A paid booking is cancelled
  // without an automatic refund — that's the host's call, from Stripe.
  const cancelReason = typeof reason === 'string' ? reason.trim().slice(0, MAX_REASON) : '';
  await updateOrThrow(bookings, idOf(row), {
    status: 'cancelled',
    slotLock: null,
    cancelledAt: new Date(),
    cancelledBy: byGuest ? 'guest' : 'host',
    cancelReason,
  });

  // The host deleted it themselves in the second case; the guest gets Google's email.
  if (byGuest) {
    const hostEmail = (holder || conns[0])?.googleAccountEmail;
    const rules = await fetchRules(database, row.userId, row.meetingType).catch(() => null);
    await notifyHostOfCancellation({
      domain,
      hostEmail,
      booking: bookingForEmail(row, typeNameOf(rules, row.meetingType)),
      reason: cancelReason,
      hostTimezone: rules?.timezone,
    });
  }

  return { status: 200, body: { ok: true } };
}

export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    const row = await findByToken(request.addonContext.database.use('bc_bookings'), token);
    if (row?.pagePath) {
      return NextResponse.redirect(`${publicOrigin(request)}${row.pagePath}?cancel=${encodeURIComponent(token)}`, 302);
    }
    return html(confirmPage({ token, row, lang: langOf(request) }), row ? 200 : 404);
  } catch (err) {
    console.error('[booking-calendar] bookings/cancel GET error:', err);
    return html(page('Error', '<p>Something went wrong.</p>'), 500);
  }
}

export async function POST(request) {
  try {
    const isForm = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
    if (isForm) {
      // The bare confirm page below.
      const form = await request.formData();
      const { status, body } = await cancel(request, { token: form.get('token'), reason: form.get('reason') });
      const t = PAGE_STRINGS[langOf(request)];
      const message = body.ok ? t.done : body.error === 'already_started' ? t.started : t.failed;
      return html(page(t.title, `<p>${message}</p>`), status);
    }
    const data = await request.json().catch(() => ({}));
    const { status, body } = await cancel(request, { id: data.id, token: data.token, reason: data.reason });
    return NextResponse.json(body, { status });
  } catch (err) {
    console.error('[booking-calendar] bookings/cancel error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── Bare confirm page (bookings without a pagePath) ─────────────────────────────

const PAGE_STRINGS = {
  es: {
    title: 'Cancelar reunión', ask: '¿Cancelamos esta reunión?', reason: 'Motivo',
    button: 'Cancelar la reunión', notFound: 'Este link de cancelación no es válido.',
    already: 'Esta reunión ya estaba cancelada.', done: 'Listo, la reunión quedó cancelada.',
    started: 'Esta reunión ya empezó o ya pasó.', failed: 'No pudimos cancelarla. Probá de nuevo.',
  },
  en: {
    title: 'Cancel meeting', ask: 'Cancel this meeting?', reason: 'Reason',
    button: 'Cancel the meeting', notFound: "This cancellation link isn't valid.",
    already: 'This meeting was already cancelled.', done: 'Done — the meeting is cancelled.',
    started: 'This meeting has already started or passed.', failed: "We couldn't cancel it. Please try again.",
  },
};

function langOf(request) {
  return /^en\b/i.test(request.headers.get('accept-language') || '') ? 'en' : 'es';
}

function confirmPage({ token, row, lang }) {
  const t = PAGE_STRINGS[lang];
  if (!row) return page(t.title, `<p>${t.notFound}</p>`);
  if (row.status === 'cancelled') return page(t.title, `<p>${t.already}</p>`);
  const when = new Date(row.startUtc).toLocaleString(lang === 'en' ? 'en-US' : 'es-AR', {
    timeZone: row.timezoneGuest || 'UTC', dateStyle: 'full', timeStyle: 'short',
  });
  return page(t.title, `
    <h1>${t.ask}</h1>
    <p>${escapeHtml(when)}</p>
    <form method="post">
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <label>${t.reason}<br><textarea name="reason" rows="4" maxlength="${MAX_REASON}" required></textarea></label>
      <button type="submit">${t.button}</button>
    </form>`);
}

function page(title, inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;line-height:1.5}
textarea{width:100%;box-sizing:border-box;margin:6px 0 12px;padding:8px;font:inherit}button{padding:10px 16px;font:inherit;cursor:pointer}</style>
</head><body>${inner}</body></html>`;
}

function html(markup, status = 200) {
  return new NextResponse(markup, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
