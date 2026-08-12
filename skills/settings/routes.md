---
skill: settings/routes
when: "Configuring custom routes, mapping URLs to pages or functions"
requires: []
---

# Routes Settings

> Map URL patterns to pages or functions.

## Quick Start

Create `settings/routes.json`:

```json
{
  "blog/:slug": { "page": "blog/detail" },
  "llm": { "function": "llm" }
}
```

## Format

Flat object — each key is a URL pattern, each value has either `"page"` or `"function"`:

```json
{
  "pattern": { "page": "page-name" },
  "pattern": { "function": "function-name" }
}
```

## Page Routes

Map URL patterns to page files:

| File | URL |
|------|-----|
| `pages/index.json` | `/` |
| `pages/about.json` | `/about` |
| `pages/blog/:slug.json` | `/blog/anything` |

Override with routes.json:

```json
{
  "proyectos/:slug": { "page": "proyectos/vista" },
  "shop/:category": { "page": "shop_category" },
  "shop/:category/:slug": { "page": "shop_product" }
}
```

Access params in page:

```json
{
  "fetch_data": {
    "database": "products",
    "query": { "slug": "{{params.slug}}" },
    "single": true
  }
}
```

## Function Routes

Expose server functions as clean URLs without `/api/` prefix:

```json
{
  "llm": { "function": "llm" },
  "llm/:model": { "function": "llm" },
  "search": { "function": "search" },
  "webhook/stripe": { "function": "webhooks/stripe" }
}
```

How it works:
- `GET /llm` -> executes `functions/llm.js`, returns JSON
- `POST /llm/gpt4` -> executes `functions/llm.js` with `model=gpt4` in params
- All HTTP methods work (GET, POST, PUT, DELETE)
- Route params forwarded as query parameters
- Same-origin (no api.json needed)
- Direct `/api/llm` access still works

## Pattern Matching

| Pattern | Matches |
|---------|---------|
| `blog` | Exact `/blog` |
| `blog/:slug` | `/blog/anything` |
| `api/v1/*` | `/api/v1/a/b/c` |

## Complete Example

```json
{
  "/": { "page": "index" },
  "dashboard": { "page": "dashboard" },
  "llm": { "function": "llm" },
  "llm/:model": { "function": "llm" },
  "proyectos/:slug": { "page": "proyectos/vista" },
  "webhook/stripe": { "function": "webhooks/stripe" }
}
```

## Gotchas

| Don't | Do |
|-------|-----|
| Use `[slug]` for dynamic | Use `:slug` |
| Use `redirects`/`rewrites` arrays | Use flat `{ pattern: { page/function } }` |
| Expect leading `/` to matter | Both `"blog"` and `"/blog"` work |

## Related

- `skill:page` - Page structure
- `skill:database` - Dynamic page data
- `skill:function` - Server functions
