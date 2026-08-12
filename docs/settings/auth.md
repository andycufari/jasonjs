# Auth Settings

Configure OAuth providers, signup fields, and redirects.

## Quick Start

Create `settings/auth.json`:

```json
{}
```

Empty config enables email + 6-digit code auth (passwordless). No setup required.

---

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

Store credentials in `settings/.env.json`:

```json
{
  "GOOGLE_CLIENT_ID": "xxx.apps.googleusercontent.com",
  "GOOGLE_CLIENT_SECRET": "xxx",
  "GITHUB_CLIENT_ID": "xxx",
  "GITHUB_CLIENT_SECRET": "xxx"
}
```

### Available Providers

| Provider | Config Key |
|----------|------------|
| Google | `google` |
| GitHub | `github` |
| Apple | `apple` |
| Discord | `discord` |
| Twitter | `twitter` |

---

## Custom Signup Fields

Collect additional info during registration:

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
          { "value": "designer", "label": "Designer" },
          { "value": "manager", "label": "Manager" }
        ]
      },
      "phone": {
        "type": "tel",
        "label": "Phone Number"
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

---

## Redirects

Control where users go after auth actions:

```json
{
  "redirects": {
    "afterLogin": "/dashboard",
    "afterSignup": "/onboarding",
    "afterLogout": "/"
  }
}
```

| Redirect | Default | Description |
|----------|---------|-------------|
| `afterLogin` | `/` | Where to go after login |
| `afterSignup` | `/` | Where to go after new signup |
| `afterLogout` | `/` | Where to go after logout |

---

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
      "company": {
        "type": "text",
        "label": "Company"
      },
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

---

## Options Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `signup.enabled` | boolean | `true` | Allow new registrations |
| `signup.fields` | object | `{}` | Custom signup fields |
| `signup.terms` | string | `null` | Terms URL (shows checkbox) |
| `signup.privacy` | string | `null` | Privacy URL |
| `redirects.afterLogin` | string | `/` | Post-login redirect |
| `redirects.afterSignup` | string | `/` | Post-signup redirect |
| `redirects.afterLogout` | string | `/` | Post-logout redirect |

---

## Common Mistakes

| Don't | Do |
|-------|-----|
| Put secrets directly in auth.json | Use `[[env.VAR]]` syntax |
| Forget OAuth callback URLs | Add callback URL in provider console |
| Create a users database manually | User data is managed automatically |

---

## See Also

- [auth.md](../auth.md) - Using auth in components and functions
- [settings/env.md](./env.md) - Environment variables
