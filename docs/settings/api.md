# API Access

Expose specific functions to external services. By default, functions only accept same-origin requests.

## Quick Start

```json
// settings/api.json
{
  "routes": {
    "webhook/stripe": {
      "public": true,
      "origins": ["https://api.stripe.com"],
      "keys": ["[[env.STRIPE_WEBHOOK_SECRET]]"]
    }
  }
}
```

That's it. External services can now POST to `/api/webhook/stripe` with the secret key.

## Route Patterns

Routes match in priority order: exact → dynamic → wildcard.

```json
{
  "routes": {
    // 1. Exact match - highest priority
    "webhook/stripe": { "public": true },

    // 2. Dynamic segments - capture values
    "webhook/:provider": { "public": true },

    // 3. Wildcards - match everything
    "public/*": { "public": true }
  }
}
```

### Dynamic Segments

Captured values available as `app.params`:

```javascript
// functions/webhook/:provider.js
export default async function handler({ app, params }) {
  const provider = app.params.provider; // "stripe" or "github"

  // Handle webhook
}
```

Request: `/api/webhook/stripe` → `app.params.provider = "stripe"`

### Wildcards

```json
"public/*": { "public": true }
```

Matches:
- `/api/public/users`
- `/api/public/products/list`
- `/api/public/anything/nested/deep`

Wildcard value in `app.params['*']`.

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `public` | boolean | Must be `true` for external access |
| `origins` | string[] | Allowed origins. Use `["*"]` for any |
| `keys` | string[] | Required API keys (X-API-Key header) |

### Origins

```json
{
  "origins": [
    "https://api.github.com",           // Exact
    "*.zapier.com",                      // Wildcard subdomain
    "*"                                  // Any origin (use carefully)
  ]
}
```

### API Keys

Always use environment variables for secrets:

```json
// settings/.env
{
  "GITHUB_SECRET": "ghp_...",
  "PARTNER_KEY": "pk_..."
}

// settings/api.json
{
  "routes": {
    "webhook/github": {
      "public": true,
      "keys": ["[[env.GITHUB_SECRET]]"]
    }
  }
}
```

Client includes key in header:
```bash
curl -H "X-API-Key: ghp_..." https://yoursite.com/api/webhook/github
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
            └─ ✅ Allow + CORS headers
```

Same-origin requests always allowed (no `api.json` needed). Same-origin is detected via `Sec-Fetch-Site`, `Origin`, or `Referer` headers. Requests with **none** of these (cURL, Postman, server-to-server) are treated as external.

> **Important:** `origins` only restricts **browser** requests. Non-browser clients (cURL, webhooks, scripts) don't send Origin headers, so `origins` alone won't protect endpoints. Always use `keys` for server-to-server and webhook endpoints.

## Examples

### GitHub Webhooks

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

### Multiple Providers

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

### Public API

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

### Partner API with Auth

```json
{
  "routes": {
    "partner/sync": {
      "public": true,
      "origins": ["https://partner.example.com"],
      "keys": ["[[env.PARTNER_API_KEY]]"]
    }
  }
}
```

### Mixed Security

```json
{
  "routes": {
    // Webhooks with key auth
    "webhook/*": {
      "public": true,
      "keys": ["[[env.WEBHOOK_SECRET]]"]
    },

    // Authenticated API (any origin, requires key)
    "api/*": {
      "public": true,
      "origins": ["*"],
      "keys": ["[[env.API_KEY]]"]
    },

    // Partner-only endpoints (restricted origin + key)
    "partner/*": {
      "public": true,
      "origins": ["https://partner.com"],
      "keys": ["[[env.PARTNER_KEY]]"]
    }
  }
}
```

## Rate Limiting

**You cannot configure rate limits.** The framework applies them globally:

| Type | Limit |
|------|-------|
| API requests | 200/min per IP |
| General requests | 300/min per IP |
| Auth requests | 30 per 5min per IP |

This protects shared infrastructure from abuse.

## CORS Headers

Automatically added for external requests:

```
Access-Control-Allow-Origin: <matched-origin>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-Key, Authorization
Access-Control-Allow-Credentials: true
```

OPTIONS preflight handled automatically.

## Default Behavior

**Without api.json:**
- Same-origin (browser): ✅ Allowed
- External (any non-browser or cross-origin): ❌ Blocked

**With api.json but no route match:**
- Same-origin (browser): ✅ Allowed
- External: ❌ Blocked

**cURL / Postman / server-to-server (no browser headers):**
- Always treated as external, requires api.json route with `public: true`

Fail secure by default.

## Troubleshooting

### 403 Forbidden
- Set `public: true` in route config
- Add origin to `origins` array
- Check route pattern matches function path

### 401 Unauthorized
- Include `X-API-Key` header
- Verify key matches `settings/.env` value
- Check environment variable is set

### 404 Not Found
- Route pattern doesn't match
- Function file doesn't exist
- Check route priority (exact > dynamic > wildcard)

### Function receives empty params (`{}`)

If your function gets an empty object instead of the expected POST body, the JSON was likely malformed. The framework doesn't throw — it silently falls back to `{}` to avoid crashing the request.

**How to diagnose:** Check your server logs for:
```
[API] JSON parse error for /api/your/endpoint: <error details>
```

This warning only appears when the request has `Content-Type: application/json` but the body can't be parsed. Common causes:
- Trailing commas in JSON
- Single quotes instead of double quotes
- Empty body with `Content-Type: application/json` header
- Binary/form data sent with wrong content type

> **Tip:** Test same-origin first. If it works without `api.json`, the function is correct and it's an access control issue.

> 📖 **Related:** [Functions](../functions.md), [Environment Variables](./env.md)
