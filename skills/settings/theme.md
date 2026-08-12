---
skill: settings/theme
when: "Customizing colors, typography, dark mode"
requires: []
---

# Theme Settings

> Two colors in, complete design system out.

## Quick Start

Create `settings/theme.json`:

```json
{
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#6366f1"
  }
}
```

Auto-generates: backgrounds, text, borders, hover states, dark mode.

## Theme Class Application

The framework wraps your page content in a theme class:

```html
<div class="theme-light">...</div>  <!-- or theme-dark -->
```

This controls which CSS variables are active for theme switching.

## Colors

```json
{
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#6366f1",
    "accent": "#10b981"
  }
}
```

| Color | Required | Description |
|-------|----------|-------------|
| `primary` | Yes | Main brand |
| `secondary` | Yes | Secondary brand |
| `accent` | No | Highlights |

**Auto-generated:** background, surface, text, success, error, borders.

### Color Palettes (for shade classes)

Provide a full palette to enable shade classes like `bg-primary-600`:

```json
{
  "colors": {
    "primary": {
      "50": "#eff6ff",
      "500": "#3b82f6",
      "600": "#2563eb",
      "700": "#1d4ed8",
      "900": "#1e3a8a"
    }
  }
}
```

```jsx
// Now these work!
<div className="bg-primary-600 hover:bg-primary-700">
```

**Only `primary`, `secondary`, `accent` support palette objects.**

## Typography

```json
{
  "typography": {
    "fontFamily": "'Inter', system-ui, sans-serif",
    "headings": {
      "fontFamily": "'Poppins', sans-serif",
      "fontWeight": "600",
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
      "lineHeight": "1.6"
    }
  }
}
```

**Note:** Default heading fontWeight is `"600"`, not `"700"`.

## Dark Mode

**System-detected by default.** Override:

```json
{
  "defaultColorScheme": "dark",
  "colors": {
    "primary": "#818cf8"
  },
  "darkMode": {
    "colors": {
      "background": "#0f172a",
      "surface": "#1e293b",
      "text": "#f8fafc"
    }
  }
}
```

## Custom Backgrounds

```json
{
  "backgrounds": {
    "hero": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "pattern": "url(/images/pattern.png) repeat"
  }
}
```

Use: `className="bg-hero"` or `var(--background-hero)`

## Animations

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

## Using Theme

### Utility Classes

```json
{
  "component": "div",
  "className": "bg-primary text-white rounded-theme shadow-theme"
}
```

**Available:**
- `bg-primary`, `bg-secondary`, `bg-surface`
- `text-primary`, `text-muted`
- `border-primary`, `border-base`
- `rounded-theme`, `rounded-theme-lg`
- `shadow-theme`, `shadow-theme-lg`

### CSS Variables

```css
.custom {
  background: var(--color-primary);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-base);
}
```

## Borders & Shadows

```json
{
  "borders": {
    "radius": {
      "none": "0",
      "sm": "0.25rem",
      "base": "0.5rem",
      "md": "0.75rem",
      "lg": "1rem",
      "full": "9999px"
    }
  },
  "shadows": {
    "xs": "0 1px 2px rgba(0, 0, 0, 0.05)",
    "sm": "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
    "base": "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)",
    "lg": "0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)"
  }
}
```

## Spacing

```json
{
  "spacing": {
    "containerMaxWidth": "1280px",
    "sectionPadding": "5rem",
    "cardPadding": "1.5rem"
  }
}
```

## Complete Example

```json
{
  "defaultColorScheme": "light",
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#1e40af"
  },
  "backgrounds": {
    "hero": "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
  },
  "typography": {
    "fontFamily": "'Inter', system-ui, sans-serif",
    "headings": { "fontWeight": "600" }
  },
  "borders": {
    "radius": { "base": "0.5rem" }
  },
  "animations": {
    "duration": { "base": "250ms" }
  }
}
```

## CSS Variables Reference

| Variable | Description |
|----------|-------------|
| `--color-primary` | Primary color |
| `--color-secondary` | Secondary color |
| `--color-background` | Page background |
| `--color-surface` | Card background |
| `--color-text` | Primary text |
| `--color-textMuted` | Secondary text |
| `--font-family` | Body font |
| `--font-heading` | Heading font |
| `--radius-base` | Default radius |
| `--shadow-base` | Default shadow |

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Put `fonts` in theme.json | Use separate `settings/fonts.json` for fonts |
| Wrap content in `{ "theme": {...} }` | Put theme properties directly at root |
| Use `className="bg-primary-600"` with hex color | Provide palette object OR use Tailwind built-in like `bg-blue-600` |
| Define 50 colors | Start with 2-3, auto-generate rest |
| No font fallbacks | Include: `system-ui, sans-serif` |
| Expect page theme to merge | Page `theme` completely replaces site `theme` |
| Use `fontWeight: "700"` expecting default | Default heading fontWeight is `"600"` |

## Using Color Shades in Components

Theme classes (`bg-primary`, `text-secondary`) use your brand colors. For specific shades:

**Option 1: Provide full palette**
```json
{
  "colors": {
    "primary": { "500": "#3b82f6", "600": "#2563eb", "700": "#1d4ed8" }
  }
}
```
```jsx
<button className="bg-primary-600 hover:bg-primary-700">
```

**Option 2: Use Tailwind built-in colors**
```jsx
<button className="bg-primary text-white">  // Theme color
<button className="bg-blue-600 hover:bg-blue-700">  // Tailwind shade
```

**Match your theme to Tailwind colors:**
| Theme primary | Use Tailwind |
|--------------|--------------|
| `#0ea5e9` | `sky-*` |
| `#3b82f6` | `blue-*` |
| `#6366f1` | `indigo-*` |
| `#8b5cf6` | `violet-*` |
| `#10b981` | `emerald-*` |

## Related

- `skill:settings/fonts` - Font configuration (separate file)
- `skill:theming` - Complete theming guide
- `skill:component` - Using theme in components
