# JasonJS Documentation

Human reference docs — what things are, why they work that way, with examples. Building with an AI agent? Point it at [`skills/`](../skills/) instead: the same knowledge, compacted into agent workflows.

## Start here

| | |
|---|---|
| [Quickstart](quickstart.md) | Zero to running app with nothing but Node |
| [Site anatomy](site-anatomy.md) | Everything inside a `sites/<domain>/` folder |
| [Deployment](deployment.md) | Docker, VPS, reverse proxy, the component rebuild rule |

## Building

| | |
|---|---|
| [Pages](pages/index.md) | JSON page structure · [routing](pages/routing.md) · [data fetching](pages/data.md) · [attributes](pages/attributes.md) · [page settings](pages/settings.md) |
| [Components](components/index.md) | Built-in library ([website](components/website.md), [forms](components/formbuilder.md), [tables](components/jasontable.md), [auth](components/auth.md), [media](components/media.md), [ui](components/ui.md)) and custom components |
| [The `app` object](app.md) | The universal client/server API |
| [Functions](functions.md) | Backend ES module functions |
| [Events](events.md) | The event bus — how components interoperate |
| [Addons](addons/index.md) | Optional kits: booking, comments, Notion blog, QR, react-bits, Tally |

## Data

| | |
|---|---|
| [Databases](databases.md) | `app.db`, queries, schemas, permissions |
| [Notion as a database](databases/notion.md) | Content-driven sites from Notion |
| [Geolocation](geolocation.md) | Position API, geo queries, maps |
| [Realtime](realtime.md) | Live DB subscriptions (SSE) and sockets |
| [Storage](storage.md) | File uploads (S3) |

## Features

| | |
|---|---|
| [Auth](auth.md) | Login, OAuth, roles, protected pages |
| [Billing](billing.md) | Stripe / MercadoPago subscriptions |
| [Email](email.md) | Transactional email via SMTP |
| [AI](ai.md) | `app.ai` and AI endpoints |
| [Analytics](analytics.md) | Event tracking |
| [SEO](seo.md) | Meta, structured data, sitemaps, llms.txt |

## Styling & polish

| | |
|---|---|
| [Theming](settings/theme.md) | Colors → full design system with dark mode |
| [Custom CSS](css.md) | `css/global.css` for what JSON can't express |
| [Tailwind](tailwind.md) | How runtime class generation works |
| [Fonts](settings/fonts.md) | Google Fonts and self-hosted |

## Configuration & internals

| | |
|---|---|
| [Settings](settings/index.md) | Every `settings/*.json` file |
| [Environment variables](settings/env.md) | Instance `.env` and per-site `.env.json` |
| [Dev mode](dev-mode.md) | `?dev=true`, cache skipping |
| [Cache](cache.md) | Caching layers and invalidation |
