# Auth Components

**The primary way to handle auth is the `app.auth` object. Use it everywhere.**

Components are for UI (navbar, protected content, etc). Logic goes through `app.auth`.

> 📖 For auth configuration, see [auth.md](../auth.md)

---

## The Pattern 🎯

```jsx
// In any component
const MyComponent = ({ jcontext }) => {
  const handleAction = async () => {
    // Require login before action
    try {
      const user = await app.auth.requireLogin();
      // User is authenticated, do the thing
      await app.db.use('favorites').add({ item });
      app.ui.toast('Saved!');
    } catch {
      // User cancelled login
    }
  };

  // Check if logged in
  if (!app.auth.isAuthenticated) {
    return <button onClick={handleAction}>Sign in to save</button>;
  }

  // Check role
  if (app.auth.hasRole('premium')) {
    return <PremiumFeature />;
  }

  return <StandardFeature />;
};
```

**That's it. No providers, no context, no prop drilling.**

---

## app.auth Object 🧰

Available globally in components and functions. This is your main auth API.

### Check Auth State

```javascript
// Current user object
app.auth.user
// → { id, email, name, role, image, customFields, ... }

// Is authenticated?
app.auth.isAuthenticated  // → true/false
app.auth.isLoggedIn       // → alias

// User roles
app.auth.userRoles  // → ['user'] or ['admin', 'editor']
app.auth.isAdmin    // → true if user is admin

// Check specific role(s)
app.auth.hasRole('admin')              // → true/false
app.auth.hasRole(['admin', 'editor'])  // → true if has ANY
```

### Require Login

**Shows modal. No redirect. Preserves context.**

```javascript
// Basic - shows login modal
const user = await app.auth.requireLogin();

// With options
const user = await app.auth.requireLogin({
  mode: 'signup',  // 'login' or 'signup'
  message: 'Sign in to continue'
});

// Handle cancellation
try {
  const user = await app.auth.requireLogin();
  // User authenticated
  doSomething();
} catch (error) {
  // User cancelled
}
```

### Update User Data

```javascript
// Get custom field
const theme = app.auth.getField('theme', 'light');

// Set custom field
await app.auth.setField('theme', 'dark');

// Set multiple fields
await app.auth.setFields({
  theme: 'dark',
  notifications: true,
  language: 'es'
});

// Check if field exists
if (app.auth.hasField('onboarded')) {
  // ...
}

// Delete field
await app.auth.deleteField('temp_data');
```

### Sign Out

```javascript
await app.auth.signOut();
```

> 💡 **Tip:** `app.auth.requireLogin()` is the killer feature. No redirect, no state management, just works.

---

## Components for JSON Pages

These work in JSON pages without callbacks.

| Component | Purpose |
|-----------|---------|
| UserWidget | User menu dropdown (profile, billing, logout) |
| AuthGuard | Conditional rendering based on auth |
| ProtectedContent | Protected content with built-in "login" UI |
| UnifiedAuth | Complete login/signup flow (dedicated pages only) |
| UserProfile | Profile management (usually via UserWidget) |

---

## UserWidget

**Avatar dropdown with profile, billing, logout.**

Drop it in your navbar. It handles everything.

```json
{
  "component": "@framework/website/Navbar",
  "attributes": {
    "rightContent": [
      {
        "component": "@framework/auth/UserWidget"
      }
    ]
  }
}
```

Shows "Sign In / Sign Up" when logged out. Shows user menu when logged in.

### Options

```json
{
  "component": "@framework/auth/UserWidget",
  "attributes": {
    "options": {
      "showBilling": true,
      "avatarPosition": "right",
      "avatarSize": "md",
      "afterSignOutUrl": "/",
      "customLinks": [
        {
          "label": "Dashboard",
          "href": "/dashboard",
          "icon": "Home"
        }
      ]
    }
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `showBilling` | boolean | true | Show "Manage Plan" (if billing configured) |
| `avatarPosition` | string | 'right' | 'left' or 'right' |
| `avatarSize` | string | 'md' | 'sm', 'md', 'lg' |
| `afterSignOutUrl` | string | '/' | Where to go after logout |
| `customLinks` | array | [] | Add menu items |
| `adminUrl` | string | null | Admin panel (shows only for admins) |

Icons use [Lucide](https://lucide.dev) names: Home, Settings, User, Mail, etc.

---

## AuthGuard

**Conditionally render based on auth state.**

```json
{
  "component": "@framework/auth/AuthGuard",
  "attributes": {
    "requireAuth": true
  },
  "components": [
    {
      "component": "Dashboard"
    }
  ]
}
```

### Role-Based

```json
{
  "component": "@framework/auth/AuthGuard",
  "attributes": {
    "requireAuth": true,
    "requireRoles": ["admin", "editor"]
  },
  "components": [
    {
      "component": "AdminPanel"
    }
  ]
}
```

### With Fallback

```json
{
  "component": "@framework/auth/AuthGuard",
  "attributes": {
    "requireAuth": true,
    "fallback": {
      "component": "p",
      "innerHTML": "Please log in"
    }
  },
  "components": [
    {
      "component": "PremiumFeature"
    }
  ]
}
```

| Prop | Type | Description |
|------|------|-------------|
| `requireAuth` | boolean | Must be logged in |
| `requireRoles` | array | Must have one of these roles |
| `fallback` | ReactNode | Show when not authorized |
| `showLoading` | boolean | Show spinner while checking (default: true) |

---

## ProtectedContent

**Like AuthGuard but with built-in "please login" UI.**

Shows a nice card with sign-in buttons.

```json
{
  "component": "@framework/auth/ProtectedContent",
  "components": [
    {
      "component": "PremiumFeature"
    }
  ]
}
```

### Custom Messages

```json
{
  "component": "@framework/auth/ProtectedContent",
  "attributes": {
    "roles": ["premium"],
    "loginMessage": "Sign in to access premium features",
    "accessDeniedMessage": "Upgrade to premium"
  },
  "components": [
    {
      "component": "AdvancedAnalytics"
    }
  ]
}
```

| Prop | Type | Description |
|------|------|-------------|
| `roles` | array | Required roles |
| `loginMessage` | string | Message when not logged in |
| `accessDeniedMessage` | string | Message when no permission |
| `fallback` | ReactNode | Custom fallback UI |

---

## UnifiedAuth

**Complete login/signup flow. Auto-detects if user exists.**

⚠️ **Use on dedicated auth pages only** (e.g., `/auth/login`). Can't use callbacks in JSON.

```json
{
  "component": "@framework/auth/UnifiedAuth"
}
```

Flow:
1. User enters email
2. System checks if user exists
3. **Exists?** → Send code → verify → login → redirect to `afterLogin` URL
4. **New?** → Collect name → send code → verify → create → redirect to `afterSignup` URL

Redirects are configured in `settings/auth.json`:

```json
{
  "redirects": {
    "afterLogin": "/dashboard",
    "afterSignup": "/welcome"
  }
}
```

### Why Not Everywhere?

In JSON pages, you can't handle the `onSuccess` callback. UnifiedAuth is designed for **dedicated auth pages** where it just redirects after success.

For inline auth (like "save to favorites"), use `app.auth.requireLogin()` instead:

```jsx
// ✅ Correct pattern
<button onClick={async () => {
  const user = await app.auth.requireLogin();
  saveFavorite();
}}>
  Save
</button>
```

---

## UserProfile

**Complete profile management: name, email, password, delete account.**

Usually opened from UserWidget automatically. Can also be standalone:

```json
{
  "component": "@framework/auth/UserProfile"
}
```

Features:
- Change name and custom fields
- Change email (with verification)
- Reset password (sends email)
- Delete account (with confirmation)

Respects custom fields from `settings/auth.json`.

---

## Patterns 🧰

### Require Login Before Action

```jsx
const MyComponent = () => {
  const handleSave = async () => {
    try {
      await app.auth.requireLogin({
        message: 'Sign in to save your work'
      });
      // User is authenticated
      await app.db.use('favorites').add({ item });
    } catch {
      // User cancelled
    }
  };

  return <button onClick={handleSave}>Save</button>;
};
```

### Check User in Component

```jsx
const MyComponent = ({ jcontext }) => {
  const user = jcontext?.user;

  if (!user) {
    return <p>Please log in</p>;
  }

  return <p>Welcome, {user.name}!</p>;
};
```

### Role-Based UI

```jsx
// Show/hide elements
{app.auth.isAdmin && <AdminButton />}
{app.auth.hasRole(['premium', 'pro']) && <PremiumFeature />}

// Or use AuthGuard
<AuthGuard requireRoles={['admin']}>
  <AdminPanel />
</AuthGuard>
```

### Update Profile Data

```jsx
const handleThemeChange = async (theme) => {
  await app.auth.setField('theme', theme);
  app.ui.toast('Theme updated');
};

const handleBulkUpdate = async () => {
  await app.auth.setFields({
    theme: 'dark',
    notifications: true,
    language: 'es'
  });
};
```

### Page-Level Auth (JSON)

Protect entire pages by adding `auth` and `roles` at the root:

```json
{
  "auth": true,
  "roles": ["admin"],
  "components": [
    {
      "component": "AdminDashboard"
    }
  ]
}
```

This is enforced **server-side**. Users without permission get a 403.

> 💡 **Tip:** Page-level auth is real security. Client components are just UI hints.

---

## Custom Fields

Store arbitrary user data with custom fields.

### Define in auth.json

```json
{
  "signup": {
    "fields": {
      "company": {
        "type": "text",
        "label": "Company Name",
        "required": true
      },
      "role": {
        "type": "select",
        "label": "Your Role",
        "options": [
          { "label": "Developer", "value": "dev" },
          { "label": "Designer", "value": "design" }
        ]
      }
    }
  }
}
```

### Access in Code

```javascript
// Get field
const company = app.auth.getField('company');
const role = app.auth.getField('role', 'dev'); // with default

// Set field
await app.auth.setField('onboarding_completed', true);

// Check field
if (!app.auth.hasField('onboarded')) {
  router.push('/welcome');
}
```

### Display in Components

```jsx
const MyComponent = ({ jcontext }) => {
  const user = jcontext?.user;
  const company = user?.customFields?.company;

  return <p>Company: {company}</p>;
};
```

---

## Styling

All components respect `settings/theme.json`:
- Primary colors
- Dark mode
- Custom fonts
- Border radius

They work out of the box. Override with `className` if needed.

---

## i18n 🌍

Components support multiple languages automatically.

Built-in: en, es, pt, fr, de, it, ja, zh, ko, ru

Override in `settings/auth.json`:

```json
{
  "texts": {
    "signIn": "Log In",
    "welcomeBack": {
      "en": "Welcome back!",
      "es": "¡Bienvenido!",
      "pt": "Bem-vindo!"
    }
  }
}
```

Language detected from:
1. `jcontext.language`
2. HTML `<html lang="en">`
3. Browser language
4. Fallback to `en`

---

## Common Gotchas

| Don't | Do Instead |
|-------|------------|
| `requireRoles="admin"` | `requireRoles={["admin"]}` (array required) |
| Put UnifiedAuth with callbacks in JSON | Use on dedicated `/auth/login` page |
| Check auth client-side only | Add `auth: true` in page JSON |
| Import `app` | `app` is globally available |
| Manage login modal state | Use `app.auth.requireLogin()` |
| `onSuccess` in JSON pages | JSON can't have function callbacks |

---

## Summary

**Primary pattern:** Use `app.auth` for all logic.

- `app.auth.requireLogin()` - Require login (shows modal)
- `app.auth.user` - Current user
- `app.auth.hasRole()` - Check roles
- `app.auth.setField()` - Update user data

**Components:** UI only.

- `UserWidget` - Navbar menu
- `AuthGuard` / `ProtectedContent` - Wrap content
- `UnifiedAuth` - Dedicated auth pages
- `UserProfile` - Profile management

**In JSON pages:** Components work. Callbacks don't.

---

> 📖 **See also:**
> - [auth.md](../auth.md) - Auth configuration
> - [pages/index.md](../pages/index.md) - Page-level auth with `auth: true`
> - [app.md](../app.md) - Full `app` object reference
