# Analytics

The framework ships with a two-tier analytics system. Tier 1 runs automatically — you don't have to do anything. Tier 2 is there when you want custom events.

## Tier 1 — Automatic visit tracking (default, zero-config)

Every page render is recorded server-side. You get visitors, unique users, pages, day/time, browser, OS, and device for free.

- **Cookieless.** No `document.cookie`, no client JS, no consent banner.
- **Unique visitors via rotating salted hash** (same approach as Plausible, Fathom). `sha256(dailySalt + ip + userAgent + siteId)` → 16-char fingerprint. Salt rotates every UTC day; old salts are TTL-deleted after 48h, so historical hashes become mathematically irreversible.
- **No PII stored.** Raw IP and User-Agent are hashed on the fly, never written to disk.
- **Bots and no-JS clients ARE tracked.** Server-side tracking sees every real request, unlike Google Analytics.
- **Fire-and-forget.** Tracking runs after `renderPage` resolves but is not awaited. A slow or broken Mongo never delays your pages.
- **Prefetch-safe.** Next.js `<Link>` hover prefetches and RSC payloads are filtered out, so counts aren't inflated.

You don't need to import anything. You don't need a settings file. You don't need Google Analytics. It's on for every site.

### What gets recorded

A lean document per page view in the `analytics_events` collection:

```js
{
  _id: ObjectId("..."),
  siteId: "...",
  event: "$page_view",
  properties: {
    $page: "/pricing",
    $referrer: "https://google.com",    // only if present
    $browser: "Chrome",
    $os: "macOS",
    $device: "desktop",
    $pageType: "page"                   // or "not-found", "error", "html"
  },
  userId: null,                         // set if user is authenticated
  sessionId: null,
  visitorHash: "a3f29b8c7d1e0f42",       // 16-char daily fingerprint
  timestamp: ISODate("...")
}
```

Typical document size: ~200 bytes.

**Note:** `visitorHash` is a **top-level** field, not inside `properties`. MongoDB rejects `$`-prefixed field names in index keys, so it was stored without the prefix and at the top level alongside `sessionId` / `userId`. Tier 2 custom events (from `app.analytics.track()`) don't include it — the field is absent on those documents, not null.

### Google Analytics

If you want GA alongside the built-in tracking, wire it the normal way via `settings/scripts.json`:

```json
{ "gtag": "G-XXXXXXXXXX" }
```

Unchanged from previous behavior. Nothing in Tier 1 interferes with it.

### Meta Pixel (Facebook)

Single pixel or multiple pixels on the same site:

```json
{ "meta_pixels": "1234567890" }
```

```json
{ "meta_pixels": ["1234567890", "0987654321"] }
```

The framework injects the base code once, runs `fbq('init', ...)` per pixel, fires a single `fbq('track', 'PageView')`, and adds a `<noscript>` image fallback per pixel. Independent of Tier 1.

---

## Tier 2 — Explicit event tracking (opt-in)

For custom events — button clicks, form submissions, purchases, etc. — use the `app.analytics` API from your components. This is an **optional** layer on top of Tier 1.

```jsx
// Track a custom event
app.analytics.track('signup_clicked', {
  location: 'hero',
  variant: 'primary'
});

// Track a custom page view (in addition to the automatic one)
app.analytics.page('/pricing', { utm_source: 'google' });

// Associate events with a user
app.analytics.identify(user.id, {
  name: user.name,
  email: user.email,
  plan: 'pro'
});
```

**Consent responsibility.** Tier 2 can use session storage or any identifier you pass in. If your jurisdiction requires a consent banner for the data you collect through Tier 2, you're responsible for implementing it. Tier 1 alone does not require consent.

### API

| Method | Purpose |
|--------|---------|
| `app.analytics.track(event, properties)` | Fire a named event with arbitrary properties. |
| `app.analytics.page(path, properties)` | Fire a `$page_view` event for a specific path (in addition to the automatic one). |
| `app.analytics.identify(userId, traits)` | Upsert the user profile and link subsequent events to this user. |
| `app.analytics.group(groupId, traits)` | Associate the user with an organization/team. |

### Common patterns

```jsx
function SignUpButton() {
  const app = useApp();
  const handleClick = () => {
    app.analytics.track('signup_clicked', { location: 'hero' });
    app.navigate.to('/signup');
  };
  return <button onClick={handleClick}>Start Free Trial</button>;
}
```

```jsx
function CheckoutSuccess({ order }) {
  const app = useApp();
  useEffect(() => {
    app.analytics.track('purchase_completed', {
      orderId: order.id,
      amount: order.total,
      items: order.items.length
    });
  }, [order.id]);
  return <div>Thanks!</div>;
}
```

---

## Querying the data

Events live in the `analytics_events` collection in the app database. Query them with `app.db.use('analytics_events')` or directly from a server function.

```jsx
// All events for the current site
const events = await app.db.use('analytics_events').fetch();

// Page views in the last 30 days
const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const recent = await app.db.use('analytics_events').fetch({
  event: '$page_view',
  timestamp: { $gte: startDate }
});

// Unique visitors today
const today = new Date().toISOString().slice(0, 10);
const all = await app.db.use('analytics_events').fetch({
  event: '$page_view',
  timestamp: { $gte: new Date(today) }
});
const uniqueVisitors = new Set(all.map(e => e.visitorHash).filter(Boolean)).size;
```

### Building a dashboard

```jsx
function AnalyticsDashboard() {
  const app = useApp();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = async () => {
      const recent = await app.db.use('analytics_events').fetch({
        event: '$page_view',
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      setStats({
        last30Days: recent.length,
        uniqueVisitors: new Set(recent.map(e => e.visitorHash).filter(Boolean)).size,
        byDevice: groupBy(recent, e => e.properties.$device),
        byBrowser: groupBy(recent, e => e.properties.$browser),
      });
    };
    load();
  }, []);

  if (!stats) return <div>Loading...</div>;
  return <div>Visits in last 30 days: {stats.last30Days}</div>;
}
```

---

## Privacy and GDPR

**Tier 1 is designed to be compliant without a consent banner.**

Under GDPR Recital 26 and the EDPB guidelines, data that cannot be re-linked to an individual is not personal data. The rotating salted hash approach is specifically the pattern that privacy-first analytics vendors (Plausible, Fathom, Simple Analytics) operate under without consent.

- Raw IP addresses are never stored, only hashed with a daily rotating salt.
- Raw User-Agent strings are never stored, only the parsed browser/OS/device labels.
- After 48 hours, the daily salt is deleted via a MongoDB TTL index. Old hashes become mathematically irreversible — not even the framework can retroactively link them to an IP.
- No cookies. No `localStorage`. No persistent client-side identifier.
- No cross-site tracking: the hash includes `siteId` so the same visitor on two different sites produces two different hashes.

**Not legal advice.** Consult your own counsel for your specific jurisdiction.

### Tier 2 consent

Tier 2 events are opt-in by you, the builder. If you call `app.analytics.identify()` with a real user ID or pass PII through `app.analytics.track()`, you're in a different compliance regime. Add a banner if your jurisdiction requires one.

### Deleting user data

Tier 1 data cannot be linked to an individual after 48 hours, so there's nothing to delete. For Tier 2 events tied to an authenticated user:

```js
await app.db.use('analytics_events').delete({ userId: targetUserId });
```

---

## Performance

- **Tier 1** adds one Mongo insert + one `$inc` per page render. Both hit indexed lookups. Fire-and-forget — never blocks rendering.
- **Tier 2** is a fetch from the client, batched by the browser. Add a `navigator.sendBeacon` wrapper yourself if you need zero-latency critical-path tracking.
- **Indexes matter.** The `analytics_events` collection needs compound indexes on `{ siteId, timestamp }`, `{ siteId, event, timestamp }`, `{ siteId, userId, timestamp }`, and `{ siteId, visitorHash, timestamp }` (partial, only where `visitorHash` exists). Create them once with your MongoDB tooling (mongosh or Compass).

---

## Summary

| You want | Use |
|----------|-----|
| Visitors, page views, devices, browsers | Nothing — already automatic (Tier 1) |
| Total visits for a site | `db.analytics_events.countDocuments({ siteId, event: '$page_view' })` |
| Unique visitors today | `$addToSet` over `visitorHash` (top-level field) |
| Custom events (clicks, purchases) | `app.analytics.track(...)` (Tier 2) |
| Link events to a user | `app.analytics.identify(...)` (Tier 2) |
| Google Analytics | `settings/scripts.json` → `{ "gtag": "G-..." }` |
| Meta Pixel (Facebook) | `settings/scripts.json` → `{ "meta_pixels": "..." }` or `[...]` |

> **Zero setup.** Tier 1 works the moment you ship the site. Tier 2 is there when you need it.
