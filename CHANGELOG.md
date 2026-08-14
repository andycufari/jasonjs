# Changelog

All notable changes to JasonJS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **`git clone && npm run dev` now actually serves the demo site with no
  `.env`.** The README promised zero-config, but `resolveSite()` fell back to
  the literal host `localhost` when `DEFAULT_DOMAIN` was unset, and no
  `sites/localhost/` exists — a fresh clone rendered "Site Not Found" until
  you copied `.env.example`. `jason.config.js` now carries
  `defaultDomain: 'example.com'` and `core/sites/resolve.js` exports a
  `defaultDomain()` helper (`DEFAULT_DOMAIN` env → `jason.config.js` →
  null) used by every consumer: the six ad-hoc `process.env.DEFAULT_DOMAIN`
  reads in `apiAccess.js`, `componentRegistry.js`, `page.js`, `files.js` and
  `middleware.js` all route through it, so env and config can't disagree.
- **Docs showed a database method that doesn't exist.** README, quickstart
  and the components guide all called `app.db.use(...).find({...})` — the
  API is `.query({...})` (as `docs/databases.md` and the skills correctly
  say). Every `.find()` occurrence fixed; caught by following the README
  verbatim on a fresh clone.

### Fixed (addon seam)
- **File-source adapter registration now actually reaches route code.** The
  `.cm64/` overlay registers its adapter from `instrumentation.js`, but
  Next.js bundles instrumentation separately from routes — each bundle gets
  its own module instance of `core/sites/files.js`, so the registration was
  stranded in the instrumentation bundle and every route still ran in local
  mode ("Site not found" for database-mode tenants). The adapter slot now
  lives on `globalThis` (`Symbol.for('jasonjs.siteFiles.adapter')`), which
  is per-process and crosses bundle boundaries. First verified database-mode
  render end-to-end (pages, settings, api.json and sandboxed functions
  served from MongoDB) rode on this fix.

### Changed
- **`npm test` now exists and runs everything** (`test:unit` + `smoke`), and
  `test:unit` includes the database-security regression tests
  (`tests/unit/security-fieldFilter.test.js`), not just `deepMerge`. Removed
  two Jest-era test files (`tests/unit/database.test.js`,
  `client-database.test.js`) that could never run — Jest isn't a dependency —
  and a Startup-Studio-framed manual test doc left in `tests/`.
- **`npm run dev` / `npm run start` respect `PORT`** — the scripts hardcoded
  `--port 3000`, so anyone with something already on 3000 (very common) got
  `EADDRINUSE` with no way to override except editing package.json.
- **The external-API 403 tells you how to fix it.** Non-browser calls to
  `/api/<fn>` (curl, Postman) answered only "External API access not
  configured"; the response now includes a hint pointing at
  `settings/api.json` / `docs/settings/api.md`, and `docs/functions.md` +
  README explain the same-origin-by-default rule up front.
- **Dependency refresh via `npm audit fix`** — 48 advisories down to 6, all
  criticals cleared (next-auth 4.24.15, @auth/core 0.41.3, form-data 4.0.6,
  protobufjs 7.6.5, …). `next` stays pinned; remaining 6 are the
  `mercadopago` v3 major bump, deferred deliberately.

### Docs
- **Multi-site local testing recipe** in `docs/site-anatomy.md`: hit any
  site folder with `curl -H "Host: …"` or an `/etc/hosts` entry — new site
  folders are picked up live in dev, no restart.

### Security
- **`DEFAULT_AUTH_CONFIG` is now deeply frozen** — hardening follow-up to the
  deepMerge purity fix. The shared auth defaults singleton can no longer be
  mutated by any future code path: ESM strict mode turns an accidental write
  into a loud `TypeError` instead of a silent cross-site config bleed. Merged
  per-site configs are unaffected (the pure `deepMerge` layers overrides onto
  a new object).
- **CI now runs the unit tests** — `npm run test:unit`
  (`core/utils/deepMerge.test.js`) added to the build-and-smoke job so the
  tenant-isolation regression tests actually gate PRs.

### Fixed
- **Signup no longer demands fields it never renders — cross-tenant auth
  config bleed.** A site whose `settings/auth.json` is `{}` could reject
  registration with `"Phone number is required"` while showing no phone input
  at all, leaving the form unfillable. Root cause: `deepMerge` in
  `core/utils/deepMerge.js` **mutated its target**, and `getAuthConfig`
  (`core/auth/options.js:37`) calls
  `deepMerge(DEFAULT_AUTH_CONFIG, pageData.auth)` against the module-level
  singleton from `core/auth/defaults.js`. The first tenant with
  `signup.fields` configured wrote those fields permanently into the shared
  defaults object, so every site handled by that Node process afterwards
  inherited them until restart — which is also why it looked intermittent and
  load-balancer-dependent. The mismatch was visible because the two sides read
  different sources: `/api/auth/config` builds the form from the site's own
  raw settings (clean → no input drawn) while `/api/auth/register` validates
  against the polluted merged config (→ field required). `deepMerge` is now
  pure — it returns a new object and never writes to `target` at any depth;
  arrays are copied rather than aliased, and
  `__proto__`/`constructor`/`prototype` keys are skipped since source objects
  come from tenant JSON. The local non-mutating `deepMerge` in
  `core/render/getTheme.js` was already safe and is untouched. Regression
  tests in `core/utils/deepMerge.test.js`
  (`node core/utils/deepMerge.test.js`, 18 assertions). Note: the pollution
  lived in process memory, so Node processes must be restarted on deploy to
  clear already-poisoned defaults.

### Docs
- **Fresh front-door documentation for the open-source release** — new
  `README.md` (pitch + 5-minute quickstart), rewritten `docs/quickstart.md`
  (standalone, zero-config), new `docs/site-anatomy.md` and
  `docs/deployment.md` (Docker/VPS, the component build-time rebuild rule,
  functions live-editable asymmetry). `docs/intro.md` retired into the README;
  `BILLING.md`/`RUNTIME_TAILWIND.md` renamed to `billing.md`/`tailwind.md`.

### Docs
- **Four SEO docs consolidated into one `docs/seo.md`** (2,392 lines → 557) —
  meta pipeline, structured-data `seo` field with per-type examples,
  sitemap/robots/llms.txt, troubleshooting. Also fixes docs that pointed at a
  nonexistent `settings/seo.json`: site-wide meta defaults live in
  `settings/meta.json`.

### Docs
- **All six shipped addons documented** — new docs/addons pages for
  booking-calendar, comments, react-bits, and tally (notion-blog and
  qr-scanner already had them) plus a docs/addons/index.md overview.
  Addon metadata (addon.json author/urls/examples) de-branded.

### Docs
- **Skills-only subsystems now have human docs** — new `docs/geolocation.md`,
  `docs/realtime.md`, `docs/email.md`, written from the skills and verified
  against the code (notably: DB subscriptions are SSE, not WebSocket; geo
  operators and subscriptions require MongoDB — the file store throws; email
  is `app.utils.sendEmail`, server-side only). Stale Studio-era email quota
  response shape removed from the email skill. New `docs/README.md` index of
  the whole tree.

### Removed
- **Internal working material dropped from the public tree** — the root
  `prompts/` directory (internal task prompts, security analyses,
  screenshots) and the overlay-only skills (`skills/deploy.md` — Studio
  snapshot tooling, `skills/settings/workers.md` — background workers are not
  in the open-source runtime; `app.worker` throws with a clear error).

### Docs
- **De-studio sweep** — remaining CM64/Startup Studio references removed from
  docs and skills (css.md now documents the real `data-jason-css` attribute;
  analytics/env/settings/component/geolocation/scripts cleaned; functions.md
  is honest about `app.worker` being unavailable).

### Fixed
- **Demo site CSS now actually loads** — `sites/example.com/css/custom.css`
  renamed to `css/global.css`, the filename the renderer reads.

### Changed
- **Dockerfile modernized** — node:20-alpine (matches `engines`), legacy
  CM64 build args removed; `docker-compose.yml` now runs the app itself with
  `sites/` volume-mounted plus an optional MongoDB service (was Mongo-only).

### Added
- **Local-mode asset serving** — `/assets/<path>` now serves files from
  `sites/<domain>/assets/` when no storage adapter is registered (previously
  returned 501 outside CM64 adapter mode). ETag/304 and per-type cache headers
  included; demo asset at `sites/example.com/assets/logo.svg`.
- **Route-level smoke-test suite** (`npm run smoke`) — spawns `next dev` and
  verifies page render, dynamic `[slug]` routes, site-local component mounting,
  native function GET/POST, an `app.db` write/read round-trip on the file
  store, and asset serving. Set `SMOKE_BASE_URL` to target a running server.
  This suite gates every refactor commit.

### Added
- **`jason.config.js`** — instance-level defaults (default title/description,
  email footer, site-network naming, proxy User-Agent). The framework's
  last-resort branding now comes from this editable root file instead of
  hardcoded CM64 strings.

### Changed
- **De-branding**: the injected global-CSS `<style>` tag attribute is now
  `data-jason-css` (was `data-cm64-css`; no readers depended on it).
  "Startup not found" API errors now read "Site not found".
- **Vocabulary**: framework code says site/siteId (getStartup() removed —
  use getSite(); sitemap/robots generation params renamed). Persisted data
  contracts are untouched: the `startups` collection name, `startupId` in
  user records/JWTs, and `startup_id` on site records still use the legacy
  names — renaming those is a Phase 5 data-migration decision.
- **Host resolution consolidated into `core/sites/resolve.js`** — one
  `resolveSite(request?) => { host, siteId }` replaces `getHost`,
  `getHostFromRequest`, and three ad-hoc idioms (62 call sites migrated).
  Behavior change: `x-forwarded-host` is now honored consistently on every
  path (previously only the page renderer and middleware checked it); dead
  `getResolvedHost`/`getStandaloneHost`/`isStandaloneMode` exports removed.
- `sites/*/data/` (runtime data written by the file-backed `app.db` store) is
  now gitignored.
- Demo site: `/about` mounts the site-local `./Header` component.
