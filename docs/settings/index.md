# Settings

Configure your app with JSON files in the `settings/` folder.

## Quick Overview

```
settings/
├── theme.json      # Colors, typography, dark mode
├── auth.json       # OAuth providers, signup fields
├── fonts.json      # Custom fonts
├── meta.json       # Default meta tags
├── routes.json     # Redirects, rewrites
├── api.json        # Public API config
├── mobile.json     # Native app settings
└── .env.json       # Secrets and API keys
```

---

## Common Settings

### Theme (Minimal)

```json
// settings/theme.json
{
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#6366f1"
  }
}
```

Two colors → full design system with dark mode.

### Auth (Google OAuth)

```json
// settings/auth.json
{
  "providers": {
    "google": {
      "enabled": true,
      "clientId": "[[env.GOOGLE_CLIENT_ID]]",
      "clientSecret": "[[env.GOOGLE_CLIENT_SECRET]]"
    }
  },
  "redirects": {
    "afterLogin": "/dashboard"
  }
}
```

### Environment Variables

```json
// settings/.env.json
{
  "GOOGLE_CLIENT_ID": "xxx.apps.googleusercontent.com",
  "GOOGLE_CLIENT_SECRET": "xxx",
  "STRIPE_SECRET_KEY": "sk_live_xxx",
  "OPENAI_API_KEY": "sk-xxx"
}
```

Reference anywhere with `[[env.VAR_NAME]]`.

---

## Settings Reference

| File | Purpose | Doc |
|------|---------|-----|
| `theme.json` | Colors, typography, spacing, dark mode | [theme.md](./theme.md) |
| `auth.json` | OAuth providers, signup fields, redirects | [auth.md](./auth.md) |
| `fonts.json` | Google Fonts, self-hosted fonts | [fonts.md](./fonts.md) |
| `meta.json` | Default meta tags, OG images | [../seo.md](../seo.md) |
| `routes.json` | Redirects, rewrites, custom routes | [routes.md](./routes.md) |
| `api.json` | Public API endpoints | [api.md](./api.md) |
| `mobile.json` | Native app configuration | [mobile.md](./mobile.md) |
| `.env.json` | Secrets and API keys | [env.md](./env.md) |

---

## Page-Level Overrides

Most settings can be overridden per-page:

```json
{
  "meta": { "title": "Special Page" },
  "theme": {
    "colors": { "primary": "#ec4899" }
  },
  "fonts": [
    { "name": "Playfair", "src": "https://fonts.googleapis.com/..." }
  ],
  "scripts": {
    "gtag": "G-XXXXXXXXXX"
  },
  "components": [...]
}
```

Page settings merge with (and override) global settings.

---

## Environment Variable Syntax

Use `[[env.VAR_NAME]]` to reference secrets:

```json
// settings/auth.json
{
  "providers": {
    "stripe": {
      "secretKey": "[[env.STRIPE_SECRET_KEY]]"
    }
  }
}
```

This keeps secrets out of your config files.

---

## Tips

1. **Start minimal** - Most settings have sensible defaults
2. **Secrets in .env.json** - Never hardcode API keys
3. **Page overrides** - Test theme changes on one page first
