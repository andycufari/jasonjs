// Google OAuth2 + Calendar client factory.
// Uses the framework's schema-native encryption: reads store decrypted tokens
// directly on the connection record, writes go through update() which re-encrypts.

import { google } from 'googleapis';

export function makeOAuth2Client({ clientId, clientSecret, redirectUri }) {
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Build a Calendar client bound to a specific connection's credentials,
 * persisting auto-refreshed tokens back to the database.
 *
 * @param {Object} opts
 * @param {Object} opts.database      — request.addonContext.database
 * @param {Object} opts.connection    — bc_connections row (tokens already decrypted by framework)
 * @param {string} opts.clientId
 * @param {string} opts.clientSecret
 * @param {string} opts.redirectUri
 */
export function makeCalendarForConnection({ database, connection, clientId, clientSecret, redirectUri }) {
  const oauth2 = makeOAuth2Client({ clientId, clientSecret, redirectUri });
  oauth2.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.expiryAt ? new Date(connection.expiryAt).getTime() : undefined,
    scope: connection.scope,
    token_type: 'Bearer',
  });

  // Persist new tokens when googleapis refreshes them.
  // The framework encrypts accessToken/refreshToken on update() automatically.
  oauth2.on('tokens', async (tokens) => {
    try {
      const patch = {};
      if (tokens.access_token) patch.accessToken = tokens.access_token;
      if (tokens.refresh_token) patch.refreshToken = tokens.refresh_token;
      if (tokens.expiry_date) patch.expiryAt = new Date(tokens.expiry_date);
      if (Object.keys(patch).length === 0) return;
      await database.use('bc_connections').update(connection._id || connection.id, patch);
    } catch (err) {
      console.error('[booking-calendar] Failed to persist refreshed token:', err.message);
    }
  });

  return {
    calendar: google.calendar({ version: 'v3', auth: oauth2 }),
    oauth2,
  };
}

/**
 * Fetch freebusy for one connection across its configured calendarIds.
 * Returns flat array of { start, end } ISO strings in UTC.
 */
export async function fetchConnectionBusy({ calendar, connection, fromUtc, toUtc }) {
  const items = (connection.calendarIds && connection.calendarIds.length > 0)
    ? connection.calendarIds.map(id => ({ id }))
    : [{ id: 'primary' }];

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: fromUtc,
      timeMax: toUtc,
      timeZone: 'UTC',
      items,
    },
  });

  const busy = [];
  if (data && data.calendars) {
    for (const id of Object.keys(data.calendars)) {
      const cal = data.calendars[id];
      if (cal.errors && cal.errors.length > 0) {
        console.warn(`[booking-calendar] freebusy error for calendar ${id}:`, cal.errors);
        continue;
      }
      for (const b of cal.busy || []) {
        busy.push({ start: b.start, end: b.end });
      }
    }
  }
  return busy;
}

/**
 * Insert an event on the primary (write) calendar for a connection.
 * Google handles invite delivery to attendees.
 */
export async function insertEvent({ calendar, calendarId, summary, description, startUtc, endUtc, attendees, guestTimezone }) {
  const { data } = await calendar.events.insert({
    calendarId: calendarId || 'primary',
    sendUpdates: 'all',
    conferenceDataVersion: 1,
    requestBody: {
      summary,
      description: description || '',
      start: { dateTime: startUtc, timeZone: 'UTC' },
      end: { dateTime: endUtc, timeZone: 'UTC' },
      attendees: attendees || [],
      conferenceData: {
        createRequest: {
          requestId: `bc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });
  return {
    eventId: data.id,
    htmlLink: data.htmlLink,
    hangoutLink: data.hangoutLink,
    meetLink:
      (data.conferenceData?.entryPoints || []).find(e => e.entryPointType === 'video')?.uri
      || data.hangoutLink
      || null,
  };
}

export async function deleteEvent({ calendar, calendarId, eventId }) {
  try {
    await calendar.events.delete({
      calendarId: calendarId || 'primary',
      eventId,
      sendUpdates: 'all',
    });
    return true;
  } catch (err) {
    console.warn(`[booking-calendar] deleteEvent failed for ${eventId}:`, err.message);
    return false;
  }
}

/**
 * Revoke a refresh token (best-effort — Google is lenient about dupes).
 */
export async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return false;
  try {
    const url = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`;
    const res = await fetch(url, { method: 'POST' });
    return res.ok;
  } catch (err) {
    console.warn('[booking-calendar] revoke failed:', err.message);
    return false;
  }
}

/**
 * Exchange an authorization code for tokens + user email.
 */
export async function exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
  const oauth2 = makeOAuth2Client({ clientId, clientSecret, redirectUri });
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  // userinfo endpoint (works with `openid email` scope)
  const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
  const { data: userinfo } = await oauth2Api.userinfo.get();
  return {
    tokens,
    email: userinfo?.email || null,
    verifiedEmail: !!userinfo?.verified_email,
  };
}
