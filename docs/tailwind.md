# Runtime Tailwind CSS System

## Overview

The JasonJS Framework includes a **runtime Tailwind CSS generation system** that dynamically generates CSS for arbitrary Tailwind classes used in database-loaded components. This ensures that classes like `bg-[#0a0a0a]`, `w-[500px]`, and `hover:bg-[#dc2626]` work correctly even when the component code is loaded from the database at runtime.

## The Problem

Traditional Tailwind CSS requires all classes to be known at build time so they can be included in the compiled CSS. However, JasonJS components are:
1. Stored in the database
2. Loaded at runtime
3. May use arbitrary Tailwind values unknown at build time

Without runtime CSS generation, these arbitrary values would have no corresponding CSS rules and styles would fail silently.

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ SERVER SIDE (bundler.js)                                    │
│                                                              │
│ 1. Load component code from database                        │
│ 2. extractTailwindClasses(code) → Extract class names       │
│ 3. generateDynamicCSS(classes) → Generate CSS rules         │
│ 4. Store in bundle.dynamicCSS                               │
│                                                              │
│ bundle = {                                                   │
│   code: "...",                                               │
│   dynamicCSS: ".bg-\\[\\#000\\] { background-color: #000; }"│
│   hash: "abc123"                                             │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
                     (sent to client)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ CLIENT SIDE (DynamicComponentLoader.jsx)                    │
│                                                              │
│ 1. Receive bundle from server                               │
│ 2. useEffect: Inject bundle.dynamicCSS into <head>          │
│    - Create <style id="dynamic-css-{name}-{hash}">          │
│    - Append to document.head                                │
│ 3. Execute component code in sandbox                        │
│ 4. Render component with styles applied                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. `tailwindClassExtractor.js`
**Location**: `/core/render/components/tailwindClassExtractor.js`

**Purpose**: Server-side extraction and CSS generation

**Functions**:
- `extractTailwindClasses(code)` - Extracts all Tailwind classes from JSX code
- `generateCSSForClass(className)` - Generates CSS rule for a single class
- `generateDynamicCSS(classes)` - Generates CSS for all classes
- `extractAndGenerateCSS(code)` - Main entry point

**Example**:
```javascript
const code = '<div className="bg-[#0a0a0a] text-[#ef4444]">Hello</div>';
const css = extractAndGenerateCSS(code);
// Returns:
// .bg-\[\#0a0a0a\] { background-color: #0a0a0a; }
// .text-\[\#ef4444\] { color: #ef4444; }
```

#### 2. `DynamicComponentLoader.jsx`
**Location**: `/components/system/DynamicComponentLoader.jsx`

**Purpose**: Client-side CSS injection

**Key Code**:
```javascript
useEffect(() => {
  if (!bundle?.dynamicCSS) return;

  const styleId = `dynamic-css-${name}-${bundle.hash}`;
  if (document.getElementById(styleId)) return; // Already injected

  const styleTag = document.createElement('style');
  styleTag.id = styleId;
  styleTag.textContent = bundle.dynamicCSS;
  document.head.appendChild(styleTag);

  return () => {
    document.getElementById(styleId)?.remove(); // Cleanup
  };
}, [bundle?.dynamicCSS, bundle?.hash, name]);
```

## Supported Patterns

### ✅ Arbitrary Colors
```jsx
<div className="bg-[#0a0a0a]">Dark background</div>
<div className="text-[#ef4444]">Red text</div>
<div className="border-[rgb(255,0,0)]">RGB border</div>
```

### ✅ Hover/Focus States
```jsx
<button className="bg-[#ef4444] hover:bg-[#dc2626]">
  Hover changes color
</button>
<input className="focus:border-[#3b82f6]" />
```

### ✅ Arbitrary Sizes
```jsx
<div className="w-[500px]">Fixed width</div>
<div className="h-[3rem]">Rem height</div>
<div className="max-w-[1200px]">Max width</div>
```

### ✅ Arbitrary Spacing
```jsx
<div className="p-[20px]">Custom padding</div>
<div className="m-[1rem]">Custom margin</div>
<div className="gap-[2rem]">Custom gap</div>
```

### ✅ Arbitrary Shadows
```jsx
<div className="shadow-[0_0_30px_rgba(239,68,68,0.3)]">
  Red glow
</div>
```

### ✅ Font Families
```jsx
<div className="font-['Inter']">Custom font</div>
```

### ✅ Grid Layouts
```jsx
<div className="grid-cols-[repeat(3,1fr)]">
  Three columns
</div>
```

### ✅ Semantic Theme Classes (shadcn/ui)

The runtime system generates CSS for shadcn/ui semantic classes that reference HSL CSS variables from the theme system (`globals.css` + `getTheme.js`):

```jsx
// Background and text
<div className="bg-background text-foreground">Theme-aware</div>
<div className="bg-card text-card-foreground">Card styling</div>
<div className="bg-muted text-muted-foreground">Muted content</div>

// Primary, secondary, accent, destructive
<button className="bg-primary text-primary-foreground">Primary</button>
<button className="bg-secondary text-secondary-foreground">Secondary</button>
<span className="text-destructive">Error text</span>

// Borders and rings
<input className="border-border ring-ring" />
<input className="border-input" />
```

**Supported semantic tokens:**
- **Background**: `bg-background`, `bg-foreground`, `bg-card`, `bg-popover`, `bg-primary`, `bg-secondary`, `bg-muted`, `bg-accent`, `bg-destructive`
- **Text**: `text-foreground`, `text-card-foreground`, `text-popover-foreground`, `text-primary-foreground`, `text-secondary-foreground`, `text-muted-foreground`, `text-accent-foreground`, `text-destructive`, `text-destructive-foreground`
- **Border**: `border-border`, `border-input`, `border-primary`, `border-secondary`, `border-destructive`, `border-muted`, `border-accent`
- **Ring**: `ring-ring`, `ring-primary`, `ring-destructive`

These work with variants and opacity modifiers:
```jsx
<button className="hover:bg-muted focus:border-input">Variants</button>
<div className="bg-primary/90 text-muted-foreground/50">Opacity</div>
```

## Limitations

### ❌ Complex Variants
Some complex variant combinations may not generate correctly:
```jsx
// May not work
<div className="md:hover:bg-[#000]">Multiple variants</div>

// Workaround: Use standard Tailwind classes
<div className="md:hover:bg-black">Standard class</div>
```

### ❌ Arbitrary @apply
Cannot use `@apply` with arbitrary values:
```css
/* Won't work */
.my-class {
  @apply bg-[#000];
}
```

### ❌ Dynamic Class Names
Classes generated from JavaScript won't be detected:
```jsx
// Won't work - class name is dynamic
const color = '#ff0000';
<div className={`bg-[${color}]`}>Text</div>

// Workaround: Use inline styles
<div style={{ backgroundColor: color }}>Text</div>
```

## Performance

### Server-Side
- CSS generation happens once per component bundle
- Cached with component hash
- Minimal overhead (~5ms for typical component)

### Client-Side
- CSS injected once per component mount
- Uses document fragment for batch insertion
- Cleanup on unmount prevents memory leaks
- Style tags deduplicated by component hash

### Memory
- Each unique component gets one `<style>` tag
- Style tags removed when component unmounts
- Maximum ~1KB per component's dynamic CSS

## Debugging

### Verify CSS Injection

1. **Open DevTools** → Elements → `<head>`
2. Look for `<style id="dynamic-css-{componentName}-{hash}">`
3. Verify CSS rules are present

**Example**:
```html
<style id="dynamic-css-Navbar-abc123">
.bg-\[\#0a0a0a\] { background-color: #0a0a0a; }
.text-\[\#ef4444\] { color: #ef4444; }
</style>
```

### Check Computed Styles

1. **Inspect element** with arbitrary class
2. **Computed tab** should show the generated CSS
3. Example: `bg-[#0a0a0a]` → `background-color: rgb(10, 10, 10)`

### Console Debugging

In development mode, check for logs:
```javascript
// Should see in bundler.js
console.log('Dynamic CSS generated:', bundle.dynamicCSS);

// Should NOT see
console.error('Style injection failed');
```

## Troubleshooting

### Problem: Styles Not Applying

**Check**:
1. Is `bundle.dynamicCSS` present? (DevTools → Network → component response)
2. Is style tag in `<head>`? (DevTools → Elements)
3. Are CSS selectors correctly escaped? (Check style tag content)

**Fix**:
```javascript
// Verify bundle has dynamicCSS
console.log(bundle.dynamicCSS); // Should not be empty

// Verify injection
useEffect(() => {
  console.log('Injecting CSS:', bundle.dynamicCSS);
}, [bundle.dynamicCSS]);
```

### Problem: Wrong Colors/Values

**Cause**: CSS selector escaping issue

**Fix**: Check `escapeSelector` in `tailwindClassExtractor.js`:
```javascript
const escapeSelector = (str) => {
  return str.replace(/[[\]()#/:]/g, '\\$&');
};
```

### Problem: Variants Not Working

**Cause**: Variant not in `pseudoMap`

**Fix**: Add variant to `generateCSSForClass`:
```javascript
const pseudoMap = {
  'hover': ':hover',
  'focus': ':focus',
  'active': ':active',
  'disabled': ':disabled',
  'group-hover': ':hover' // Add new variant
};
```

## Best Practices

### ✅ Do
- Use arbitrary values for one-off custom styles
- Prefer standard Tailwind classes when possible
- Document custom color values in design system
- Test in both light and dark mode

### ❌ Don't
- Don't overuse arbitrary values (hurts maintainability)
- Don't use arbitrary values for common colors (add to theme instead)
- Don't generate class names dynamically from JS
- Don't use complex multi-variant combinations

## Integration with Tailwind

### Build-Time vs Runtime

**Build-Time (Tailwind CLI)**:
- Processes all JSX files in `/components`, `/app`, etc.
- Generates static CSS file
- Handles standard Tailwind classes

**Runtime (This System)**:
- Processes database-loaded components
- Generates dynamic CSS on-the-fly
- Handles arbitrary values and semantic theme classes

**Both systems work together** - no conflicts.

### Safelist

The framework maintains a safelist of common classes at build time:
```javascript
// tailwind.config.js
safelist: [
  'bg-black', 'bg-white', 'bg-gray-900',
  'text-red-500', 'text-blue-500',
  // ... common classes
]
```

This ensures common classes are always available, reducing runtime generation overhead.

## Future Improvements

### Planned Features
- [ ] Support for complex multi-variant combinations
- [ ] Better error messages for unsupported patterns
- [ ] CSS minification for production
- [ ] Preload hints for critical dynamic CSS
- [ ] Dev tools panel showing generated CSS

### Potential Optimizations
- [ ] Batch CSS generation across multiple components
- [ ] Shared style tag for common arbitrary values
- [ ] CSS caching in localStorage
- [ ] Service worker caching for dynamic CSS

## Related Documentation

- [Components](./components/index.md)

## Support

For issues or questions:
1. Check DevTools for style tag injection
2. Verify bundle.dynamicCSS content
3. Test with simple arbitrary value first
4. Report issue with minimal reproduction

---

**Last Updated**: 2026-02-11
**System Version**: Dynamic Component System v2.0
