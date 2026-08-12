# Page Attributes & Expressions

Dynamic values in JSON pages using `{{variable}}` syntax.

## Basic Interpolation

```json
{ "innerHTML": "Welcome, {{user.name}}" }
{ "attributes": { "src": "{{data.imageUrl}}" } }
```

---

## Variable Sources

### params

URL path parameters from dynamic routes.

```
Route: /products/[slug]
URL: /products/widget-pro

{{params.slug}} → "widget-pro"
```

```json
{
  "fetch_data": {
    "query": { "slug": "{{params.slug}}" }
  }
}
```

### searchParams

Query string parameters.

```
URL: /search?q=hello&page=2

{{searchParams.q}} → "hello"
{{searchParams.page}} → "2"
```

### user

Current authenticated user (null if not logged in).

| Property | Description |
|----------|-------------|
| `{{user.id}}` | User ID |
| `{{user.name}}` | Display name |
| `{{user.email}}` | Email address |
| `{{user.image}}` | Avatar URL |
| `{{user.role}}` | Primary role |
| `{{user.roles}}` | All roles (array) |

```json
{ "innerHTML": "Hello, {{user.name}}" }
{ "attributes": { "src": "{{user.image}}" } }
```

### data

Single `fetch_data` result.

```json
{
  "fetch_data": {
    "source": "mongodb",
    "database": "posts",
    "query": { "slug": "{{params.slug}}" }
  },
  "components": [
    { "innerHTML": "{{data.title}}" }
  ]
}
```

### Named Sources

Multiple `fetch_data` sources with `id`.

```json
{
  "fetch_data": [
    { "id": "posts", "database": "posts" },
    { "id": "author", "database": "users", "query": { "_id": "{{posts.authorId}}" } }
  ],
  "components": [
    { "innerHTML": "{{posts.title}} by {{author.name}}" }
  ]
}
```

---

## Path Syntax

### Dot Notation

```
{{user.name}}         → user.name
{{data.author.name}}  → nested property
{{posts.0.title}}     → first item in array
```

### Bracket Notation

```
{{posts[0].title}}    → array index
{{data[fieldName]}}   → dynamic key
```

### Wildcard (Arrays)

Collect a property from all items:

```
{{posts.*.title}}     → ["Title 1", "Title 2", "Title 3"]
```

---

## Fallback Values

Use `||` for fallbacks when value might be missing:

```json
{ "innerHTML": "{{data.excerpt || data.description || 'No description'}}" }
```

First non-empty value wins.

---

## Environment Variables

Use `[[env.VAR]]` syntax (double brackets):

```json
{
  "attributes": {
    "data-api-key": "[[env.NEXT_PUBLIC_API_KEY]]"
  }
}
```

Only `NEXT_PUBLIC_*` variables are available client-side.

---

## Where Expressions Work

| Location | Example |
|----------|---------|
| `innerHTML` | `"innerHTML": "Hello {{user.name}}"` |
| `attributes` | `"src": "{{data.image}}"` |
| `fetch_data.query` | `"query": { "userId": "{{user.id}}" }` |
| `meta` | `"title": "{{data.title}} - Blog"` |

---

## Common Patterns

### Conditional Display

Show different content based on auth state:

```json
{
  "component": "div",
  "innerHTML": "{{user.name || 'Guest'}}"
}
```

### Dynamic Links

```json
{
  "component": "a",
  "attributes": {
    "href": "/posts/{{data.slug}}"
  },
  "innerHTML": "{{data.title}}"
}
```

### Dynamic Images

```json
{
  "component": "img",
  "attributes": {
    "src": "{{data.image || '/placeholder.jpg'}}",
    "alt": "{{data.title}}"
  }
}
```

### User-Specific Queries

```json
{
  "fetch_data": {
    "database": "orders",
    "query": {
      "userId": "{{user.id}}",
      "status": "{{searchParams.status || 'all'}}"
    }
  }
}
```

---

## Array Handling

When the resolved value is an array:
- In text context: Returns first item
- In SEO extraction: Processes all items

```json
// data.tags = ["react", "nextjs", "json"]

{ "innerHTML": "{{data.tags}}" }
// Renders: "react" (first item)

// For all tags, iterate with a component
```

### Wildcard for Array Properties

```json
// posts = [{ title: "A" }, { title: "B" }]

{ "innerHTML": "{{posts.*.title}}" }
// Useful for SEO meta generation
```

---

## Type Coercion

All values are converted to strings when rendered:
- `null`/`undefined` → empty string `""`
- Numbers → `"123"`
- Booleans → `"true"` or `"false"`
- Objects → `"[object Object]"` (avoid this)
- Arrays → first item or joined

---

## Security

Values are **not** automatically HTML-escaped in `innerHTML`. For user-generated content, use components that sanitize:

```json
// Safe - component handles escaping
{
  "component": "@framework/website/MarkdownRenderer",
  "attributes": { "content": "{{data.content}}" }
}

// Potentially unsafe - raw HTML injection
{
  "component": "div",
  "innerHTML": "{{data.userContent}}"
}
```

---

## Debugging

Variables that don't resolve render as empty strings. Check:

1. Is `fetch_data` configured?
2. Is the user authenticated (for `{{user.*}}`)?
3. Is the path correct (case-sensitive)?
4. Did the query return data?

Enable dev mode (`?dev=true`) for debugging info.

---

## See Also

- [data.md](./data.md) - Data fetching configuration
- [index.md](./index.md) - Page structure overview
