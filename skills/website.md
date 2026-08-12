---
skill: website
when: "Building landing pages, marketing sites"
requires: []
---

# Website Components

> Navbar, Hero, Footer, FeatureGrid, Stats, Testimonials - landing page blocks.

## Quick Start

```json
{
  "components": [
    { "component": "@framework/website/Navbar" },
    {
      "component": "@framework/website/Hero",
      "attributes": {
        "headline": "Ship Faster",
        "subheadline": "Build your next idea in hours."
      }
    },
    { "component": "@framework/website/FeatureGrid" },
    { "component": "@framework/website/Footer" }
  ]
}
```

All components work with zero config.

## Navbar

```json
{
  "component": "@framework/website/Navbar",
  "attributes": {
    "logoText": "MyApp",
    "navigation": [
      { "name": "Home", "href": "/" },
      { "name": "Features", "href": "#features" },
      {
        "name": "Products",
        "submenu": [
          { "name": "Widget", "href": "/products/widget" },
          { "name": "Gadget", "href": "/products/gadget" }
        ]
      }
    ],
    "showAuth": true
  }
}
```

| Prop | Default | Description |
|------|---------|-------------|
| `logoText` | "JasonJS" | Text logo |
| `logo` | - | Image URL |
| `navigation` | [] | Nav items |
| `showAuth` | true | Auth buttons |
| `variant` | "default" | "default", "gradient", "glass" |
| `position` | "sticky" | "sticky", "fixed", "relative" |

## Hero

```json
{
  "component": "@framework/website/Hero",
  "attributes": {
    "headline": "Build Something Amazing",
    "subheadline": "The framework that gets out of your way.",
    "ctaText": "Get Started",
    "ctaUrl": "/signup",
    "secondaryCta": "Learn More",
    "secondaryUrl": "#features",
    "features": ["No credit card", "14-day trial", "Cancel anytime"]
  }
}
```

| Prop | Default | Description |
|------|---------|-------------|
| `headline` | "Build Something Amazing" | Main title |
| `subheadline` | auto | Supporting text |
| `ctaText` | "Get Started" | Primary button |
| `ctaUrl` | "/docs" | Primary link |
| `secondaryCta` | "Learn More" | Secondary button |
| `features` | [] | Feature bullets |
| `codeExample` | null | `{ title, code }` |
| `variant` | "default" | "default", "gradient", "minimal" |

## Footer

```json
{
  "component": "@framework/website/Footer",
  "attributes": {
    "logoText": "MyApp",
    "linkGroups": [
      {
        "title": "Product",
        "links": [
          { "name": "Features", "href": "/features" },
          { "name": "Pricing", "href": "/pricing" }
        ]
      }
    ],
    "socialLinks": [
      { "name": "Twitter", "href": "https://twitter.com", "icon": "Twitter" },
      { "name": "GitHub", "href": "https://github.com", "icon": "Github" }
    ],
    "showNewsletter": true
  }
}
```

| Prop | Default | Description |
|------|---------|-------------|
| `logoText` | "JasonJS" | Text logo |
| `linkGroups` | [] | Link columns |
| `socialLinks` | [] | Social icons |
| `showNewsletter` | false | Include newsletter |
| `newsletterDatabase` | "newsletter" | Database for signups |
| `variant` | "default" | "default", "gradient", "dark" |

## FeatureGrid

```json
{
  "component": "@framework/website/FeatureGrid",
  "attributes": {
    "title": "Why Choose Us",
    "features": [
      { "icon": "Zap", "title": "Fast", "description": "Lightning performance" },
      { "icon": "Shield", "title": "Secure", "description": "Enterprise-grade" },
      { "icon": "Code", "title": "Developer First", "description": "Great DX" }
    ]
  }
}
```

| Prop | Default | Description |
|------|---------|-------------|
| `title` | "Everything You Need" | Section title |
| `features` | [] | Feature objects |
| `columns` | 3 | 1, 2, 3, or 4 |
| `variant` | "default" | "default", "gradient", "minimal" |

Feature object:
```javascript
{
  icon: "Zap",       // Lucide name, emoji, or URL
  title: "Fast",
  description: "Lightning performance",
  details: ["Point 1", "Point 2"]  // Optional expandable
}
```

## StatsSection

```json
{
  "component": "@framework/website/StatsSection",
  "attributes": {
    "title": "Trusted Worldwide",
    "stats": [
      { "value": 10000, "suffix": "+", "label": "Users", "icon": "Users" },
      { "value": 99.9, "suffix": "%", "label": "Uptime", "icon": "Activity" },
      { "value": 50, "prefix": "$", "suffix": "M", "label": "Processed" }
    ]
  }
}
```

Numbers animate on scroll. Large numbers auto-format (1000 → 1K).

| Prop | Default | Description |
|------|---------|-------------|
| `title` | "Trusted by Thousands" | Section title |
| `stats` | [] | Stat objects |
| `columns` | 4 | 2, 3, or 4 |
| `animate` | true | Animate numbers |

Stat object:
```javascript
{
  value: 10000,
  label: "Users",
  icon: "Users",     // Optional
  prefix: "$",       // Optional
  suffix: "+"        // Optional
}
```

## TestimonialSection

```json
{
  "component": "@framework/website/TestimonialSection",
  "attributes": {
    "title": "What Customers Say",
    "testimonials": [
      {
        "name": "Sarah Chen",
        "role": "CTO, TechCorp",
        "avatar": "👩‍💼",
        "content": "Shipped our MVP in a weekend.",
        "rating": 5
      }
    ]
  }
}
```

| Prop | Default | Description |
|------|---------|-------------|
| `title` | "What People Are Saying" | Section title |
| `testimonials` | [] | Testimonial objects |
| `columns` | 3 | 1, 2, or 3 |
| `showRatings` | true | Show star ratings |

Testimonial object:
```javascript
{
  name: "Sarah Chen",
  role: "CTO, TechCorp",
  avatar: "👩‍💼",     // Emoji, URL, or initials fallback
  content: "Amazing product!",
  rating: 5          // Optional, 1-5 stars
}
```

## Newsletter

```json
{
  "component": "@framework/website/Newsletter",
  "attributes": {
    "title": "Stay Updated",
    "subtitle": "Weekly tips delivered to your inbox",
    "newsletterDatabase": "subscribers"
  }
}
```

Auto-saves to database and shows toast.

| Prop | Default | Description |
|------|---------|-------------|
| `title` | "Subscribe" | Section title |
| `buttonText` | "Subscribe" | Button text |
| `newsletterDatabase` | "newsletter" | Database name |
| `variant` | "default" | "default", "gradient", "dark" |

## IconWrapper

Universal icon utility for other components:

```json
{ "icon": "Rocket" }     // Lucide icon
{ "icon": "🚀" }         // Emoji
{ "icon": "/icon.svg" }  // Image URL
```

All website components accept icons in this format.

## Complete Landing Page

```json
{
  "components": [
    {
      "component": "@framework/website/Navbar",
      "attributes": {
        "logoText": "Acme",
        "navigation": [
          { "name": "Features", "href": "#features" },
          { "name": "Pricing", "href": "#pricing" }
        ]
      }
    },
    {
      "component": "@framework/website/Hero",
      "attributes": {
        "headline": "Build Faster, Ship Sooner",
        "ctaText": "Start Free",
        "ctaUrl": "/signup"
      }
    },
    {
      "component": "@framework/website/FeatureGrid",
      "attributes": { "id": "features" }
    },
    {
      "component": "@framework/website/StatsSection"
    },
    {
      "component": "@framework/website/TestimonialSection"
    },
    {
      "component": "@framework/website/Footer",
      "attributes": { "showNewsletter": true }
    }
  ]
}
```

## Styling Dark Sections in User Components

The framework's **default theme is light** (`defaultColorScheme: 'light'`) — dark text (`#1e293b`) on white backgrounds. When building custom landing pages with dark backgrounds, **use Tailwind classes instead of inline styles for text color**. The theme sets base text colors that cascade properly with Tailwind but can conflict with inline styles on nested elements.

```jsx
// ✅ CORRECT - Tailwind classes, colors cascade properly
<section className="bg-[#0f0c29] text-white">
  <h2 className="text-2xl font-bold">This heading is white</h2>
  <p className="text-white/60">Subtitle with opacity</p>
</section>

// ✅ ALSO WORKS - inline style on each element directly
<section style={{ background: '#0f0c29' }}>
  <h2 style={{ color: '#fff' }}>Explicit color on the heading itself</h2>
</section>

// ⚠️ FRAGILE - color on parent only, children may not inherit
<section style={{ background: '#0f0c29', color: '#fff' }}>
  <h2>May not inherit white if theme CSS overrides it</h2>
</section>
```

**Best practice:** Use Tailwind for all colors. The dynamic CSS extractor handles `text-white`, `text-white/60`, `bg-[#hex]`, and all standard Tailwind color classes — even for runtime-compiled user components.

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Hardcode colors | Use variant props |
| Forget `href` in nav items | Add `href` to all links |
| Use external icon libs | Use Lucide names or emojis |
| Forget `id` for anchors | Add `id` to link targets |
| Set `color` only on parent div for dark sections | Set `text-white` class or explicit color on each heading/paragraph |
| Mix inline styles with Tailwind for colors | Pick one approach — prefer Tailwind classes |

## Related

- `skill:page` - JSON page structure
- `skill:auth` - Auth button integration
