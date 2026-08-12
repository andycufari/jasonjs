# Deployment

JasonJS is a Next.js app — anywhere Next.js runs, JasonJS runs. This guide covers the two common self-host paths (Docker and bare VPS) and the production behaviors worth knowing before you ship.

## The short version

```bash
npm run build
npm run start        # serves on :3000
```

Set your env (`.env`, from `.env.example`), put a reverse proxy in front, point DNS at it. Done.

---

## What's live-editable in production, and what isn't

| Thing | Production behavior |
|---|---|
| Pages (`pages/*.json`) | ✅ Live — edit the file, next request serves it |
| Functions (`functions/*.js`) | ✅ Live — loaded per request |
| Settings, CSS, assets, data | ✅ Live |
| **Components (`components/*.jsx`)** | ⚠️ **Compiled at build time — adding or editing one requires `npm run build` + restart** |

### The component rebuild rule

Site components are real React modules compiled by Next.js, which is what buys HMR in dev, source maps, npm imports, and no runtime compiler or `unsafe-eval` in production. The cost: the production bundle only contains the components that existed at build time. If your workflow is "agents/users add components to a running instance", schedule rebuilds (a simple `git pull && npm run build && restart` deploy loop covers it).

---

## Environment

Minimum production `.env`:

```env
DEFAULT_DOMAIN=myapp.com          # site served for unmatched hosts
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

Recommended for real deployments:

```env
MONGODB_URI=mongodb://...         # upgrades app.db + required for auth user storage
```

Everything else (S3, SMTP, Stripe, AI keys, Redis) is optional and per-feature — see [`.env.example`](../.env.example), which documents all of it.

**Note on auth:** login/user storage requires MongoDB. The zero-config file store covers `app.db` data, not auth accounts.

---

## Docker

The repo ships a `Dockerfile` and `docker-compose.yml`:

```bash
cp .env.example .env   # edit it
docker compose up -d --build
```

The compose file:

- builds the app (components in `sites/` are compiled into the image),
- mounts `./sites` as a volume so pages, functions, settings, and file-store data live outside the container,
- includes a MongoDB service — set `MONGODB_URI=mongodb://mongodb:27017/jason` in `.env` to use it.

Because `sites/` is a mounted volume, page/function/settings edits on the host are live immediately. Component additions still need `docker compose up -d --build` (the rebuild rule).

## VPS / bare Node

```bash
git clone <your fork> && cd jasonjs
npm ci
cp .env.example .env   # edit it
npm run build
npm run start
```

Keep it alive with your process manager of choice, e.g. pm2:

```bash
pm2 start npm --name jasonjs -- run start
```

Deploy loop:

```bash
git pull && npm ci && npm run build && pm2 restart jasonjs
```

---

## Reverse proxy and multi-site

Run one instance, point every site's DNS at it, and let the Host header do the routing — `sites/blog.example.com/` and `sites/shop.example.com/` are two apps on one deployment.

Behind a proxy, JasonJS resolves the site from `x-forwarded-host` (first value) before `host`, so the standard nginx setup just works:

```nginx
server {
  server_name myapp.com blog.example.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

TLS: terminate at the proxy (certbot/caddy). Caddy is the least-config option for many domains:

```
myapp.com, blog.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

Requests whose host matches no site folder fall back to `DEFAULT_DOMAIN` — deliberate, so IP-address scans and misconfigured DNS hit your default site instead of erroring.

---

## Vercel / serverless

It deploys, with caveats: the file-backed `app.db` store and local `sites/*/assets/` need a persistent disk, which serverless doesn't give you. On serverless platforms use `MONGODB_URI` for data and S3 for assets, and treat `sites/` as read-only content shipped with the build. Self-hosting (Docker/VPS) is the recommended path — it's what the zero-config experience is designed around.

---

## Production checklist

- [ ] `NEXTAUTH_SECRET` set to a real secret
- [ ] `DEFAULT_DOMAIN` points at your primary site
- [ ] `MONGODB_URI` set if you use auth or outgrow the file store
- [ ] Reverse proxy forwards `X-Forwarded-Host` and `X-Forwarded-Proto`
- [ ] `sites/*/data/` is on persistent storage (volume-mounted in Docker) and backed up
- [ ] A rebuild path exists for component changes (`build` + restart)
- [ ] Optional: `REDIS_URL` for distributed caching across multiple instances
