# The App Object

The unified API for everything. Same syntax works in components and functions.

```javascript
// In components (client-side)
import { useApp } from '@jasonjs/framework';
const app = useApp();
await app.db.use('todos').add({ task: 'Ship it' });

// In functions (server-side)
async function myFunction(app) {
  await app.db.use('todos').add({ task: 'Ship it' });
}
```

## Quick Reference

| Module | Purpose | Client | Server |
|--------|---------|--------|--------|
| `app.db` | Database CRUD | REST API | Direct MongoDB |
| `app.auth` | Authentication | Session state | Session state |
| `app.ui` | Toasts, modals, loading | Full | Stubs (no-op) |
| `app.events` | Component communication | Full | Full |
| `app.storage` | File uploads (S3) | Via API | Direct S3 |
| `app.billing` | Payments, subscriptions | Full | - |
| `app.cache` | Temporary data | In-memory | In-memory |
| `app.browser` | Location, device info | Full | Stubs |
| `app.navigate` | Routing | Full | - |
| `app.utils` | Formatting, validation | Full | Full |
| `app.context` | Current request info | Full | Full |
| `app.user` | Custom fields | Full | - |
| `app.ai` | AI prompts | Full | Full |

---

## app.db

```javascript
const db = app.db.use('products');

// Create
const product = await db.add({ name: 'Widget', price: 99 });

// Read
const all = await db.query({ status: 'active' });
const one = await db.getById('product-123');

// Update
await db.update('product-123', { price: 149 });

// Delete
await db.delete('product-123');

// Search
const results = await db.search('widget', 10);

// Geospatial
const nearby = await db.nearBy('location', [-73.9, 40.7], 5000);
```

**See:** [databases.md](./databases.md) for full API.

---

## app.ui

Client-side only. Server calls are no-ops.

```javascript
// Toast notifications
app.ui.toast('Saved!', { type: 'success' });
app.ui.toast('Error', { type: 'error', duration: 5000 });

// Confirmation dialog
const confirmed = await app.ui.confirm('Delete this item?', {
  title: 'Confirm',
  okText: 'Delete',
  type: 'danger'
});

// Alert
await app.ui.alert('Done!', { title: 'Success' });

// Loading overlay
app.ui.loading(true);
await doSomething();
app.ui.loading(false);

// Theme
app.ui.theme.toggle();
app.ui.theme.set('dark');
const current = app.ui.theme.current;
```

### Toast Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | `'info'` | `'success'`, `'error'`, `'info'` |
| `duration` | number | `4000` | Milliseconds |
| `position` | string | `'top-right'` | `'top-right'`, `'top-left'`, `'bottom-right'`, `'bottom-left'` |

---

## app.auth

```javascript
// Check status
if (app.auth.isAuthenticated) {
  console.log(app.auth.user);
}

// Check roles
if (app.auth.hasRole('admin')) { ... }
if (app.auth.isAdmin) { ... }
const roles = app.auth.userRoles; // ['user', 'editor']

// Sign in/out
await app.auth.signIn('google');
await app.auth.signIn('credentials', { email, password });
await app.auth.signOut();

// Require login (shows modal, no redirect)
await app.auth.requireLogin({
  mode: 'login',
  message: 'Please sign in to continue'
});

// Redirect to login page
app.auth.redirectToLogin('/protected-page');
```

**See:** [auth.md](./auth.md) for full configuration.

---

## app.events

Inter-component communication without prop drilling.

```javascript
// Emit
app.events.emit('cart:add', { productId: '123', qty: 1 });

// Subscribe
const unsubscribe = app.events.on('cart:add', (data) => {
  console.log('Added to cart:', data);
});

// Wildcard
app.events.on('cart:*', (data) => { ... });

// One-time
app.events.once('payment:complete', (data) => { ... });

// Always cleanup in useEffect
useEffect(() => {
  const unsub = app.events.on('cart:updated', handleUpdate);
  return () => unsub();
}, []);
```

---

## app.storage

```javascript
// Upload file
const result = await app.storage.upload(file, {
  path: 'uploads/images',
  maxSize: 10 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png']
});
// { success, url, key, name, type, size }

// Get URL with transformations
const url = await app.storage.getUrl('uploads/image.jpg', {
  width: 400,
  height: 300,
  quality: 80,
  format: 'webp'
});

// Delete
await app.storage.delete('uploads/image.jpg');

// Local key-value (localStorage wrapper)
await app.storage.set('prefs', { theme: 'dark' });
const prefs = await app.storage.get('prefs');
await app.storage.remove('prefs');
```

---

## app.billing

```javascript
// Check subscription
const subscription = await app.billing.getSubscriptionStatus();

// Check plan access
if (await app.billing.canAccess('pro')) {
  showProFeature();
}

// Require plan (shows upgrade modal if needed)
await app.billing.requirePlan('pro', {
  message: 'Upgrade to export data'
});

// Subscribe (handles auth + checkout)
await app.billing.subscribe('pro');

// Show plan picker
const planId = await app.billing.showPlans();

// Show billing modal
await app.billing.showBillingModal({ tab: 'history' });
```

**See:** [billing.md](./billing.md) for full configuration.

---

## app.navigate

```javascript
app.navigate.to('/products');
app.navigate.replace('/login');  // No history entry
app.navigate.back();
app.navigate.forward();
app.navigate.reload();

// External links
app.navigate.external('https://example.com', { newTab: true });

// Current URL info
const { pathname, search, hash } = app.navigate.current;
```

---

## app.user

Manage custom fields for the current user.

```javascript
// Get fields
const company = app.user.getField('company', 'Not set');
const allFields = app.user.customFields;

// Set fields (persists to database)
await app.user.setField('company', 'Acme Corp');
await app.user.setFields({ company: 'Acme', phone: '+1 555' });

// Delete field
await app.user.deleteField('oldPreference');

// Check field exists
if (app.user.hasField('phone')) { ... }
```

---

## app.cache

Client-side in-memory cache with TTL.

```javascript
app.cache.set('key', data, 60000);  // 60 second TTL
const cached = app.cache.get('key');
if (app.cache.has('key')) { ... }
app.cache.delete('key');
app.cache.clear();
```

---

## app.utils

```javascript
// Formatting
app.utils.formatCurrency(99.99, 'USD');  // "$99.99"
app.utils.formatNumber(1234567);          // "1,234,567"
app.utils.formatDate(new Date());         // "2024-01-15"

// Validation
app.utils.validateEmail('user@example.com');  // true
app.utils.validatePhone('+1234567890');       // true

// Helpers
const id = app.utils.generateId();
const debouncedFn = app.utils.debounce(fn, 300);
const throttledFn = app.utils.throttle(fn, 100);

// Geospatial
const meters = app.utils.calculateDistance(
  { lat: 40.7, lng: -74.0 },
  { lat: 34.0, lng: -118.2 }
);
```

---

## app.browser

Client-side only.

```javascript
// Location
const loc = await app.browser.location.get({ enableHighAccuracy: true });
// { latitude, longitude, accuracy }

const unwatch = app.browser.location.watch((pos) => { ... });
unwatch(); // Stop watching

// Device info
const { os, browser, screen } = app.browser.device;

// Network
const { ip, isOnline } = await app.browser.network();

// Locale
const { language, timezone } = app.browser.locale;
```

---

## app.context

```javascript
const params = app.context.params;         // URL params
const search = app.context.searchParams;   // Query string
const pathname = app.context.pathname;     // Current path
const domain = app.context.domain;         // Current domain
const siteId = app.context.siteId;         // Tenant ID
const userId = app.context.userId;         // Current user ID
```

---

## app.ai

```javascript
// Text generation
const result = await app.ai.prompt('Write a product description');

// Image generation
const result = await app.ai.image('A sunset over mountains', { size: '1024x1024' });
// result.images[0].url → CDN URL

// Image editing (from FileUpload, URL, or file path — auto-detected)
const result = await app.ai.image('Remove the background', {
  editMode: true,
  images: [formData.photo]  // FileUpload object from FormBuilder
});
```

**See:** [ai.md](./ai.md) for full configuration.

---

## React Hooks

```javascript
import { useApp, useQuery, useSubscription, useLocation } from '@jasonjs/framework';

// Main hook
const app = useApp();

// Query with loading state
const { data, loading, error, refetch } = useQuery('products', { status: 'active' });

// Real-time subscription
const { data, loading, error } = useSubscription('messages', { roomId: '123' });

// Location tracking
const { location, loading, getCurrentLocation, watchLocation } = useLocation();
```

---

## Server Functions

In functions, `app` is passed as the first parameter with additional server-only features:

```javascript
async function createOrder(app) {
  const { params, db, auth, utils, response, log } = app;

  // Request data
  const { items } = params;

  // Auth check
  if (!auth.isAuthenticated) {
    return response({ error: 'Login required' }, 'AUTH');
  }

  // Database
  const order = await db.use('orders').add({
    userId: auth.user.id,
    items
  });

  // Logging
  log(`Order ${order.id} created`);

  // Response
  return response({ order }, 'CREATED');
}
```

### Response Shortcuts

| String | Code | Use Case |
|--------|------|----------|
| `'OK'` | 200 | Success |
| `'CREATED'` | 201 | Resource created |
| `'INVALID'` | 400 | Bad request |
| `'AUTH'` | 401 | Unauthorized |
| `'FORBIDDEN'` | 403 | Access denied |
| `'NOT_FOUND'` | 404 | Not found |
| `'ERROR'` | 500 | Server error |

**See:** [functions.md](./functions.md) for full server API.
