// Turn a booking row that holds its slot into a real meeting: Google event on the
// primary connection, row → confirmed, host notified. Used by bookings/create (free
// types) and by the payment hook (paid types, once the money is in).

import { makeCalendarForConnection, insertEvent } from './googleClient.js';
import { notifyHostOfBooking } from './notify.js';
import { idOf, updateOrThrow } from './db.js';

export function cancelUrlFor(origin, cancelToken) {
  return `${origin}/api/addons/booking-calendar/bookings/cancel?token=${cancelToken}`;
}

/**
 * @throws {Error} code EVENT_INSERT_FAILED when Google refused the event (nothing was created)
 * @returns {Promise<{ meetLink: string|null, cancelUrl: string }>}
 */
export async function confirmBooking({ database, domain, origin, booking, rules, connections, env }) {
  const primary = connections.find(c => c.isPrimary) || connections[0];
  const cancelUrl = cancelUrlFor(origin, booking.cancelToken);

  const typeName = rules.name?.es || rules.name?.en || booking.meetingType;

  let eventResult;
  try {
    const { calendar } = makeCalendarForConnection({
      database, connection: primary,
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    });
    const title = (rules.eventTitleTemplate || '{guestName} · {type}')
      .replace('{guestName}', booking.guestName)
      .replace('{type}', typeName);
    eventResult = await insertEvent({
      calendar,
      calendarId: primary.writeCalendarId || 'primary',
      summary: title,
      description: buildEventDescription({ ...booking, cancelUrl }),
      startUtc: new Date(booking.startUtc).toISOString(),
      endUtc: new Date(booking.endUtc).toISOString(),
      attendees: [{ email: booking.guestEmail, displayName: booking.guestName }],
      guestTimezone: booking.timezoneGuest,
    });
  } catch (err) {
    console.error('[booking-calendar] insertEvent failed:', err);
    const failed = new Error('Failed to create calendar event');
    failed.code = 'EVENT_INSERT_FAILED';
    throw failed;
  }

  const meetLink = eventResult.meetLink || eventResult.hangoutLink || null;
  await updateOrThrow(database.use('bc_bookings'), idOf(booking), {
    status: 'confirmed',
    googleEventId: eventResult.eventId,
    googleCalendarId: primary.writeCalendarId || 'primary',
    meetLink,
  });

  // Host notification (best-effort).
  if (primary.googleAccountEmail) {
    await notifyHostOfBooking({
      domain,
      hostEmail: primary.googleAccountEmail,
      booking: {
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        guestNotes: booking.guestNotes,
        subject: booking.subject,
        whatsapp: booking.whatsapp,
        answers: booking.answers,
        typeName,
        amountCents: booking.amountCents,
        currency: booking.currency,
        startUtc: new Date(booking.startUtc).toISOString(),
        timezoneGuest: booking.timezoneGuest,
        meetLink,
      },
    });
  }

  return { meetLink, cancelUrl };
}

// What the host reads when the meeting starts: who, what about, and their answers.
function buildEventDescription({ guestName, guestEmail, subject, whatsapp, answers, guestNotes, cancelUrl, amountCents, currency }) {
  const lines = [];
  if (subject) lines.push(subject, '');
  lines.push(`${guestName} <${guestEmail}>`);
  if (whatsapp) lines.push(`WhatsApp: ${whatsapp}`);
  if (amountCents) lines.push(`Paid: ${currency} ${amountCents / 100}`);
  for (const a of answers || []) lines.push('', `${a.label}`, a.value);
  if (guestNotes) lines.push('', 'Notes:', guestNotes);
  lines.push('', `Cancel: ${cancelUrl}`);
  return lines.join('\n');
}
