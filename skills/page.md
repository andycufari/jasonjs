---
skill: page
when: "Creating JSON page routes"
requires: []
---

# Page Building

> Build pages with JSON that define routes, data fetching, and component structure.

## Quick Start

```json
{
  "meta": {
    "title": "My Page | App Name",
    "description": "Page description for SEO"
  },
  "components": [
    {
      "component": "@framework/website/Hero",
      "attributes": {
        "headline": "Welcome to My App",
        "ctaText": "Get Started",
        "ctaUrl": "/signup"
      }
    },
    {
      "component": "section",
      "attributes": { "className": "py-16" },
      "components": [
        {
          "component": "div",
          "attributes": { "className": "container mx-auto" },
          "components": [
            {
              "component": "h2",
              "innerHTML": "Features"
            },
            {
              "component": "p",
              "innerHTML": "Description text here"
            }
          ]
        }
      ]
    }
  ]
}
```

## Page Structure

```json
{
  "meta": {},           // SEO: title, description, image
  "auth": false,        // Require login? (default: false)
  "roles": [],          // Required roles if auth: true
  "layout": "main",     // Layout name from settings/layout.json
  "fetch_data": {},     // Server-side data fetching
  "components": []      // The actual content
}
```

## File Naming = Routes

```
pages/index.json         → myapp.com/
pages/about.json         → myapp.com/about
pages/pricing.json       → myapp.com/pricing
pages/blog/:slug.json    → myapp.com/blog/my-post
pages/app/dashboard.json → myapp.com/app/dashboard
```

**Dynamic parameters use colon:** `:param`

> For custom URL mapping (e.g., rewriting paths, exposing functions as clean URLs), see `skill:settings/routes`.

## Components

### HTML Elements

```json
{
  "component": "div",
  "attributes": { "className": "container mx-auto p-4" },
  "components": [
    { "component": "h1", "innerHTML": "Title" },
    { "component": "p", "innerHTML": "Content here" }
  ]
}
```

### Framework Components

```json
{ "component": "@framework/website/Hero" }
{ "component": "@framework/website/Footer" }
{ "component": "@framework/JasonTable", "attributes": { "database": "posts" } }
{ "component": "@framework/FormBuilder", "attributes": { "database": "contacts" } }
```

### Custom Components

```json
{
  "components": [
    { "component": "./Header" },
    { "component": "./ProductCard", "attributes": { "featured": true } }
  ]
}
```

## Text Content

Use `innerHTML` for text. **Never put strings in components array.**

```json
// Correct
{ "component": "p", "innerHTML": "Hello world" }

// WRONG - breaks rendering
{ "component": "p", "components": ["Hello world"] }
```

## Authentication

```json
// Public page
{ "auth": false }

// Requires login
{ "auth": true }

// Requires specific role(s)
{
  "auth": true,
  "roles": ["admin"]
}
```

## Data Fetching

### Single Source

Template key = the `database` name. Access as `{{posts}}`, `{{posts[0].title}}`, etc:

```json
{
  "fetch_data": {
    "database": "posts",
    "query": { "published": true },
    "sort": { "createdAt": -1 },
    "limit": 10
  },
  "components": [
    { "innerHTML": "First post: {{posts[0].title}}" },
    { "component": "./PostList", "attributes": { "posts": "{{posts}}" } }
  ]
}
```

### Multiple Sources

Use `id` to differentiate (required when same database used twice). Key = `id` if set, otherwise `database` name:

```json
{
  "fetch_data": [
    {
      "id": "featured",
      "database": "posts",
      "query": { "featured": true },
      "limit": 5
    },
    {
      "database": "categories"
    }
  ],
  "components": [
    { "innerHTML": "Posts: {{featured.length}}" },
    { "innerHTML": "Categories: {{categories.length}}" }
  ]
}
```

### Single Record (Detail Page)

```json
{
  "fetch_data": {
    "database": "posts",
    "query": { "slug": "{{params.slug}}" },
    "findOne": true
  },
  "components": [
    { "innerHTML": "{{posts.title}}" }
  ]
}
```

Without `findOne: true`, data is array → need `{{posts[0].title}}`.

### Sort Syntax

```json
{
  "sort": { "createdAt": -1 }
}
```

| Value | Direction |
|-------|-----------|
| `1` | Ascending (A-Z, oldest first) |
| `-1` | Descending (Z-A, newest first) |

### Fetch Options

| Option | Type | Description |
|--------|------|-------------|
| `database` | string | Collection name |
| `query` | object | Filter conditions |
| `sort` | object | `{ field: -1 }` for desc, `{ field: 1 }` for asc |
| `limit` | number | Max results |
| `skip` | number | Offset for pagination |
| `findOne` | boolean | Return single object (not array) |
| `search` | string | Full-text search query |
| `join` | boolean | Enable/disable auto-joins (default: true) |

## Query Operators

```json
{
  "query": {
    "status": "active",
    "price": { "$gt": 100 },
    "tags": { "$in": ["featured", "sale"] }
  }
}
```

| Operator | Description |
|----------|-------------|
| `$gt` / `$gte` | Greater than (or equal) |
| `$lt` / `$lte` | Less than (or equal) |
| `$in` | Value in array |
| `$ne` | Not equal |
| `$contains` | String contains (case-insensitive) |

## Interpolation

### Available Variables

| Variable | Source |
|----------|--------|
| `{{database_name.field}}` | fetch_data result (key = `database` name or `id`) |
| `{{user.name}}` | Authenticated user |
| `{{user.id}}` | User ID |
| `{{params.slug}}` | URL parameter `:slug` |
| `{{searchParams.q}}` | Query string `?q=value` |

### In Meta Tags

```json
{
  "fetch_data": {
    "database": "posts",
    "query": { "slug": "{{params.slug}}" },
    "findOne": true
  },
  "meta": {
    "title": "{{posts.title}} | My Blog",
    "description": "{{posts.excerpt}}"
  }
}
```

## Conditional Rendering

```json
{
  "component": "AdminPanel",
  "showIf": "{{user.role === 'admin'}}"
}
```

## Meta Tags (SEO)

### Basic

```json
{
  "meta": {
    "title": "Page Title",
    "description": "Under 160 chars",
    "image": "https://example.com/og.jpg",
    "keywords": ["keyword1", "keyword2"],
    "canonical": "https://mysite.com/page",
    "robots": "index, follow",
    "lang": "en"
  }
}
```

| Field | Notes |
|-------|-------|
| `title` | Used as `<title>` and falls through to `og:title`/`twitter:title` |
| `description` | Used for `<meta name="description">` and OG/Twitter description |
| `image` | Shorthand for `ogImage` — used as OG and Twitter image |
| `keywords` | Array or comma-separated string |
| `canonical` | Optional. Defaults to the actual page URL. |
| `robots` | Default `"index,follow"`. |
| `lang` | Maps to `og:locale`. Defaults to page language or `"en"`. |

### Open Graph & Twitter Card

OG/Twitter fall back from the basic fields above; only set these when you need to override per surface. The renderer is in `core/render/metadata.js`.

```json
{
  "meta": {
    "ogTitle": "Custom OG title",
    "ogDescription": "Different description for social shares",
    "ogImage": "https://example.com/og-1200x630.jpg",
    "ogImageWidth": 1200,
    "ogImageHeight": 630,
    "ogType": "article",
    "ogSiteName": "My Site",
    "twitter": {
      "card": "summary_large_image",
      "site": "@mysite",
      "creator": "@author",
      "image": "https://example.com/twitter.jpg"
    }
  }
}
```

| Field | Default | Notes |
|-------|---------|-------|
| `ogTitle` | `meta.title` | |
| `ogDescription` | `meta.description` | |
| `ogImage` / `image` | — | Recommended **1200x630**. |
| `ogImageWidth` / `ogImageHeight` | `1200` / `630` | |
| `ogType` | `"website"` | Use `"article"` for blog posts. |
| `ogUrl` | actual page URL | Don't hardcode; framework resolves it. |
| `ogSiteName` | — | |
| `twitter.card` | `"summary_large_image"` if image present, else `"summary"` | |
| `twitter.site` / `twitter.creator` | — | `@handle` form. |
| `twitter.image` | falls through to `ogImage` | |

Advanced — escape hatches that bypass field-by-field config:

| Form | Use when |
|------|----------|
| `meta.ogCustom: { key: value }` | Need a non-standard `og:foo` tag — emits `og:key`. |
| `meta.ogopengraph: [{ property, content }]` | Pasting a chunk of OG meta from elsewhere. Each item becomes one `<meta property="og:..." content="...">`. |

### Structured Data (`seo[]`)

For schema.org JSON-LD (FAQPage, Product, Article, BreadcrumbList, etc.), use `seo` at the page root — it composes with `meta` (don't duplicate fields).

```json
{
  "seo": [
    { "type": "WebSite", "name": "My Site", "url": "https://mysite.com" },
    {
      "type": "FAQPage",
      "questions": [
        { "question": "How much does it cost?", "answer": "Free plan available." },
        { "question": "Can I export?", "answer": "Yes, full code ownership." }
      ]
    }
  ]
}
```

Supported types include `WebSite`, `Organization`, `Article`, `FAQPage`, `HowTo`, `BreadcrumbList`, `Product`, `Event`, `LocalBusiness` / `Restaurant` / `Hotel`, `JobPosting`, `Course`, `Recipe`, `VideoObject`, `SoftwareApplication`, `Review`, `AggregateRating`. Single-object form (`seo: { type: "..." }`) is also accepted.

`seo[]` items support `{{interpolation}}` from `fetch_data`, plus iterative expansion via `iterate` (one entry per row in a fetched array). Full reference + per-type field tables in `docs/seo.md`.

> **Watch the FAQ shape**: the framework's FAQ builder reads `questions: [{ question, answer }]` (or aliases `faqs` / `items`) and constructs `mainEntity` itself. Don't pass `mainEntity: [...]` directly — it'll be ignored.

## Theme & Fonts

### Site-Wide (Recommended)

For global styling, use separate settings files:

```
settings/
├── theme.json    # Colors, typography, spacing
└── fonts.json    # Font definitions
```

**`settings/theme.json`:**
```json
{
  "defaultColorScheme": "light",
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#6366f1"
  },
  "typography": {
    "fontFamily": "'Inter', system-ui, sans-serif"
  }
}
```

**`settings/fonts.json`:**
```json
[
  {
    "name": "Inter",
    "src": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
  }
]
```

### Page-Level Overrides

Override theme/fonts for specific pages:

```json
{
  "fonts": [
    { "name": "Playfair Display", "src": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" }
  ],
  "theme": {
    "colors": { "primary": "#ec4899" }
  },
  "components": [...]
}
```

### Using Theme in Components

```jsx
// CSS variables (recommended)
<div style={{ color: 'var(--color-primary)' }}>

// Utility classes
<div className="bg-primary text-white">
<div className="font-inter rounded-theme shadow-theme">
```

**Note:** To use shade classes like `bg-primary-600`, provide a palette object in your theme (not just a hex string). See `skill:settings/theme` for details.

## Common Page Patterns

### Landing Page

```json
{
  "auth": false,
  "layout": "minimal",
  "meta": { "title": "Welcome | MyApp" },
  "components": [
    { "component": "@framework/website/Hero", "attributes": { "headline": "Build Faster" } },
    { "component": "@framework/website/FeatureGrid" },
    { "component": "@framework/website/TestimonialSection" },
    { "component": "@framework/website/Footer" }
  ]
}
```

### Blog Post (Dynamic)

File: `pages/blog/:slug.json`

```json
{
  "auth": false,
  "fetch_data": {
    "database": "posts",
    "query": { "slug": "{{params.slug}}" },
    "findOne": true
  },
  "meta": {
    "title": "{{posts.title}}",
    "description": "{{posts.excerpt}}"
  },
  "components": [
    { "component": "./BlogPost" }
  ]
}
```

### Protected Dashboard

```json
{
  "auth": true,
  "layout": "dashboard",
  "fetch_data": {
    "database": "stats",
    "query": { "userId": "{{user.id}}" },
    "findOne": true
  },
  "components": [
    { "component": "./DashboardStats" }
  ]
}
```

### Admin Table

```json
{
  "auth": true,
  "roles": ["admin"],
  "components": [
    {
      "component": "@framework/JasonTable",
      "attributes": {
        "database": "users",
        "editable": true,
        "pageSize": 25
      }
    }
  ]
}
```

## Component Resolution

```
@framework/Name     → Framework component (Hero, Footer, etc.)
@framework/cat/Name → Framework component in category
./Name              → Your custom component
Name                → HTML element (div, section, h1, etc.)
```

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| `[slug]` for dynamic routes | `:slug` for dynamic routes |
| `orderBy: "field"` | `sort: { field: -1 }` |
| Use made-up keys like `{{data}}` | Key = `database` name or `id`: `{{posts.title}}` |
| Put logic in pages | Logic goes in components |
| `{ "components": ["text"] }` | `{ "innerHTML": "text" }` |
| Forget `findOne: true` for detail | Single record needs `findOne` |
| Skip meta tags | Always set title and description |
| Put fonts in `settings/theme.json` | Use separate `settings/fonts.json` |
| `bg-primary-600` with hex color | Provide palette object for shade classes |
| `seo: { type: "FAQPage", mainEntity: [...] }` | `seo: { type: "FAQPage", questions: [{ question, answer }] }` |
| Hardcode `meta.ogUrl` | Omit it — framework resolves from request URL |

## Related

- `skill:component` - Building components
- `skill:database` - Query syntax for fetch_data
- `skill:website` - Landing page components
- `skill:settings/theme` - Site-wide theme configuration
- `skill:settings/fonts` - Site-wide font configuration
- `skill:settings/routes` - Custom URL mapping (routes.json)
- `skill:theming` - Complete theming guide
- `docs/seo.md` - Full structured-data reference (every `seo[]` type with examples)
