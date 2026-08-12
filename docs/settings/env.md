# Environment Variables 🔑

**Store secrets and configuration per site.**

## Quick Start

```json
// settings/.env.json
{
  "variables": {
    "OPENAI_API_KEY": "sk-...",
    "STRIPE_SECRET_KEY": "sk_test_..."
  },
  "public": {
    "STRIPE_KEY": "pk_test_...",
    "API_URL": "https://api.example.com"
  }
}
```

```javascript
// In server functions
const apiKey = await app.context.env('OPENAI_API_KEY');

// In components (public vars only)
const apiUrl = await app.context.env('API_URL');
```

---

## Two Types of Variables

| Type | Where Used | Security |
|------|-----------|----------|
| **Private** (`variables`) | Server functions only | Never exposed to client |
| **Public** (`public`) | Components & functions | Embedded in client bundle |

### Private Variables

Server-side only. Use for secrets.

```json
{
  "variables": {
    "DATABASE_PASSWORD": "secret123",
    "STRIPE_SECRET_KEY": "sk_live_...",
    "OPENAI_API_KEY": "sk-...",
    "SMTP_PASSWORD": "app-password"
  }
}
```

**Access in functions:**
```javascript
export default async function myFunction(params, context) {
  const apiKey = await context.env('OPENAI_API_KEY');
  // Use it
}
```

### Public Variables

Exposed to client. Use for non-sensitive config.

```json
{
  "public": {
    "STRIPE_KEY": "pk_test_...",
    "GOOGLE_MAPS_KEY": "AIza...",
    "API_URL": "https://api.example.com",
    "ENABLE_BETA": "true"
  }
}
```

**Access in components:**
```javascript
export default function Map() {
  const apiKey = await app.context.env('GOOGLE_MAPS_KEY');
  return <GoogleMap apiKey={apiKey} />;
}
```

---

## Reference in Settings

Use `[[env.VAR_NAME]]` to inject env vars into other settings:

```json
// settings/auth.json
{
  "providers": {
    "google": {
      "clientId": "[[env.GOOGLE_CLIENT_ID]]",
      "clientSecret": "[[env.GOOGLE_CLIENT_SECRET]]"
    }
  }
}
```

```json
// settings/api.json
{
  "routes": {
    "webhook/stripe": {
      "public": true,
      "keys": ["[[env.STRIPE_WEBHOOK_SECRET]]"]
    }
  }
}
```

This keeps secrets out of your settings files.

---

## Common Patterns

### AI Providers

Set any one (or more) to auto-enable AI text generation — no `ai.json` needed for basic usage:

```json
{
  "variables": {
    "OPENAI_API_KEY": "sk-...",
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "GOOGLE_AI_API_KEY": "AIza-..."
  }
}
```

For image generation, speech, templates, or agents, also create `settings/ai.json`. See [AI Features](../ai.md).

### Payment & API Integration
```json
{
  "variables": {
    "STRIPE_SECRET_KEY": "sk_test_..."
  },
  "public": {
    "STRIPE_KEY": "pk_test_...",
    "API_URL": "https://api.example.com"
  }
}
```

### OAuth Providers
```json
{
  "variables": {
    "GOOGLE_CLIENT_ID": "xxx.apps.googleusercontent.com",
    "GOOGLE_CLIENT_SECRET": "GOCSPX-...",
    "GITHUB_CLIENT_ID": "Iv1...",
    "GITHUB_CLIENT_SECRET": "..."
  }
}
```

### Database Credentials
```json
{
  "variables": {
    "EXTERNAL_DB_URL": "postgresql://user:pass@host/db",
    "REDIS_URL": "redis://localhost:6379"
  }
}
```

### Feature Flags
```json
{
  "public": {
    "ENABLE_DARK_MODE": "true",
    "ENABLE_ANALYTICS": "false",
    "MAINTENANCE_MODE": "false"
  }
}
```

---

## Security Best Practices

### ✅ DO
- Store all secrets in private `variables`
- Use strong, unique values
- Rotate secrets regularly
- Keep publishable keys in `public`
- Use environment-specific values (dev/staging/prod)

### ❌ DON'T
- Put secrets in `public` object
- Commit real secrets to git
- Use same secrets across environments
- Hardcode secrets in components/functions

---

## Naming Convention

```
API_KEY                ✅ Any variable name
STRIPE_SECRET_KEY      ✅ Private variable
GOOGLE_MAPS_KEY        ✅ Public variable
apiKey                 ❌ Use SCREAMING_SNAKE_CASE
```

Convention: `SCREAMING_SNAKE_CASE` for both private and public vars.

---

## Access Patterns

### In Server Functions

```javascript
// functions/sendEmail.js
export default async function sendEmail({ to, subject, body }, context) {
  const password = await context.env('SMTP_PASSWORD');
  const host = await context.env('SMTP_HOST');

  // Send email using credentials
}
```

### In Components (Public Only)

```javascript
// components/Analytics.jsx
export default function Analytics() {
  const gaId = await app.context.env('GA_ID');

  return <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />;
}
```

### With Default Values

```javascript
// Provide fallback if not set
const apiUrl = await context.env('API_URL', 'https://api.default.com');
```

---

## Site-Specific Variables

The `settings/.env.json` file stores **per-site** variables that are isolated between sites.

- Each site has its own `.env.json`
- One site cannot access another site's variables
- Lives in the site folder, next to the rest of the site config
- Changes apply per-site without affecting others

---

## How Variables Work

### Private Variables
- Server-side only
- Never sent to client
- Access via `app.context.env()` in functions

### Public Variables
- Available in components and functions
- Embedded in client bundle (visible in browser)
- Access via `app.context.env()` anywhere

---

## Notes

- Site-specific env vars are **isolated** - one site can't access another's
- Access all variables via `app.context.env('VAR_NAME')`
- Public vars are visible in browser DevTools (never put secrets there)
- Use `[[env.VAR_NAME]]` syntax to reference in JSON settings
- Private variables should never go in `public` object
