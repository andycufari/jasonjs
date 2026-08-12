---
skill: seo
when: "Adding SEO/GEO metadata to pages — meta titles, descriptions, structured data, Open Graph, sitemap, llms.txt, FAQ schema"
requires: [page]
---

# SEO & GEO

> Make your pages rank well in Google AND get cited by AI search engines (ChatGPT, Perplexity, Claude). The framework wires most of this up automatically — your job is to fill in the page JSON correctly.

For the long-form reference, see `docs/seo.md`. This skill is the working subset.

## The minimum every page needs

```json
{
  "meta": {
    "title": "Page Title — Brand Name",
    "description": "150–160 char description that doubles as the search snippet."
  },
  "seo": {
    "type": "WebPage",
    "name": "Page Title",
    "description": "Detailed description for structured data."
  },
  "components": [...]
}
```

- `meta.title` and `meta.description` produce `<title>` and `<meta name="description">`.
- `seo` (object) emits a single JSON-LD block for that page.
- `seo` can also be an **array** to emit multiple JSON-LD blocks (e.g. `WebPage` + `FAQPage` + `BreadcrumbList`).

## Open Graph & Twitter (social previews)

Add an OG image to `meta` so shares don't render bare. **Open Graph fields are
flat `og*` keys** (not a nested `og` object), while `twitter` *is* an object:

```json
{
  "meta": {
    "title": "...",
    "description": "...",
    "ogTitle": "...",
    "ogDescription": "...",
    "ogImage": "https://yoursite.com/og/landing.png",
    "ogType": "website",
    "ogUrl": "https://yoursite.com/",
    "ogSiteName": "Brand Name",
    "twitter": { "card": "summary_large_image", "image": "https://yoursite.com/og/landing.png" }
  }
}
```

| Field | Falls back to |
|---|---|
| `ogTitle` | `title` |
| `ogDescription` | `description` |
| `ogImage` (or `image`) | — (no image if unset) |
| `ogType` | `"website"` |
| `twitter.card` | `summary_large_image` if an image exists, else `summary` |
| `twitter.image` | `ogImage` |

Image must be at least 1200×630 and reachable by an unauthenticated fetch.

> ⚠️ **Plain strings only — never `{ "es": "..." }`.** A locale-object in a meta
> field renders literally as `[object Object]` in the tag. If you need
> per-language meta, set it per-page, not as a nested locale map.

## Structured data — the schemas that pay off

| Schema | When to use |
|---|---|
| `WebPage` | Default for any page. |
| `Article` / `BlogPosting` | Editorial content with an author + date. |
| `FAQPage` | Pages with Q/A blocks (huge GEO win — AI loves citing FAQs). |
| `Product` | E-commerce or SaaS product pages with price/availability. |
| `BreadcrumbList` | Multi-level pages — Google shows breadcrumbs in results. |
| `Organization` / `Person` | Author/publisher info on Articles. |

Multi-block example:

```json
{
  "seo": [
    { "type": "WebPage", "name": "Pricing", "description": "..." },
    { "type": "FAQPage", "mainEntity": [
      { "type": "Question", "name": "What's included?", "acceptedAnswer": { "type": "Answer", "text": "..." } }
    ]},
    { "type": "BreadcrumbList", "itemListElement": [
      { "type": "ListItem", "position": 1, "name": "Home", "item": "/" },
      { "type": "ListItem", "position": 2, "name": "Pricing", "item": "/pricing" }
    ]}
  ]
}
```

## Sitemap

`/sitemap.xml` is generated automatically from your published pages. Cache TTL is 1h.

Per-page control via `sitemap`:

```json
{
  "sitemap": {
    "include": true,         // default true; set false to exclude (e.g. legal pages, admin)
    "priority": 0.8,          // 0.0–1.0
    "changefreq": "weekly"   // never|yearly|monthly|weekly|daily|hourly|always
  }
}
```

Dynamic pages (`page/cuento/:id`) need a `sitemap.source` to enumerate URLs:

```json
{
  "sitemap": {
    "include": true,
    "source": { "database": "stories", "field": "slug", "path": "/cuento/{slug}" }
  }
}
```

## llms.txt — the AI-search sitemap

`/llms.txt` is auto-generated and lists key URLs + descriptions for AI search engines. It's the GEO equivalent of `sitemap.xml`. No manual config needed for the basics, but you can curate the highlight list in `setting/llms-txt.json`:

```json
{
  "summary": "Brand Name — one-line site description.",
  "highlights": [
    { "title": "Pricing", "url": "/pricing", "description": "Plans and per-credit costs." }
  ]
}
```

## GEO best practices (AI search)

1. **Be factual and specific.** AI cites numbers and names, not adjectives. "Processed 2.3M requests in 2025" beats "scaled massively."
2. **Use FAQ schema.** Direct Q→A pairs are the single highest-ROI structured data for GEO.
3. **Define relationships.** Use `Organization` → `member` → `Person`, `Product` → `offers` → `Offer`. AI follows these links.
4. **Keep dates fresh.** `dateModified` matters more than `datePublished` for freshness ranking.

## Pre-deploy checklist

- [ ] Every page has `meta.title` and `meta.description`.
- [ ] Public pages have an OG image.
- [ ] Pricing/Product pages have `Product` or `Offer` JSON-LD.
- [ ] Blog/article pages have `Article` JSON-LD with author + dates.
- [ ] At least one page has `FAQPage` if you have Q/A content.
- [ ] `sitemap.xml` returns 200 and includes the pages you expect.
- [ ] `llms.txt` returns 200.

## Workarounds & gotchas

- **Blog articles via `@addons/notion-blog/components/Article`** auto-generate Article JSON-LD, OG tags, word count, reading time, and author/publisher blocks. Don't duplicate them in `seo[]`.
- **Sitemap excludes private pages** (auth-required) automatically. Don't add them manually.
- **Cache TTLs** during development hurt — sitemap is 1h, llms.txt is 1h. `?dev=true` skips most caches.
- **Wrong/missing dates in Articles** are usually a Notion field-mapping bug. See the "Wrong dates or no dates" section in `docs/seo.md`.

## See also

- `docs/seo.md` — full reference with copy-paste examples for blog list pages, landing pages, and field mapping.
- Skill `page` — page JSON structure these SEO fields hang off.
- Skill `database` — defining the `database` referenced by `sitemap.source` for dynamic pages.
