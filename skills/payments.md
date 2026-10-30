---
skill: payments
when: "Selling something once (a ticket, a workshop seat, a deposit, an order) with Stripe or MercadoPago — not a subscription"
requires: [function, database]
---

# One-time payments

> A site function sells something at its own price; the framework runs your handler when the money arrives.
> Subscriptions and plans are `skill:billing`.

## How it flows

```
page ──call──▶ function "sell"      ── creates your row (pending) and app.billing.checkout(...)
   ◀── { url } ──┘                        price decided HERE, never by the browser
browser ──▶ Stripe / MercadoPago checkout
provider ──webhook──▶ framework ──runs──▶ function "onPaid"   (app.source === 'billing')
                                              marks the row paid, sends the mail
browser ◀── returnUrl ──  page polls the row's state (the webhook may land after the redirect)
```

Two functions, one table. The framework creates the checkout, verifies the webhook, routes it to
the right site and runs your handler. Everything about **what** is sold (price, discounts,
capacity, mails) stays in your site.

## Setup

`setting/billing.json`, with the keys in the site's env:

```json
{
  "stripe": { "secretKey": "[[env.STRIPE_SECRET_KEY]]", "statementDescriptorSuffix": "ACME" },
  "mercadopago": { "accessToken": "[[env.MP_ACCESS_TOKEN]]", "statementDescriptor": "ACME" }
}
```

- **MercadoPago:** nothing to configure in its panel. Every checkout names the site's own webhook.
- **Stripe:** the account needs one webhook at `https://<any site of the account>/api/billing/webhook/stripe`
  (`checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_*`).
  It routes each event to its site by `metadata.domain`, which `app.billing.checkout` sets.

## Recipe

### 1. The table: one row per payment attempt

```json
// database/orders.json
{
  "type": "jason",
  "schema": {
    "email":       { "type": "text", "required": true },
    "estado":      { "type": "text" },            // pending → paid | failed | expired; paid → refunded
    "provider":    { "type": "text" },
    "currency":    { "type": "text" },
    "amountCents": { "type": "number" },
    "statusToken": { "type": "text" },            // lets the return page read its own state
    "checkoutId":  { "type": "text" },
    "paymentId":   { "type": "text" },
    "paidAt":      { "type": "date" },
    "mailAt":      { "type": "date" }
  },
  "security": { "read": "admin", "create": "admin", "update": "admin", "delete": "admin" }
}
```

Keep **every attempt**, not only the paid ones: an abandoned checkout or a failed card is what
you'll want to see when someone writes "I paid and got nothing".

### 2. The function that sells

```js
// function/sell.js — called by the page with app.functions.call('sell', {...})
var PRICE = { stripe: { currency: 'USD', cents: 4400 }, mercadopago: { currency: 'ARS', cents: 5500000 } };

async function sell(app) {
  var p = app.params, price = PRICE[p.provider];
  if (!price) return app.response({ error: 'Pick a payment method' }, 'BAD_REQUEST');
  if (String(p.email || '').indexOf('@') < 1) return app.response({ error: 'Email missing' }, 'BAD_REQUEST');

  var db = app.db.use('orders', true);
  var token = app.crypto.randomToken(16);
  var row = await db.add({ email: p.email, estado: 'pending', provider: p.provider,
    currency: price.currency, amountCents: price.cents, statusToken: token });
  var id = String(row.getValues()._id);

  var co = await app.billing.checkout({
    provider: p.provider,                 // 'stripe' | 'mercadopago'
    email: p.email,
    items: [{ name: 'Workshop', description: 'Saturday 14/11', amount: price.cents }], // integer cents
    currency: price.currency,
    reference: id,                        // back as payment.metadata.reference
    onPaid: 'orderPaid',                  // the handler below
    expiresAt: new Date(Date.now() + 60 * 60000).toISOString(), // Stripe: 30 min to 24 h
    returnUrl: 'https://' + app.domain + '/workshop?order=' + id + '&s=' + token,
    cancelUrl: 'https://' + app.domain + '/workshop?cancelled=1'
  });
  await db.update(id, { checkoutId: co.id });
  return app.response({ url: co.url });   // the page does window.location.href = url
}
```

### 3. The handler

```js
// function/orderPaid.js — run by the payment webhook. Never by HTTP.
async function orderPaid(app) {
  if (app.source !== 'billing') return app.response({ error: 'billing only' }, 'FORBIDDEN');
  var p = app.params;                      // { event, provider, payment | checkout }
  var obj = p.payment || p.checkout || {};
  var db = app.db.use('orders', true);
  var row = await db.getById(String(obj.metadata && obj.metadata.reference || obj.externalReference || ''));
  if (!row) return app.response({ ok: true });              // nothing a retry can fix: log it
  row = row.getValues ? row.getValues() : row;
  var id = String(row._id);

  if (p.event === 'failed' || p.event === 'expired') {
    if (row.estado === 'pending') await db.update(id, { estado: p.event });
    return app.response({ ok: true });
  }
  if (row.estado === 'paid') return app.response({ ok: true }); // providers deliver twice

  if (obj.amount !== row.amountCents || String(obj.currency).toLowerCase() !== row.currency.toLowerCase()) {
    await db.update(id, { estado: 'review' });                  // don't trust a different amount
    return app.response({ ok: true });
  }
  await db.update(id, { estado: 'paid', paymentId: obj.id, paidAt: new Date().toISOString() });
  // mail AFTER recording the payment; if it fails, don't answer an error (see Gotchas)
  return app.response({ ok: true });
}
```

### 4. The return page

`returnUrl` brings the buyer back **before or after** the webhook arrives. Poll a small public
action (`{ action: 'state', id, s }` compared with `app.crypto.safeEqual` against `statusToken`)
every 2 s for up to a minute: "Confirming your payment…" → "You're in!".

## API (functions only)

| Call | What it does |
|---|---|
| `app.billing.checkout(opts)` | Creates the checkout server-side. `{ provider, email, items: [{ name, description?, amount, quantity? }], currency, reference, onPaid, returnUrl, cancelUrl, expiresAt?, metadata? }` → `{ provider, id, url }` |
| `app.billing.providers()` | Providers with keys on this site: `['stripe', 'mercadopago']` (+ `'test'` for an admin) |
| `app.billing.refund({ provider, paymentId, reason? })` | Full refund through the provider that took it. Admin session or billing handler only |
| `app.billing.payments({ limit?, status?, since? })` | The ledger (below), newest first. Admin session only |

The handler gets `app.params = { event: 'succeeded' | 'failed' | 'expired', provider: 'stripe' | 'mercadopago', payment | checkout }`.
`payment` = `{ id, amount (cents), currency, email, status, metadata, externalReference }`.

## Handler checklist

- [ ] First line: `if (app.source !== 'billing')` → 403.
- [ ] Look up your row by `metadata.reference` (MercadoPago also gives `externalReference`).
- [ ] Already paid? Return OK. Providers deliver the same event more than once.
- [ ] Compare `amount` **and** `currency` with your row before marking it paid.
- [ ] Record the payment first, then side effects (mail, counters, notifications).
- [ ] Answer 4xx/5xx only when a retry can fix it: the provider retries and the money is already taken.
- [ ] Don't set `config.auth = true` on the handler: it runs without a session.

## Test mode: the whole flow without money

`provider: 'test'` works for a **logged-in admin** only, with no keys. The checkout URL is a framework
page (`/api/billing/test-checkout`) with **Pay (simulated)** and **Decline**; it runs your `onPaid`
exactly like a webhook, with `provider: 'test'` and `payment.simulated === true`, then sends the
browser to `returnUrl`. Your rows, mails, capacity and panel all run for real.

- Offer it where an admin can see it: `app.billing.providers()` already returns `'test'` for admins,
  so a page that renders one button per provider shows it only to you.
- Decide what a simulated payment means in your handler (e.g. store `provider: 'test'` and leave it
  out of totals). `app.billing.refund({ provider: 'test' })` "refunds" without calling anyone.
- If the handler fails, the test page shows the error instead of retrying.

## The ledger: every checkout, how it ended

The framework records each `app.billing.checkout` in a shared ledger: amount, provider, buyer,
function and reference, status (`open` → `succeeded` · `failed` · `expired` → `refunded`) and
**whether your handler took it** (and its error when it didn't). You don't write to it.

- `cm64 payments [--status failed] [--days 7] [--test]`: from the terminal.
- `app.billing.payments()` (admin) for a panel inside the site.
- A `⚠ handler` line means the provider charged and your function failed: the provider retries,
  but look at the function now.

Keep your own table anyway: the ledger knows about money, your table knows about your business
(who has a seat, which code they used, whether the mail went out).

## Testing

- Same-origin only: a `curl` to `/api/<fn>` gets `403 External API access not configured`.
  Send the headers a browser sends (`Origin`, `Referer` and `Sec-Fetch-Site: same-origin` with the site's URL),
  or expose the route in `setting/api.json` (`skill:settings/api`).
- End to end without money: test mode (above).
- Unit-test the two functions by evaluating their source with a fake `app` (in-memory `db`,
  `billing.checkout` that records its options, `utils.sendEmail` that collects mails). The money logic lives there.
- `console`/`app.log` from a billing or trigger handler do **not** show in `cm64 debug`: they go to the server logs.

## Gotchas

| ❌ Don't | ✅ Do |
|---|---|
| Take the price from the request body (or use `/api/billing/guest-checkout` for a price) | Compute it in the function and pass it to `app.billing.checkout` |
| Use decimals | Integer cents: USD 44 → `4400`, ARS 55.000 → `5500000` |
| Mark paid on the return URL | Mark paid in the handler; the return page only reads the state |
| Wait for an "expired" from MercadoPago | It never sends one: treat a `pending` older than its `expiresAt` as expired |
| Leave a 100 % discount to the checkout | `amount` must be > 0: register free seats from an admin action |
| Put `function`, `domain`, `siteId` or `reference` in `metadata` | They are reserved (routing and handler) |
| Cash/ATM methods for something with a date | `checkout` sets MercadoPago to instant methods only |

## Worked example

`andy.cm64.io`, the workshop (2026-10): `function/taller.js` (price with presale, discount codes,
waitlist link that keeps the presale price, capacity), `function/tallerPagos.js` (handler + admin actions:
refund, resend mail with `.ics`, manual seats, reminder) and `component/TallerPanel.jsx` (every attempt with its state).

## Related

- `skill:billing` — subscriptions and plans
- `cm64 payments` — the ledger from the terminal
- `skill:function` — `app.params`, `app.source`, `app.crypto`, `app.utils.sendEmail` (its `calendarEvent` attaches an `.ics`)
- `skill:database` — tables and triggers
