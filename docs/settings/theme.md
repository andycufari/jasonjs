# Theme

Two colors in, complete design system out.

## Quick Start

**Minimal theme (just two colors):**

```json
{
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#6366f1"
  }
}
```

**That's it.** Auto-generates: backgrounds, text colors, borders, hover states, dark mode, accessibility-compliant contrasts.

---

## Where to Configure

**Create `settings/theme.json`:**

```json
{
  "defaultColorScheme": "light",
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#6366f1"
  },
  "typography": {
    "fontFamily": "'Inter', system-ui, sans-serif"
  }
}
```

Restart dev server to see changes.

---

## Theme Class Application

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

---

## Using Theme in Components

**Utility classes (Tailwind-style):**

```json
{
  "component": "div",
  "className": "bg-primary text-white p-4 rounded-theme shadow-theme"
}
```

**CSS variables:**

```css
.custom-element {
  background: var(--color-primary);
  color: var(--color-text);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-base);
}
```

---

## Auto-Generated Classes

**Colors:**
- `bg-primary`, `bg-secondary`, `bg-accent`, `bg-surface`
- `text-primary`, `text-secondary`, `text-muted`
- `border-primary`, `border-base`, `border-light`

**States:**
- `hover:bg-primary`, `hover:bg-secondary`, `hover:bg-hover`
- `focus:border-primary`, `focus:ring-primary`

**Theme utilities:**
- `rounded-theme`, `rounded-theme-sm`, `rounded-theme-lg`
- `shadow-theme`, `shadow-theme-sm`, `shadow-theme-lg`
- `font-body`, `font-heading`

---

## Configuration Options

### Colors

```json
{
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#6366f1",
    "accent": "#10b981"
  }
}
```

**Auto-generates:**
- Background, surface, text colors
- Border colors (light and base)
- Semantic colors (success, warning, error, info)
- Interactive states (hover, focus, active)

| Color | Purpose | Auto-Generated |
|-------|---------|----------------|
| `primary` | Main brand color | Required |
| `secondary` | Secondary brand | Required |
| `accent` | Accent highlights | Optional |
| `background` | Page background | Yes |
| `surface` | Card/panel background | Yes |
| `text` | Primary text | Yes |
| `success` | Success states | Yes |
| `error` | Error states | Yes |

### Color Palettes (Tailwind-style)

You can provide a full color palette for `primary`, `secondary`, and `accent` to enable shade classes:

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
    "secondary": "#6366f1"
  }
}
```

**When you provide a full palette, shade classes ARE generated:**

```jsx
// Works when you provide palette objects
<div className="bg-primary-600 text-primary-50">
<div className="hover:bg-primary-700">
<div className="from-primary-500 to-primary-700">
```

**Important:**
- Only `primary`, `secondary`, and `accent` support palette objects
- Other colors must be simple hex strings
- If you only provide a hex string, shade classes won't work

### Typography

```json
{
  "typography": {
    "fontFamily": "'Inter', system-ui, sans-serif",
    "headings": {
      "fontFamily": "'Poppins', sans-serif",
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

| Option | Default | Description |
|--------|---------|-------------|
| `fontFamily` | `'Inter', system-ui` | Body font |
| `headings.fontFamily` | Same as body | Heading font |
| `headings.fontWeight` | `600` | Heading weight |
| `body.fontSize` | `16px` | Base font size |
| `body.lineHeight` | `1.6` | Body line height |

**Note:** Default heading fontWeight is `"600"`, not `"700"`.

### Spacing

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

### Borders & Radius

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

### Shadows

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

### Animations

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

---

## Dark Mode

**Auto-detected by default.** System checks primary color brightness and generates appropriate scheme.

**Explicit dark mode:**

```json
{
  "defaultColorScheme": "dark",
  "colors": {
    "primary": "#818cf8",
    "secondary": "#a78bfa"
  }
}
```

**Custom dark mode colors:**

```json
{
  "defaultColorScheme": "light",
  "colors": {
    "primary": "#6366f1"
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

---

## Custom Backgrounds

**Named backgrounds for patterns and gradients:**

```json
{
  "backgrounds": {
    "hero": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "pattern": "url(/images/pattern.png) repeat",
    "noise": "url(/textures/noise.png) repeat"
  }
}
```

**Use anywhere:**

```json
{
  "component": "div",
  "className": "bg-hero min-h-screen"
}
```

**Or in CSS:**

```css
.header {
  background: var(--background-hero);
}
```

**Set page-wide background:**

```json
{
  "typography": {
    "body": {
      "background": "url(/pattern.png) repeat"
    }
  }
}
```

---

## Complete Example

```json
{
  "defaultColorScheme": "light",
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#1e40af",
    "accent": "#10b981"
  },
  "backgrounds": {
    "hero": "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
  },
  "typography": {
    "fontFamily": "'Inter', system-ui, sans-serif",
    "headings": {
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
      "base": "0.5rem",
      "lg": "1rem"
    }
  },
  "shadows": {
    "base": "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)",
    "lg": "0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)"
  },
  "animations": {
    "duration": {
      "base": "250ms"
    }
  }
}
```

---

## All CSS Variables

**Colors:**
- `--color-primary`, `--color-secondary`, `--color-accent`
- `--color-background`, `--color-surface`, `--color-text`
- `--color-textSecondary`, `--color-textMuted`
- `--color-border`, `--color-borderLight`
- `--color-success`, `--color-warning`, `--color-error`, `--color-info`
- `--color-hover`, `--color-focus`, `--color-active`

**Backgrounds:**
- `--background-{name}` (from your custom backgrounds)

**Typography:**
- `--font-family`, `--font-heading`
- `--font-weight-heading`, `--font-weight-body`
- `--font-size-body`, `--line-height-body`

**Spacing:**
- `--spacing-containerMaxWidth`, `--spacing-containerPadding`
- `--spacing-sectionPadding`, `--spacing-cardPadding`

**Borders:**
- `--radius-none`, `--radius-sm`, `--radius-base`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-full`
- `--border-thin`, `--border-base`, `--border-thick`

**Shadows:**
- `--shadow-xs`, `--shadow-sm`, `--shadow-base`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`, `--shadow-2xl`

---

## Using Color Shades in Components

Theme classes (`bg-primary`, `text-secondary`) use your brand colors. For specific shades:

**Option 1: Provide full palette (enables shade classes)**

```json
// settings/theme.json
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
// Now shade classes work!
<button className="bg-primary-600 hover:bg-primary-700">
<div className="text-primary-100 bg-primary-900">
```

**Option 2: Use Tailwind built-in colors**

```jsx
// Theme colors (your brand)
<button className="bg-primary text-white">

// Tailwind built-in (for shades)
<button className="bg-blue-600 hover:bg-blue-700">
<div className="bg-gradient-to-r from-sky-500 to-indigo-600">
```

**Match your theme to Tailwind colors:**
| Theme primary | Use Tailwind |
|--------------|--------------|
| `#0ea5e9` | `sky-*` |
| `#3b82f6` | `blue-*` |
| `#6366f1` | `indigo-*` |
| `#8b5cf6` | `violet-*` |
| `#10b981` | `emerald-*` |

---

## Common Patterns

### SaaS Platform

```json
{
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#1e40af"
  },
  "typography": {
    "fontFamily": "'Inter', sans-serif",
    "headings": {
      "fontWeight": "600"
    }
  },
  "spacing": {
    "containerMaxWidth": "1200px"
  }
}
```

### Creative Agency

```json
{
  "colors": {
    "primary": "#ec4899",
    "secondary": "#be185d"
  },
  "typography": {
    "fontFamily": "'Poppins', sans-serif",
    "headings": {
      "fontFamily": "'Playfair Display', serif",
      "fontWeight": "700"
    }
  },
  "borders": {
    "radius": {
      "base": "2rem",
      "lg": "3rem"
    }
  }
}
```

### Fintech App

```json
{
  "colors": {
    "primary": "#059669",
    "secondary": "#047857"
  },
  "typography": {
    "fontFamily": "'IBM Plex Sans', sans-serif"
  },
  "borders": {
    "radius": {
      "base": "0.25rem"
    }
  }
}
```

---

## Best Practices

### 1. Start Minimal

```json
// Don't start with 50 color definitions
{
  "colors": {
    "primary": "#3b82f6",
    "primaryLight": "#60a5fa",
    "primaryDark": "#2563eb"
    // ... 47 more colors
  }
}

// Start with 2-3, let system generate the rest
{
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#6366f1"
  }
}
```

### 2. Use Theme Classes

```json
// Hardcoded colors
{ "className": "bg-blue-500 text-white" }

// Theme-aware
{ "className": "bg-primary text-white" }
```

### 3. Font Fallbacks

```json
// No fallbacks
{ "fontFamily": "'Inter'" }

// Proper fallbacks
{ "fontFamily": "'Inter', system-ui, sans-serif" }
```

### 4. Consistent Naming

```json
// Use semantic names
{
  "backgrounds": {
    "hero": "linear-gradient(...)",
    "pattern": "url(...)",
    "noise": "url(...)"
  }
}
```

---

## Summary

**Minimal theme:**
```json
{
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#6366f1"
  }
}
```

**Complete design system auto-generated:**
- Backgrounds, text, borders
- Hover states and interactions
- Dark mode
- Accessibility-compliant contrasts
- CSS variables + utility classes

> **Tip:** Start with just primary and secondary colors. Override specific colors only when needed.
