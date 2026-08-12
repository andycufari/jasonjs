# Email

JasonJS sends email over SMTP (nodemailer) through one server-side call: **`app.utils.sendEmail(options)`**, available inside site functions. There is no `app.email.send()` and no client-side sending — put the send in a function and call the function from the client.

```javascript
// sites/myapp.com/functions/welcome.js
export default async function ({ app, params }) {
  const result = await app.utils.sendEmail({
    to: params.email,
    subject: 'Welcome!',
    body: '<h1>Thanks for signing up</h1>',
    template: 'auto',
    title: 'Welcome aboard'
  });
  return { sent: result.success };
}
```

## Configuration

SMTP credentials are resolved **per site first, then instance-wide**: each variable is read from the site's `settings/.env.json`, falling back to the process `.env`. That means one deployment can send from different SMTP accounts per site.

```json
// sites/myapp.com/settings/.env.json
{
  "EMAIL_SERVER_HOST": "smtp.example.com",
  "EMAIL_SERVER_PORT": "587",
  "EMAIL_SERVER_USER": "noreply@myapp.com",
  "EMAIL_SERVER_PASSWORD": "app-password",
  "EMAIL_FROM": "noreply@myapp.com"
}
```

| Variable | Purpose |
|----------|---------|
| `EMAIL_SERVER_HOST` | SMTP host |
| `EMAIL_SERVER_PORT` | 587 (STARTTLS) or 465 (implicit TLS — detected automatically) |
| `EMAIL_SERVER_USER` / `EMAIL_SERVER_PASSWORD` | SMTP credentials |
| `EMAIL_FROM` | Default sender (overridable per send with `from`) |

All four credentials are required — `sendEmail` throws "Email service not configured" otherwise. Works with any SMTP provider: Gmail (use an App Password, not your account password), SendGrid (`user: "apikey"`), Mailgun, SES, etc.

Auth emails (verification codes, magic links) use the same configuration automatically.

## `sendEmail()` options

```javascript
await app.utils.sendEmail({
  // Required
  to: 'user@example.com',           // or an array of addresses
  subject: 'Subject line',
  body: '<p>HTML content</p>',      // or bodyText for plain text

  // Optional
  from: 'other@myapp.com',          // overrides EMAIL_FROM
  fromName: 'My App',               // display name
  toName: 'Ada',                    // or array matching `to`

  // Templating
  template: 'auto',                 // 'auto' | 'text' | 'markdown' | omit for raw HTML
  title: 'Email heading',           // header in the themed template
  preheader: 'Inbox preview text',

  // Footer (defaults come from jason.config.js → email.footerText/footerLink)
  footerText: 'Powered by MyApp',
  footerLink: 'https://myapp.com',
  hideFooter: false,

  // Calendar invite (attaches an iCal event)
  calendarEvent: {
    summary: 'Product review',
    start: '2026-09-01T14:00:00Z',
    end: '2026-09-01T15:00:00Z',
    description: 'Quarterly review',
    location: 'Meet',
    method: 'REQUEST'               // REQUEST | CANCEL | REPLY
  }
});
```

Returns `{ success: true, ... }` on success; missing `to`/`subject`/`body` or unconfigured SMTP **throw**, so wrap in try/catch when the send is best-effort.

### Templates

- **`auto`** (recommended) — wraps your HTML in a responsive email shell styled with the *site's theme colors*, with title, preheader, and footer.
- **`text`** — takes plain text, converts paragraphs/lists to clean HTML.
- **`markdown`** — renders markdown to HTML.
- **omit `template`** — sends your `body` exactly as given (bring your own `<!DOCTYPE html>`).

The default footer text/link for all sites on the instance lives in [`jason.config.js`](../jason.config.js) (`email.footerText`, `email.footerLink`); per-send options override it, `hideFooter: true` removes it.

## Patterns

Order confirmation:

```javascript
export default async function ({ app, params }) {
  const order = await app.db.use('orders').getById(params.orderId);

  await app.utils.sendEmail({
    to: order.email,
    subject: `Order #${order.number} confirmed`,
    body: `<h2>Thank you!</h2><p>Order #${order.number} — total $${order.total}</p>`,
    template: 'auto',
    title: 'Order confirmation'
  });
  return { ok: true };
}
```

Calendar invite that lands in the recipient's calendar:

```javascript
await app.utils.sendEmail({
  to: attendee.email,
  subject: 'Booking confirmed',
  body: `<p>See you ${when}.</p>`,
  calendarEvent: { summary: 'Session', start, end, location: 'Studio' }
});
```

## Gotchas

| Don't | Do |
|-------|----|
| `app.email.send()` | `app.utils.sendEmail()` — inside a server function |
| Send from the client | Client calls a function; the function sends |
| Use your Gmail password | Use a Gmail App Password (2FA required) |
| Hardcode SMTP credentials in code | `settings/.env.json` (per site) or `.env` (instance) |
| Assume delivery | Check `result.success` and try/catch the call |

The agent-oriented version: [skills/settings/email.md](../skills/settings/email.md).
