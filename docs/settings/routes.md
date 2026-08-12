# Custom Routing

**Map URL patterns to pages or functions in `settings/routes.json`.**

## Quick Start

```json
// settings/routes.json
{
  "/": { "page": "index" },
  "blog/:slug": { "page": "blog/detail" },
  "llm": { "function": "llm" },
  "llm/:model": { "function": "llm" }
}
```

> See [pages/routing.md](../pages/routing.md) for default file-based routing

---

## When to Use This

**Default routing** works for most cases:
- `pages/about.json` -> `/about`
- `pages/blog/:slug.json` -> `/blog/anything`

**Custom routing** is for:
- Mapping clean URLs to specific pages (`blog/:slug` -> `blog/detail`)
- Exposing functions as clean URLs without `/api/` prefix
- Complex URL patterns that don't match the file structure

---

## Format

`settings/routes.json` is a flat object where each key is a URL pattern and each value specifies either a **page** or a **function**:

```json
{
  "pattern": { "page": "page-name" },
  "pattern": { "function": "function-name" }
}
```

---

## Page Routes

Map a URL pattern to a specific page file.

```json
{
  "proyectos/:slug": { "page": "proyectos/vista" },
  "aprende/sobre/:slug": { "page": "aprende/sobre/contenido" },
  "shop/:category": { "page": "shop_category" }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `page` | string | Page file name (without `.json` extension) |

Parameters from `:param` segments are extracted and available as `params` in the page.

### Accessing Parameters

**In Page JSON:**
```json
{
  "fetch_data": {
    "products": {
      "query": {
        "category": "{{params.category}}",
        "slug": "{{params.slug}}"
      }
    }
  }
}
```

**In Components:**
```javascript
export default function ProductPage() {
  const { category, slug } = app.context.params;
}
```

---

## Function Routes

Map a clean URL to a server function. The URL executes the function and returns its result as JSON, without needing the `/api/` prefix.

```json
{
  "llm": { "function": "llm" },
  "llm/:model": { "function": "llm" },
  "webhook/stripe": { "function": "webhooks/stripe" }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `function` | string | Function file name (in `functions/` directory) |

### How It Works

1. Request comes in: `GET /llm/gpt4`
2. Middleware matches pattern `llm/:model` -> function `llm`
3. Rewrites internally to `/api/llm?model=gpt4`
4. Function executes through the standard API handler
5. JSON response returned to the client

### Key Details

- **All HTTP methods work** (GET, POST, PUT, DELETE)
- **Route params** are forwarded as query parameters to the function
- **Same-origin** — no `api.json` configuration needed (treated as first-party)
- **Direct `/api/` access still works** — `/api/llm` continues to function normally
- **Auth** — the function itself can check `session` for authentication

### Example Function

```javascript
// functions/llm.js
export default async function handler({ params, session, method }, { app }) {
  const model = params.model || 'default';

  if (method === 'POST') {
    const result = await app.ai.generate({ model, prompt: params.prompt });
    return { result };
  }

  return { models: ['gpt4', 'claude'], selected: model };
}
```

Accessed via:
- `GET /llm` -> lists models
- `GET /llm/gpt4` -> lists models with selected=gpt4
- `POST /llm/gpt4` with body -> generates response

---

## Route Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `blog` | Exact match | `/blog` |
| `blog/:slug` | Single dynamic segment | `/blog/hello-world` |
| `api/v1/*` | Wildcard (remaining path) | `/api/v1/users/123` |

Parameters from `:param` segments are extracted by name. The `*` wildcard captures all remaining segments.

---

## Processing Order

When a request comes in:

1. **Static files** — `/_next`, images, fonts, etc. skip routing
2. **Function rewrites** — Checked in middleware before page rendering
3. **Page routes** — Matched during page resolution
4. **Dynamic page auto-detection** — File-based pattern matching
5. **404** — No match found

Function routes take priority because they're resolved in middleware before the page renderer runs.

---

## Common Patterns

### Clean API Endpoints

Expose functions without the `/api/` prefix:

```json
{
  "llm": { "function": "llm" },
  "llm/:model": { "function": "llm" },
  "search": { "function": "search" }
}
```

### E-commerce

```json
{
  "shop": { "page": "shop_index" },
  "shop/:category": { "page": "shop_category" },
  "shop/:category/:slug": { "page": "shop_product" }
}
```

### Multi-Language

```json
{
  "es/productos/:slug": { "page": "products_detail" },
  "en/products/:slug": { "page": "products_detail" }
}
```

### Mixed Pages and Functions

```json
{
  "/": { "page": "index" },
  "dashboard": { "page": "dashboard" },
  "api-status": { "function": "health-check" },
  "webhook/stripe": { "function": "webhooks/stripe" },
  "proyectos/:slug": { "page": "proyectos/vista" }
}
```

---

## Notes

- Leading slashes in patterns are optional (`"blog/:slug"` and `"/blog/:slug"` both work)
- More specific routes should come before general ones
- Function routes bypass page rendering entirely
- Page routes extract params automatically from `:param` segments
- Default file-based routing still works for any path not in routes.json
