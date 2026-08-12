---
skill: function
when: "Building any server-side function"
requires: []
---

# Function Building

> Build secure server-side functions with database, email, AI, and external API access.

## Quick Start

```javascript
// @desc Process order and send confirmation email
async function processOrder(app) {
  const { params, db, auth, response, utils, log } = app;

  // Validate input
  if (!params.orderId) {
    return response({ error: 'Order ID required' }, 'INVALID');
  }

  // Check authentication
  if (!auth.isAuthenticated) {
    return response({ error: 'Login required' }, 'AUTH');
  }

  try {
    // Get order
    const order = await db.use('orders').getById(params.orderId);
    if (!order) {
      return response({ error: 'Order not found' }, 'NOT_FOUND');
    }

    // Update status
    await db.use('orders').update(params.orderId, {
      status: 'processed',
      processedAt: new Date()
    });

    // Send confirmation email
    await utils.sendEmail({
      to: order.email,
      subject: 'Order Confirmed',
      html: `<h1>Thank you!</h1><p>Order ${params.orderId} confirmed.</p>`
    });

    log(`Order ${params.orderId} processed`);
    return response({ success: true, orderId: params.orderId });

  } catch (error) {
    log(`processOrder failed: ${error.message}`, 'error');
    return response({ error: 'Processing failed' }, 'ERROR');
  }
}
```

## Function Structure

```javascript
// @desc Brief description for file discovery
async function functionName(app) {
  const {
    // Request data
    params,           // Merged body + query params
    method,           // GET, POST, PUT, DELETE, PATCH

    // Response
    response,         // response(data, status)

    // Database
    db,               // db.use('collection')

    // Authentication
    auth,             // { user, isAuthenticated, isAdmin, hasRole(), createUser(), getUserByEmail() }

    // Services
    ai,               // { prompt(text, opts), image(text, opts), speech(text, opts) }
    cache,            // { get(key), set(key, value, ttl), delete(key) }
    utils,            // { sendEmail(), generateSlug(), uploadFile(), sendWebhook() }
    CURL,             // Secure external HTTP
    env,              // { get(name, default), has(name), all() } - all async!

    // Helpers
    log,              // log(message, 'info|warn|error')
    sanitizeData,     // Clean user input
    trackEvent        // Analytics
  } = app;

  // ... function logic ...

  return response({ success: true, data: result });
}
```

## App Object Reference

```javascript
// DATABASE
const db = app.db.use('posts');
const db = app.db.use('posts', true);  // Admin mode (bypasses security)
await db.add({ title: 'New' });
await db.getById('id123');
await db.query({ status: 'active' }).limit(10);
await db.update('id123', { title: 'Updated' });
await db.delete('id123');

// AUTHENTICATION
const { user, isAuthenticated, isAdmin } = app.auth;
if (app.auth.hasRole('editor')) { /* ... */ }
if (app.auth.hasRole(['admin', 'mod'])) { /* any match */ }

// User management
const newUser = await app.auth.createUser({ email, password, name });
const userByEmail = await app.auth.getUserByEmail('user@example.com');
const userById = await app.auth.getUserById('user_id');
const count = await app.auth.countUsers({ role: 'admin' });
const users = await app.auth.getUsers({ limit: 50, skip: 0 });

// RESPONSE (status codes auto-convert)
return app.response({ success: true }, 200);
return app.response({ error: 'Not found' }, 'NOT_FOUND');  // 404
return app.response({ error: 'Bad input' }, 'INVALID');    // 400
return app.response({ error: 'Denied' }, 'AUTH');          // 401
return app.response({ error: 'Forbidden' }, 'FORBIDDEN');  // 403
return app.response({ error: 'Failed' }, 'ERROR');         // 500

// EMAIL
await app.utils.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Hello</h1>',
  text: 'Hello'  // Optional fallback
});

// EXTERNAL API (requires allowedExternalDomains in settings)
const result = await app.CURL(
  'https://api.example.com/data',
  { query: 'test' },  // params
  'GET',              // method
  'bearer-token'      // auth (optional)
);
// result: { response, status, error }

// AI
const result = await app.ai.prompt('Write a description', {
  maxTokens: 500,
  system: 'You are a helpful assistant.'  // Optional system prompt
});
// result: { success: true, text: '...', cost: 0.001 }

// CACHE (Redis, tenant-isolated)
await app.cache.set('key', value, 300);  // 300 seconds TTL
const cached = await app.cache.get('key');
await app.cache.delete('key');

// LOGGING
app.log('Info message');
app.log('Warning', 'warn');
app.log('Error occurred', 'error');

// ENVIRONMENT VARIABLES (all async!)
const apiKey = await app.env.get('STRIPE_KEY', 'default_value');
const hasKey = await app.env.has('STRIPE_KEY');
const allEnv = await app.env.all();

// ANALYTICS
await app.trackEvent('order_completed', { amount: 99.99 });
```

## Patterns

### Pattern: REST API Handler

```javascript
async function productsAPI(app) {
  const { method, params, db, auth, response } = app;
  const products = db.use('products');

  switch (method) {
    case 'GET':
      const list = await products.query(params.filters || {})
        .orderBy('createdAt', 'desc')
        .limit(params.limit || 20);
      return response({ products: list });

    case 'POST':
      if (!auth.isAuthenticated) {
        return response({ error: 'Auth required' }, 'AUTH');
      }
      const created = await products.add({
        ...params,
        createdBy: auth.user.id
      });
      return response({ product: created }, 'CREATED');

    case 'DELETE':
      if (!auth.isAdmin) {
        return response({ error: 'Admin only' }, 'FORBIDDEN');
      }
      await products.delete(params.id);
      return response({ deleted: true });

    default:
      return response({ error: 'Method not allowed' }, 405);
  }
}
```

### Pattern: Ownership Check

```javascript
async function updateArticle(app) {
  const { params, db, auth, response } = app;

  if (!auth.isAuthenticated) {
    return response({ error: 'Login required' }, 'AUTH');
  }

  const article = await db.use('articles').getById(params.id);
  if (!article) {
    return response({ error: 'Not found' }, 'NOT_FOUND');
  }

  // Check ownership OR admin
  const canEdit = article.created_by === auth.user.id || auth.isAdmin;
  if (!canEdit) {
    return response({ error: 'Not authorized' }, 'FORBIDDEN');
  }

  await db.use('articles').update(params.id, params.updates);
  return response({ success: true });
}
```

### Pattern: Cached Data

```javascript
async function getPopularProducts(app) {
  const { db, cache, response } = app;
  const cacheKey = 'popular-products';

  // Check cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return response({ products: cached, fromCache: true });
  }

  // Fetch from database
  const products = await db.use('products')
    .query({ featured: true })
    .orderBy('sales', 'desc')
    .limit(10);

  // Cache for 5 minutes
  await cache.set(cacheKey, products, 300);

  return response({ products, fromCache: false });
}
```

### Pattern: AI Generation

```javascript
async function generateDescription(app) {
  const { params, ai, response } = app;

  const result = await ai.prompt(
    `Write a product description for: ${params.productName}`,
    {
      maxTokens: 200,
      system: 'You are a marketing copywriter.'
    }
  );

  if (!result.success) {
    return response({ error: result.error }, 'ERROR');
  }

  return response({ description: result.text, cost: result.cost });
}
```

## Status Codes

| Code | Number | Use For |
|------|--------|---------|
| `'OK'` | 200 | Success (default) |
| `'CREATED'` | 201 | Record created |
| `'INVALID'` | 400 | Bad input |
| `'AUTH'` | 401 | Not authenticated |
| `'FORBIDDEN'` | 403 | Not authorized |
| `'NOT_FOUND'` | 404 | Resource missing |
| `'ERROR'` | 500 | Server error |
| `'TOO_MANY_REQUESTS'` | 429 | Rate limited |

## Calling from Components

```jsx
// In any component
const result = await app.functions.call('processOrder', {
  orderId: '123',
  action: 'confirm'
});

if (result.success) {
  app.ui.toast('Order processed!');
} else {
  app.ui.toast(result.error, { type: 'error' });
}
```

## Background Workers

Run functions asynchronously via events or direct calls:

```javascript
// Emit event (handler configured in settings/workers.json)
await app.worker.emit('order:created', { orderId: '123', total: 99.99 });

// Direct function call (background)
await app.worker.call('sendEmail', { to: 'user@example.com', subject: 'Hello' });

// With options
await app.worker.call('processFile', { fileId: '123' }, {
  priority: 0,   // 0 = highest
  delay: 5000    // Wait 5s before processing
});
```

> 📖 See `skill:settings/workers` for full configuration.

## Environment Variables

`app.env` is an **async API**, not a plain object. Accessing `app.env.MY_VAR` silently returns `undefined`.

```javascript
// ❌ WRONG — silently returns undefined, no error
const key = app.env.STRIPE_KEY;

// ✅ CORRECT — all methods are async
const key = await app.env.get('STRIPE_KEY');
const key = await app.env.get('STRIPE_KEY', 'fallback_value');  // with default
const exists = await app.env.has('STRIPE_KEY');                  // boolean
const all = await app.env.all();                                 // { KEY: 'value', ... }
```

Environment variables are loaded from `settings/.env` (JSON file: `{ "KEY": "value" }`).

## Development & Debugging

### Cache Bypass with `?dev=true`

Functions are cached in production. To test changes immediately:

```
https://yourdomain.com/api/myFunction?dev=true
```

- `?dev=true` — enables dev mode (24h session, per-IP)
- `?dev=false` — disables dev mode
- Every page view refreshes the 24h window while active

Without this, you'll test stale cached code after deploying changes.

## Sandbox Restrictions

Functions run in a secure sandbox. **NOT available:**

- `import` / `require()`
- `process`, `global`, `Buffer`, `__dirname`
- `eval()`, `Function()`
- File system access
- Direct npm packages

**Use `app.*` methods for everything.**

## Environment Variables

`app.env` is an **async API**, not a plain object. Every method requires `await`.

```javascript
// ✅ CORRECT — async methods
const apiKey = await app.env.get('STRIPE_KEY');           // Returns value or undefined
const apiKey = await app.env.get('STRIPE_KEY', 'fallback'); // With default
const exists = await app.env.has('STRIPE_KEY');            // Returns boolean
const all    = await app.env.all();                        // Returns { KEY: 'value', ... }

// ❌ WRONG — silently returns undefined (no error!)
const apiKey = app.env.STRIPE_KEY;      // undefined
const apiKey = app.env['STRIPE_KEY'];   // undefined
```

> **Trap:** `app.env.MY_VAR` returns `undefined` silently — no error, no warning. Always use `await app.env.get('MY_VAR')`.

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| `export default async function(params, { app })` | `async function name(app)` |
| `app.email.send()` | `app.utils.sendEmail()` |
| `app.ai.prompt({ prompt: 'text' })` | `app.ai.prompt('text', { maxTokens: 500 })` |
| `app.env.MY_VAR` (plain access) | `await app.env.get('MY_VAR')` — async API! |
| Access `process.env` directly | `await app.env.get('VAR_NAME', default)` |
| `app.env.MY_VAR` (silent undefined!) | `await app.env.get('MY_VAR')` |
| Throw errors | Return `response({ error }, status)` |
| `console.log` | Use `app.log(message, type)` |
| Return non-JSON data | Return plain objects only |
| Forget auth checks | Always validate `auth.isAuthenticated` |
| Trust user input | Use `app.sanitizeData(params)` |

## Related

- `skill:database` - Full query API
- `skill:auth` - Authentication details
- `skill:ai` - AI operations
- `skill:settings/email` - Email configuration
- `skill:settings/workers` - Background jobs and crons
- `skill:settings/api` - External API access
