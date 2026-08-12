# Tally Forms Addon

Embed [Tally.so](https://tally.so) forms — contact, waitlist, surveys, lead capture — as-is. The addon auto-loads Tally's `embed.js` on demand (no page-level `scripts` config) and supports dynamic iframe height, so multi-step forms grow naturally.

- **Package**: `@addons/tally`
- **Component**: `TallyForm`

## Usage

The form ID is the last segment of the Tally share URL: `https://tally.so/r/nPvaKV` → `nPvaKV`.

Page JSON:

```json
{
  "components": [
    {
      "component": "@addons/tally/TallyForm",
      "attributes": { "formId": "nPvaKV", "title": "Contact Form" }
    }
  ]
}
```

In a component:

```jsx
import TallyForm from '@addons/tally/TallyForm';

const ContactSection = () => (
  <section className="py-16">
    <div className="max-w-2xl mx-auto px-4">
      <h2 className="text-3xl font-bold mb-8">Get in Touch</h2>
      <TallyForm formId="nPvaKV" />
    </div>
  </section>
);
```

**Don't add a `scripts` field to the page** — the addon loads Tally's embed script itself, once per page.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `formId` | string | required | Tally form ID from the share URL |
| `title` | string | `'Form'` | iframe title (accessibility) |
| `dynamicHeight` | boolean | `true` | Auto-resize the iframe to fit the form (via Tally's postMessage) |
| `height` | string | `'100vh'` | Fallback height when `dynamicHeight` is `false` |
| `customHeight` | string | — | Fixed height override (e.g. `'600px'`); disables dynamic height |

## Design lives in Tally

Theme, colors, layout, title visibility, background — all of it is configured in the Tally dashboard (Settings → Design), and the embed inherits it. The addon deliberately passes **no** URL parameters to the iframe: overriding Tally's design from the embed side causes washed-out colors and clipped content. Edit the form in Tally and the embed updates automatically — no redeploy.

## Notes

- The framework's CSP already allows `https://tally.so` in `script-src` and `frame-src`, which the embed requires.
- The iframe's `allow` attribute includes camera, microphone, and geolocation for forms that use them.
- Fixed-size embed: `{ "dynamicHeight": false, "height": "700px" }`.
