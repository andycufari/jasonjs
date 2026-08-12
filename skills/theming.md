---
skill: theming
when: "Customizing colors, fonts, typography, or visual styling"
requires: []
---

# Theming & Styling

> Configure fonts, colors, typography, and visual design for your app

## Quick Start

```json
{
  "fonts": [
    {
      "name": "Inter",
      "src": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
    }
  ],
  "theme": {
    "defaultColorScheme": "light",
    "colors": {
      "primary": "#6366f1",
      "secondary": "#8b5cf6"
    },
    "typography": {
      "fontFamily": "'Inter', system-ui, sans-serif"
    }
  }
}
```

## File Structure

Theme and fonts are configured in **separate files** within the `settings/` directory:

```
settings/
├── theme.json    # Theme configuration (colors, typography, spacing)
├── fonts.json    # Font definitions (name, src, weights)
└── *.json        # All .json files are loaded and merged as settings
```

Or at the **page level** in your page JSON:

```json
{
  "fonts": [...],      // Page-level fonts (REPLACES site-level)
  "theme": {...},      // Page-level theme (REPLACES site-level)
  "components": [...]
}
```

### How Settings Merge

Settings from `settings/*.json` files are merged with page JSON:

```js
// Merge order (later wins)
{
  ...settings,  // All site-level settings (theme, fonts, etc.)
  ...page       // Page-level values REPLACE (not deep merge)
}
```

**Important:** Page-level `theme` completely replaces site-level `theme`. If you only want to override one color, you still need to provide the full theme object at page level.

### ⚠️ Common Mistake: Mixing fonts in theme.json

```json
// ❌ WRONG - fonts inside settings/theme.json
{
  "fonts": [...],
  "theme": {...}
}

// ✅ CORRECT - settings/theme.json (theme only)
{
  "defaultColorScheme": "light",
  "colors": {...},
  "typography": {...}
}

// ✅ CORRECT - settings/fonts.json (fonts only)
// Can be an ARRAY format:
[
  { "name": "Inter", "src": "..." }
]

// ✅ ALSO CORRECT - settings/fonts.json (object format)
// Named keys are ignored, only the font objects matter:
{
  "primary": { "name": "Inter", "src": "..." },
  "heading": { "name": "Cal Sans", "src": "..." }
}
```

## Fonts Configuration

Fonts can be configured in two places:
1. **Page-level**: In your page JSON's `fonts` field (per-page fonts)
2. **Site-level**: In `settings/fonts.json` (applies to all pages)

### Fonts Format

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

### Pattern: Google Fonts

```json
{
  "fonts": [
    {
      "name": "Inter",
      "src": "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"
    },
    {
      "name": "Playfair Display",
      "src": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap"
    }
  ],
  "theme": {
    "typography": {
      "fontFamily": "'Inter', system-ui, sans-serif",
      "headings": {
        "fontFamily": "'Playfair Display', serif"
      }
    }
  }
}
```

### Font Utility Classes

The framework generates CSS utility classes automatically from font names:

```jsx
// Font name: "Inter" → class: "font-inter"
// Font name: "Playfair Display" → class: "font-playfair-display"
// Font name: "JetBrains Mono" → class: "font-jetbrains-mono"

<h1 className="font-playfair-display">Heading</h1>
<p className="font-inter">Body text</p>
<code className="font-jetbrains-mono">Code</code>
```

**Naming rules:**
- Converted to lowercase
- Spaces and special characters become hyphens
- Only alphanumeric characters and hyphens kept

### Pattern: Self-Hosted Fonts

```json
{
  "fonts": [
    {
      "name": "CustomFont",
      "src": "/assets/fonts/custom.woff2",
      "weight": "400",
      "style": "normal"
    }
  ]
}
```

Supported formats: `.woff2`, `.woff`, `.ttf`, `.otf`

### Pattern: CDN Fonts (not Google)

```json
{
  "fonts": [
    {
      "name": "RobotoMono",
      "src": "https://fonts.cdnfonts.com/css/roboto-mono"
    }
  ]
}
```

## Theme Configuration

### Theme Class Application

The framework wraps your page content in a theme class based on `defaultColorScheme`:

```html
<!-- For defaultColorScheme: "light" -->
<div class="theme-light">
  <!-- Your page content -->
</div>

<!-- For defaultColorScheme: "dark" -->
<div class="theme-dark">
  <!-- Your page content -->
</div>
```

This class controls which CSS variables are active, enabling theme switching.

### Pattern: Light Theme (Default)

```json
{
  "defaultColorScheme": "light",
  "colors": {
    "primary": "#6366f1",
    "secondary": "#8b5cf6",
    "accent": "#10b981",
    "background": "#ffffff",
    "surface": "#f8fafc",
    "text": "#1e293b",
    "textSecondary": "#64748b"
  }
}
```

### Pattern: Dark Theme

```json
{
  "defaultColorScheme": "dark",
  "colors": {
    "primary": "#818cf8",
    "secondary": "#a78bfa",
    "background": "#0f172a",
    "surface": "#1e293b",
    "text": "#f8fafc",
    "border": "#334155"
  }
}
```

### Pattern: Minimal Theme (Auto-Generate)

Just provide primary/secondary colors and the framework generates the rest:

```json
{
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#8b5cf6"
  }
}
```

The framework auto-generates: background, surface, text, borders, semantic colors (success/warning/error), and interactive states (hover/focus/active).

### Pattern: Tailwind-Style Color Palettes

You can use Tailwind-style palette objects for `primary`, `secondary`, and `accent`. The framework extracts the `500` shade for CSS variables **AND generates shade utility classes**:

```json
{
  "colors": {
    "primary": {
      "50": "#eff6ff",
      "100": "#dbeafe",
      "200": "#bfdbfe",
      "300": "#93c5fd",
      "400": "#60a5fa",
      "500": "#3b82f6",
      "600": "#2563eb",
      "700": "#1d4ed8",
      "800": "#1e40af",
      "900": "#1e3a8a"
    },
    "secondary": "#8b5cf6"
  }
}
```

**When you provide a full palette, these classes ARE generated:**

```jsx
// ✅ WORKS when you provide palette objects
<div className="bg-primary-600 text-primary-50">
<div className="hover:bg-primary-700">
<div className="border-primary-300">
<div className="from-primary-500 to-primary-700">
```

**Important:**
- Only `primary`, `secondary`, and `accent` support palette objects
- Other colors like `background`, `text`, `border`, etc. must be simple hex strings
- If you only provide a hex string (not a palette), shade classes won't work

### Color Classes in Components

The framework provides **two ways** to use colors in components:

#### 1. Theme Utility Classes (Recommended for Brand Colors)

These use your theme's primary/secondary colors:

```jsx
// ✅ Theme-aware classes (use CSS variables)
<div className="bg-primary text-white">
<div className="bg-secondary text-primary">
<button className="bg-primary hover:bg-primary/90">
```

#### 2. Tailwind Built-in Colors (Always Available)

For specific color shades, use Tailwind's built-in color palette:

```jsx
// ✅ Tailwind colors are always available
<div className="bg-sky-600 text-sky-50">
<div className="bg-slate-900 text-slate-100">
<div className="bg-gradient-to-r from-blue-500 to-indigo-600">
<button className="bg-blue-600 hover:bg-blue-700">
```

**Available Tailwind colors:** `slate`, `gray`, `zinc`, `neutral`, `stone`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`

Each has shades: `50`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`

### Custom Shade Classes

```jsx
// ❌ WON'T WORK - if primary is just a hex string "#6366f1"
<div className="bg-primary-600">

// ✅ WORKS - if primary is a full palette object { "500": "#3b82f6", ... }
<div className="bg-primary-600 text-primary-100">

// ✅ ALWAYS WORKS - theme base class or Tailwind built-in
<div className="bg-primary text-secondary">
<div className="bg-sky-600 text-slate-900">
```

### Matching Theme to Tailwind Colors

Choose a Tailwind color that matches your brand, then use both:

```json
// settings/theme.json - for CSS variables
{
  "colors": {
    "primary": "#0ea5e9",
    "secondary": "#64748b"
  }
}
```

```jsx
// In components - use matching Tailwind colors for shades
<button className="bg-primary">Simple button</button>
<button className="bg-sky-600 hover:bg-sky-700">With hover shade</button>
<div className="bg-gradient-to-r from-sky-500 to-sky-700">Gradient</div>
```

**Color mapping guide:**
| Theme primary | Use Tailwind |
|--------------|--------------|
| `#0ea5e9` | `sky-*` |
| `#3b82f6` | `blue-*` |
| `#6366f1` | `indigo-*` |
| `#8b5cf6` | `violet-*` |
| `#10b981` | `emerald-*` |
| `#ef4444` | `red-*` |

### Pattern: Full Typography Control

```json
{
  "typography": {
    "fontFamily": "'Inter', system-ui, sans-serif",
    "headings": {
      "fontFamily": "'Playfair Display', serif",
      "fontWeight": "600",
      "lineHeight": "1.2",
      "sizes": {
        "h1": "2.5rem",
        "h2": "2rem",
        "h3": "1.75rem",
        "h4": "1.5rem",
        "h5": "1.25rem",
        "h6": "1rem"
      }
    },
    "body": {
      "fontSize": "16px",
      "lineHeight": "1.6",
      "fontWeight": "400"
    }
  }
}
```

**Note:** Default heading fontWeight is `"600"`, not `"700"`.

### Pattern: Spacing & Layout

```json
{
  "spacing": {
    "containerMaxWidth": "1280px",
    "containerPadding": "1rem",
    "sectionPadding": "5rem",
    "cardPadding": "1.5rem"
  }
}
```

### Pattern: Border Radius

```json
{
  "borders": {
    "radius": {
      "none": "0",
      "sm": "0.25rem",
      "base": "0.5rem",
      "md": "0.75rem",
      "lg": "1rem",
      "xl": "1.5rem",
      "2xl": "2rem",
      "full": "9999px"
    },
    "width": {
      "thin": "1px",
      "base": "2px",
      "thick": "3px"
    }
  }
}
```

### Pattern: Shadows

```json
{
  "shadows": {
    "xs": "0 1px 2px rgba(0, 0, 0, 0.05)",
    "sm": "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
    "base": "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)",
    "md": "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)",
    "lg": "0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)",
    "xl": "0 25px 50px rgba(0, 0, 0, 0.15)",
    "2xl": "0 50px 100px rgba(0, 0, 0, 0.25)"
  }
}
```

### Pattern: Animations

```json
{
  "animations": {
    "duration": {
      "fast": "150ms",
      "base": "250ms",
      "slow": "350ms"
    },
    "easing": {
      "smooth": "cubic-bezier(0.4, 0, 0.2, 1)"
    }
  }
}
```

### Pattern: Custom Backgrounds

Define reusable background styles (gradients, patterns, etc.):

```json
{
  "backgrounds": {
    "gradient-primary": "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    "gradient-dark": "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
    "dots": "radial-gradient(circle, #e2e8f0 1px, transparent 1px)"
  }
}
```

Use in components:

```jsx
<div className="bg-gradient-primary">Gradient background</div>
<div style={{ background: 'var(--background-gradient-dark)' }}>Dark gradient</div>
```

### Pattern: Dark Mode Override

Define custom colors for dark mode (when user toggles theme):

```json
{
  "defaultColorScheme": "light",
  "colors": {
    "primary": "#6366f1",
    "background": "#ffffff"
  },
  "darkMode": {
    "colors": {
      "primary": "#818cf8",
      "background": "#0f172a",
      "surface": "#1e293b",
      "text": "#f8fafc"
    }
  }
}
```

## External CSS

Include external CSS files using `include_css` in your page JSON:

```json
{
  "include_css": [
    "https://cdn.example.com/styles.css",
    "/assets/custom.css"
  ],
  "components": [...]
}
```

External HTTPS URLs are automatically proxied to bypass CSP restrictions.

## Using Theme Variables

The framework generates CSS variables from your theme:

```jsx
const MyComponent = () => {
  return (
    <div style={{
      backgroundColor: 'var(--color-primary)',
      color: 'var(--color-text)',
      borderRadius: 'var(--radius-base)',
      boxShadow: 'var(--shadow-base)',
      fontFamily: 'var(--font-family)',
      padding: 'var(--spacing-cardPadding)'
    }}>
      Themed content
    </div>
  );
};
```

### Built-in Utility Classes

```jsx
// Background Colors
<div className="bg-primary">Primary background</div>
<div className="bg-secondary">Secondary background</div>
<div className="bg-surface">Surface background</div>
<div className="bg-success">Success background</div>
<div className="bg-warning">Warning background</div>
<div className="bg-error">Error background</div>
<div className="bg-info">Info background</div>

// Text Colors
<p className="text-primary">Primary text</p>
<p className="text-secondary">Secondary text</p>
<p className="text-muted">Muted text</p>
<p className="text-success">Success text</p>
<p className="text-warning">Warning text</p>
<p className="text-error">Error text</p>

// Border Colors
<div className="border border-primary">Primary border</div>
<div className="border border-base">Base border</div>
<div className="border border-light">Light border</div>

// Interactive States
<button className="hover:bg-primary">Hover effect</button>
<button className="hover:bg-hover">Hover state</button>
<input className="focus:border-primary" />
<input className="focus:ring-primary" />

// Font Utilities
<h1 className="font-heading">Uses heading font</h1>
<p className="font-body">Uses body font</p>

// Border Radius
<div className="rounded-theme">Base radius</div>
<div className="rounded-theme-sm">Small radius</div>
<div className="rounded-theme-lg">Large radius</div>

// Shadows
<div className="shadow-theme">Base shadow</div>
<div className="shadow-theme-sm">Small shadow</div>
<div className="shadow-theme-lg">Large shadow</div>
```

## Complete Example

```json
{
  "meta": {
    "title": "My Styled App"
  },
  "fonts": [
    {
      "name": "Inter",
      "src": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
    },
    {
      "name": "Space Grotesk",
      "src": "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap"
    }
  ],
  "theme": {
    "defaultColorScheme": "light",
    "colors": {
      "primary": "#3b82f6",
      "secondary": "#8b5cf6",
      "accent": "#10b981"
    },
    "typography": {
      "fontFamily": "'Inter', system-ui, sans-serif",
      "headings": {
        "fontFamily": "'Space Grotesk', sans-serif",
        "fontWeight": "600"
      },
      "body": {
        "fontSize": "16px",
        "lineHeight": "1.6"
      }
    },
    "spacing": {
      "containerMaxWidth": "1200px",
      "sectionPadding": "4rem"
    },
    "borders": {
      "radius": {
        "base": "0.75rem"
      }
    },
    "shadows": {
      "base": "0 4px 12px rgba(0, 0, 0, 0.1)"
    },
    "animations": {
      "duration": {
        "base": "250ms"
      }
    },
    "darkMode": {
      "colors": {
        "primary": "#60a5fa",
        "background": "#0f172a",
        "surface": "#1e293b",
        "text": "#f8fafc"
      }
    }
  },
  "components": [
    {
      "component": "Hero",
      "attributes": {
        "title": "Beautiful Design",
        "className": "bg-primary text-white"
      }
    }
  ]
}
```

## API Reference

### Font Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Font family name (used for class generation) |
| `src` | string | Yes | URL or path to font file/stylesheet |
| `weight` | string | No | Font weight (default: "400") |
| `style` | string | No | Font style (default: "normal") |
| `display` | string | No | Font-display value (default: "swap") |
| `fallback` | string | No | Fallback font stack |

### Theme Object

| Property | Type | Description |
|----------|------|-------------|
| `defaultColorScheme` | string | "light" or "dark" (default: "light") |
| `colors` | object | Color palette (primary, secondary, background, text, etc.) |
| `typography` | object | Font settings (fontFamily, headings, body) |
| `spacing` | object | Layout spacing (containerMaxWidth, padding, etc.) |
| `borders` | object | Border styles (radius, width) |
| `shadows` | object | Shadow definitions |
| `animations` | object | Animation timing (duration, easing) |
| `backgrounds` | object | Custom background styles (gradients, patterns) |
| `darkMode` | object | Dark mode color overrides |

### Colors Object

| Property | Type | Description |
|----------|------|-------------|
| `primary` | string or object | Primary brand color (hex string or Tailwind palette) |
| `secondary` | string or object | Secondary brand color (hex string or Tailwind palette) |
| `accent` | string or object | Accent color (hex string or Tailwind palette) |
| `background` | string | Page background color |
| `surface` | string | Card/surface background |
| `text` | string | Primary text color |
| `textSecondary` | string | Secondary text color |
| `textMuted` | string | Muted/disabled text |
| `border` | string | Border color |
| `borderLight` | string | Light border color |
| `success` | string | Success state color |
| `warning` | string | Warning state color |
| `error` | string | Error state color |
| `info` | string | Info state color |
| `hover` | string | Hover state background |
| `focus` | string | Focus state color |
| `active` | string | Active state color |

**Note:** Core colors (`primary`, `secondary`, `accent`) can be either:
- Simple hex string: `"#3b82f6"` (base class only: `bg-primary`)
- Tailwind-style palette object: `{ "50": "#eff6ff", "500": "#3b82f6", "900": "#1e3a8a" }` (enables shade classes: `bg-primary-600`)

When using palette objects, the framework extracts the `500` shade (or `600` as fallback) for the base CSS variable.

### Typography Object

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `fontFamily` | string | "'Inter', system-ui, sans-serif" | Base font family |
| `headings.fontFamily` | string | Same as fontFamily | Heading font family |
| `headings.fontWeight` | string | "600" | Heading font weight |
| `headings.lineHeight` | string | "1.2" | Heading line height |
| `headings.sizes` | object | See below | H1-H6 sizes |
| `body.fontSize` | string | "16px" | Body font size |
| `body.lineHeight` | string | "1.6" | Body line height |
| `body.fontWeight` | string | "400" | Body font weight |

**Default heading sizes:**
- h1: 2.5rem
- h2: 2rem
- h3: 1.75rem
- h4: 1.5rem
- h5: 1.25rem
- h6: 1rem

## Generated CSS Variables

The framework converts your theme to CSS variables:

```css
/* Colors */
--color-primary: #6366f1;
--color-secondary: #8b5cf6;
--color-background: #ffffff;
--color-surface: #f8fafc;
--color-text: #1e293b;
--color-textSecondary: #64748b;
--color-textMuted: #94a3b8;
--color-border: #e2e8f0;
--color-success: #10b981;
--color-warning: #f59e0b;
--color-error: #ef4444;
--color-info: #3b82f6;
--color-hover: #f1f5f9;
--color-focus: #ddd6fe;
--color-active: #e7e5e4;

/* Typography */
--font-family: 'Inter', system-ui, sans-serif;
--font-heading: 'Inter', system-ui, sans-serif;
--font-weight-heading: 600;
--line-height-heading: 1.2;
--font-size-body: 16px;
--line-height-body: 1.6;
--font-weight-body: 400;

/* Spacing */
--spacing-containerMaxWidth: 1280px;
--spacing-containerPadding: 1rem;
--spacing-sectionPadding: 5rem;
--spacing-cardPadding: 1.5rem;

/* Borders */
--radius-none: 0;
--radius-sm: 0.25rem;
--radius-base: 0.5rem;
--radius-md: 0.75rem;
--radius-lg: 1rem;
--radius-xl: 1.5rem;
--radius-2xl: 2rem;
--radius-full: 9999px;
--border-thin: 1px;
--border-base: 2px;
--border-thick: 3px;

/* Shadows */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-base: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06);
--shadow-md: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
--shadow-lg: 0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04);
--shadow-xl: 0 25px 50px rgba(0, 0, 0, 0.15);
--shadow-2xl: 0 50px 100px rgba(0, 0, 0, 0.25);

/* Backgrounds (if defined) */
--background-gradient-primary: linear-gradient(...);
```

## Best Practices

### When to Use Theme Classes vs Arbitrary Values

The framework supports **both** theme-based classes and runtime arbitrary Tailwind values. Choose wisely:

#### ✅ Use Theme Classes (Recommended)

**For brand colors, fonts, and reusable design tokens:**

```jsx
// ✅ BEST - Uses theme, easy to update globally
<div className="bg-primary text-white font-heading">
<button className="bg-secondary hover:bg-secondary/90">
```

**Benefits:**
- One place to update (theme.json)
- Consistent across all pages
- Smaller bundle size
- Better performance (CSS variables)
- Works with theme switcher

#### ✅ Use Arbitrary Values (When Needed)

**For one-off designs, custom shadows, specific hex values:**

```jsx
// ✅ GOOD - Specific design requirement
<div className="bg-[#0a0a0a] shadow-[0_0_30px_rgba(239,68,68,0.3)]">
<div className="w-[500px] max-w-[1200px]">
```

**When to use:**
- One-off custom colors not in theme
- Complex shadow effects
- Specific pixel-perfect sizes
- Prototyping before adding to theme
- Third-party design specs (client provides exact hex)

**Important:** The framework generates CSS for arbitrary values at runtime, so they work seamlessly!

### Font Usage Guide

```jsx
// ✅ BEST - Use theme utility class
<h1 className="font-heading">Heading</h1>
<p className="font-body">Body text</p>

// ✅ GOOD - Use generated font class
<h1 className="font-jetbrains-mono">Monospace heading</h1>

// ⚠️ WORKS - Arbitrary font (use only if not in fonts.json)
<h1 className="font-['CustomFont']">Custom font</h1>

// ❌ WRONG - Invalid Tailwind syntax
<h1 className="font-['Font_With_Underscores']">Won't work</h1>
// Use font-heading or font-custom-font instead
```

**Note:** If you must use arbitrary font values, use spaces not underscores: `font-['JetBrains Mono']`. But it's better to add the font to `fonts.json` and use the generated utility class.

### Color Strategy

```jsx
// ✅ Theme colors (for brand)
<button className="bg-primary hover:bg-primary/90">

// ✅ Tailwind colors (for specific shades)
<div className="bg-slate-900 text-slate-100">

// ✅ Arbitrary colors (for one-offs)
<div className="bg-[#0a0a0a] text-[#ef4444]">

// ❌ Mix of approaches (inconsistent)
<div className="bg-primary">
  <div className="bg-[#6366f1]"> // Same color, different approach
```

**Pick ONE strategy per component for consistency.**

### Accessing Theme Values in JavaScript

```jsx
// ❌ DOESN'T EXIST - no app.getTheme() API
const color = app.getTheme().colors.primary;

// ✅ CORRECT - Read from CSS variables
const primaryColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--color-primary').trim();

// ✅ BETTER - Use CSS classes, avoid JS when possible
<div className="bg-primary" />
```

**Philosophy:** JasonJS is CSS-first. Use `className` for styling, not JavaScript.

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Put `fonts` inside `settings/theme.json` | Use `settings/fonts.json` for fonts, `settings/theme.json` for theme |
| `"fonts": { "Inter": "url..." }` | `"fonts": [{ "name": "Inter", "src": "url..." }]` or `{ "key": { "name": "Inter", "src": "..." } }` |
| Forget to set `typography.fontFamily` | Set `fontFamily` to match font name: `"'Inter', sans-serif"` |
| Hard-code colors in components | Use CSS variables: `var(--color-primary)` or theme classes |
| `className="bg-#6366f1"` | `className="bg-primary"` or `className="bg-[#6366f1]"` |
| Provide incomplete color palette | Provide at least `primary` and `secondary`, rest auto-generates |
| Use generic class names | Use generated classes: `.font-inter`, `.font-space-grotesk` |
| Missing quotes in fontFamily | `"fontFamily": "'Inter', sans-serif"` (note the single quotes) |
| Forget darkMode overrides | Define `darkMode.colors` for theme toggle support |
| Use Tailwind palette for non-core colors | Only `primary`, `secondary`, `accent` support palette objects |
| `bg-primary-600` with simple hex color | Provide full palette object to use shade classes, or use `bg-primary` |
| Expect page theme to deep-merge | Page `theme` completely replaces site `theme`, doesn't deep merge |
| Use `fontWeight: "700"` expecting it's the default | Default heading fontWeight is `"600"` |
| `font-['Font_Name_With_Underscores']` | Use `font-heading` or add to fonts.json and use generated class |
| Try to access theme via `app.getTheme()` | Use CSS variables: `getComputedStyle()` or just use `className` |
| Mix theme classes and arbitrary values randomly | Choose one strategy per component for consistency |

## Related

- `skill:page` - Page JSON structure
- `skill:component` - Using theme in components
- `skill:scripts` - Adding analytics and external scripts
