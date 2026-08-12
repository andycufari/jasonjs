# Contributing to JasonJS

Thanks for helping build the framework. This guide covers setup, testing, and the conventions that keep the repo healthy.

## Development setup

```bash
git clone https://github.com/andycufari/jasonjs
cd jasonjs
npm install
npm run dev        # http://localhost:3000 — serves sites/example.com
```

Node.js ≥ 20 required. No database or env vars needed for core development; copy `.env.example` to `.env` when you work on a feature that needs one (Mongo, S3, Stripe, ...).

## Repo orientation

```
core/            Framework internals (rendering, sites, db, auth, services)
components/      Framework component library (@framework/*, @ui/*)
addons/          Optional feature kits (comments, notion-blog, tally, ...)
app/             Next.js App Router — page renderer + API routes
sites/           Site folders; example.com is the demo/testbed
docs/            Human documentation
skills/          Agent documentation (compact, machine-oriented)
tests/smoke/     Route-level smoke suite
```

Key seams, if you touch internals:

- `core/sites/files.js` — the only module that knows how site code is stored
- `core/sites/resolve.js` — the only host→site resolution point
- `core/render/` — JSON → React
- `core/functions/run.js` — site function execution
- `core/db/` — the `app.db` implementation and adapters

## Testing

Every PR must keep these green:

```bash
npm run build      # production build
npm run smoke      # route-level smoke suite (spawns its own dev server)
```

The smoke suite (`tests/smoke/`) covers page rendering, dynamic routes, site components, functions, the file-backed `app.db` store, and asset serving. If you add a user-visible behavior, extend it — smoke tests are cheap and they gate refactors.

## Conventions

- **Update `CHANGELOG.md`** in the same PR for any behavior-visible change, under `[Unreleased]` in the right Keep-a-Changelog section. Pure refactors/formatting skip it.
- **Docs come in pairs**: `docs/` is the human reference (what/why, examples); `skills/` is the agent playbook (compact workflows). If you change behavior that either describes, update both.
- **Site code is trusted** in this runtime — site components and functions are native modules. Don't add sandboxing layers; do keep the seams (above) clean.
- Match the style of the file you're editing; no drive-by reformatting.

## Pull requests

1. Fork, branch from `main`.
2. Keep PRs focused — one coherent change.
3. Fill in the PR template (what/why, how it was tested).
4. CI runs build + smoke, plus a canary build against the latest Next.js release. The canary job is informational — a red canary doesn't block your PR.

## Bugs and ideas

Open an issue with the template. For security problems, **don't open an issue** — see [SECURITY.md](SECURITY.md).
