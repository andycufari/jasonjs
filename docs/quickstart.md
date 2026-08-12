# Quickstart

From zero to a running app, with nothing but Node.js ≥ 20.

## Run it

```bash
git clone https://github.com/andycufari/jasonjs
cd jasonjs
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You're looking at the bundled demo site, `sites/example.com/` — localhost serves whatever site `DEFAULT_DOMAIN` points to (`example.com` out of the box; copy `.env.example` to `.env` to change it).

No database, no env vars, no services: `app.db` stores records as JSON files under `sites/<domain>/data/` until you configure MongoDB.

---

## A site is a folder

```
sites/example.com/
├── pages/           # JSON pages — file path = URL route
├── components/      # React components (.jsx), compiled by Next.js
├── functions/       # Backend ES modules — functions/x.js = /api/x
├── settings/        # theme.json, auth.json, routes.json, ...
├── css/global.css   # Optional site-wide CSS
├── assets/          # Static files, served at /assets/*
└── data/            # app.db file store writes here (gitignored)
```

Every folder under `sites/` is an independent site; one running instance serves all of them, resolved by Host header. Full tour: [site-anatomy.md](./site-anatomy.md).

For this quickstart, work directly in `sites/example.com/` — it's yours to edit.

---

## Your first page

Create `sites/example.com/pages/first.json`:

```json
{
  "meta": {
    "title": "My First Page",
    "description": "Built with JasonJS"
  },
  "components": [
    {
      "component": "@framework/website/Navbar",
      "attributes": {
        "logoText": "My App",
        "navigation": [
          { "name": "Home", "href": "/" },
          { "name": "First", "href": "/first" }
        ]
      }
    },
    {
      "component": "@framework/website/Hero",
      "attributes": {
        "headline": "Welcome",
        "subheadline": "This page is a JSON file",
        "ctaText": "Get Started",
        "ctaUrl": "/docs"
      }
    }
  ]
}
```

Visit `/first`. Pages hot-reload — edit the JSON and refresh.

Two rules worth learning immediately:

- Text goes in `innerHTML`, not the `components` array: `{ "component": "p", "innerHTML": "text" }`
- `attributes` are the React props; `className` takes Tailwind classes.

Full page reference: [pages/index.md](./pages/index.md).

---

## Add data

Use `app.db` anywhere — components, functions, or page-level `fetch_data`:

```javascript
// Write
await app.db.use('todos').add({ task: 'Ship it', done: false });

// Read
const open = await app.db.use('todos').find({ done: false });
```

Pages can fetch declaratively and interpolate:

```json
{
  "fetch_data": { "database": "todos", "query": { "done": false } },
  "components": [
    { "component": "h1", "innerHTML": "Next up: {{data.0.task}}" },
    { "component": "@framework/JasonTable", "attributes": { "data": "{{data}}", "columns": ["task", "done"] } }
  ]
}
```

Records land in `sites/example.com/data/todos.json` — open the file and look. Set `MONGODB_URI` later and the same code runs on MongoDB. See [databases.md](./databases.md).

---

## Add a backend function

Create `sites/example.com/functions/hello.js`:

```javascript
export const config = {
  public: true,              // callable without a session
  methods: ['GET', 'POST']
};

export default async function ({ app, params, query, method }) {
  const name = params?.name || query?.name || 'world';

  // Full server-side app object: app.db, app.auth, app.storage, app.email, ...
  await app.db.use('greetings').add({ name, at: new Date().toISOString() });

  return { message: `Hello, ${name}!`, method };
}
```

It's live at `/api/hello?name=Ada` immediately — functions are loaded per request, no restart needed. Call it from the client with:

```javascript
const result = await app.functions.call('hello', { name: 'Ada' });
```

Functions are native ES modules: real stack traces, debugger support, and you can `import` npm packages. The demo site's `functions/guestbook.js` shows a complete CRUD function. Reference: [functions.md](./functions.md).

---

## Add a custom component

Create `sites/example.com/components/TodoList.jsx`:

```jsx
'use client';
import React, { useEffect, useState } from 'react';
import app from '@/core/app';

export default function TodoList() {
  const [todos, setTodos] = useState([]);
  const [task, setTask] = useState('');

  const load = () => app.db.use('todos').find({}).then(setTodos);
  useEffect(() => { load(); }, []);

  const add = async () => {
    await app.db.use('todos').add({ task, done: false });
    setTask('');
    app.ui.toast('Added!');
    load();
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-3">
      <div className="flex gap-2">
        <input className="border rounded px-3 py-2 flex-1" value={task}
               onChange={e => setTask(e.target.value)} placeholder="New task" />
        <button className="px-4 py-2 bg-black text-white rounded" onClick={add}>Add</button>
      </div>
      {todos.map(t => <div key={t._id} className="border-b py-2">{t.task}</div>)}
    </div>
  );
}
```

Mount it in any page with a relative reference:

```json
{ "component": "./TodoList" }
```

Site components are plain React compiled by Next.js — HMR in dev, imports from npm, framework components (`@framework/*`, `@/components/ui/*`), or sibling components. Guide: [components/index.md](./components/index.md).

---

## Add authentication

Auth user storage needs MongoDB — set it up first:

```bash
# .env
MONGODB_URI=mongodb://localhost:27017/jason
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

Then create `sites/example.com/pages/login.json`:

```json
{
  "components": [
    { "component": "@framework/auth/UnifiedAuth", "attributes": { "redirectTo": "/dashboard" } }
  ]
}
```

Protect any page with one line:

```json
{
  "auth": true,
  "components": [ ... ]
}
```

Providers (Google, GitHub, magic links, ...) are configured in `sites/<domain>/settings/auth.json`. The demo's `pages/protected.json` is a working example. Full guide: [auth.md](./auth.md).

---

## Configure the site

Settings are JSON files in `sites/<domain>/settings/`:

| File | Purpose |
|------|---------|
| `theme.json` | Colors, typography, dark mode — two colors become a full design system |
| `auth.json` | Auth providers, signup fields, redirects |
| `billing.json` | Stripe / MercadoPago plans |
| `routes.json` | Redirects and rewrites |
| `meta.json` | Site-wide default meta tags |
| `.env.json` | Per-site secrets, referenced as `[[env.VAR]]` in other settings |

Reference: [settings/index.md](./settings/index.md).

---

## Create your own site

```bash
cp -r sites/example.com sites/myapp.local
```

1. Set `DEFAULT_DOMAIN=myapp.local` in `.env` so localhost serves it, and restart dev.
2. Strip the demo pages you don't want; keep `settings/theme.json` as a starting point.
3. In production, the site is selected by Host header — point DNS for `myapp.com` at your instance and name the folder `sites/myapp.com/`.

---

## Next steps

| What | Doc |
|------|-----|
| Everything inside a site folder | [site-anatomy.md](./site-anatomy.md) |
| JSON page reference | [pages/index.md](./pages/index.md) |
| The `app` object | [app.md](./app.md) |
| Databases and queries | [databases.md](./databases.md) |
| Payments | [billing.md](./billing.md) |
| Ship it | [deployment.md](./deployment.md) |

Building with an AI agent? Point it at the [`skills/`](../skills/) tree — compact, machine-oriented instructions for every part of the framework.
