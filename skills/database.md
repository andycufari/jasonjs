---
skill: database
when: "Querying, creating, updating, or deleting data"
requires: []
---

# Database

> CRUD operations, queries, Record objects, schemas, and real-time subscriptions.

## Quick Start

```jsx
// Component: Add and query data
const handleAdd = async () => {
  await app.db.use('posts').add({ title: 'Hello', status: 'draft' });
  app.ui.toast('Created!');
};

// Query with filters
const posts = await app.db.use('posts')
  .query({ status: 'published' })
  .orderBy('createdAt', 'desc')
  .limit(10);
```

```javascript
// Function: Same API server-side
async function getMyPosts(app) {
  const { db, auth, response } = app;

  const posts = await db.use('posts')
    .query({ created_by: auth.user.id })
    .orderBy('createdAt', 'desc');

  return response({ success: true, data: posts });
}
```

## Auto-Added Fields

Framework automatically adds these - **don't pass them**:

| Field | When | Value |
|-------|------|-------|
| `createdAt` | Create | Timestamp |
| `updatedAt` | Create/Update | Timestamp |
| `created_by` | Create | User ID (if authenticated) |
| `updated_by` | Update | User ID (if authenticated) |

## CRUD Operations

```jsx
// CREATE
const post = await app.db.use('posts').add({
  title: 'New Post',
  content: 'Body text'
});
// Returns Record instance with auto-fields

// READ - by ID
const post = await app.db.use('posts').getById('abc123');

// READ - query
const posts = await app.db.use('posts')
  .query({ status: 'active' })
  .limit(10);

// UPDATE - via Record
post.title = 'Updated Title';
await post.save(); // Only sends changed fields

// UPDATE - direct
await app.db.use('posts').update('abc123', { status: 'published' });

// DELETE
await app.db.use('posts').deleteById('abc123');
```

## Query Builder

Chain methods for complex queries. Awaiting executes the query.

```jsx
const results = await app.db.use('products')
  .query({ category: 'electronics' })
  .gt('price', 100)
  .lte('price', 500)
  .contains('name', 'phone')
  .orderBy('price', 'asc')
  .limit(20)
  .skip(10);
```

### Query Operators

| Method | Example | Description |
|--------|---------|-------------|
| `.query({})` | `.query({ active: true })` | Exact match filters |
| `.gt(f, v)` | `.gt('price', 100)` | Greater than |
| `.gte(f, v)` | `.gte('stock', 1)` | Greater than or equal |
| `.lt(f, v)` | `.lt('price', 50)` | Less than |
| `.lte(f, v)` | `.lte('qty', 10)` | Less than or equal |
| `.in(f, arr)` | `.in('status', ['a','b'])` | Value in array |
| `.not(f, v)` | `.not('status', 'deleted')` | Not equal |
| `.contains(f, s)` | `.contains('name', 'john')` | Case-insensitive contains |
| `.startsWith(f, s)` | `.startsWith('name', 'J')` | Starts with |
| `.endsWith(f, s)` | `.endsWith('email', '.com')` | Ends with |

### Result Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `await query` | `Array` | Execute, return plain objects |
| `.execute()` | `Array` | Same as awaiting |
| `.records()` | `Array<Record>` | Returns Record instances |
| `.first()` | `Object\|null` | First result as plain object |
| `.firstRecord()` | `Record\|null` | First result as Record |
| `.count()` | `number` | Count matching (optimized) |
| `.exists()` | `boolean` | Check if any match |

```jsx
// Plain objects (default)
const posts = await app.db.use('posts').query({ featured: true });

// Record instances (for .save(), .delete())
const posts = await app.db.use('posts').query({ featured: true }).records();
posts[0].featured = false;
await posts[0].save();

// Efficient counting
const count = await app.db.use('posts')
  .query({ status: 'published' })
  .count();
```

## Record Objects

Records track changes and only send modified fields on save.

```jsx
const post = await app.db.use('posts').getById('abc123');

// Modify fields
post.title = 'New Title';
post.status = 'published';

// Check state
post.isModified();     // true
post.getChanges();     // { title: 'New Title', status: 'published' }

// Save (only sends changed fields)
await post.save();

// Other methods
await post.delete();   // Delete from database
await post.reload();   // Refresh from database
post.reset();          // Discard changes
post.getValues();      // Get all fields as plain object
```

## Search

Full-text search across fields marked `search: true` in schema.

```jsx
const res = await app.db.use('products').search('wireless headphones', 20);

// With additional filters
const res = await app.db.use('products').search('phone', 10, {
  category: 'electronics',
  inStock: true
});
```

> ⚠️ **`search()` does NOT return a bare array** — unlike `query()` and `nearBy()`. A
> non-empty search returns `{ success, data, error }` (the rows are in `.data`),
> while an empty search term or an unsupported-type fallback returns a plain `[]`.
> Always unwrap defensively or you'll hit `results.slice is not a function`:
> ```jsx
> const res = await app.db.use('products').search(term, 50, filters);
> const rows = Array.isArray(res) ? res : (res?.data || []);
> ```

## Real-Time Subscriptions

```jsx
useEffect(() => {
  const subscription = app.db.use('orders')
    .subscribe({ status: 'pending' }, (change) => {
      if (change.type === 'create') {
        setOrders(prev => [...prev, change.data]);
      } else if (change.type === 'update') {
        setOrders(prev => prev.map(o =>
          o._id === change.id ? change.data : o
        ));
      } else if (change.type === 'delete') {
        setOrders(prev => prev.filter(o => o._id !== change.id));
      }
    });

  return () => subscription.unsubscribe(); // Always cleanup!
}, []);
```

## Geospatial Queries

```jsx
// Find within distance
const nearby = await app.db.use('places')
  .nearBy('location', [-73.935242, 40.730610], 5000); // 5km

// Within circle
const inArea = await app.db.use('places')
  .query({})
  .withinCircle('location', [-73.935, 40.730], 10000);

// Within bounding box
const inBox = await app.db.use('places')
  .query({})
  .withinBounds('location', [-74.0, 40.7], [-73.9, 40.8]);
```

> **Geo indexing is automatic.** Any field declared `"type": "geopoint"` in the
> schema is indexed for you — just store `[lng, lat]` and call `nearBy` /
> `withinCircle` / `withinBounds`. If geo queries return empty, the usual cause is
> a field that holds coordinates but isn't declared `geopoint` in the schema: fix
> the schema type and re-save a record so the field is recognized.

## Page-Level Fetch

In JSON pages, use `fetch_data`:

```json
{
  "fetch_data": {
    "database": "posts",
    "query": { "published": true },
    "sort": { "createdAt": -1 },
    "limit": 10
  },
  "components": [
    { "innerHTML": "{{data[0].title}}" }
  ]
}
```

### User's Own Data

Filter by `created_by` to get current user's records:

```json
{
  "fetch_data": {
    "database": "orders",
    "query": { "created_by": "{{user.id}}" }
  }
}
```

## Database Schema

Define schemas in `databases/{name}.json`:

```json
{
  "type": "jason",
  "schema": {
    "title": {
      "type": "text",
      "label": "Title",
      "required": true,
      "search": true
    },
    "price": {
      "type": "price",
      "label": "Price",
      "required": true
    },
    "category": {
      "type": "relation",
      "label": "Category",
      "collection": "categories"
    },
    "status": {
      "type": "select",
      "label": "Status",
      "options": [
        { "value": "draft", "label": "Draft" },
        { "value": "active", "label": "Active" }
      ],
      "default": "draft"
    },
    "location": {
      "type": "geopoint",
      "label": "Location"
    },
    "tags": {
      "type": "array",
      "label": "Tags",
      "items": { "type": "text", "placeholder": "Enter tag" },
      "maxItems": 10
    }
  },
  "security": {
    "read": "public",
    "create": "authenticated",
    "update": "owner",
    "delete": "admin"
  },
  "joins": [
    {
      "type": "left",
      "class": "categories",
      "key": "category",
      "foreignKey": "_id",
      "fields": ["name", "slug"],
      "as": "categoryData"
    }
  ],
  "indexes": [
    { "fields": ["status", "createdAt"] }
  ]
}
```

### Field Types

| Type | Use For | Schema Props |
|------|---------|--------------|
| `text` | Short text | `minLength`, `maxLength` |
| `email` | Email | Auto-validates |
| `url` | URLs | Auto-validates |
| `tel` | Phone | Country picker |
| `number` | Numbers | `min`, `max` |
| `price` | Currency | `currency` |
| `textarea` | Long text | `rows` |
| `rich_text` | WYSIWYG | TipTap editor |
| `select` | Dropdown | `options: [{value, label}]` |
| `boolean` | Yes/No | - |
| `date` | Date | - |
| `datetime-local` | Date + time | - |
| `image` | Single image | `variant: 'avatar'\|'square'` |
| `file` | Single file | `accept`, `maxSize` |
| `files` | Multiple files | `maxFiles` |
| `array` | List of values | `items: { type, placeholder }`, `maxItems`, `minItems` |
| `geopoint` | Location | Creates 2dsphere index |
| `relation` | Foreign key | `collection`, `multiple` |

### Security Levels

| Level | Access |
|-------|--------|
| `public` | Anyone |
| `authenticated` | Logged-in users |
| `owner` | Creator only (via `created_by`) |
| `admin` | Admin role only |

### Schema Field Properties

| Property | Description |
|----------|-------------|
| `type` | Field type (see above) |
| `label` | Display name in forms |
| `required` | Mandatory field |
| `default` | Default value |
| `hidden` | Exclude from forms |
| `search` | Include in full-text search |
| `searchWeight` | Search priority (higher = more relevant) |
| `index` | Create single-field index |
| `unique` | Enforce uniqueness |
| `listing` | `false` to hide from JasonTable |
| `listEdit` | `true` to enable inline editing in JasonTable |

### Array Fields

```json
{
  "tags": {
    "type": "array",
    "label": "Tags",
    "items": { "type": "text", "placeholder": "Add a tag" },
    "maxItems": 10,
    "minItems": 1
  }
}
```

**`items.type`** — `"text"` or `"number"`. Determines input type in FormBuilder.

**Rendering:**
- **FormBuilder:** Add/remove list with numbered items. Enter adds new item, Backspace on empty removes it.
- **JasonTable:** Joined with commas (`"tag1, tag2, tag3"`). File arrays show count (`"3 files"`).
- **Storage:** Native array in MongoDB (`["a", "b"]`), not a JSON string.

**With options** — becomes multi-select instead of text list:

```json
{
  "features": {
    "type": "array",
    "multiple": true,
    "options": ["WiFi", "Pool", "Parking", "Kitchen"]
  }
}
```

**With file upload** — add `accept` to get file array:

```json
{
  "photos": {
    "type": "array",
    "accept": "image/*",
    "maxItems": 5
  }
}
```

## Server-Side Admin Mode

```javascript
// In public API functions (no authenticated user), use admin mode:
var results = await db.use('keys', true).query({ status: 'active' });

// true = admin mode: bypasses user-scoping and security field filtering
// Without it, queries from unauthenticated API calls may return empty results
// or be filtered to only show records created by the current (null) user
```

| Parameter | Effect |
|-----------|--------|
| `db.use('collection')` | User-scoped: respects security schema, filters by `created_by` if `owner` level |
| `db.use('collection', true)` | Admin mode: `serverSideAccess=true`, `role='admin'`, bypasses all security checks |
| `db.use('collection', 'editor')` | Role impersonation: acts as specified role |

**When to use admin mode:**
- Public API functions (`setting/api.json` routes) that serve unauthenticated clients
- Background jobs / cron functions
- Cross-user data queries (e.g., leaderboards, aggregations)

**When NOT to use admin mode:**
- User-facing components (use standard mode to respect ownership)
- Any context where the user should only see their own data

## API Reference

| Method | Description |
|--------|-------------|
| `app.db.use(name)` | Select collection, returns fluent interface |
| `.add(data)` | Create record, returns Record |
| `.getById(id)` | Get by ID, returns Record or null |
| `.query(filters)` | Start query builder |
| `.update(id, data)` | Update record |
| `.deleteById(id)` | Delete record |
| `.search(term, limit?, filters?)` | Full-text search |
| `.nearBy(field, coords, meters)` | Geospatial query |
| `.subscribe(filters, callback)` | Real-time changes |

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Pass `createdAt`, `created_by` | Auto-added by framework |
| Create separate `userId` field | Use `created_by` (it's already there) |
| Forget `app.db.use()` first | Always: `app.db.use('collection').method()` |
| Forget subscription cleanup | Return `unsubscribe` from `useEffect` |
| `orderBy: "field"` | `orderBy('field', 'desc')` |
| Fetch all then count: `data.length` | Use `.count()` (optimized) |
| Define `_id`, `createdAt` in schema | Auto-added, don't define |
| Create users database | Use `settings/auth.json` for user fields |
| `db.use('x')` in webhooks/workers | `db.use('x', true)` — admin mode needed when no auth user |

## Related

- `skill:component` - Using database in components
- `skill:function` - Server-side database access
- `skill:page` - Page-level fetch_data
- `skill:forms` - FormBuilder with database schemas
