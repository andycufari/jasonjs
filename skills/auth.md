---
skill: auth
when: "Adding user authentication, login/signup, protected pages"
requires: []
---

# Authentication

> Email verification login, OAuth providers, protected pages, and programmatic auth modals.

## Quick Start

```jsx
// Component: Protected action with seamless login
const SaveButton = () => {
  const handleSave = async () => {
    try {
      // Shows modal if not logged in, returns user
      const user = await app.auth.requireLogin();
      
      // User is now authenticated
      await app.db.use('favorites').add({ userId: user.id });
      app.ui.toast('Saved!');
    } catch (error) {
      // User cancelled login
    }
  };

  return <Button onClick={handleSave}>Save to Favorites</Button>;
};
```

## Zero-Config Auth

Empty `settings/auth.json` enables:
- Email + 6-digit code login (no passwords)
- User registration
- Email verification
- Secure sessions

```json
{}
```

## app.auth API

```jsx
// Check authentication state
const user = app.auth.user;            // Current user or null
const isLoggedIn = app.auth.isAuthenticated; // boolean
const isAdmin = app.auth.isAdmin;      // boolean

// Check roles
if (app.auth.hasRole('editor')) { /* ... */ }
if (app.auth.hasRole(['admin', 'moderator'])) { /* ... */ }

// Seamless login modal (no redirect, stays on page)
const user = await app.auth.requireLogin();

// With options
const user = await app.auth.requireLogin({
  mode: 'signup',                    // 'login' | 'signup'
  message: 'Sign in to continue'     // Custom message
});

// Direct sign out
await app.auth.signOut();

// Redirect to login page (full page navigation)
app.auth.redirectToLogin('/dashboard');
```

## Protected Pages

```json
{
  "auth": true,
  "components": [
    { "component": "./Dashboard" }
  ]
}
```

### Role-Based Access

```json
{
  "auth": true,
  "roles": ["admin"],
  "components": [
    { "component": "./AdminPanel" }
  ]
}
```

### Multiple Roles (any match)

```json
{
  "auth": true,
  "roles": ["admin", "moderator", "editor"]
}
```

## Auth Events

```jsx
useEffect(() => {
  // Listen for login
  const unsubLogin = app.events.on('user.login', ({ user }) => {
    console.log('Welcome back,', user.name);
  });

  // Listen for logout
  const unsubLogout = app.events.on('user.logout', () => {
    console.log('User signed out');
  });

  return () => { unsubLogin(); unsubLogout(); };
}, []);
```

## Component Auth State

```jsx
const ProfileMenu = ({ jcontext }) => {
  // Initial state from server render
  const [user, setUser] = useState(jcontext?.user);

  // Listen for auth changes (jcontext.user won't update mid-session)
  useEffect(() => {
    const unsubLogin = app.events.on('user.login', (data) => setUser(data.user));
    const unsubLogout = app.events.on('user.logout', () => setUser(null));
    return () => { unsubLogin(); unsubLogout(); };
  }, []);

  if (!user) {
    return <Button onClick={() => app.auth.requireLogin()}>Sign In</Button>;
  }

  return (
    <div>
      <span>Hello, {user.name}</span>
      <Button onClick={() => app.auth.signOut()}>Sign Out</Button>
    </div>
  );
};
```

## Auth Settings

`settings/auth.json`:

```json
{
  "providers": {
    "google": {
      "enabled": true,
      "clientId": "xxx.apps.googleusercontent.com",
      "clientSecret": "xxx"
    },
    "github": {
      "enabled": true,
      "clientId": "xxx",
      "clientSecret": "xxx"
    }
  },
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
  },
  "redirects": {
    "afterLogin": "/dashboard",
    "afterSignup": "/onboarding"
  }
}
```

### Setting Options

| Setting | Default | Description |
|---------|---------|-------------|
| `signup.enabled` | `true` | Allow new registrations |
| `signup.fields` | `{}` | Custom fields during signup |
| `signup.terms` | `null` | Terms of service URL |
| `signup.privacy` | `null` | Privacy policy URL |
| `redirects.afterLogin` | `/` | Post-login redirect |
| `redirects.afterSignup` | `/` | Post-signup redirect |

### Custom Field Types

| Type | Description |
|------|-------------|
| `text` | Text input |
| `email` | Email input |
| `tel` | Phone input |
| `textarea` | Multi-line text |
| `select` | Dropdown (requires `options`) |
| `date` | Date picker |
| `checkbox` | Boolean toggle |

## User Custom Fields

Access and modify user-specific data stored with the user profile:

```jsx
// Get custom field
const company = app.user.getField('company', 'No company');

// Check if field exists
if (app.user.hasField('onboarded')) { /* ... */ }

// Set custom field (persists to database)
await app.user.setField('company', 'Acme Inc');

// Set multiple fields
await app.user.setFields({
  company: 'Acme Inc',
  role: 'developer',
  onboarded: true
});

// Delete a field
await app.user.deleteField('tempData');

// Get all custom fields
const fields = app.user.customFields; // { company: '...', role: '...' }
```

## Conditional Rendering in Pages

```json
{
  "component": "div",
  "showIf": "{{user}}",
  "innerHTML": "Welcome, {{user.name}}!"
}
```

```json
{
  "component": "AdminTools",
  "showIf": "{{user.role === 'admin'}}"
}
```

## User Data in Queries

```json
{
  "fetch_data": {
    "database": "orders",
    "query": { "created_by": "{{user.id}}" }
  }
}
```

## Available User Fields

| Field | Description |
|-------|-------------|
| `user.id` | Unique user ID |
| `user.name` | Display name |
| `user.email` | Email address |
| `user.image` | Profile picture URL |
| `user.role` | Primary role (string) |
| `user.roles` | All roles (array) |
| `user.customFields` | Custom signup fields |

## API Reference

| Method | Description |
|--------|-------------|
| `app.auth.user` | Current user object or null |
| `app.auth.isAuthenticated` | Boolean: logged in? |
| `app.auth.isLoggedIn` | Alias for isAuthenticated |
| `app.auth.isAdmin` | Boolean: has admin role? |
| `app.auth.hasRole(role)` | Check if user has role(s) |
| `app.auth.requireLogin(opts)` | Show modal, return user |
| `app.auth.signOut()` | Sign out user |
| `app.auth.redirectToLogin(url)` | Redirect to login page |
| `app.user.getField(name, default)` | Get custom field |
| `app.user.setField(name, value)` | Set custom field |
| `app.user.setFields(obj)` | Set multiple fields |
| `app.user.deleteField(name)` | Delete custom field |
| `app.user.hasField(name)` | Check if field exists |

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Rely on `jcontext.user` to update | Use `app.auth.user` or events |
| Forget event cleanup | Return unsubscribe from `useEffect` |
| Create separate `userId` field | Use `created_by` (auto-added) |
| Store user data in custom DB | Use `app.user.setField()` |
| Check admin with `role === 'admin'` | Use `app.auth.isAdmin` |
| Redirect on protected action | Use `app.auth.requireLogin()` |
| Set credentials in code | Use `settings/auth.json` |

## Related

- `skill:component` - Auth in components
- `skill:page` - Page-level auth config
- `skill:database` - Owner-level security
- `skill:billing` - Subscription-gated features
