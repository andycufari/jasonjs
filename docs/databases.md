# Database

Zero-config database with automatic multi-tenancy, joins, and full-text search.

## Quick Start

```json
// database/posts.json
{
  "type": "jason",
  "schema": {
    "title": { "type": "string", "required": true },
    "content": { "type": "string" },
    "published": { "type": "boolean", "default": false }
  }
}
```

```javascript
// Use it
const posts = await app.db.use('posts').add({
  title: 'My First Post',
  content: 'Hello world!',
  published: true
});
```

> 💡 **Automatic fields:** Every record gets `_id`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` for free.

---

## Field Types

Define your schema with typed fields:

```json
// database/products.json
{
  "type": "jason",
  "schema": {
    "name": {
      "type": "string",
      "required": true,
      "search": true,
      "searchWeight": 3
    },
    "price": {
      "type": "number",
      "required": true
    },
    "inStock": {
      "type": "boolean",
      "default": true
    },
    "tags": {
      "type": "array"
    },
    "metadata": {
      "type": "object"
    },
    "releaseDate": {
      "type": "date"
    },
    "location": {
      "type": "geopoint"
    }
  }
}
```

### Field Type Reference

| Type | Example | FormBuilder | JasonTable |
|------|---------|-------------|------------|
| `string` | `"Hello"` | Text input | Text column |
| `number` | `42`, `19.99` | Number input | Number column |
| `boolean` | `true`, `false` | Checkbox/Toggle | Boolean badge |
| `array` | `["a", "b"]` | Multi-select | Tags |
| `object` | `{key: "val"}` | JSON editor | Nested view |
| `date` | ISO string | Date picker | Date column |
| `geopoint` | `[lng, lat]` | Map picker | Map link |

### Field Options

```json
{
  "email": {
    "type": "string",
    "required": true,       // Must be provided
    "unique": true,         // No duplicates allowed
    "index": true,          // Create database index
    "search": true,         // Include in full-text search
    "searchWeight": 2,      // Search relevance (1-10)
    "default": "No email",  // Default value
    "hidden": false         // Return in queries
  }
}
```

---

## Automatic Fields

Every record automatically includes:

| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | Unique identifier |
| `createdAt` | date | When record was created |
| `updatedAt` | date | Last update time |
| `createdBy` | string | User ID who created |
| `updatedBy` | string | User ID who last updated |

```javascript
const post = await db.use('posts').add({ title: 'Hello' });

console.log(post._id);        // "1k2m3n4p5q_abc123"
console.log(post.createdAt);  // 2024-01-15T10:30:00.000Z
console.log(post.createdBy);  // "user_abc123"
```

> 📖 **Note:** These fields are read-only and managed by the framework.

---

## CRUD Operations

### Create

```javascript
// Single record
const post = await app.db.use('posts').add({
  title: 'My Post',
  content: 'Content here',
  published: true
});

// Returns Record object with automatic fields
console.log(post._id);
console.log(post.createdAt);
```

### Read

```javascript
// By ID
const post = await app.db.use('posts').getById('post_123');

// Query
const posts = await app.db.use('posts').query()
  .where('published', true)
  .where('views', '>=', 100)
  .orderBy('createdAt', 'desc')
  .limit(10);

// Search
const results = await app.db.use('posts').search('javascript');

// First match
const post = await app.db.use('posts').query({ slug: 'my-post' }).first();
```

### Update

```javascript
// Using Record (smart - only sends changed fields)
const post = await app.db.use('posts').getById('post_123');
post.title = 'Updated Title';
post.views = post.views + 1;
await post.save();

// Direct update
await app.db.use('posts').update('post_123', {
  title: 'Updated Title'
});
```

### Delete

```javascript
// Using Record
const post = await app.db.use('posts').getById('post_123');
await post.delete();

// Direct
await app.db.use('posts').deleteById('post_123');
```

---

## Relationships (Joins)

Connect related data across collections:

```json
// database/orders.json
{
  "type": "jason",
  "schema": {
    "orderNumber": { "type": "string", "required": true },
    "customerId": { "type": "string", "required": true },
    "productId": { "type": "string", "required": true },
    "status": { "type": "string", "default": "pending" }
  },
  "joins": [
    {
      "class": "customers",
      "key": "customerId",
      "foreignKey": "_id",
      "type": "inner",
      "fields": ["name", "email"]
    },
    {
      "class": "products",
      "key": "productId",
      "foreignKey": "_id",
      "type": "left",
      "fields": ["name", "price", "image"]
    }
  ]
}
```

**Join Configuration:**

| Field | Description | Required |
|-------|-------------|----------|
| `class` | Database to join with | Yes |
| `key` | Local field to match | Yes |
| `foreignKey` | Foreign field to match | Yes |
| `type` | `inner` or `left` | No (default: `inner`) |
| `fields` | Fields to include from joined table | No (default: all) |

### Join Types

**Inner Join** - Only returns records with matches:
```json
{ "type": "inner" }
// If customer doesn't exist, order is excluded
```

**Left Join** - Preserves all records:
```json
{ "type": "left" }
// If customer doesn't exist, order is included with null
```

### Using Joined Data

```javascript
const orders = await app.db.use('orders').query({ status: 'pending' });

orders.forEach(order => {
  console.log(order.orderNumber);
  console.log(order.customer.name);     // From joined customers
  console.log(order.product.name);      // From joined products
});
```

### Control Joins in Queries

```javascript
// Enable joins (default)
const withDetails = await app.db.use('orders').query().limit(10);
// Result includes customer + product data

// Disable joins (faster for large lists)
const idsOnly = await app.db.use('orders').query().join(false).limit(1000);
// Result only has customerId, productId (no joined data)
```

> 💡 **Tip:** Disable joins when you only need IDs or are fetching large lists.

---

## Security

### Collection-Level

```json
// database/posts.json
{
  "type": "jason",
  "schema": { /* fields */ },
  "security": {
    "read": "public",
    "write": "authenticated",
    "create": "authenticated",
    "delete": "owner"
  }
}
```

**Security Levels:**

| Level | Description |
|-------|-------------|
| `public` | Anyone can access |
| `authenticated` | Logged-in users only |
| `owner` | Only user who created the record |
| `admin` | Admin users only |
| `system` | Internal calls only — denied even for admins |
| `never` | Nobody, ever. Use for fields like `password` |

Both spellings are accepted and behave identically:

```json
"read": "admin"
"read": { "level": "admin" }
```

> ⚠️ **Writes default to closed.** If you declare `read` but no `write` /
> `create` / `update` / `delete` rule, mutations require a logged-in user. Reads
> keep the permissive default: an undeclared `read` is public. Declare the levels
> you want explicitly rather than relying on either default.
>
> An unrecognised level (a typo like `"addmin"`) denies access rather than
> falling back to something permissive. If a database starts returning 403s after
> a security edit, check the spelling of the level first.

### Field-Level

```json
// database/users.json
{
  "type": "jason",
  "schema": {
    "name": {
      "type": "string",
      "security": {
        "read": "public",
        "write": "owner"
      }
    },
    "email": {
      "type": "string",
      "security": {
        "read": "owner",
        "write": "owner"
      }
    },
    "password": {
      "type": "string",
      "security": {
        "read": "never",
        "write": "owner"
      }
    }
  }
}
```

> 🔒 **Important:** Security is enforced automatically. You can't bypass it from client code.

---

## Query Builder

### Filters

```javascript
const db = app.db.use('products');

// Equality
await db.query().where('category', 'electronics');

// Comparison
await db.query()
  .where('price', '>', 100)
  .where('price', '<=', 500)
  .where('stock', '>=', 1);

// Multiple conditions (AND)
await db.query()
  .where('category', 'electronics')
  .where('published', true)
  .where('price', '<=', 300);
```

### Text Search

```javascript
// Full-text search (uses searchWeight from schema)
const results = await app.db.use('posts').search('javascript react', 20);

// Search with filters
await app.db.use('products')
  .search('laptop', 50, { category: 'electronics' });
```

### Geospatial

```javascript
// Find nearby (stores location as [longitude, latitude])
const nearby = await app.db.use('stores').nearBy(
  'location',
  [-58.472, -34.548],  // [lng, lat]
  5000                  // 5km radius
);
```

Also `withinCircle`, `withinBounds`, and `withinGeometry` — full guide including maps and location input: [geolocation.md](./geolocation.md). Geospatial queries require MongoDB.

### Sorting & Pagination

```javascript
// Sort
await db.query()
  .orderBy('createdAt', 'desc')
  .orderBy('title', 'asc');

// Paginate
const page1 = await db.query().limit(20).skip(0);
const page2 = await db.query().limit(20).skip(20);
```

---

## Examples

### Blog with Authors

```json
// database/posts.json
{
  "type": "jason",
  "schema": {
    "title": { "type": "string", "required": true, "search": true },
    "content": { "type": "string", "search": true },
    "authorId": { "type": "string", "required": true },
    "published": { "type": "boolean", "default": false },
    "views": { "type": "number", "default": 0 }
  },
  "joins": [
    {
      "class": "authors",
      "key": "authorId",
      "foreignKey": "_id",
      "fields": ["name", "avatar", "bio"]
    }
  ],
  "security": {
    "read": "public",
    "write": "owner",
    "create": "authenticated",
    "delete": "owner"
  }
}
```

```json
// database/authors.json
{
  "type": "jason",
  "schema": {
    "name": { "type": "string", "required": true },
    "avatar": { "type": "string" },
    "bio": { "type": "string" }
  }
}
```

```javascript
// Get published posts with author info
const posts = await app.db.use('posts').query()
  .where('published', true)
  .orderBy('createdAt', 'desc')
  .limit(10);

posts.forEach(post => {
  console.log(post.title);
  console.log(`By ${post.author.name}`);
});
```

### E-commerce Orders

```json
// database/orders.json
{
  "type": "jason",
  "schema": {
    "orderNumber": { "type": "string", "required": true, "unique": true },
    "userId": { "type": "string", "required": true },
    "items": { "type": "array" },
    "total": { "type": "number", "required": true },
    "status": { "type": "string", "default": "pending" }
  },
  "security": {
    "read": "owner",
    "write": "admin",
    "create": "authenticated",
    "delete": "admin"
  }
}
```

```javascript
// Create order
const order = await app.db.use('orders').add({
  orderNumber: `ORD-${Date.now()}`,
  userId: app.auth.user.id,
  items: [
    { productId: 'prod_1', quantity: 2, price: 29.99 },
    { productId: 'prod_2', quantity: 1, price: 49.99 }
  ],
  total: 109.97
});

// Get user's orders
const myOrders = await app.db.use('orders').query()
  .where('userId', app.auth.user.id)
  .orderBy('createdAt', 'desc');
```

---

## FormBuilder Integration

Fields are automatically compatible with FormBuilder:

```json
{
  "component": "@framework/FormBuilder",
  "attributes": {
    "database": "products",
    "fields": [
      {
        "name": "name",
        "label": "Product Name",
        "type": "text",
        "required": true
      },
      {
        "name": "price",
        "label": "Price",
        "type": "number",
        "required": true
      },
      {
        "name": "inStock",
        "label": "In Stock",
        "type": "checkbox"
      },
      {
        "name": "tags",
        "label": "Tags",
        "type": "multiselect",
        "options": ["Featured", "Sale", "New"]
      }
    ]
  }
}
```

> 📖 See [formbuilder.md](./components/formbuilder.md) for complete reference

---

## JasonTable Integration

Display data with automatic CRUD:

```json
{
  "component": "@framework/JasonTable",
  "attributes": {
    "database": "products",
    "columns": [
      { "field": "name", "header": "Name" },
      { "field": "price", "header": "Price", "type": "currency" },
      { "field": "inStock", "header": "Stock", "type": "boolean" },
      { "field": "createdAt", "header": "Created", "type": "date" }
    ],
    "actions": ["edit", "delete"]
  }
}
```

> 📖 See [jasontable.md](./components/jasontable.md) for complete reference

---

## Best Practices

1. **Use joins for related data**
   ```javascript
   // ✅ Good - one query with join
   await db.use('orders').query();

   // ❌ Bad - multiple queries
   const orders = await db.use('orders').query();
   for (order of orders) {
     order.customer = await db.use('customers').getById(order.customerId);
   }
   ```

2. **Disable joins for large lists**
   ```javascript
   // ✅ Good - fast for 1000 records
   await db.use('orders').query().join(false).limit(1000);

   // ❌ Slow - joins add overhead
   await db.use('orders').query().limit(1000);
   ```

3. **Use search for text queries**
   ```javascript
   // ✅ Good - uses text indexes
   await db.use('posts').search('javascript');

   // ❌ Bad - slow without indexes
   await db.use('posts').query().where('content', 'contains', 'javascript');
   ```

4. **Set proper security levels**
   ```javascript
   // ✅ Good - restrictive by default
   "security": {
     "read": "public",
     "write": "owner",
     "delete": "owner"
   }
   ```

5. **Mark searchable fields in schema**
   ```json
   {
     "title": {
       "type": "string",
       "search": true,
       "searchWeight": 3
     }
   }
   ```

---

## Quick Reference

```javascript
// Select database
const db = app.db.use('posts');

// Create
await db.add({ title: 'Hello' });

// Read
await db.getById('id');
await db.query().where('published', true).limit(10);
await db.search('keyword');

// Update
const post = await db.getById('id');
post.title = 'New Title';
await post.save();

// Delete
await db.deleteById('id');

// Joins
await db.query().join(true);   // Enable (default)
await db.query().join(false);  // Disable

// Query helpers
.where(field, value)
.where(field, operator, value)
.orderBy(field, direction)
.limit(number)
.skip(number)
```

---

## Database File Structure

JasonJS supports two ways to organize database configurations:

### New Format (Recommended)
Each database gets its own file in the `database/` folder:

```
database/
├── posts.json
├── authors.json
├── orders.json
└── products.json
```

Each file contains a single database configuration:

```json
// database/posts.json
{
  "type": "jason",
  "schema": { /* fields */ },
  "joins": [ /* joins */ ],
  "security": { /* rules */ }
}
```

### Legacy Format (Still Supported)
All databases in a single file:

```json
// settings/database.json
{
  "posts": {
    "type": "jason",
    "schema": { /* fields */ }
  },
  "authors": {
    "type": "jason",
    "schema": { /* fields */ }
  }
}
```

> 💡 **Priority:** If both formats exist, individual `database/*.json` files take priority over `settings/database.json`.

---

## Advanced Topics

For performance optimization with indexes, see the advanced guide (coming soon).

---

## Field Encryption at Rest

Any field in a database schema can be marked as encrypted. The framework transparently encrypts the value with AES-256-GCM on write and decrypts on read. Addons never call crypto primitives directly.

### Declaring an encrypted field

```json
{
  "schema": {
    "userId":       { "type": "string" },
    "accessToken":  { "type": "string", "encrypted": true },
    "refreshToken": { "type": "string", "encrypted": true },
    "expiryAt":     { "type": "datetime" }
  }
}
```

Addon code treats the field like any other string:

```js
await app.db.use('bc_connections').add({
  userId: app.auth.user.id,
  accessToken: googleTokens.access_token,   // framework encrypts on write
  refreshToken: googleTokens.refresh_token
});

const conn = await app.db.use('bc_connections').findOne({ userId });
conn.accessToken  // already decrypted
```

### What gets stored

The adapter stores an envelope in place of the plaintext:

```json
{
  "__enc": 1,
  "iv":  "<base64>",
  "tag": "<base64>",
  "ct":  "<base64>",
  "t":   "s"
}
```

Objects and arrays are JSON-serialized before encryption (`t: "j"`). Strings use `t: "s"`.

### Limits

- **Cannot query encrypted fields.** Filters like `{ accessToken: "abc" }` throw at the adapter. Use non-encrypted identifier fields (`userId`, a dedup key) to find records, then decrypt.
- **Cannot use in text search.** The search indexer skips encrypted fields automatically — it has no way to tokenize ciphertext.
- **Slight size overhead.** Envelope adds ~60 bytes per field plus base64 expansion.

### Key management

Resolution order for the encryption key:

1. `process.env.JASONJS_ENCRYPTION_KEY` — 64 hex characters. **Required in production.**
2. Dev-only fallback: `.jasonjs-encryption-key` in the project root. The framework auto-generates this on first run and appends it to `.gitignore`.

**Losing the key loses all encrypted data.** There is no recovery. Back up the key (a password manager works fine) before putting anything in prod.

### Rotation

To rotate the key, re-encrypt every affected row with the new key while the old key is still available:

```bash
JASONJS_ENCRYPTION_KEY=<old> JASONJS_NEW_ENCRYPTION_KEY=<new> \
  node scripts/rotate-encryption-key.js --collection bc_connections
```

The script reads each row, decrypts with the old key, encrypts with the new key, writes it back. After it finishes across all collections, swap `JASONJS_ENCRYPTION_KEY` to the new value and restart the app. See `scripts/rotate-encryption-key.js` for details.
