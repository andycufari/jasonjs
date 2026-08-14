# JasonJS

**Build web apps from JSON pages, React components, and one universal `app.*` API — on top of Next.js.**

JasonJS (Jason = JSON) is a JSON-driven web framework. Pages are JSON files, components are plain React, backend functions are native ES modules, and everything — database, auth, billing, storage, events — is reachable through a single `app` object that works the same on the client and the server. One instance serves any number of sites from plain folders.

```json
{
  "meta": { "title": "Acme" },
  "components": [
    { "component": "@framework/website/Navbar", "attributes": { "logoText": "Acme" } },
    { "component": "@framework/website/Hero", "attributes": { "headline": "Welcome" } },
    { "component": "@framework/website/Footer" }
  ]
}
```

That's a complete, server-rendered landing page. No wiring, no build config.

## Quickstart

```bash
git clone https://github.com/andycufari/jasonjs
cd jasonjs
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you're looking at `sites/example.com/`, the bundled demo site. No database, no env vars, no services required: `app.db` stores records as JSON files under `sites/<domain>/data/` until you point it at MongoDB.

Now make it yours:

**1. Add a page** — create `sites/example.com/pages/hello.json`:

```json
{
  "meta": { "title": "Hello" },
  "components": [
    { "component": "h1", "attributes": { "className": "text-3xl font-bold p-8" }, "innerHTML": "Hello, JasonJS" }
  ]
}
```

Visit `/hello`. It's live — pages hot-reload.

**2. Add a backend function** — create `sites/example.com/functions/greet.js`:

```javascript
export const config = { public: true, methods: ['GET', 'POST'] };

export default async function ({ params, query }) {
  return { message: `Hello, ${params?.name || query?.name || 'world'}!` };
}
```

Open `/api/greet?name=Ada` in the browser. Functions are real ES modules — real stack traces, real debugger, `import` anything.

> Non-browser clients (curl, Postman, server-to-server) are treated as external and blocked by default. To expose a function externally, declare it in `sites/example.com/settings/api.json` — see [docs/settings/api.md](docs/settings/api.md).

**3. Add a component** — create `sites/example.com/components/Counter.jsx`:

```jsx
'use client';
import React, { useState } from 'react';

export default function Counter({ start = 0 }) {
  const [n, setN] = useState(start);
  return <button className="px-4 py-2 border rounded" onClick={() => setN(n + 1)}>Clicked {n}×</button>;
}
```

Mount it from any page:

```json
{ "component": "./Counter", "attributes": { "start": 10 } }
```

**4. Use the database** — from any component or function:

```javascript
await app.db.use('todos').add({ task: 'Ship it', done: false });
const open = await app.db.use('todos').query({ done: false });
```

Same call client-side (goes through the REST API) and server-side (hits the store directly). Full guide: [docs/quickstart.md](docs/quickstart.md).

## What you get

| Normally you'd set up… | With JasonJS |
|---|---|
| Routing + SSR + hydration | Drop a JSON file in `pages/` |
| Auth (OAuth, sessions, protected routes) | `"auth": true` on a page ([docs](docs/auth.md)) |
| Database + query layer | `app.db.use('todos')` — zero-config file store, MongoDB when you're ready |
| Payments (Stripe / MercadoPago) | `app.billing.subscribe('pro')` ([docs](docs/billing.md)) |
| File uploads (S3) | `app.storage.upload(file)` ([docs](docs/storage.md)) |
| Email, AI, analytics, realtime | `app.email`, `app.ai`, `app.analytics`, `app.events` |
| A component library | `@framework/*` (forms, tables, auth flows, website sections) + `@ui/*` (shadcn-style primitives) |
| SEO (meta, OG, sitemap, llms.txt) | Generated from page JSON ([docs](docs/seo.md)) |

## How it works

**Pages are JSON.** A page declares its meta, auth requirements, data needs, and component tree. The renderer turns it into a server-rendered React tree with declarative data fetching and `{{template}}` interpolation:

```json
{
  "meta": { "title": "Dashboard" },
  "auth": true,
  "fetch_data": { "database": "projects", "query": { "owner_id": "{{user.id}}" } },
  "components": [
    { "component": "h1", "innerHTML": "Welcome, {{user.name}}" },
    { "component": "@framework/JasonTable", "attributes": { "data": "{{data}}", "columns": ["name", "status"] } }
  ]
}
```

**Components are plain React.** Site components live in `sites/<domain>/components/`, get compiled by Next.js at build time (HMR in dev, source maps, TypeScript if you want), and can import npm packages, framework components, or each other. No sandbox, no runtime compiler.

**Functions are native ES modules.** `sites/<domain>/functions/<name>.js` becomes `/api/<name>`. Each function receives a `jcontext` with the request and the full `app` object.

**Components talk through events, not wiring.** `app.events.emit('cart:add', item)` in one component, `app.events.on('cart:add', …)` in another — components interoperate without knowing about each other, which is what makes drop-in components possible.

**One instance, many sites.** Every folder under `sites/` is a site, resolved by Host header; `DEFAULT_DOMAIN` decides what localhost serves. Point two domains at one deployment and `sites/blog.example.com/` and `sites/shop.example.com/` are two independent apps sharing one runtime.

## Built for AI agents

JSON pages are structured data — trivially generated, diffed, and validated by an LLM; no broken JSX to debug. The repo ships a [`skills/`](skills/) tree: compact, machine-oriented instructions for building pages, components, functions, auth, billing, SEO and more. Point your coding agent at it (Claude Code, Cursor, etc.) and it knows the framework:

```
skills/page.md        # how to write JSON pages
skills/component.md   # how to build components
skills/function.md    # how to write backend functions
skills/database.md    # app.db patterns
...29 skills
```

`docs/` is the human reference; `skills/` is the agent playbook. They're maintained together.

## Deployment

It's a Next.js app — deploy it like one (Docker, VPS, any Node host; `Dockerfile` and `docker-compose.yml` included):

```bash
npm run build
npm run start
```

One honest constraint: **site components are compiled at build time**, so adding a component to a production instance requires a rebuild (dev has HMR). Pages, functions, data, and assets are live-editable in production. Details: [docs/deployment.md](docs/deployment.md).

## Documentation

| | |
|---|---|
| [Quickstart](docs/quickstart.md) | Zero to running app |
| [Site anatomy](docs/site-anatomy.md) | What's inside `sites/<domain>/` |
| [Pages](docs/pages/index.md) | JSON page reference |
| [The `app` object](docs/app.md) | The universal API |
| [Components](docs/components/index.md) | Built-in library + custom components |
| [Addons](docs/addons/index.md) | Optional kits: comments, booking, Notion blog, effects, forms |
| [Functions](docs/functions.md) | Backend ES module functions |
| [Databases](docs/databases.md) | `app.db`, file store, MongoDB, Notion |
| [Auth](docs/auth.md) | Login, OAuth, roles, protected pages |
| [Billing](docs/billing.md) | Stripe / MercadoPago subscriptions |
| [SEO](docs/seo.md) | Meta, sitemaps, structured data, llms.txt |
| [Deployment](docs/deployment.md) | Docker, VPS, production notes |

The full tree — realtime, geolocation, email, theming, addons, and more — is indexed at [docs/README.md](docs/README.md).

## Requirements

- Node.js ≥ 20
- Next.js is pinned to a known-good version and bumped when our canary CI passes against the latest release.

## License

[MIT](LICENSE)
