# Authentication

Passwordless by default. Sign users in with email codes, no setup required.

## Quick Start

**Authentication works out of the box.** Users enter their email, get a 6-digit code, and they're in.

```jsx
'use client';
import { useApp } from '@jasonjs';

function MyFeature() {
  const app = useApp();

  const handleProtectedAction = async () => {
    // Opens modal if not logged in, returns user when authenticated
    const user = await app.auth.requireLogin();

    if (user) {
      await app.db.use('todos').add({ task: 'Ship it', userId: user.id });
      app.ui.toast('Saved!', { type: 'success' });
    }
  };

  return <button onClick={handleProtectedAction}>Add Todo</button>;
}
```

**No redirects. No page reloads. Just works.**

---

## Configuration

Zero config by default. Create `settings/auth.json` only if you need customization.

### Enable OAuth

```json
{
  "providers": {
    "google": true,
    "github": true
  }
}
```

Requires environment variables in `settings/.env`:

```json
{
  "NEXTAUTH_SECRET": "your-secret-min-32-chars",
  "GOOGLE_CLIENT_ID": "...",
  "GOOGLE_CLIENT_SECRET": "...",
  "GITHUB_ID": "...",
  "GITHUB_SECRET": "..."
}
```

### Custom Signup Fields

Use FormBuilder schema for custom fields. Supported `type` values:

| Type | Stored as | UI |
|---|---|---|
| `text`, `email`, `tel`, `url`, `number`, `date`, etc. | string | `<input>` |
| `textarea` | string | `<textarea>` (use `rows`) |
| `select` | string | dropdown — needs `options` |
| `select` + `multiple: true` | string[] | native multi-select — needs `options` |
| `checkbox` / `boolean` | boolean | single inline checkbox |
| `radio` | string | radio group — needs `options` |
| `array` (with `options`) | string[] | native multi-select (FormBuilder convention) |

Option shape: `{ value, label }` where `label` may be a string or `{ en, es, ... }` map.

```json
{
  "signup": {
    "fields": {
      "company": {
        "type": "text",
        "label": { "en": "Company", "es": "Empresa" },
        "required": true
      },
      "companySize": {
        "type": "select",
        "label": { "en": "Company size", "es": "Tamaño" },
        "required": true,
        "options": [
          { "value": "1",     "label": { "en": "Just me", "es": "Solo yo" } },
          { "value": "2-10",  "label": { "en": "2–10",    "es": "2–10" } },
          { "value": "11-50", "label": { "en": "11–50",   "es": "11–50" } }
        ]
      },
      "scheduleDemo": {
        "type": "checkbox",
        "label": { "en": "Schedule a demo", "es": "Agendar demo" }
      },
      "referralSources": {
        "type": "array",
        "label": { "en": "Where did you hear about us?", "es": "¿Cómo nos conociste?" },
        "options": [
          { "value": "twitter",  "label": "Twitter / X" },
          { "value": "linkedin", "label": "LinkedIn" },
          { "value": "friend",   "label": { "en": "Friend", "es": "Amigo" } }
        ]
      },
      "feedback": {
        "type": "textarea",
        "label": { "en": "Anything to share?", "es": "¿Algo para contarnos?" },
        "rows": 4
      },
      "whatsapp": {
        "type": "tel",
        "label": "WhatsApp",
        "required": true
      }
    }
  }
}
```

### Terms & Privacy

```json
{
  "signup": {
    "terms": "/terms",
    "privacy": "/privacy"
  }
}
```

Adds required checkboxes during signup.

### Session Duration

```json
{
  "session": {
    "maxAge": 604800
  }
}
```

| Duration | Seconds |
|----------|---------|
| 1 day | 86400 |
| 7 days | 604800 |
| 30 days | 2592000 |
| 90 days | 7776000 |

### Admin Users

```json
{
  "adminEmails": [
    "admin@yoursite.com",
    "owner@yoursite.com"
  ]
}
```

Users with these emails automatically get the `admin` role.

> 📖 Full config reference: [components/auth.md](components/auth.md#configuration)

---

## App Methods

### app.auth.user

Current user object or `null`.

```jsx
const { user } = app.auth;

if (user) {
  console.log(user.id, user.email, user.name);
}
```

**User Object:**

```javascript
{
  id: "uuid",
  email: "user@example.com",
  name: "John Doe",
  image: "https://...",        // Avatar URL
  role: "user",                // Primary role
  roles: ["user", "editor"],   // All roles
  // Custom fields from signup
  company: "Acme Corp",
  phone: "+1234567890"
}
```

### app.auth.isAuthenticated

Boolean. `true` if user is logged in.

```jsx
if (!app.auth.isAuthenticated) {
  return <SignInButton />;
}
```

**Alias:** `app.auth.isLoggedIn` (same thing).

### app.auth.requireLogin()

Opens auth modal, returns user when authenticated. **No redirects.**

```jsx
const user = await app.auth.requireLogin();

if (user) {
  // User authenticated, proceed
}
```

**With options:**

```jsx
// Open in signup mode
const user = await app.auth.requireLogin({
  mode: 'signup',
  message: 'Create account to continue'
});

// Pre-fill email
const user = await app.auth.requireLogin({
  mode: 'login',
  email: 'user@example.com'
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | string | `'login'` | `'login'` or `'signup'` |
| `message` | string | `''` | Custom message in modal |
| `email` | string | `''` | Pre-fill email field |

### app.auth.hasRole(roles)

Check if user has specific role(s).

```jsx
// Single role
if (app.auth.hasRole('admin')) {
  // Admin only
}

// Multiple roles (OR logic - any match)
if (app.auth.hasRole(['admin', 'editor'])) {
  // Admin or editor
}
```

### app.auth.isAdmin

Boolean. Shortcut for `hasRole('admin')`.

```jsx
if (app.auth.isAdmin) {
  // Admin actions
}
```

### app.auth.userRoles

Array of user's role strings.

```jsx
const roles = app.auth.userRoles; // ['user', 'editor']

if (roles.includes('premium')) {
  // Premium feature
}
```

### app.auth.redirectToLogin(returnUrl)

Redirect to login page (old-school redirect, use `requireLogin()` for modals).

```jsx
app.auth.redirectToLogin('/dashboard');
// Redirects to /auth/login?callbackUrl=/dashboard
```

### app.auth.signOut()

Sign out the user.

```jsx
await app.auth.signOut();
```

---

## Components

**Use `@framework/auth/*` components in JSON pages or custom components.**

### @framework/auth/UnifiedAuth

Complete auth flow (login + signup) in one component.

```json
{
  "component": "@framework/auth/UnifiedAuth"
}
```

### @framework/auth/UserWidget

Current user display with dropdown menu.

```json
{
  "component": "@framework/auth/UserWidget"
}
```

### @framework/auth/UserProfile

User account settings (email change, password reset, delete account).

```json
{
  "component": "@framework/auth/UserProfile"
}
```

> 📖 Full component reference: [components/auth.md](components/auth.md)

---

## Page Protection

### Require Authentication

```json
{
  "path": "/dashboard",
  "auth": {
    "required": true
  },
  "components": [...]
}
```

Users not logged in will be redirected to login.

### Require Role

```json
{
  "path": "/admin",
  "auth": {
    "required": true,
    "roles": ["admin"]
  },
  "components": [...]
}
```

Users without the required role see a 403 error.

---

## Common Patterns

### Comment System

```jsx
'use client';
import { useApp } from '@jasonjs';

function CommentBox() {
  const app = useApp();
  const [comment, setComment] = useState('');

  const handleSubmit = async () => {
    // Require auth before posting
    const user = await app.auth.requireLogin({
      mode: 'signup',
      message: 'Sign up to join the conversation'
    });

    if (!user) return; // Cancelled

    await app.db.use('comments').add({
      text: comment,
      userId: user.id,
      userName: user.name,
      createdAt: new Date()
    });

    app.ui.toast('Comment posted!', { type: 'success' });
    setComment('');
  };

  return (
    <div>
      <textarea value={comment} onChange={e => setComment(e.target.value)} />
      <button onClick={handleSubmit}>Post Comment</button>
    </div>
  );
}
```

### Premium Feature Gate

```jsx
function PremiumFeature() {
  const app = useApp();

  const handleAccess = async () => {
    // Require authentication
    if (!app.auth.isAuthenticated) {
      await app.auth.requireLogin({
        message: 'Sign in to access premium features'
      });
    }

    // Check subscription
    const hasSubscription = await app.billing.hasSubscription();

    if (!hasSubscription) {
      app.ui.toast('Premium subscription required', { type: 'error' });
      window.location.href = '/pricing';
      return;
    }

    // Access granted
    loadPremiumContent();
  };

  return <button onClick={handleAccess}>Access Premium</button>;
}
```

### Ownership Check

```jsx
async function updatePost(postId, updates) {
  const app = useApp();

  if (!app.auth.isAuthenticated) {
    app.ui.toast('Login required', { type: 'error' });
    return;
  }

  const posts = app.db.use('posts');
  const post = await posts.getById(postId);

  if (!post) {
    app.ui.toast('Post not found', { type: 'error' });
    return;
  }

  // Only owner or admin can update
  if (post.userId !== app.auth.user.id && !app.auth.isAdmin) {
    app.ui.toast('Not authorized', { type: 'error' });
    return;
  }

  await posts.update(postId, updates);
  app.ui.toast('Post updated!', { type: 'success' });
}
```

### Conditional UI

```jsx
function Navbar() {
  const app = useApp();

  return (
    <nav>
      <Logo />

      {app.auth.isAuthenticated ? (
        <>
          <Link href="/dashboard">Dashboard</Link>
          {app.auth.isAdmin && <Link href="/admin">Admin</Link>}
          <button onClick={() => app.auth.signOut()}>Sign Out</button>
        </>
      ) : (
        <button onClick={() => app.auth.requireLogin()}>Sign In</button>
      )}
    </nav>
  );
}
```

---

## Server-Side (Functions)

**Use `app.auth` in functions for server-side auth checks.**

### Check Authentication

```javascript
// functions/protected.js
async function protectedEndpoint(app) {
  const { auth, response } = app;

  if (!auth.isAuthenticated) {
    return response({ error: 'Login required' }, 'AUTH');
  }

  return response({ message: `Hello, ${auth.user.name}!` });
}
```

### Check Role

```javascript
async function adminEndpoint(app) {
  const { auth, response } = app;

  if (!auth.isAuthenticated) {
    return response({ error: 'Login required' }, 'AUTH');
  }

  if (!auth.hasRole(['admin', 'moderator'])) {
    return response({ error: 'Insufficient permissions' }, 'FORBIDDEN');
  }

  // Admin logic
}
```

### Create User

```javascript
async function registerUser(app) {
  const { params, auth, response } = app;

  const user = await auth.createUser({
    name: params.name,
    email: params.email.toLowerCase(),
    password: params.password,  // Auto-hashed
    role: 'user',
    // Custom fields
    company: params.company
  }, true);  // true = return existing if email exists

  return response({ user }, 'CREATED');
}
```

### User Lookup

```javascript
// By email
const user = await auth.getUserByEmail('user@example.com');

// By ID
const user = await auth.getUserById('uuid');

// By username
const user = await auth.getUserByUsername('johndoe');
```

> 📖 Server-side reference: [functions.md](functions.md#authentication)

---

## Internationalization

Auth components detect language from `?lang=XX` parameter.

**Supported languages:**
- English (`en`)
- Spanish (`es`)
- French (`fr`)

```
/auth/login?lang=es          → Spanish login page
/auth/signup?lang=fr         → French signup page
```

**Custom labels override language:**

```json
{
  "signup": {
    "labels": {
      "signIn": "Acceder",
      "signUp": "Registrarse"
    }
  }
}
```

---

## Security

### Rate Limiting

Auth endpoints are automatically rate limited:
- **Email operations**: 30 requests per 5 minutes per IP
- **Code verification**: 5 attempts per 5 minutes per IP

### Code Security

- 6-digit codes (000000-999999)
- Valid for 15 minutes
- Single use only
- Stored hashed in database

### Session Security

- JWT tokens with HTTP-only cookies
- CSRF protection built-in
- Sessions expire based on `maxAge` config

### Password Hashing

Passwords are automatically hashed using bcrypt when using `auth.createUser()`.

---

## OAuth Provider Setup

### Google

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth client ID
3. Add redirect URI: `https://yoursite.com/api/auth/callback/google`

### GitHub

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create OAuth App
3. Set callback URL: `https://yoursite.com/api/auth/callback/github`

---

## Troubleshooting

### "Code not received"

- Check spam/junk folder
- Verify email config in `settings/email.json`
- Check server logs for email errors
- In dev mode, codes appear in console

### "Invalid code"

- Codes expire after 15 minutes
- Each code can only be used once
- Make sure you're using the most recent code

### "Too many requests"

Rate limiting is active. Wait a few minutes before trying again.

### Custom fields not showing

1. Verify JSON syntax in `settings/auth.json`
2. Restart dev server
3. Clear browser cache
4. Check browser console for errors

---

## Migration from LoginForm/SignupForm

If using deprecated `LoginForm` or `SignupForm` components:

**Before:**
```jsx
import LoginForm from '@/components/framework/auth/LoginForm';
<LoginForm jcontext={clientData} />
```

**After:**
```jsx
import UnifiedAuth from '@/components/framework/auth/UnifiedAuth';
<UnifiedAuth jcontext={clientData} initialMode="login" />
```

**Benefits:**
- Single component handles both flows
- Automatic user detection (existing vs new)
- Passwordless by default
- Better UX

> 📖 See: [components/auth.md](components/auth.md#migration)

---

## Why Passwordless?

**Better security.** No passwords to steal, no credential stuffing attacks.

**Better UX.** Users don't need to remember another password. Just check email.

**Lower friction.** Sign up in 10 seconds without thinking about password requirements.

**Can enable passwords if needed.** Set `"password": true` in config.

> 💡 **Tip:** Use `app.auth.requireLogin()` for seamless auth modals instead of redirects.
