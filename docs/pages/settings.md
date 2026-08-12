# Page-Level Settings

Per-page configuration for fonts, scripts, theme, and resources.

## Fonts

Load custom fonts:

```json
{
  "fonts": {
    "Inter": {
      "weights": [400, 500, 600, 700],
      "subsets": ["latin"],
      "display": "swap"
    },
    "Fira Code": {
      "weights": [400, 500],
      "subsets": ["latin"]
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `weights` | array | [400] | Font weights to load |
| `subsets` | array | ["latin"] | Character subsets |
| `display` | string | "swap" | Font-display strategy |

Fonts are auto-loaded from Google Fonts or CDN Fonts.

---

## Scripts

Load external JavaScript:

```json
{
  "scripts": {
    "analytics": {
      "src": "https://analytics.example.com/script.js",
      "async": true
    },
    "custom": {
      "innerHTML": "console.log('Hello');"
    }
  }
}
```

### Script with Expose

Make library available via `app.scripts`:

```json
{
  "scripts": {
    "custom": [
      {
        "src": "https://v8.js-dos.com/latest/js-dos.js",
        "expose": "Dos"
      }
    ]
  }
}
```

Access in components:

```javascript
const Dos = app.scripts.get('Dos');
// or
const Dos = await app.scripts.waitFor('Dos');
```

---

## External CSS

Load external stylesheets:

```json
{
  "include_css": [
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap",
    "/assets/custom-styles.css"
  ]
}
```

---

## Theme Overrides

Page-specific theme settings:

```json
{
  "theme": {
    "colors": {
      "primary": "#3b82f6",
      "secondary": "#6366f1",
      "background": "#ffffff"
    }
  }
}
```

Overrides site-wide `settings/theme.json`.

---

## Layout

Page wrapper settings:

```json
{
  "layout": {
    "className": "min-h-screen bg-background"
  }
}
```

---

## Language

Page language for i18n:

```json
{
  "lang": "en"
}
```

---

## Complete Example

```json
{
  "meta": {
    "title": "Documentation - MyApp"
  },
  "lang": "en",
  "layout": {
    "className": "min-h-screen bg-slate-50"
  },
  "fonts": {
    "Inter": {
      "weights": [400, 500, 600],
      "subsets": ["latin"]
    },
    "JetBrains Mono": {
      "weights": [400],
      "subsets": ["latin"]
    }
  },
  "theme": {
    "colors": {
      "primary": "#0ea5e9"
    }
  },
  "scripts": {
    "prism": {
      "src": "https://cdn.jsdelivr.net/npm/prismjs@1/prism.min.js",
      "async": true
    }
  },
  "include_css": [
    "https://cdn.jsdelivr.net/npm/prismjs@1/themes/prism.min.css"
  ],
  "components": [...]
}
```

---

## See Also

- [../settings/theme.md](../settings/theme.md) - Site-wide theme
- [../settings/fonts.md](../settings/fonts.md) - Global fonts
- [../seo.md](../seo.md) - Meta configuration and SEO
