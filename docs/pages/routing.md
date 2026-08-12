# Routing

URL routing, redirects, and custom route patterns.

## Default Routing

Pages are routed by file path:

```
pages/index.json       → /
pages/about.json       → /about
pages/blog/index.json  → /blog
pages/blog/[slug].json → /blog/:slug
```

---

## Dynamic Routes

Use brackets for URL parameters:

```
pages/products/[id].json     → /products/123
pages/blog/[...slug].json    → /blog/a/b/c (catch-all)
```

Access parameters in pages:

```json
{
  "fetch_data": {
    "query": { "id": "{{params.id}}" }
  }
}
```

---

## Routes Configuration

Create `settings/routes.json` for custom routing:

```json
{
  "redirects": [],
  "rewrites": [],
  "customRoutes": {},
  "trailingSlash": false,
  "caseSensitive": false
}
```

---

## Redirects

Permanent or temporary URL redirects:

```json
{
  "redirects": [
    {
      "from": "/old-path",
      "to": "/new-path",
      "permanent": true
    },
    {
      "from": "/blog/:slug",
      "to": "/articles/:slug",
      "permanent": false
    }
  ]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | string | - | Source path pattern |
| `to` | string | - | Destination path |
| `permanent` | boolean | false | 301 (true) or 302 (false) |

### Catch-All Redirect

```json
{
  "from": "/old-blog/:path*",
  "to": "/blog/:path*",
  "permanent": true
}
```

---

## Rewrites

Internal path mapping (URL doesn't change):

```json
{
  "rewrites": [
    {
      "from": "/api/v2/:path*",
      "to": "/api/:path*"
    }
  ]
}
```

---

## Custom Routes

Override page resolution:

```json
{
  "customRoutes": {
    "/shop": {
      "page": "page/shop_main"
    },
    "/products/:category": {
      "page": "page/product_category",
      "params": ["category"]
    },
    "/dashboard": {
      "page": "page/dashboard",
      "layout": "page/_layout_dashboard"
    }
  }
}
```

---

## Route Patterns

| Pattern | Description | Example Match |
|---------|-------------|---------------|
| `:param` | Single segment | `/blog/:slug` → `/blog/hello` |
| `:param*` | Zero or more | `/docs/:path*` → `/docs/a/b/c` |
| `:param+` | One or more | `/api/:path+` → `/api/users/123` |
| `:param?` | Optional | `/profile/:id?` → `/profile` or `/profile/123` |

---

## Processing Order

1. Exact matches
2. Custom routes
3. Redirects
4. Rewrites
5. Default file-based routing

---

## Global Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `trailingSlash` | boolean | false | Enforce trailing slashes |
| `caseSensitive` | boolean | false | Case-sensitive URLs |

---

## Common Patterns

### Blog Migration

```json
{
  "redirects": [
    {
      "from": "/blog/:year/:month/:slug",
      "to": "/articles/:slug",
      "permanent": true
    }
  ]
}
```

### API Versioning

```json
{
  "rewrites": [
    {
      "from": "/api/v1/:path*",
      "to": "/api/:path*"
    }
  ]
}
```

### Vanity URLs

```json
{
  "redirects": [
    { "from": "/home", "to": "/", "permanent": true },
    { "from": "/contact-us", "to": "/contact", "permanent": true }
  ]
}
```

---

## See Also

- [index.md](./index.md) - Page structure
- [../settings/routes.md](../settings/routes.md) - Full routes settings
