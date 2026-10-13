// Host-notification email for new bookings.
// Uses the framework's emailService directly (not available on route context).

import { getEmailService } from '../../../core/services/email.js';

export async function notifyHostOfBooking({ domain, hostEmail, booking }) {
  if (!hostEmail) return { success: false, error: 'hostEmail missing' };
  const subject = `${booking.typeName ? `${booking.typeName}: ` : 'New booking: '}${booking.guestName} — ${formatWhen(booking.startUtc, booking.timezoneGuest)}`;
  const html = renderHtml(booking);
  try {
    const result = await getEmailService().send(domain, {
      to: hostEmail,
      subject,
      html,
    });
    return result;
  } catch (err) {
    console.warn('[booking-calendar] notifyHostOfBooking failed:', err.message);
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

function renderHtml(b) {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <h2 style="margin: 0 0 12px 0;">${escapeHtml(b.typeName || 'New booking')}</h2>
      ${b.subject ? `<p style="font-size: 16px;"><strong>${escapeHtml(b.subject)}</strong></p>` : ''}
      <p><strong>${escapeHtml(b.guestName)}</strong> &lt;${escapeHtml(b.guestEmail)}&gt;</p>
      ${b.whatsapp ? `<p><strong>WhatsApp:</strong> ${escapeHtml(b.whatsapp)}</p>` : ''}
      <p><strong>When:</strong> ${formatWhen(b.startUtc, b.timezoneGuest)} (guest tz)</p>
      ${b.amountCents ? `<p><strong>Paid:</strong> ${escapeHtml(b.currency)} ${b.amountCents / 100}</p>` : ''}
      ${b.meetLink ? `<p><strong>Meet link:</strong> <a href="${b.meetLink}">${b.meetLink}</a></p>` : ''}
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
