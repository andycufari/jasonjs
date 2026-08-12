---
skill: settings/api
when: "Exposing functions to external services (webhooks, public APIs)"
requires: []
---

# API Settings

> Expose functions to external services. By default, functions only accept same-origin requests.

## Quick Start

Create `settings/api.json`:

```json
{
  "routes": {
    "webhook/stripe": {
      "public": true,
      "keys": ["[[env.STRIPE_WEBHOOK_SECRET]]"]
    }
  }
}
```

External services can now POST to `/api/webhook/stripe` with the correct `X-API-Key` header.

## Route Configuration

```json
{
  "routes": {
    "path/to/function": {
      "public": true,
      "origins": ["https://allowed-origin.com"],
      "keys": ["[[env.API_KEY]]"]
    }
  }
}
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `public` | boolean | Yes | Must be `true` for external access |
| `origins` | string[] | No | Allowed origins. Omit or `["*"]` for any |
| `keys` | string[] | No | Required API keys (X-API-Key header) |

## Route Patterns

Routes match in priority: **exact → dynamic → wildcard**

```json
{
  "routes": {
    "webhook/stripe": { "public": true },
    "webhook/:provider": { "public": true },
    "public/*": { "public": true }
  }
}
```

### Exact Match

```json
"webhook/stripe": { "public": true }
```

Matches only `/api/webhook/stripe`.

### Dynamic Segments

```json
"webhook/:provider": { "public": true }
```

Matches `/api/webhook/stripe`, `/api/webhook/github`, etc.

Access in function:

```javascript
async function webhookHandler(app) {
  const provider = app.params.provider;  // "stripe" or "github"
  // ...
}
```

### Wildcards

```json
"public/*": { "public": true }
```

Matches:
- `/api/public/users`
- `/api/public/products/list`
- `/api/public/anything/nested/deep`

## Origins

Control which domains can call your API:

```json
{
  "origins": [
    "https://api.github.com",
    "https://api.stripe.com",
    "*.zapier.com",
    "*"
  ]
}
```

| Pattern | Matches |
|---------|---------|
| `https://api.github.com` | Exact origin |
| `*.zapier.com` | Any zapier.com subdomain |
| `*` | Any origin (use carefully) |

## API Keys

Require authentication for external access:

```json
// settings/.env.json
{
  "WEBHOOK_SECRET": "whsec_xxxxx",
  "PARTNER_KEY": "pk_xxxxx"
}
```

```json
// settings/api.json
{
  "routes": {
    "webhook/stripe": {
      "public": true,
      "keys": ["[[env.WEBHOOK_SECRET]]"]
    },
    "partner/sync": {
      "public": true,
      "keys": ["[[env.PARTNER_KEY]]"]
    }
  }
}
```

Client includes key in header:

```bash
curl -X POST https://yoursite.com/api/partner/sync \
  -H "X-API-Key: pk_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"data": "value"}'
```

## Common Patterns

### Stripe Webhook

```json
{
  "routes": {
    "webhook/stripe": {
      "public": true,
      "keys": ["[[env.STRIPE_WEBHOOK_SECRET]]"]
    }
  }
}
```

```javascript
// functions/webhook/stripe.js
async function stripeWebhook(app) {
  const { params, db, response, log } = app;

  const event = params;  // Stripe sends event in body

  switch (event.type) {
    case 'checkout.session.completed':
      await db.use('orders').update(event.data.object.metadata.orderId, {
        status: 'paid'
      });
      break;

    case 'customer.subscription.deleted':
      await db.use('subscriptions').update(event.data.object.id, {
        status: 'cancelled'
      });
      break;
  }

  log(`Processed Stripe event: ${event.type}`);
  return response({ received: true });
}
```

### GitHub Webhook

```json
{
  "routes": {
    "webhook/github": {
      "public": true,
      "keys": ["[[env.GITHUB_WEBHOOK_SECRET]]"]
    }
  }
}
```

### Public REST API

```json
{
  "routes": {
    "v1/*": {
      "public": true,
      "origins": ["*"]
    }
  }
}
```

### Authenticated Partner API

```json
{
  "routes": {
    "partner/*": {
      "public": true,
      "origins": ["https://partner.example.com"],
      "keys": ["[[env.PARTNER_API_KEY]]"]
    }
  }
}
```

### Multiple Webhook Providers

```json
{
  "routes": {
    "webhook/:provider": {
      "public": true,
      "keys": ["[[env.WEBHOOK_SECRET]]"]
    }
  }
}
```

Access the provider in the function:

```javascript
async function webhookHandler(app) {
  const provider = app.params.provider;  // "stripe", "github", etc.
}
```

## Security Flow

```
Incoming Request
     │
     ├─ Same origin? (Sec-Fetch-Site / Origin / Referer)
     │   ├─ Browser with matching headers → ✅ Allow
     │   └─ No headers (cURL, scripts, servers) → Treated as external ↓
     │
     ├─ Route in api.json? → No → 403 "External API access not configured"
     │
     ├─ Route match? → No → 404
     │
     ├─ public: true? → No → 403
     │
     ├─ Origin allowed? → No → 403 (browser requests only)
     │
     └─ Key valid? → No → 401
            │
            └─ ✅ Allow
```

**Same-origin detection** uses three signals in order:
1. `Sec-Fetch-Site` header (all modern browsers set this)
2. `Origin` header (browsers set on POST and cross-origin)
3. `Referer` header (fallback)

Requests with **none** of these headers (cURL, Postman, server-to-server, scripts) are treated as **external** and must pass through api.json validation.

## Important: Origins vs API Keys

`origins` only restricts **browser** requests (which send Origin headers). Non-browser clients (cURL, webhooks, server-to-server) don't send Origin headers, so the `origins` check alone won't stop them.

**For webhooks and server-to-server endpoints, always use `keys`:**

```json
{
  "routes": {
    "webhook/stripe": {
      "public": true,
      "keys": ["[[env.STRIPE_WEBHOOK_SECRET]]"]
    }
  }
}
```

## Rate Limits

Built-in rate limiting (not configurable per-route):

| Type | Limit |
|------|-------|
| General requests | 300/min per IP |
| API requests | 200/min per IP |
| Auth requests | 30 per 5min per IP |
| Suspicious requests | 50/min per IP |
| Auto-block | After 10 violations, 20min ban |

## CORS Headers

Automatically added for allowed external **browser** requests:

```
Access-Control-Allow-Origin: <matched-origin>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-Key, Authorization
Access-Control-Allow-Credentials: true
```

OPTIONS preflight handled automatically.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| 403 "External API access not configured" | No `settings/api.json` exists | Create api.json with route config |
| 403 Forbidden | Missing `public: true` or origin not allowed | Add route with `public: true` and correct origin |
| 401 Unauthorized | Missing or invalid API key | Include `X-API-Key` header with correct value |
| 404 Not Found | Route doesn't match or function missing | Check route pattern and function file exists |

> **Tip:** Test same-origin first (from the browser on the same domain). If it works without api.json, the function is correct - it's an access control issue.

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Hardcode API keys in api.json | Use `[[env.VAR_NAME]]` |
| Use `origins: "*"` without API keys | Add `keys` for sensitive endpoints |
| Rely on `origins` alone for webhooks | Use `keys` — webhooks don't send Origin headers |
| Forget `public: true` | Always required for external access |
| Trust webhook payload blindly | Validate signatures when available |
| Assume cURL/Postman is blocked by origins | Only browsers respect CORS — use `keys` for real auth |
| Assume malformed JSON throws an error | Function receives `{}` — check logs for `[API] JSON parse error` |

## Related

- `skill:function` - Writing API handlers
- `skill:settings/env` - Environment variables
- `skill:settings/workers` - Background processing for webhooks
