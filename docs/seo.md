# SEO & GEO

Everything about search optimization in JasonJS: meta tags, Open Graph, structured data (JSON-LD), sitemaps, robots.txt, and llms.txt — for both traditional search engines (Google, Bing) and AI engines (ChatGPT, Perplexity, Claude).

**GEO (Generative Engine Optimization)** means optimizing to be *cited by AI* rather than just ranked. AI engines parse structured data directly, so the same `seo` config serves both worlds.

## Quick Start

**Static page (landing, about):**

```json
{
  "meta": {
    "title": "Product Name - Build 10x Faster",
    "description": "AI-powered platform for building web apps. Start free, no credit card."
  },
  "seo": [
    { "type": "WebPage", "name": "Product Name", "description": "AI-powered platform for building web apps" },
    { "type": "Software", "name": "Product Name", "price": 0, "currency": "USD" }
  ]
}
```

**Dynamic page (blog post from a database):**

```json
{
  "fetch_data": {
    "database": "posts",
    "query": { "slug": "{{params.slug}}" },
    "findOne": true
  },
  "meta": {
    "title": "{{data.title}} - Blog",
    "description": "{{data.excerpt}}",
    "ogImage": "{{data.featuredImage}}"
  },
  "seo": {
    "type": "Article",
    "headline": "{{data.title}}",
    "datePublished": "{{data.publishedAt}}",
    "author": { "@type": "Person", "name": "{{data.author.name}}" }
  }
}
```

Templates resolve server-side before render — search engines and AI crawlers see the final values.

---

## The Meta Pipeline

Meta values come from two places, merged per page:

1. **`settings/meta.json`** — site-wide defaults, applied to every page.
2. **`page.meta`** — per-page values; any key present here overrides the site default.

```json
// settings/meta.json — site defaults
{ "title": "MyApp", "ogImage": "/assets/og-default.jpg" }

// pages/about.json — overrides just the title
{ "meta": { "title": "About Us - MyApp" } }
```

Result: title from the page, OG image and everything else inherited. Most pages can skip `meta` entirely.

**Shorthand:** `meta.image` is accepted as a fallback for `meta.ogImage` — if no explicit OG image is set, `image` is used.

---

## Page Meta Reference

```json
{
  "meta": {
    "title": "Page Title - Brand Name",
    "description": "Compelling description in 150-160 characters",
    "keywords": ["primary", "secondary"],
    "robots": "index,follow",
    "ogImage": "/assets/og-image.jpg",
    "ogType": "article",
    "publishedTime": "{{data.publishedAt}}",
    "modifiedTime": "{{data.updatedAt}}"
  }
}
```

| Field | Purpose |
|-------|---------|
| `title` | Search result + browser tab (50–60 chars) |
| `description` | Search snippet (150–160 chars) |
| `keywords` | Minor SEO impact (optional) |
| `robots` | Crawl directive (`index,follow` / `noindex,nofollow`) |
| `ogImage` (or `image`) | Social share preview image (1200×630px recommended) |
| `ogType` | `website`, `article`, `product` |
| `publishedTime` / `modifiedTime` | Article timestamps for OG |

---

## Site-Wide Defaults: `settings/meta.json`

All page meta fields work here as defaults, plus site-level extras:

```json
{
  "title": "MyApp - Build Faster",
  "description": "The fastest way to build web applications with AI",
  "keywords": ["web apps", "AI", "SaaS"],
  "lang": "en",
  "robots": "index,follow",

  "favIcon": "/favicon.ico",

  "ogTitle": "MyApp - Revolutionary App Builder",
  "ogDescription": "Build production-ready apps in minutes, not months",
  "ogImage": "/assets/og-social.jpg",
  "ogImageWidth": 1200,
  "ogImageHeight": 630,
  "ogUrl": "https://myapp.com",
  "ogSiteName": "MyApp",
  "ogType": "website",

  "twitterCard": "summary_large_image",
  "twitterSite": "@myapp",
  "twitterCreator": "@creator",

  "customMeta": {
    "author": "MyApp Team",
    "theme-color": "#3b82f6",
    "application-name": "MyApp"
  },

  "structured_data": {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "MyApp Inc",
    "url": "https://myapp.com",
    "logo": "https://myapp.com/logo.png",
    "sameAs": ["https://twitter.com/myapp", "https://github.com/myapp"]
  }
}
```

| Field | Purpose |
|-------|---------|
| `favIcon` | `.ico`, `.png`, or `.svg`; defaults to `/assets/default-favicon.ico` |
| `ogTitle` / `ogDescription` | Social-specific overrides of title/description |
| `ogSiteName` | Brand name shown in shares |
| `twitterCard` | `summary` or `summary_large_image` |
| `twitterSite` / `twitterCreator` | Twitter handles |
| `customMeta` | Any key-value pairs, emitted as `<meta>` tags in `<head>` |
| `structured_data` | Raw site-level JSON-LD (e.g. `Organization`, `LocalBusiness`) — emitted as-is |

---

## Structured Data: the `seo` Field

Pages declare structured data (JSON-LD) via `seo` — as an **object** (one schema, or iterative) or an **array** (multiple schemas on one page).

### Array format — explicit multi-schema

Best for landing pages, where client components can't generate structured data:

```json
{
  "seo": [
    { "type": "WebPage", "name": "MyApp - Build Apps 10x Faster", "description": "AI-powered platform" },
    {
      "type": "Software",
      "name": "MyApp",
      "applicationCategory": "DeveloperApplication",
      "price": 0,
      "currency": "USD",
      "rating": 4.9,
      "reviewCount": 1250
    },
    { "type": "Organization", "name": "MyApp Inc", "url": "https://myapp.com" },
    {
      "type": "FAQ",
      "questions": [
        { "question": "Is it free?", "answer": "Yes! Free plan with unlimited projects." },
        { "question": "Can I export code?", "answer": "Absolutely. You own all code." }
      ]
    }
  ]
}
```

### Iterative format — one schema per fetched item

For list pages (blog index, product catalog), `iterate` generates a separate schema entry for every row of a `fetch_data` source. 20 posts → 20 `BlogPosting` entries in the page source:

```json
{
  "fetch_data": {
    "posts": { "database": "blog-posts", "query": { "published": true }, "limit": 20 }
  },
  "meta": { "title": "Blog - Latest Articles" },
  "seo": {
    "iterate": "posts",
    "title": "{{item.title}}",
    "description": "{{item.excerpt || item.description}}",
    "image": "{{item.featuredImage}}",
    "structuredData": {
      "@type": "BlogPosting",
      "headline": "{{item.title}}",
      "description": "{{item.excerpt || item.description}}",
      "datePublished": "{{item.publishedAt}}",
      "author": { "@type": "Person", "name": "{{item.author.name || item.author}}" },
      "publisher": { "@type": "Organization", "name": "MySite" }
    }
  }
}
```

Inside `iterate`, each row is `{{item.*}}`. Use `||` fallback chains for fields that vary by source:

```json
"image": "{{item.featuredImage || item.cover || item.thumbnail}}"
```

### Type aliases

`type` is case-insensitive and accepts shortcuts — both map to full schema.org types:

| Shortcut(s) | Schema.org type |
|---|---|
| `article` | Article |
| `blog`, `blogpost` | BlogPosting |
| `news`, `newsarticle` | NewsArticle |
| `page`, `webpage` | WebPage |
| `product` / `offer` / `service` | Product / Offer / Service |
| `company`, `organization` | Organization |
| `person` | Person |
| `business`, `localbusiness` | LocalBusiness |
| `restaurant` / `hotel` / `place` | Restaurant / Hotel / Place |
| `event` | Event |
| `faq`, `faqpage` | FAQPage |
| `howto` | HowTo |
| `review` / `rating` | Review / AggregateRating |
| `video` / `image` / `audio` | VideoObject / ImageObject / AudioObject |
| `software`, `app` / `webapp` | SoftwareApplication / WebApplication |
| `breadcrumb`, `breadcrumbs` | BreadcrumbList |
| `course` / `job`, `jobposting` / `recipe` | Course / JobPosting / Recipe |

Unknown types pass through as-is with generic property mapping (`title`→`name`, `desc`→`description`, `img`/`src`/`thumbnail`→`image`, `published_at`→`datePublished`), so any schema.org type works.

---

## Schema Examples by Type

One copy-paste example per commonly used type. Mix templates (`{{data.*}}`) and literals freely.

### Article / BlogPosting

```json
{
  "seo": {
    "type": "Article",
    "headline": "{{data.title}}",
    "description": "{{data.excerpt}}",
    "image": "{{data.featuredImage}}",
    "datePublished": "{{data.publishedAt}}",
    "dateModified": "{{data.updatedAt}}",
    "author": { "@type": "Person", "name": "{{data.author.name}}", "url": "{{data.author.website}}" },
    "publisher": {
      "@type": "Organization",
      "name": "MySite",
      "logo": { "@type": "ImageObject", "url": "https://mysite.com/logo.png" }
    }
  }
}
```

### Product

```json
{
  "seo": {
    "type": "Product",
    "name": "{{data.name}}",
    "description": "{{data.description}}",
    "image": "{{data.images}}",
    "brand": { "@type": "Brand", "name": "{{data.brand}}" },
    "offers": {
      "@type": "Offer",
      "price": "{{data.price}}",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "{{data.rating}}",
      "reviewCount": "{{data.reviewCount}}"
    }
  }
}
```

### FAQPage

Pass questions in the simple `{ question, answer }` shape — the framework builds the schema.org-compliant `mainEntity` / `Question` / `acceptedAnswer` wrapping for you:

```json
{
  "seo": {
    "type": "FAQPage",
    "questions": [
      { "question": "How much does it cost?", "answer": "Free plan available. Pro is $29/month." },
      { "question": "Can I export my code?", "answer": "Yes, full code ownership." }
    ]
  }
}
```

`questions` (or aliases `faqs` / `items`) holds the array. Each item supports `question` (or `q` / `title`) and `answer` (or `a` / `content` / `text`). Passing a canonical schema.org `mainEntity` array directly will **not** work — the builder ignores it and writes its own.

### Event

```json
{
  "seo": {
    "type": "Event",
    "name": "Next.js Workshop 2025",
    "description": "Learn advanced Next.js patterns",
    "startDate": "2025-06-15T09:00:00Z",
    "endDate": "2025-06-15T17:00:00Z",
    "location": { "@type": "Place", "name": "Tech Center", "address": "123 Main St, San Francisco, CA" },
    "organizer": { "@type": "Organization", "name": "Tech Events Inc" },
    "offers": { "@type": "Offer", "price": "99", "priceCurrency": "USD", "url": "https://mysite.com/register" }
  }
}
```

### LocalBusiness

```json
{
  "seo": {
    "type": "LocalBusiness",
    "name": "Joe's Coffee",
    "description": "Artisan coffee and fresh pastries",
    "image": "/images/storefront.jpg",
    "telephone": "+1-555-123-4567",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 Main St",
      "addressLocality": "San Francisco",
      "addressRegion": "CA",
      "postalCode": "94102",
      "addressCountry": "US"
    },
    "geo": { "@type": "GeoCoordinates", "latitude": 37.7749, "longitude": -122.4194 },
    "openingHours": "Mo-Fr 07:00-19:00, Sa-Su 08:00-18:00",
    "priceRange": "$$"
  }
}
```

### SoftwareApplication (SaaS)

```json
{
  "seo": {
    "type": "Software",
    "name": "MyApp",
    "description": "AI-powered development platform",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "5000" }
  }
}
```

---

## Sitemap, robots.txt, llms.txt

All three are generated automatically per site — no configuration needed to get started.

### Sitemap (`/sitemap.xml`)

Includes all public pages, dynamically generated routes, and last-modified dates.

**A page is excluded automatically when any of these is true:**

- `"auth": true` — requires authentication
- `"roles": [...]` — requires specific roles (non-empty array)
- `"sitemap": { "hidden": true }` — explicitly hidden

```json
{
  "auth": true,
  "sitemap": { "hidden": true },
  "components": [ ... ]
}
```

> ⚠️ If a protected page shows up in your sitemap, that's a leak — add `auth` or `sitemap.hidden`.

**Dynamic pages** (e.g. `pages/products/[slug].json`) can enumerate their URLs from a database. If no `urlPattern` is given, the framework tries to infer it from the route:

```json
{
  "fetch_data": { "database": "products", "query": {} },
  "sitemap": {
    "urlPattern": "/products/:slug",
    "query": { "params": { ":slug": "Slug" } }
  }
}
```

### robots.txt (`/robots.txt`)

Generated per site, pointing at the sitemap. Set `"robots": "noindex,nofollow"` in `settings/meta.json` for staging environments.

### llms.txt (`/llms.txt`)

An AI-optimized plain-text sitemap: site name and description (from `settings/meta.json`), then public pages and blog posts with their descriptions. AI crawlers use it to understand your site without parsing HTML. Generated from the same page data as the sitemap — same exclusion rules apply.

### Caching

Sitemap and llms.txt are cached for 1 hour; structured data is generated per request (SSR). During development, `?dev=true` skips most caches — use it when your sitemap or meta changes don't appear immediately.

---

## Notion Blog Addon SEO

The Notion Blog addon (`@addons/notion-blog`) ships with SEO built in — no configuration needed for solid results.

**Article pages** (`@addons/notion-blog/components/Article`) automatically emit a complete `Article` JSON-LD schema: headline, description, cover image (1200×630 `ImageObject`), published/modified dates, author + publisher objects, word count (from Notion blocks), reading time, language tagging, and keywords from tags — plus Open Graph and Twitter Card meta.

**List pages** (`@addons/notion-blog/components/List`) emit one `CollectionPage` schema for the index *plus* an individual `BlogPosting` schema for each post — 20 posts on the index page means 20 structured entries visible to crawlers.

### Field mapping

If your Notion database uses different property names, map them:

```json
{
  "component": "@addons/notion-blog/components/Article",
  "attributes": {
    "database": "data",
    "fields": {
      "title": "Post Title",
      "description": "Summary",
      "author": "Written By",
      "date": "Published Date",
      "tags": "Categories",
      "language": "Language"
    }
  }
}
```

List components use the `*Field` naming (`titleField`, `slugField`, `descriptionField`, `authorField`, `imageField`, `dateField`). All fields have fallbacks — e.g. image resolves `cover || Image || imageField`, date resolves `Date || updatedAt || createdAt`.

Full addon reference: [addons/notion-blog.md](./addons/notion-blog.md).

---

## GEO Best Practices

AI engines favor structured data over prose. The rules:

**1. Be specific and factual.** Vague marketing copy gets ignored; concrete facts get cited:

```json
// ❌ { "description": "The best app builder ever" }
// ✅
{ "description": "No-code platform with 200+ components, 15+ database integrations, deploys in under 2 minutes. 50K+ developers." }
```

**2. Include numbers** — user counts, ratings ("4.9★ from 1,250 reviews"), performance ("99.9% uptime, <100ms response").

**3. Define relationships as objects, not strings:**

```json
// ❌ { "author": "Jane Smith" }
// ✅
{ "author": { "@type": "Person", "name": "Jane Smith", "jobTitle": "Senior Developer", "url": "https://janesmith.dev" } }
```

**4. Add FAQ schemas** for common questions — they're prime citation material.

**5. Keep dates fresh** — `dateModified` matters to AI engines.

---

## Testing & Validation

| Tool | Checks |
|------|--------|
| [Google Rich Results Test](https://search.google.com/test/rich-results) | JSON-LD validity, rich-result eligibility |
| [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) | OG tags, share preview |
| [Twitter Card Validator](https://cards-dev.twitter.com/validator) | Card appearance |

Quick command-line checks:

```bash
curl https://yoursite.com | grep "og:image"                       # OG tags
curl https://yoursite.com/blog/post | grep 'application/ld+json'  # JSON-LD present
curl https://yoursite.com/sitemap.xml                             # sitemap valid, no protected routes
curl https://yoursite.com/llms.txt                                # AI sitemap
```

**Test the AI engines directly:** ask ChatGPT/Claude "What can you tell me about yoursite.com?" or search your site name in Perplexity. If they get facts wrong, your structured data needs improvement.

---

## Troubleshooting

### Meta tags not appearing

- Check the file is `settings/meta.json` and the JSON is valid (no trailing commas).
- Restart the dev server after settings changes, or use `?dev=true` to skip caches.

### OG image not showing on social

- Use **absolute URLs** — relative ones break in scrapers.
- The image must be publicly accessible (not behind auth), ideally 1200×630px, < 500KB.
- Re-scrape with the Facebook Debugger after fixing (it caches aggressively).

### Structured data not showing / not valid

- View page source and search for `application/ld+json` — is it there at all?
- If it depends on `fetch_data`, verify the query returns data.
- Validate with the Rich Results Test; check required fields for your schema type.

### Missing images in structured data

- For Notion sources: ensure the page has a cover image or the `Image` property is populated, and the field mapping (`imageField`) matches your property name.

### Wrong dates or no dates

Usually a Notion field-mapping problem:

- Use a Notion **Date property**, not a text field.
- Ensure the property is actually populated on each page.
- Check the field mapping: `"dateField": "Date"` (or `"date": "Date"` on Article) must match your Notion property name exactly.
- Remember the fallback chain `Date || updatedAt || createdAt` — if your Date property is empty, you'll silently get the record's system timestamps instead.

### Protected pages in sitemap

Security issue — fix immediately by adding `"auth": true` and/or `"sitemap": { "hidden": true }` to the page JSON.

---

## See Also

- [pages/data.md](./pages/data.md) — `fetch_data` for dynamic SEO
- [pages/attributes.md](./pages/attributes.md) — template expressions
- [addons/notion-blog.md](./addons/notion-blog.md) — Notion Blog addon
- [skills/seo.md](../skills/seo.md) — the compact agent workflow version of this doc
- [Schema.org](https://schema.org) — all types and properties
