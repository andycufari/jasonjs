// Host-notification email for new bookings.
// Uses the framework's emailService directly (not available on route context).

import { emailService } from '../../../core/services/email.js';

export async function notifyHostOfBooking({ domain, hostEmail, booking }) {
  if (!hostEmail) return { success: false, error: 'hostEmail missing' };
  const subject = `New booking: ${booking.guestName} — ${formatWhen(booking.startUtc, booking.timezoneGuest)}`;
  const html = renderHtml(booking);
  try {
    const result = await emailService.send(domain, {
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
      <h2 style="margin: 0 0 12px 0;">New booking</h2>
      <p><strong>${escapeHtml(b.guestName)}</strong> &lt;${escapeHtml(b.guestEmail)}&gt;</p>
      <p><strong>When:</strong> ${formatWhen(b.startUtc, b.timezoneGuest)} (guest tz)</p>
      ${b.meetLink ? `<p><strong>Meet link:</strong> <a href="${b.meetLink}">${b.meetLink}</a></p>` : ''}
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
