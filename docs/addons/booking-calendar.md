# Booking Calendar Addon

A Calendly-style booking flow backed by Google Calendar. The host connects one or more Google accounts and defines availability; a public `Book` component then shows free slots computed as the **intersection of freebusy across every connected calendar**, and confirmed bookings are inserted straight into the host's calendar.

- **Package**: `@addons/booking-calendar`
- **Components**: `Book` (public widget), `Settings` (host admin), `ConnectionsList`, `AvailabilityEditor`
- **Requires**: auth, database, Google OAuth credentials

## Setup

### 1. Google Cloud credentials

Create an OAuth 2.0 client in Google Cloud Console and register the redirect URI:

```
https://<your-domain>/api/addons/booking-calendar/google/callback
```

### 2. Environment variables

In the site's `settings/.env.json`:

```json
{
  "GOOGLE_CLIENT_ID": "xxx.apps.googleusercontent.com",
  "GOOGLE_CLIENT_SECRET": "GOCSPX-...",
  "GOOGLE_REDIRECT_URI": "https://<your-domain>/api/addons/booking-calendar/google/callback",
  "BOOKING_CALENDAR_STATE_SECRET": "<64 hex chars — openssl rand -hex 32>"
}
```

`BOOKING_CALENDAR_STATE_SECRET` HMACs the OAuth state parameter (anti-CSRF).

## Host settings page

Create an authenticated page mounting the `Settings` shell (tabs: Connections / Availability / Bookings):

```json
{
  "meta": { "title": "Booking Settings" },
  "auth": true,
  "components": [
    {
      "component": "div",
      "attributes": { "className": "max-w-4xl mx-auto px-6 py-12" },
      "components": [
        { "component": "h1", "attributes": { "className": "text-3xl font-bold mb-8" }, "innerHTML": "Booking calendar" },
        { "component": "@addons/booking-calendar/Settings" }
      ]
    }
  ]
}
```

From there the host connects Google accounts and sets weekly hours, timezone, meeting duration, and buffers. `Settings` accepts an optional `allowedEmails` array prop to restrict which authenticated users can see it (defaults to any logged-in user).

## Public booking page

```json
{
  "meta": { "title": "Book a meeting" },
  "fetch_data": {
    "host": { "database": "users", "query": { "email": "host@example.com" }, "findOne": true }
  },
  "components": [
    {
      "component": "div",
      "attributes": { "className": "max-w-3xl mx-auto px-6 py-16" },
      "components": [
        { "component": "h1", "attributes": { "className": "text-4xl font-bold mb-2" }, "innerHTML": "Book time with us" },
        {
          "component": "@addons/booking-calendar/Book",
          "attributes": { "userId": "{{host.id}}", "meetingType": "default" }
        }
      ]
    }
  ]
}
```

### `Book` props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `userId` | string | Yes | Host userId to book with (whose calendar gets the event) |
| `meetingType` | string | No | Availability-rule key (currently always `"default"`, 30 min) |
| `brand` | object | No | `{ primaryColor, logoUrl }` |
| `styles` | object | No | Tailwind class overrides keyed by slot/day/button |

## API routes

All under `/api/addons/booking-calendar/`:

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `google/url` | POST | ✅ | Build the OAuth authorization URL |
| `google/callback` | GET | — | OAuth callback; tokens persisted encrypted |
| `connections/list` | GET | ✅ | List connected accounts (never returns tokens) |
| `connections/disconnect` | POST | ✅ | Revoke + delete a connection |
| `availability/get` / `availability/save` | GET / POST | ✅ | Read / upsert availability rules |
| `slots` | GET | — | Public: free slots across all connections (rate-limited, 30 req/min per IP) |
| `bookings/create` | POST | — | Public: verify slot, insert calendar event |
| `bookings/list` | GET | ✅ | Host: upcoming bookings |
| `bookings/cancel` | POST | mixed | Host by session, or guest by `cancelToken` |

## Data

Three collections, created from schemas in the addon: `bc_connections` (OAuth tokens, encrypted at rest), `bc_availability_rules`, `bc_bookings`. Double-booking is prevented by a unique index on confirmed bookings.

## Known issues

- Email notifications are currently broken in the open-source runtime — the addon's `notify.js` imports `emailService` from `core/services/email.js`, which exposes `getEmailService()` instead. Bookings themselves work; confirmation emails may not send until this import is fixed.
- One meeting type (`default`, 30 minutes) is supported today; multiple meeting types are planned.
