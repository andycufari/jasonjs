// Emails to the host: a new booking, a guest cancelling.
// Uses the framework's emailService directly (not available on route context).
// The guest hears from Google Calendar instead (invite / cancellation, sendUpdates: 'all').

import { getEmailService } from '../../../core/services/email.js';

export async function notifyHostOfBooking({ domain, hostEmail, booking, hostTimezone }) {
  const subject = `${booking.typeName ? `${booking.typeName}: ` : 'New booking: '}${booking.guestName} — ${formatWhen(booking.startUtc, hostTimezone || booking.timezoneGuest)}`;
  return send(domain, hostEmail, subject, renderBooking(booking, hostTimezone));
}

export async function notifyHostOfCancellation({ domain, hostEmail, booking, reason, hostTimezone }) {
  const subject = `Cancelled — ${booking.typeName ? `${booking.typeName}: ` : ''}${booking.guestName} — ${formatWhen(booking.startUtc, hostTimezone || booking.timezoneGuest)}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <h2 style="margin: 0 0 12px 0;">${escapeHtml(booking.guestName)} cancelled</h2>
      <p><strong>Reason:</strong><br>${reason ? escapeHtml(reason).replace(/\n/g, '<br>') : '<em>(none given)</em>'}</p>
      ${booking.amountCents ? `<p><strong>Paid ${escapeHtml(booking.currency)} ${booking.amountCents / 100}</strong> — not refunded automatically. Refund it from ${booking.provider === 'mercadopago' ? 'MercadoPago' : 'Stripe'} if it applies${booking.paymentId ? ` (payment ${escapeHtml(booking.paymentId)})` : ''}.</p>` : ''}
      <hr style="border: none; border-top: 1px solid #ddd; margin: 16px 0;">
      ${renderBooking(booking, hostTimezone)}
    </div>
  `;
  return send(domain, hostEmail, subject, html);
}

async function send(domain, to, subject, body) {
  if (!to) return { success: false, error: 'hostEmail missing' };
  try {
    // emailService takes the HTML as `body` (an `html` key is passed through untouched
    // and send() rejects the message for having no body).
    return await getEmailService().send(domain, { to, subject, body });
  } catch (err) {
    console.warn('[booking-calendar] host email failed:', err.message);
    return { success: false, error: err.message };
  }
}

function formatWhen(startUtc, tz) {
  try {
    const d = new Date(startUtc);
    return d.toLocaleString('en-US', { timeZone: tz || 'UTC', dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return startUtc;
  }
}

function renderBooking(b, hostTimezone) {
  const tz = hostTimezone || b.timezoneGuest;
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <h2 style="margin: 0 0 12px 0;">${escapeHtml(b.typeName || 'New booking')}</h2>
      ${b.subject ? `<p style="font-size: 16px;"><strong>${escapeHtml(b.subject)}</strong></p>` : ''}
      <p><strong>${escapeHtml(b.guestName)}</strong> &lt;${escapeHtml(b.guestEmail)}&gt;</p>
      ${b.whatsapp ? `<p><strong>WhatsApp:</strong> ${escapeHtml(b.whatsapp)}</p>` : ''}
      <p><strong>When:</strong> ${formatWhen(b.startUtc, tz)} (${escapeHtml(tz || 'UTC')})</p>
      ${b.amountCents ? `<p><strong>Paid:</strong> ${escapeHtml(b.currency)} ${b.amountCents / 100}</p>` : ''}
      ${b.meetLink ? `<p><strong>Meet link:</strong> <a href="${escapeHtml(b.meetLink)}">${escapeHtml(b.meetLink)}</a></p>` : ''}
      ${(b.answers || []).map(a => `<p><strong>${escapeHtml(a.label)}</strong><br>${escapeHtml(a.value).replace(/\n/g, '<br>')}</p>`).join('')}
      ${b.guestNotes ? `<p><strong>Notes:</strong><br>${escapeHtml(b.guestNotes).replace(/\n/g, '<br>')}</p>` : ''}
    </div>
  `;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
