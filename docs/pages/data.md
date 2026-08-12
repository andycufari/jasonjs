# Data Fetching

Server-side data fetching with `fetch_data`. Runs before render, data available as `{{data}}` or `{{sourceId}}`.

## Basic Usage

```json
{
  "fetch_data": {
    "database": "posts",
    "query": { "published": true }
  },
  "components": [
    { "innerHTML": "{{data.title}}" }
  ]
}
```

---

## Single Source

Data available as `{{data}}`:

```json
{
  "fetch_data": {
    "database": "products",
    "query": { "status": "active" },
    "sort": { "createdAt": -1 },
    "limit": 10
  }
}
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `database` | string | Collection/table name |
| `query` | object | Filter conditions |
| `sort` | object | Sort order (`{ field: 1 }` asc, `{ field: -1 }` desc) |
| `limit` | number | Max results |
| `skip` | number | Offset for pagination |
| `findOne` | boolean | Return single object instead of array |
| `search` | string | Full-text search query |
| `join` | boolean | Enable/disable automatic joins (default: true) |

---

## Multiple Sources

Use array with `id` for each source. Access via `{{sourceId}}`:

```json
{
  "fetch_data": [
    {
      "id": "posts",
      "database": "posts",
      "query": { "published": true },
      "limit": 5
    },
    {
      "id": "categories",
      "database": "categories"
    }
  ],
  "components": [
    { "innerHTML": "Posts: {{posts.length}}" },
    { "innerHTML": "Categories: {{categories.length}}" }
  ]
}
```

---

## Dynamic Queries

Use template variables in queries:

### From URL Parameters

```json
{
  "fetch_data": {
    "database": "posts",
    "query": { "slug": "{{params.slug}}" },
    "findOne": true
  }
}
```

### From Search Parameters

```json
{
  "fetch_data": {
    "database": "products",
    "query": { "category": "{{searchParams.cat}}" }
  }
}
```

### From Authenticated User

```json
{
  "fetch_data": {
    "database": "orders",
    "query": { "userId": "{{user.id}}" },
    "sort": { "createdAt": -1 }
  }
}
```

---

## Find One

Return single object instead of array:

```json
{
  "fetch_data": {
    "database": "posts",
    "query": { "slug": "{{params.slug}}" },
    "findOne": true
  },
  "components": [
    { "innerHTML": "{{data.title}}" }
  ]
}
```

Without `findOne: true`, `data` is an array and you'd need `{{data.0.title}}`.

---

## Search

Full-text search (doesn't require MongoDB text index):

```json
{
  "fetch_data": {
    "database": "products",
    "search": "{{searchParams.q}}",
    "limit": 20
  }
}
```

Searches across string fields intelligently.

---

## Sorting

```json
{
  "fetch_data": {
    "database": "posts",
    "sort": { "createdAt": -1 }
  }
}
```

| Value | Direction |
|-------|-----------|
| `1` | Ascending (A-Z, oldest first) |
| `-1` | Descending (Z-A, newest first) |

Multiple sort fields:

```json
{
  "sort": { "category": 1, "createdAt": -1 }
}
```

---

## Pagination

```json
{
  "fetch_data": {
    "database": "posts",
    "limit": 10,
    "skip": "{{searchParams.offset}}"
  }
}
```

---

## Disabling Joins

By default, related data is auto-joined. Disable for performance:

```json
{
  "fetch_data": {
    "database": "posts",
    "join": false
  }
}
```

---

## Query Operators

MongoDB-style query operators:

```json
{
  "query": {
    "status": "active",
    "price": { "$gt": 100 },
    "tags": { "$in": ["featured", "sale"] },
    "stock": { "$gte": 1 }
  }
}
```

| Operator | Description |
|----------|-------------|
| `$eq` | Equal |
| `$ne` | Not equal |
| `$gt` | Greater than |
| `$gte` | Greater than or equal |
| `$lt` | Less than |
| `$lte` | Less than or equal |
| `$in` | In array |
| `$nin` | Not in array |
| `$exists` | Field exists |
| `$regex` | Pattern match |

---

## Complete Example

Blog post page with author data:

```json
{
  "meta": {
    "title": "{{post.title}} - Blog"
  },
  "fetch_data": [
    {
      "id": "post",
      "database": "posts",
      "query": { "slug": "{{params.slug}}" },
      "findOne": true
    },
    {
      "id": "related",
      "database": "posts",
      "query": {
        "category": "{{post.category}}",
        "slug": { "$ne": "{{params.slug}}" }
      },
      "limit": 3
    }
  ],
  "components": [
    {
      "component": "article",
      "components": [
        { "component": "h1", "innerHTML": "{{post.title}}" },
        { "component": "p", "innerHTML": "By {{post.author.name}}" },
        {
          "component": "@framework/website/MarkdownRenderer",
          "attributes": { "content": "{{post.content}}" }
        }
      ]
    },
    {
      "component": "aside",
      "components": [
        { "component": "h3", "innerHTML": "Related Posts" }
      ]
    }
  ]
}
```

---

## Caching

- Data is cached for 1 minute by default
- Dev mode (`?dev=true`) bypasses cache
- Cache is isolated per domain (multi-tenant safe)

---

## Error Handling

If fetch fails, data returns empty array `[]` or empty object `{}` (for `findOne`).

Check for data before rendering:

```json
{
  "innerHTML": "{{data.title || 'Not found'}}"
}
```

---

## See Also

- [attributes.md](./attributes.md) - Template expressions
- [../databases.md](../databases.md) - Database configuration
