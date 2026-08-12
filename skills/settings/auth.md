---
skill: settings/auth
when: "Configuring authentication providers, signup fields"
requires: []
---

# Auth Settings

> Configure OAuth providers, signup fields, and redirects.

## Quick Start

Create `settings/auth.json`:

```json
{}
```

Empty config enables email + 6-digit code auth (no passwords).

## OAuth Providers

```json
{
  "providers": {
    "google": {
      "enabled": true,
      "clientId": "[[env.GOOGLE_CLIENT_ID]]",
      "clientSecret": "[[env.GOOGLE_CLIENT_SECRET]]"
    },
    "github": {
      "enabled": true,
      "clientId": "[[env.GITHUB_CLIENT_ID]]",
      "clientSecret": "[[env.GITHUB_CLIENT_SECRET]]"
    }
  }
}
```

Credentials via `settings/.env.json`:

```json
{
  "GOOGLE_CLIENT_ID": "xxx.apps.googleusercontent.com",
  "GOOGLE_CLIENT_SECRET": "xxx",
  "GITHUB_CLIENT_ID": "xxx",
  "GITHUB_CLIENT_SECRET": "xxx"
}
```

## Custom Signup Fields

```json
{
  "signup": {
    "enabled": true,
    "fields": {
      "company": {
        "type": "text",
        "label": "Company",
        "required": true
      },
      "role": {
        "type": "select",
        "label": "Role",
        "options": [
          { "value": "developer", "label": "Developer" },
          { "value": "designer", "label": "Designer" }
        ]
      }
    },
    "terms": "/terms",
    "privacy": "/privacy"
  }
}
```

### Field Types

| Type | Description |
|------|-------------|
| `text` | Text input |
| `email` | Email input |
| `tel` | Phone input |
| `textarea` | Multi-line text |
| `select` | Dropdown (needs `options`) |
| `date` | Date picker |
| `checkbox` | Boolean toggle |

## Redirects

```json
{
  "redirects": {
    "afterLogin": "/dashboard",
    "afterSignup": "/onboarding",
    "afterLogout": "/"
  }
}
```

## Complete Example

```json
{
  "providers": {
    "google": {
      "enabled": true,
      "clientId": "[[env.GOOGLE_CLIENT_ID]]",
      "clientSecret": "[[env.GOOGLE_CLIENT_SECRET]]"
    }
  },
  "signup": {
    "enabled": true,
    "fields": {
      "company": { "type": "text", "label": "Company" },
      "role": {
        "type": "select",
        "label": "Role",
        "options": ["Developer", "Designer", "Manager"]
      }
    },
    "terms": "/terms"
  },
  "redirects": {
    "afterLogin": "/dashboard",
    "afterSignup": "/onboarding"
  }
}
```

## Options

| Setting | Default | Description |
|---------|---------|-------------|
| `signup.enabled` | true | Allow new registrations |
| `signup.fields` | {} | Custom signup fields |
| `signup.terms` | null | Terms URL (shows checkbox) |
| `signup.privacy` | null | Privacy URL |
| `redirects.afterLogin` | `/` | Post-login redirect |
| `redirects.afterSignup` | `/` | Post-signup redirect |

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Put secrets in auth.json | Use `[[env.VAR]]` |
| Forget OAuth callback URLs | Add to provider console |
| Create users database | Use auth settings for user fields |

## Related

- `skill:auth` - Using auth in components
- `skill:settings/env` - Environment variables
