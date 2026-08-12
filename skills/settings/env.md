---
skill: settings/env
when: "Configuring secrets, API keys, environment variables"
requires: []
---

# Environment Variables

> Secrets, API keys, and configuration that shouldn't be in code.

## Quick Start

Create `settings/.env.json`:

```json
{
  "STRIPE_SECRET_KEY": "sk_live_xxx",
  "OPENAI_API_KEY": "sk-xxx",
  "DATABASE_URL": "mongodb://..."
}
```

## Reference in Settings

Use `[[env.VAR_NAME]]` syntax:

```json
{
  "stripe": {
    "secretKey": "[[env.STRIPE_SECRET_KEY]]",
    "publishableKey": "[[env.STRIPE_PUBLISHABLE_KEY]]"
  }
}
```

## Common Variables

### Auth

```json
{
  "GOOGLE_CLIENT_ID": "xxx.apps.googleusercontent.com",
  "GOOGLE_CLIENT_SECRET": "xxx",
  "GITHUB_CLIENT_ID": "xxx",
  "GITHUB_CLIENT_SECRET": "xxx",
  "NEXTAUTH_SECRET": "random-32-char-string"
}
```

### Billing

```json
{
  "STRIPE_SECRET_KEY": "sk_live_xxx",
  "STRIPE_PUBLISHABLE_KEY": "pk_live_xxx",
  "STRIPE_WEBHOOK_SECRET": "whsec_xxx"
}
```

### AI

```json
{
  "OPENAI_API_KEY": "sk-xxx",
  "ANTHROPIC_API_KEY": "sk-ant-xxx",
  "GOOGLE_AI_API_KEY": "AIza-xxx"
}
```

Set any one to auto-enable `app.ai.prompt()` — no `ai.json` needed for basic text generation.

### Storage

```json
{
  "S3_BUCKET_NAME": "my-app-bucket",
  "S3_REGION": "us-east-1",
  "AWS_ACCESS_KEY_ID": "AKIA...",
  "AWS_SECRET_ACCESS_KEY": "xxx",
  "NEXT_PUBLIC_ASSET_BASE_URL": "https://cdn.myapp.com"
}
```

### Email

```json
{
  "SMTP_HOST": "smtp.sendgrid.net",
  "SMTP_PORT": "587",
  "SMTP_USER": "apikey",
  "SMTP_PASSWORD": "SG.xxx",
  "EMAIL_FROM": "noreply@myapp.com"
}
```

## Access in Functions

```javascript
async function myFunction(app) {
  const { env, response } = app;

  // All env methods are async
  const apiKey = await env.get('OPENAI_API_KEY');
  const hasKey = await env.has('STRIPE_KEY');
  const allVars = await env.all();

  return response({ success: true });
}
```

## Public Variables

Variables prefixed with `NEXT_PUBLIC_` are exposed to client:

```json
{
  "NEXT_PUBLIC_ASSET_BASE_URL": "https://cdn.myapp.com",
  "NEXT_PUBLIC_GA_ID": "G-XXXXXXXXXX"
}
```

Access in components:

```jsx
const cdnUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL;
```

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Commit .env.json to git | Add to .gitignore |
| Hardcode secrets in settings | Use `[[env.VAR]]` |
| Use NEXT_PUBLIC_ for secrets | Only public vars get that prefix |
| Share keys across environments | Use different keys for dev/prod |

## Related

- `skill:settings/auth` - Auth provider secrets
- `skill:billing` - Payment secrets
- `skill:ai` - AI API keys
