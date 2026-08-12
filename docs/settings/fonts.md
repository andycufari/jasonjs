# Fonts

Load custom fonts site-wide or per-page.

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

---

## Font Formats

Fonts can be specified as an **array** or **object**. Both formats work:

```json
// Array format (recommended for page-level)
[
  { "name": "Inter", "src": "https://fonts.googleapis.com/..." },
  { "name": "Cal Sans", "src": "https://fonts.cdnfonts.com/css/cal-sans" }
]

// Object format (useful for organization in settings/fonts.json)
{
  "primary": { "name": "Inter", "src": "..." },
  "heading": { "name": "Cal Sans", "src": "..." },
  "mono": { "name": "JetBrains Mono", "src": "..." }
}
```

**Note:** In object format, the keys (`primary`, `heading`, `mono`) are ignored - only the font objects matter.

---

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
  },
  {
    "name": "JetBrains Mono",
    "src": "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
  }
]
```

---

## Self-Hosted Fonts

Upload fonts to your assets and reference them:

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

---

## CDN Fonts (non-Google)

```json
[
  {
    "name": "RobotoMono",
    "src": "https://fonts.cdnfonts.com/css/roboto-mono"
  }
]
```

---

## Page-Level Fonts

Add fonts to a specific page only:

```json
{
  "fonts": [
    {
      "name": "Playfair Display",
      "src": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap"
    }
  ],
  "theme": {
    "typography": {
      "headings": {
        "fontFamily": "'Playfair Display', serif"
      }
    }
  },
  "components": [...]
}
```

**Note:** Page-level fonts **replace** (not merge with) site-level fonts. If you need both, include all fonts in the page JSON.

---

## Using Fonts

### In Theme

```json
// settings/theme.json
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

### Generated CSS Classes

The framework auto-generates utility classes from font names:

```jsx
// Font name: "Inter" → class: "font-inter"
// Font name: "Space Grotesk" → class: "font-space-grotesk"
// Font name: "JetBrains Mono" → class: "font-jetbrains-mono"

<h1 className="font-inter">Body font</h1>
<h1 className="font-space-grotesk">Heading font</h1>
<code className="font-jetbrains-mono">Code</code>
```

**Class name generation rules:**
- Converted to lowercase
- Spaces and special characters become hyphens
- Only alphanumeric characters and hyphens kept

---

## Font Object Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Font family name (used in CSS and class generation) |
| `src` | string | Yes | URL to font file or stylesheet |
| `weight` | string | No | Font weight (default: "400") |
| `style` | string | No | Font style (default: "normal") |
| `display` | string | No | Font-display value (default: "swap") |
| `fallback` | string | No | Fallback font stack |

---

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

---

## Using Object Format

For better organization, you can use object format in `settings/fonts.json`:

```json
{
  "primary": {
    "name": "Inter",
    "src": "https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap",
    "weight": "100 900",
    "style": "normal",
    "display": "swap"
  },
  "heading": {
    "name": "Cal Sans",
    "src": "https://fonts.cdnfonts.com/css/cal-sans",
    "weight": "400 600",
    "style": "normal",
    "display": "swap",
    "fallback": "Inter, system-ui, sans-serif"
  },
  "mono": {
    "name": "JetBrains Mono",
    "src": "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100;200;300;400;500;600;700;800&display=swap",
    "weight": "100 800",
    "style": "normal",
    "display": "swap"
  }
}
```

The framework extracts the font objects and processes them the same as array format.

---

## Common Mistakes

| Don't | Do |
|-------|-----|
| Put fonts in `theme.json` | Use separate `settings/fonts.json` |
| `{ "Inter": "url" }` (simple object) | `{ "name": "Inter", "src": "url" }` (font object) |
| Forget to set `typography.fontFamily` | Match font name in theme |
| Skip font fallbacks | Include: `system-ui, sans-serif` |
| Missing quotes in fontFamily | Use: `"'Inter', sans-serif"` |
| Expect page fonts to merge with site fonts | Page fonts replace site fonts entirely |

---

## See Also

- [settings/theme.md](./theme.md) - Typography and colors
