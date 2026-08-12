# Addons

Addons are optional feature kits that live under `addons/` in the framework repo. Each one bundles components (and sometimes API routes, database schemas, and i18n) behind a single folder; their components are referenced from pages like any other, with the `@addons/<name>/<Component>` prefix, and their API routes mount under `/api/addons/<name>/`. Nothing to install — every addon below ships with the framework.

| Addon | What it does | Doc |
|-------|--------------|-----|
| **booking-calendar** | Calendly-style booking on Google Calendar: multi-account freebusy intersection, public `Book` widget, host settings | [booking-calendar.md](./booking-calendar.md) |
| **comments** | Threaded comments with auth, voting, reporting, AI moderation, i18n | [comments.md](./comments.md) |
| **notion-blog** | A Notion database as a blog: list + article components, field mapping, caching | [notion-blog.md](./notion-blog.md) |
| **qr-scanner** | Camera QR scanning via the native Barcode Detection API | [qrscanner.md](./qrscanner.md) |
| **react-bits** | WebGL/Three.js visual effects: ASCII text, color-morph backgrounds, dither waves | [react-bits.md](./react-bits.md) |
| **tally** | Embed Tally.so forms with auto-loading script and dynamic height | [tally.md](./tally.md) |

## Using an addon component

```json
{
  "components": [
    {
      "component": "@addons/comments/Comments",
      "attributes": { "relId": "{{post.id}}", "relType": "post" }
    }
  ]
}
```

Component resolution: `@addons/<addon>/<Component>` maps to `addons/<addon>/components/<Component>.jsx`. See [components/index.md](../components/index.md) for the full resolution order.
