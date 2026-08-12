# Server Functions

Backend JavaScript that runs on the server with database access, external APIs, and user management.

## Quick Start

```javascript
// functions/hello.js
async function hello(app) {
  const { params, response } = app;
  return response({ message: `Hello ${params.name}!` });
}
```

**Call it:**

```javascript
// From component
const result = await app.functions.call('hello', { name: 'John' });

// Or via HTTP
fetch('/api/hello', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John' })
});
```

> 💡 **Tip:** Functions receive an `app` object with all the tools you need - database, auth, external APIs, and more.

---

## The `app` Object

Every function receives one parameter: the `app` object.

```javascript
async function example(app) {
  const {
    // Request
    params,        // Body + query params merged
    method,        // GET, POST, PUT, DELETE, PATCH
    request,       // NextRequest object (HTTP only)

    // Database (same API as client!)
    db,            // app.db.use('todos').add(...)

    // Auth
    auth,          // { user, isAuthenticated, isAdmin, hasRole() }

    // Response
    response,      // response(data, statusCode)

    // Tools
    log,           // log('message', 'info|error|warn')
    CURL,          // CURL(url, params, method, auth) - External HTTP requests
    sanitizeData,  // Clean user input
    trackEvent,    // Analytics
    utils,         // Email, slugs, webhooks
    ai,            // AI chat
    cache,         // Cache API
    env,           // Environment variables (async! use await env.get('KEY'))
    billing        // Subscription status
  } = app;
}
```

> 📖 Full reference: [app.md](./app.md)

---

## Database Operations

**Same API as client components** - queries work identically.

```javascript
async function blogAPI(app) {
  const { db, params, response, auth } = app;

  const posts = db.use('blog_posts');

  // CREATE
  const post = await posts.add({
    title: params.title,
    content: params.content,
    authorId: auth.user.id,
    published: true
  });

  // READ
  const found = await posts.getById(params.id);

  // UPDATE - using Record
  found.views = found.views + 1;
  await found.save(); // Only saves changed fields

  // DELETE
  await found.delete();

  // QUERY
  const published = await posts.query()
    .where('published', true)
    .where('views', '>=', 100)
    .orderBy('createdAt', 'desc')
    .limit(10);

  return response({ posts: published });
}
```

> 📖 See [databases.md](./databases.md) for complete API

---

## Authentication

```javascript
async function protectedFunction(app) {
  const { auth, response } = app;

  // Check if logged in
  if (!auth.isAuthenticated) {
    return response({ error: 'Login required' }, 401);
  }

  // Access user
  const userId = auth.user.id;
  const email = auth.user.email;

  // Check role
  if (auth.isAdmin) {
    // Admin only
  }

  if (auth.hasRole('editor')) {
    // Editor or admin
  }

  if (auth.hasRole(['admin', 'moderator'])) {
    // Has ANY of these roles
  }

  return response({ userId });
}
```

### User Management

Server functions can create and query users:

```javascript
async function registerUser(app) {
  const { params, auth, response } = app;

  // Create user (password automatically hashed)
  const user = await auth.createUser({
    name: params.name,
    email: params.email,
    password: params.password, // Optional
    role: 'user'
  });

  // Get user
  const found = await auth.getUserByEmail('user@example.com');

  // Check existing
  if (found) {
    return response({ error: 'Email exists' }, 409);
  }

  return response({ user }, 201);
}
```

| Method | Description |
|--------|-------------|
| `auth.createUser(data)` | Create new user |
| `auth.getUserByEmail(email)` | Find user by email |
| `auth.getUserByUsername(username)` | Find user by username |
| `auth.getUserById(id)` | Find user by ID |

---

## Response & Status Codes

```javascript
async function statusExample(app) {
  const { response } = app;

  // Numeric codes
  return response({ success: true }, 200);
  return response({ error: 'Not found' }, 404);

  // String codes (auto-converted)
  return response({ error: 'Unauthorized' }, 'AUTH');      // → 401
  return response({ error: 'Invalid' }, 'INVALID');        // → 400
  return response({ data: item }, 'OK');                   // → 200
  return response({ error: 'Server error' }, 'ERROR');     // → 500
}
```

**String Status Codes:**

| String | HTTP | String | HTTP |
|--------|------|--------|------|
| `OK`, `SUCCESS` | 200 | `AUTH`, `UNAUTHORIZED` | 401 |
| `CREATED` | 201 | `FORBIDDEN` | 403 |
| `INVALID`, `BAD_REQUEST` | 400 | `NOT_FOUND` | 404 |
| `ERROR`, `SERVER_ERROR` | 500 | `TOO_MANY_REQUESTS` | 429 |

---

## External APIs (CURL)

Call external APIs with built-in security.

```javascript
async function externalAPI(app) {
  const { CURL, response } = app;

  // GET request
  const result = await CURL('https://api.example.com/data', { query: 'test' }, 'GET');

  // POST with data
  const created = await CURL(
    'https://api.example.com/create',
    { name: 'John' },
    'POST'
  );

  // With Bearer token
  const authed = await CURL(
    'https://api.example.com/protected',
    {},
    'GET',
    'YOUR_API_TOKEN'
  );

  if (result.error) {
    return response({ error: result.error }, 500);
  }

  return response({ data: result.response });
}
```

### Configuration

Add allowed domains to `settings/general.json`:

```json
{
  "allowedExternalDomains": [
    "api.stripe.com",
    "api.sendgrid.com",
    "*.twilio.com",
    "api.example.com"
  ]
}
```

---

## Utilities

```javascript
async function utilsExample(app) {
  const { utils, response } = app;

  // Slug generation
  const slug = utils.generateSlug('My Blog Post');
  // → "my-blog-post-1a2b3c4d"

  // Send email
  const emailResult = await utils.sendEmail({
    to: 'user@example.com',
    subject: 'Welcome!',
    html: '<h1>Welcome!</h1>'
  });

  if (emailResult.quotaExceeded) {
    return response({ error: 'Rate limit exceeded' }, 429);
  }

  // Send webhook
  await utils.sendWebhook('https://api.example.com/webhook', {
    event: 'user_registered',
    userId: '123'
  });

  return response({ success: true });
}
```

| Utility | Description |
|---------|-------------|
| `generateSlug(title)` | URL-safe slug with timestamp |
| `sendEmail(options)` | Send email (rate limited) |
| `sendWebhook(url, data, opts)` | HTTP webhook (rate limited) |
| `uploadFile(data, path, opts)` | Upload to storage |
| `generatePDF(template, data)` | Generate PDF |
| `optimizeImage(key, opts)` | Optimize image |

---

## Environment Variables

Access environment variables from `settings/.env` (a JSON file: `{ "KEY": "value" }`).

> **Important:** `app.env` is an async API, not a plain object. Accessing `app.env.MY_VAR` silently returns `undefined` with no error.

```javascript
async function example(app) {
  const { env, response } = app;

  // ❌ WRONG — looks intuitive but silently returns undefined
  const key = app.env.STRIPE_KEY;

  // ✅ CORRECT — all methods are async
  const key = await env.get('STRIPE_KEY');
  const key = await env.get('STRIPE_KEY', 'fallback');  // with default
  const exists = await env.has('STRIPE_KEY');             // true/false
  const allVars = await env.all();                        // { KEY: 'value', ... }

  return response({ hasKey: exists });
}
```

| Method | Returns | Description |
|--------|---------|-------------|
| `await env.get(name)` | `string \| null` | Get variable value |
| `await env.get(name, default)` | `string` | Get with fallback |
| `await env.has(name)` | `boolean` | Check if variable exists |
| `await env.all()` | `object` | Get all variables |

---

## Development & Debugging

### Cache Bypass with `?dev=true`

Functions are cached in production for performance. During development, add `?dev=true` to any URL to bypass the cache:

```
https://yourdomain.com/api/myFunction?dev=true
```

- **`?dev=true`** — Enables dev mode for 24 hours (per IP address)
- **`?dev=false`** — Disables dev mode immediately
- Every page view auto-refreshes the 24h window while active
- Component test mode (`?c=ComponentName`) auto-enables dev mode

Without this, you'll be testing stale cached code after making changes.

---

## Examples

### Contact Form Handler

```javascript
async function contact(app) {
  const { params, db, utils, sanitizeData, response } = app;

  if (!params.email || !params.message) {
    return response({ error: 'Email and message required' }, 400);
  }

  const clean = sanitizeData(params);

  // Save to database
  await db.use('contacts').add({
    name: clean.name,
    email: clean.email,
    message: clean.message,
    createdAt: new Date().toISOString()
  });

  // Send notification
  await utils.sendEmail({
    to: 'admin@mysite.com',
    subject: `Contact from ${clean.name}`,
    html: `<p>${clean.message}</p>`
  });

  return response({ success: true });
}
```

### REST API Pattern

```javascript
async function productsAPI(app) {
  const { method, params, db, response, auth } = app;
  const products = db.use('products');

  switch (method) {
    case 'GET':
      const results = await products.query()
        .orderBy('createdAt', -1)
        .limit(20);
      return response({ products: results });

    case 'POST':
      if (!auth.hasRole(['admin', 'editor'])) {
        return response({ error: 'Unauthorized' }, 403);
      }
      const product = await products.add({
        ...params.product,
        createdBy: auth.user.id
      });
      return response({ product }, 201);

    case 'DELETE':
      if (!auth.isAdmin) {
        return response({ error: 'Admin only' }, 403);
      }
      await products.deleteById(params.id);
      return response({ deleted: true });

    default:
      return response({ error: 'Method not allowed' }, 405);
  }
}
```

### Error Handling

```javascript
async function safeFunction(app) {
  const { params, db, response, log } = app;

  try {
    if (!params.id) {
      return response({ error: 'ID required' }, 400);
    }

    const order = await db.use('orders').getById(params.id);

    if (!order) {
      return response({ error: 'Order not found' }, 404);
    }

    order.status = 'processed';
    await order.save();

    return response({ order });

  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    return response({ error: 'Operation failed' }, 500);
  }
}
```

---

## Best Practices

1. **Always validate input**
   ```javascript
   const clean = sanitizeData(params);
   if (!clean.email) return response({ error: 'Invalid' }, 400);
   ```

2. **Check authentication**
   ```javascript
   if (!auth.isAuthenticated) return response({ error: 'Login required' }, 401);
   ```

3. **Verify authorization**
   ```javascript
   if (record.userId !== auth.user.id && !auth.isAdmin) {
     return response({ error: 'Not authorized' }, 403);
   }
   ```

4. **Use try-catch for external calls**
   ```javascript
   try {
     const result = await CURL('https://api.example.com');
   } catch (error) {
     return response({ error: error.message }, 500);
   }
   ```

5. **Log important events**
   ```javascript
   log('Order created', 'info');
   log(`Error: ${error.message}`, 'error');
   ```

---

## Calling Functions

**From components:**

```javascript
// Using app.functions
const result = await app.functions.call('functionName', { param: 'value' });

// Using fetch
const result = await fetch('/api/functionName', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ param: 'value' })
}).then(r => r.json());
```

**Background workers:** not available in the open-source runtime — `app.worker` throws. For scheduled or queued work today, use an external cron hitting a function endpoint.

---

## Quick Reference

```javascript
// Response
response(data, code)         // Return with status code
response({ x: 1 }, 200)
response({ error }, 'AUTH')  // String codes work too

// Database
db.use('collection').add(data)
db.use('collection').getById(id)
db.use('collection').query().where(...).limit(10)

// Auth
auth.user                    // Current user or null
auth.isAuthenticated         // Boolean
auth.isAdmin                 // Boolean
auth.hasRole(role)           // Check role(s)
auth.createUser(data)        // Create user
auth.getUserByEmail(email)   // Find user

// Tools
sanitizeData(params)         // Clean input
CURL(url, params, method, auth)  // HTTP request
log(message, level)          // Server log
trackEvent(event, props)     // Analytics

// Utilities
utils.generateSlug(title)
utils.sendEmail(options)
utils.sendWebhook(url, data)
```
