# Custom CSS

**CSS that Tailwind can't express lives in `css/global.css`.** One file,
applied to every page on your site. That's the entire system.

Use it for keyframes, `::selection`, `@font-face`, `::before`/`::after`,
print styles, complex gradients, and anything else you can't do with a
Tailwind className.

For layout, spacing, colors, and typography — keep using Tailwind classes.
That's what they're for.

---

## The 90% case

Create `css/global.css`:

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}

.glow {
  animation: pulse 2s ease-in-out infinite;
  text-shadow: 0 0 10px #00ff00;
}

::selection {
  background: #00ff00;
  color: #000;
}
```

Use it in any component:

```jsx
<h1 className="glow">Hola</h1>
```

Save, reload the page, done. No imports, no config, no JSON wrapper.

---

## What goes where

| Styling need | Where |
|---|---|
| Layout, spacing, colors, typography, responsive breakpoints | Tailwind `className` |
| Theme colors, fonts | `settings/theme.json` |
| Keyframes, `::selection`, `@font-face`, `::before`/`::after` | `css/global.css` |
| Print styles, complex gradients, scoped overrides | `css/global.css` |

If you find yourself duplicating a Tailwind utility in `global.css`, stop.
Use the Tailwind class instead.

---

## Load order

`global.css` is injected **after** the framework's theme styles, so your
rules can override the theme if you mean to:

```
1. Framework base styles (Tailwind)
2. Theme styles (from settings/theme.json)
3. css/global.css  ← your CSS lands here, wins ties
```

You'll find it in the rendered HTML as:

```html
<style data-jason-css="global">...</style>
```

Useful for filtering in devtools when debugging.

---

## Limits

- **100KB maximum.** The file is inlined on every response, so larger files
  hurt first-paint for every visitor. If you're approaching this, you're
  probably duplicating Tailwind or shipping unused rules.
- **No `@import`.** `@import` statements are stripped on load. JasonJS reads
  exactly this one file — anything pulled in via `@import` would bypass
  review. Inline what you need.
- **No Sass, Less, or PostCSS.** Plain CSS only. Use native CSS nesting and
  custom properties (`--brand: #00ff00`) if you need variables.
- **No component-scoped files.** No `css/Hero.css`. Use Tailwind class
  names or prefix your own classes (`.hero-grid`, `.hero-title`) for
  per-component styling.

---

## Troubleshooting

**My CSS isn't applying.**

1. Hard reload. Your browser may be caching the old HTML.
2. Check specificity — Tailwind utilities are low-specificity, but your
   theme may set more specific rules. Add a more specific selector, or
   use `!important` as a last resort.
3. Open devtools, search for `<style data-jason-css="global">`. If it's
   missing, the file doesn't exist or failed validation (check server
   logs for `@import` strips or the 100KB warning).

**My `@import` lines disappeared.**

They were stripped for security. Inline the imported CSS directly into
`global.css`, or host it yourself and add the rules inline.

**I need per-component CSS.**

Prefix your class names:

```css
.hero-grid { display: grid; grid-template-columns: 1fr 2fr; }
.hero-title { font-variant: small-caps; }
```

And use them only inside that component. The global namespace is a feature —
it keeps the model simple.
