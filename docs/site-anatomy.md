# Site Anatomy

A JasonJS site is a folder under `sites/`, named after the domain that serves it. One running instance hosts any number of sites; nothing is shared between them except the runtime.

```
sites/myapp.com/
├── pages/               # JSON pages — the routes
│   ├── index.json       #   /
│   ├── about.json       #   /about
│   ├── docs/[slug].json #   /docs/anything  (dynamic segment)
│   └── ...
├── components/          # Site React components (.jsx)
│   └── Header.jsx       #   mounted as "./Header" from pages
├── functions/           # Backend ES modules
│   ├── hello.js         #   /api/hello
│   └── webhook/pay.js   #   /api/webhook/pay
├── settings/            # Site configuration (all optional)
│   ├── theme.json       #   colors, typography, dark mode
│   ├── auth.json        #   auth providers, signup fields
│   ├── billing.json     #   Stripe / MercadoPago plans
│   ├── database.json    #   database declarations (schemas, permissions)
│   ├── routes.json      #   redirects and rewrites
│   ├── api.json         #   public API / CORS config for functions
│   ├── meta.json        #   site-wide default meta tags
│   ├── layout.json      #   wrap-every-page layout with slots
│   ├── fonts.json       #   custom fonts
│   ├── mobile.json      #   native container config
│   └── .env.json        #   per-site secrets → [[env.VAR]]
├── css/
│   └── global.css       # Site-wide CSS, injected after the theme
├── assets/              # Static files → /assets/<path>
│   └── logo.svg
└── data/                # app.db file store (runtime data, gitignored)
    └── todos.json
```

Everything is optional except `pages/`.

---

## How a request finds a site

1. The Host header (or `x-forwarded-host` behind a proxy) is matched against site folders: a request for `myapp.com` serves `sites/myapp.com/`.
2. `localhost`, `127.0.0.1`, and dev-tunnel hosts fall back to **`DEFAULT_DOMAIN`** from `.env` — that's how you pick which site local dev serves.
3. Unmatched hosts also fall back to `DEFAULT_DOMAIN`.

So multi-site deployment is: point DNS for each domain at the same instance, one folder per domain. Nothing else to configure.

`SITES_PATH` (default `./sites`) relocates the whole tree if you want site folders outside the repo.

### Trying other sites locally

Local dev serves the site named by `DEFAULT_DOMAIN` (or `defaultDomain` in `jason.config.js`). To hit any other site folder without touching DNS, send its Host header:

```bash
curl -H "Host: shop.example.com" http://localhost:3000/
```

For the browser, map the domain to loopback in `/etc/hosts`:

```
127.0.0.1 shop.example.com
```

…then open `http://shop.example.com:3000`. New site folders are picked up live in dev — no restart needed.

---

## pages/

Each `.json` file is a route; the file path is the URL. `index.json` serves `/`.

```json
{
  "meta": { "title": "About" },
  "auth": false,
  "fetch_data": { "database": "posts", "limit": 10 },
  "components": [
    { "component": "@framework/website/Navbar", "attributes": { "logoText": "MyApp" } },
    { "component": "h1", "innerHTML": "About us" },
    { "component": "./Header" }
  ]
}
```

- `[slug].json` folders/files create dynamic segments; the value is available as `{{params.slug}}`.
- Component references resolve in this order: `@framework/<name>` (framework library), `@ui/<name>` and `@/components/ui/<name>` (UI primitives), `./<name>` (this site's `components/`), plain strings (`"div"`, `"h1"`) as HTML tags.
- Text content goes in `innerHTML`, never as a string inside `components`.

Full reference: [pages/index.md](./pages/index.md) · routing details: [pages/routing.md](./pages/routing.md).

## components/

Plain React modules, compiled by Next.js together with the app — HMR and source maps in dev, real imports (npm packages, framework components, sibling site components).

```jsx
// sites/myapp.com/components/BuyButton.jsx
'use client';
import React from 'react';
import app from '@/core/app';

export default function BuyButton({ productId }) {
  const buy = async () => {
    await app.db.use('orders').add({ productId });
    app.ui.toast('Ordered!');
    app.events.emit('cart:updated');
  };
  return <button onClick={buy}>Buy</button>;
}
```

Mount from a page as `{ "component": "./BuyButton", "attributes": { "productId": "42" } }`.

⚠️ **Build-time rule:** components are compiled when the app builds. In dev they hot-reload; on a production instance, adding or editing a component requires a rebuild ([deployment.md](./deployment.md#the-component-rebuild-rule)).

## functions/

Backend ES modules. `functions/<name>.js` is served at `/api/<name>`; subfolders nest the route.

```javascript
export const config = {
  public: true,             // no session required (default: session required)
  methods: ['GET', 'POST'], // allowed HTTP methods
};

export default async function ({ app, params, body, query, headers, session, method }) {
  // app = full server-side app object (app.db, app.auth, app.storage, ...)
  return { ok: true };
}
```

Functions are loaded per request — live-editable even in production, no rebuild needed. Reference: [functions.md](./functions.md).

## settings/

All optional, all JSON. Site-level configuration that pages can override where it makes sense (theme, fonts, meta). Secrets go in `settings/.env.json` and are referenced from other settings files as `[[env.VAR_NAME]]` so config stays committable.

Reference: [settings/index.md](./settings/index.md).

## css/global.css

One site-wide stylesheet, injected after the theme so it can override it. Use it for `@keyframes`, `@font-face`, `::selection` — things JSON attributes can't express. `@import` is stripped on load and there's a 100KB cap. Details: [css.md](./css.md).

## assets/

Static files served at `/assets/<path>` with ETag/304 caching. When S3 storage is configured, uploaded assets (`app.storage`) are served from there instead; local `assets/` folders are the zero-config path.

## data/

Where the file-backed `app.db` store keeps its collections (`data/<collection>.json`). Created on first write, gitignored by default. When `MONGODB_URI` is set this folder isn't used — same `app.db` code, different store.

---

## What's shared between sites

- The runtime, framework components (`@framework/*`, `@ui/*`), and addons — code, not state.
- The instance-level `.env` (global keys like `MONGODB_URI`, S3, SMTP). Per-site keys live in each site's `settings/.env.json`.
- `jason.config.js` at the repo root: instance-wide fallback branding (default title/description, email footer, proxy user-agent).

Each site gets its own data (collections are site-scoped), its own auth configuration, its own theme, and its own settings.
