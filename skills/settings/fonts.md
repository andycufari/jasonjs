---
skill: settings/fonts
when: "Adding custom fonts, Google Fonts, or web fonts"
requires: []
---

# Font Settings

> Load custom fonts site-wide or per-page.

## Quick Start

Create `settings/fonts.json`:

```json
[
  {
    "name": "Inter",
    "src": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
  }
]
```

Then reference in theme typography:

```json
// settings/theme.json
{
  "typography": {
    "fontFamily": "'Inter', system-ui, sans-serif"
  }
}
```

## Font Formats

Fonts can be specified as an **array** or **object**. Both formats work:

```json
// Array format (recommended)
[
  { "name": "Inter", "src": "https://fonts.googleapis.com/..." },
  { "name": "Cal Sans", "src": "https://fonts.cdnfonts.com/css/cal-sans" }
]

// Object format (keys are ignored, useful for organization)
{
  "primary": { "name": "Inter", "src": "..." },
  "heading": { "name": "Cal Sans", "src": "..." },
  "mono": { "name": "JetBrains Mono", "src": "..." }
}
```

## Google Fonts

```json
[
  {
    "name": "Inter",
    "src": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
  },
  {
    "name": "Space Grotesk",
    "src": "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap"
  }
]
```

## Self-Hosted Fonts

```json
[
  {
    "name": "CustomFont",
    "src": "/assets/fonts/custom.woff2",
    "weight": "400",
    "style": "normal"
  },
  {
    "name": "CustomFont",
    "src": "/assets/fonts/custom-bold.woff2",
    "weight": "700",
    "style": "normal"
  }
]
```

Supported formats: `.woff2`, `.woff`, `.ttf`, `.otf`

## CDN Fonts (non-Google)

```json
[
  {
    "name": "RobotoMono",
    "src": "https://fonts.cdnfonts.com/css/roboto-mono"
  }
]
```

## Page-Level Fonts

Add fonts directly in page JSON:

```json
{
  "fonts": [
    {
      "name": "Inter",
      "src": "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"
    }
  ],
  "theme": {
    "typography": {
      "fontFamily": "'Inter', system-ui, sans-serif"
    }
  },
  "components": [...]
}
```

**Note:** Page-level fonts **replace** (not merge with) site-level fonts.

## Generated CSS Classes

The framework auto-generates utility classes from font names:

```jsx
// Font name: "Inter" → class: "font-inter"
// Font name: "Space Grotesk" → class: "font-space-grotesk"
// Font name: "JetBrains Mono" → class: "font-jetbrains-mono"

<h1 className="font-inter">Heading</h1>
<h1 className="font-space-grotesk">Heading</h1>
<code className="font-jetbrains-mono">Code</code>
```

**Class naming rules:**
- Converted to lowercase
- Spaces and special characters become hyphens
- Only alphanumeric characters and hyphens kept

## Font Object Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Font family name (used in CSS and class generation) |
| `src` | string | Yes | URL to font file or stylesheet |
| `weight` | string | No | Font weight (default: "400") |
| `style` | string | No | Font style (default: "normal") |
| `display` | string | No | Font-display value (default: "swap") |
| `fallback` | string | No | Fallback font stack |

## Complete Example

`settings/fonts.json`:
```json
[
  {
    "name": "Inter",
    "src": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
  },
  {
    "name": "Space Grotesk",
    "src": "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap"
  },
  {
    "name": "JetBrains Mono",
    "src": "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
  }
]
```

`settings/theme.json`:
```json
{
  "typography": {
    "fontFamily": "'Inter', system-ui, sans-serif",
    "headings": {
      "fontFamily": "'Space Grotesk', sans-serif",
      "fontWeight": "600"
    }
  }
}
```

## Object Format Example

For better organization in `settings/fonts.json`:

```json
{
  "primary": {
    "name": "Inter",
    "src": "https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap",
    "weight": "100 900",
    "display": "swap"
  },
  "heading": {
    "name": "Cal Sans",
    "src": "https://fonts.cdnfonts.com/css/cal-sans",
    "weight": "400 600",
    "fallback": "Inter, system-ui, sans-serif"
  },
  "mono": {
    "name": "JetBrains Mono",
    "src": "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
  }
}
```

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Put fonts in `settings/theme.json` | Use separate `settings/fonts.json` |
| `{ "fonts": {...} }` (wrapped object) | `[{...}]` (array) or `{ "key": {...} }` (object of font objects) |
| `{ "Inter": "url" }` (simple mapping) | `{ "name": "Inter", "src": "url" }` (font object) |
| Forget to set `typography.fontFamily` | Match font name in theme: `"'Inter', sans-serif"` |
| Skip font fallbacks | Include: `system-ui, sans-serif` |
| Missing quotes in fontFamily | Use: `"'Inter', sans-serif"` (single quotes inside) |
| Expect page fonts to merge | Page fonts replace site fonts entirely |

## Related

- `skill:settings/theme` - Typography and color settings
- `skill:theming` - Complete theming guide
