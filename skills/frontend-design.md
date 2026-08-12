# JasonJS Frontend Design Skill

> Create distinctive, production-grade user components with high design quality.
> Use this skill when building visual components, pages, or interfaces for JasonJS.
> Generates creative, polished code that avoids generic AI aesthetics — within the sandbox.

---

## Design Thinking

Before coding, understand the context and commit to a **bold aesthetic direction**:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick a direction and commit — brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian. Use these as inspiration but design something true to the chosen aesthetic.
- **Constraints**: JasonJS sandbox (React + Tailwind + framer-motion + shadcn/ui + lucide icons). No external font loading, no raw DOM, no arbitrary CSS imports.
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

---

## Sandbox-Aware Aesthetics

Everything below must work within JasonJS user component constraints. See `user-component-agent.md` for the full sandbox reference.

### Typography

You cannot load external fonts via `<link>` or `@import` (no DOM access). Work with what's available:

- **Tailwind's font families**: `font-sans`, `font-serif`, `font-mono`
- **Arbitrary font stacks**: `font-[Georgia,serif]`, `font-['Courier_New',monospace]`
- **System font variety**: Use serif vs sans vs mono contrast deliberately. A `font-serif` heading with `font-mono` labels and `font-sans` body creates typographic tension without external fonts.
- **Scale and weight as personality**: `text-8xl font-black tracking-tighter` feels completely different from `text-sm font-light tracking-[0.3em] uppercase`. Typography is more than font-face — it's size, weight, spacing, case, and line-height working together.

```jsx
// ✅ Typographic contrast without external fonts
<h1 className="font-serif text-6xl font-black tracking-tight leading-none">
  Bold Statement
</h1>
<p className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground">
  Subtle detail
</p>
```

### Color & Theme

Commit to a cohesive palette. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.

- **Tailwind color classes** are fully supported: `bg-emerald-950`, `text-amber-400`, `border-rose-500/30`
- **Arbitrary hex/rgb**: `bg-[#0f0c29]`, `text-[rgb(255,200,100)]`
- **Opacity modifiers**: `bg-black/80`, `text-white/60`
- **CSS variables via arbitrary values**: `bg-[hsl(var(--primary))]`
- **Gradients**: `bg-gradient-to-br from-indigo-950 via-purple-900 to-black`

```jsx
// ✅ Atmospheric dark section with gradient
<section className="bg-gradient-to-br from-slate-950 via-indigo-950 to-black text-white min-h-screen">
  <h2 className="text-amber-400 text-5xl font-bold">Golden accent on deep dark</h2>
  <p className="text-white/60">Muted body copy</p>
</section>
```

**CRITICAL**: On dark backgrounds, set `text-white` (or explicit color) on EVERY text element. Tailwind classes on parent containers cascade, but inline `style={{ color }}` does NOT reliably inherit to child headings. See the styling guidelines in `user-component-agent.md`.

### Motion & Animation

Use **framer-motion** (whitelisted) for all animation. CSS `@keyframes` cannot be injected — use Tailwind's built-in animations (`animate-spin`, `animate-pulse`, `animate-bounce`) or framer-motion for custom work.

Focus on **high-impact moments**: one well-orchestrated entrance sequence with staggered reveals creates more delight than scattered micro-interactions.

```jsx
import { motion, AnimatePresence } from 'framer-motion';

// ✅ Staggered entrance — high impact, low code
const container = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

<motion.div variants={container} initial="hidden" animate="visible">
  {items.map((i) => (
    <motion.div key={i._id} variants={item} className="...">
      {i.name}
    </motion.div>
  ))}
</motion.div>
```

```jsx
// ✅ Hover interaction on a card
<motion.div
  whileHover={{ scale: 1.02, y: -4 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
  className="cursor-pointer"
>
  <Card>...</Card>
</motion.div>
```

Advanced: `useMotionValue`, `useTransform`, `useSpring`, `useScroll`, `useInView`, `Reorder`, `LayoutGroup` are all available.

### Spatial Composition

Unexpected layouts create memorable interfaces. Tailwind gives you full control:

- **Asymmetry**: `grid-cols-[2fr_1fr]`, `grid-cols-[1fr_3fr]`
- **Overlap**: `relative`/`absolute` positioning, negative margins (`-mt-12`, `-ml-8`)
- **Diagonal flow**: `rotate-[-3deg]`, `skew-y-2`
- **Grid-breaking elements**: Items that span columns, bleed to edges, or overlap grid lines
- **Generous negative space OR controlled density** — both are valid, pick one

```jsx
// ✅ Asymmetric hero with overlap
<div className="relative grid grid-cols-[1.5fr_1fr] gap-0 min-h-[80vh] items-center">
  <div className="p-16 z-10">
    <h1 className="text-7xl font-black tracking-tight">Break the grid</h1>
  </div>
  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[55%] h-[120%] bg-amber-400 -skew-x-6" />
</div>
```

### Backgrounds & Visual Depth

Create atmosphere without DOM manipulation. All of these work in the sandbox:

- **Gradient meshes**: Stack multiple gradients with `bg-gradient-to-*` + pseudo positioning
- **Arbitrary shadows**: `shadow-[0_0_60px_rgba(99,102,241,0.3)]` for glows
- **Backdrop blur**: `backdrop-blur-xl bg-white/10` for glassmorphism
- **Ring effects**: `ring-1 ring-white/10` for subtle borders
- **Inset shadows**: `shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`

```jsx
// ✅ Glassmorphism card
<div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-[0_0_40px_rgba(99,102,241,0.15)]">
  <h3 className="text-white text-xl font-semibold">Glass card</h3>
</div>
```

---

## What to AVOID

**NEVER** produce generic AI-generated aesthetics:

- Overused defaults: plain white backgrounds with gray text and blue buttons
- Predictable card grids with uniform spacing and no visual hierarchy
- Generic icon + heading + paragraph patterns with no personality
- Timid color palettes — using 5 pastel shades at equal weight
- Unstyled shadcn/ui defaults — these are building blocks, not finished designs. Always customize with Tailwind classes.
- Cookie-cutter layouts that could be any product, any brand, any context

**Interpret creatively.** No two designs should feel the same. Vary between light and dark themes, different typographic personalities, different spatial strategies.

---

## Working Within Constraints

### You HAVE (use them fully)
- **Tailwind CSS** — full utility set including arbitrary values, responsive, dark mode
- **framer-motion** — full animation library including layout animations, drag, reorder
- **shadcn/ui** — Button, Card, Dialog, Sheet, Select, Table, etc. (customize them heavily)
- **lucide-react** — 400+ icons
- **clsx + twMerge** — dynamic class composition
- **react-swipeable** — touch gestures
- **Three.js + R3F** — 3D scenes (Canvas, OrbitControls, etc.)
- **date-fns** — date formatting

### You DON'T HAVE (don't try)
- External font loading (`<link>`, `@import`, `document.createElement`)
- Custom CSS files or `<style>` tags
- CSS `@keyframes` (use Tailwind's built-in or framer-motion)
- DOM manipulation (`document.createElement`, `document.querySelector`)
- `eval()`, `Function()`, WebSocket, Worker
- Any npm package not in the whitelist

### Inline Styles — When Acceptable
Use inline `style={{}}` sparingly for things Tailwind can't express:
- Complex gradients: `style={{ background: 'radial-gradient(circle at 30% 50%, #1a1a2e, #16213e, #0f3460)' }}`
- `clipPath`: `style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}`
- CSS `filter` values: `style={{ filter: 'saturate(1.2) contrast(1.1)' }}`

**But**: always use Tailwind classes for text colors, backgrounds, spacing, and layout. Inline style colors on parent containers do NOT cascade to child headings.

---

## Design + Function

Great design in JasonJS isn't just visual — components must also:

1. **Handle loading, error, and empty states** with the same design care as the happy path
2. **Use the `app` object** for all platform operations (database, auth, events, navigation)
3. **Clean up subscriptions** in useEffect returns
4. **Use `_id`** for MongoDB document IDs
5. **Export default** the component

A loading spinner in a beautifully designed component should feel intentional, not bolted on. An empty state is a design opportunity, not an afterthought.

```jsx
// ✅ Empty state with personality (not just "No items found")
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  className="flex flex-col items-center justify-center py-24 text-center"
>
  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 flex items-center justify-center mb-6">
    <Sparkles className="w-8 h-8 text-amber-500" />
  </div>
  <h3 className="text-xl font-semibold mb-2">Nothing here yet</h3>
  <p className="text-muted-foreground max-w-sm">
    This is where your creations will live. Start building something extraordinary.
  </p>
</motion.div>
```

---

## Remember

Claude is capable of extraordinary creative work within constraints. The JasonJS sandbox is a creative challenge, not a limitation. Tailwind + framer-motion + thoughtful composition can produce interfaces that rival anything built with unlimited tooling.

Don't hold back. Show what can truly be created when committing fully to a distinctive vision.
