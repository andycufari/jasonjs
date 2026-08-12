---
skill: settings/email
when: "Configuring email sending"
requires: []
---

# Email Settings

> Configure SMTP for sending emails from functions.

## Quick Start

Add to `settings/.env.json`:

```json
{
  "EMAIL_SERVER_HOST": "smtp.gmail.com",
  "EMAIL_SERVER_PORT": "587",
  "EMAIL_SERVER_USER": "noreply@yourdomain.com",
  "EMAIL_SERVER_PASSWORD": "your-app-password",
  "EMAIL_FROM": "noreply@yourdomain.com"
}
```

Send from any function:

```javascript
async function sendWelcome(app) {
  const { params, utils, response } = app;

  await utils.sendEmail({
    to: params.email,
    subject: 'Welcome!',
    body: '<h1>Thanks for signing up</h1>'
  });

  return response({ sent: true });
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EMAIL_SERVER_HOST` | Yes | SMTP server host |
| `EMAIL_SERVER_PORT` | Yes | SMTP port (587 or 465) |
| `EMAIL_SERVER_USER` | Yes | SMTP username |
| `EMAIL_SERVER_PASSWORD` | Yes | SMTP password or app password |
| `EMAIL_FROM` | Yes | Default sender address |

## sendEmail() Options

```javascript
await app.utils.sendEmail({
  // Required
  to: 'user@example.com',           // Single or array
  subject: 'Subject line',

  // Content (one required)
  body: '<h1>HTML content</h1>',    // HTML body
  bodyText: 'Plain text fallback',  // Plain text (auto-generated if not provided)

  // Optional
  from: 'custom@yourdomain.com',    // Override EMAIL_FROM
  fromName: 'Your App',             // Sender display name
  toName: 'John Doe',               // Recipient display name

  // Templates
  template: 'auto',                 // 'auto' | 'text' | 'markdown'
  title: 'Email Title',             // Header in themed template
  preheader: 'Preview text',        // Email preview text

  // Footer
  footerText: 'Powered by MyApp',
  footerLink: 'https://myapp.com',
  hideFooter: false,

  // Calendar event
  calendarEvent: {
    summary: 'Meeting',
    start: '2024-01-15T10:00:00Z',
    end: '2024-01-15T11:00:00Z',
    description: 'Team sync',
    location: 'Zoom'
  }
});
```

## Templates

### Auto Template (default)

Wraps content in themed email template using your site's theme colors:

```javascript
await utils.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome',
  body: '<p>Thanks for joining!</p>',
  template: 'auto',
  title: 'Welcome Aboard'
});
```

### Text Template

Converts plain text to HTML with proper paragraphs and lists:

```javascript
await utils.sendEmail({
  to: 'user@example.com',
  subject: 'Update',
  body: `Here's what happened:

1. First item
2. Second item
3. Third item

Thanks!`,
  template: 'text'
});
```

### Markdown Template

Converts markdown to HTML:

```javascript
await utils.sendEmail({
  to: 'user@example.com',
  subject: 'Newsletter',
  body: `# This Week

**Big announcement:** We launched!

- Feature one
- Feature two

[Read more](https://example.com)`,
  template: 'markdown'
});
```

### Raw HTML

No template, send exactly what you provide:

```javascript
await utils.sendEmail({
  to: 'user@example.com',
  subject: 'Custom',
  body: '<!DOCTYPE html><html>...</html>'
  // No template property = raw HTML
});
```

## Calendar Invites

Send calendar invites that add to recipient's calendar:

```javascript
await utils.sendEmail({
  to: 'attendee@example.com',
  subject: 'Meeting Invite',
  body: '<p>You are invited to a meeting.</p>',
  calendarEvent: {
    summary: 'Product Review',
    start: '2024-01-20T14:00:00Z',
    end: '2024-01-20T15:00:00Z',
    description: 'Quarterly product review meeting',
    location: 'Conference Room A',
    organizer: 'organizer@example.com',
    attendees: ['attendee@example.com', 'other@example.com'],
    method: 'REQUEST',  // REQUEST | CANCEL | REPLY
    status: 'CONFIRMED' // CONFIRMED | TENTATIVE | CANCELLED
  }
});
```

## Multiple Recipients

```javascript
// Array of emails
await utils.sendEmail({
  to: ['user1@example.com', 'user2@example.com'],
  toName: ['User One', 'User Two'],  // Optional, matches order
  subject: 'Announcement',
  body: '<p>Big news!</p>'
});
```

## Common Patterns

### Order Confirmation

```javascript
async function sendOrderConfirmation(app) {
  const { params, db, utils, response } = app;

  const order = await db.use('orders').getById(params.orderId);

  await utils.sendEmail({
    to: order.email,
    subject: `Order #${order.orderNumber} Confirmed`,
    body: `
      <h2>Thank you for your order!</h2>
      <p>Order: #${order.orderNumber}</p>
      <p>Total: $${order.total}</p>
    `,
    template: 'auto',
    title: 'Order Confirmation'
  });

  return response({ sent: true });
}
```

### Password Reset

```javascript
async function sendPasswordReset(app) {
  const { params, utils, response } = app;

  const resetLink = `https://yourapp.com/reset?token=${params.token}`;

  await utils.sendEmail({
    to: params.email,
    subject: 'Reset Your Password',
    body: `
Click the link below to reset your password:

${resetLink}

This link expires in 1 hour.

If you didn't request this, ignore this email.
    `,
    template: 'text',
    title: 'Password Reset'
  });

  return response({ sent: true });
}
```

## Provider Examples

### Gmail

```json
{
  "EMAIL_SERVER_HOST": "smtp.gmail.com",
  "EMAIL_SERVER_PORT": "587",
  "EMAIL_SERVER_USER": "your@gmail.com",
  "EMAIL_SERVER_PASSWORD": "your-app-password",
  "EMAIL_FROM": "your@gmail.com"
}
```

> Use App Password, not your Gmail password. Enable 2FA first.

### SendGrid

```json
{
  "EMAIL_SERVER_HOST": "smtp.sendgrid.net",
  "EMAIL_SERVER_PORT": "587",
  "EMAIL_SERVER_USER": "apikey",
  "EMAIL_SERVER_PASSWORD": "SG.xxxx",
  "EMAIL_FROM": "noreply@yourdomain.com"
}
```

### Mailgun

```json
{
  "EMAIL_SERVER_HOST": "smtp.mailgun.org",
  "EMAIL_SERVER_PORT": "587",
  "EMAIL_SERVER_USER": "postmaster@yourdomain.com",
  "EMAIL_SERVER_PASSWORD": "your-mailgun-password",
  "EMAIL_FROM": "noreply@yourdomain.com"
}
```

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| `app.email.send()` | `app.utils.sendEmail()` |
| Use personal Gmail password | Use Gmail App Password |
| Send without `to` or `subject` | Always include both |
| Assume email was delivered | Check `result.success` |
| Hardcode SMTP credentials | Use `settings/.env.json` |

## Related

- `docs/email.md` - Human reference for email configuration and sending
- `skill:function` - Using sendEmail in functions
- `skill:settings/env` - Environment variables
