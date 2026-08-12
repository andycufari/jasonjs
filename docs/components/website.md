# @framework/website/* Components

Landing page building blocks. Ready to use.

## Components

| Component | Purpose |
|-----------|---------|
| Navbar | Navigation with auth, submenus, mobile |
| Hero | Headlines, CTAs, code preview |
| Footer | Links, newsletter, social |
| FeatureGrid | Feature cards with icons |
| StatsSection | Animated statistics |
| TestimonialSection | Customer quotes |
| Newsletter | Email subscription with database |
| IconWrapper | Universal icon utility |

---

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
        "href": "/products",
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

Works with zero config - just drop `{"component": "@framework/website/Navbar"}` for default nav.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| logo | string | - | Image URL |
| logoText | string | "JasonJS" | Text logo |
| logoHref | string | "/" | Logo link |
| navigation | array | [] | Nav items (see below) |
| showAuth | boolean | true | Show auth buttons |
| profileMode | "modal"\|"redirect" | "modal" | Profile experience |
| variant | "default"\|"gradient"\|"glass" | "default" | Visual style |
| position | "sticky"\|"fixed"\|"relative" | "sticky" | Positioning |
| transparent | boolean | false | Transparent background |

### Navigation Item

```typescript
{
  name: string;
  href: string;
  target?: string;
  submenu?: { name: string; href: string; }[];
}
```

---

## Hero

```json
{
  "component": "@framework/website/Hero",
  "attributes": {
    "headline": "Ship Faster",
    "subheadline": "Build your next idea in hours, not weeks.",
    "ctaText": "Get Started",
    "ctaUrl": "/signup",
    "features": ["No credit card", "14-day trial", "Cancel anytime"],
    "codeExample": {
      "title": "page.json",
      "code": "{ \"component\": \"Hero\" }"
    }
  }
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| headline | string | "Build Something Amazing" | Main headline |
| subheadline | string | auto | Supporting text |
| ctaText | string | "Get Started" | Primary button |
| ctaUrl | string | "/docs" | Primary button link |
| secondaryCta | string | "Learn More" | Secondary button |
| secondaryUrl | string | "#features" | Secondary link |
| features | string[] | [] | Feature bullets |
| codeExample | object | null | `{ title, code }` |
| showCodeExample | boolean | true | Show code panel |
| variant | "default"\|"gradient"\|"minimal" | "default" | Visual style |

---

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
      },
      {
        "title": "Company",
        "links": [
          { "name": "About", "href": "/about" },
          { "name": "Blog", "href": "/blog" }
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

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| logo | string | - | Image URL |
| logoText | string | "JasonJS" | Text logo |
| companyName | string | auto | For copyright |
| linkGroups | array | [] | Link columns |
| links | array | [] | Simple links (centered layout) |
| socialLinks | array | [] | Social icons |
| showNewsletter | boolean | false | Include newsletter |
| newsletterDatabase | string | "newsletter" | Database for signups |
| variant | "default"\|"gradient"\|"dark"\|"minimal" | "default" | Visual style |
| layout | "default"\|"centered" | "default" | Multi-column or centered |
| showBadges | boolean | false | Tech badges |

---

## FeatureGrid

```json
{
  "component": "@framework/website/FeatureGrid",
  "attributes": {
    "title": "Why Choose Us",
    "features": [
      { "icon": "Zap", "title": "Fast", "description": "Lightning performance" },
      { "icon": "Shield", "title": "Secure", "description": "Enterprise-grade security" },
      { "icon": "Code", "title": "Developer First", "description": "Great DX" }
    ]
  }
}
```

Zero config shows 6 default features.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | "Everything You Need" | Section title |
| subtitle | string | auto | Section subtitle |
| features | array | [] | Feature objects |
| columns | 1\|2\|3\|4 | 3 | Grid columns |
| variant | "default"\|"gradient"\|"minimal" | "default" | Visual style |
| showExpandable | boolean | true | Expand details |

### Feature Object

```typescript
{
  icon: string;        // Lucide name, emoji, or URL
  title: string;
  description: string;
  details?: string[];  // Expandable bullet points
}
```

---

## StatsSection

```json
{
  "component": "@framework/website/StatsSection",
  "attributes": {
    "title": "Trusted Worldwide",
    "stats": [
      { "value": 10000, "suffix": "+", "label": "Users", "icon": "Users" },
      { "value": 99.9, "suffix": "%", "label": "Uptime", "icon": "Activity" },
      { "value": 50, "prefix": "$", "suffix": "M", "label": "Processed", "icon": "DollarSign" }
    ]
  }
}
```

Numbers animate on scroll. Large numbers auto-format (1000 → 1K, 1000000 → 1M).

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | "Trusted by Thousands" | Section title |
| subtitle | string | auto | Section subtitle |
| stats | array | [] | Stat objects |
| columns | 2\|3\|4 | 4 | Grid columns |
| variant | "default"\|"cards"\|"minimal" | "default" | Visual style |
| animate | boolean | true | Animate numbers |

### Stat Object

```typescript
{
  value: number;
  label: string;
  icon?: string;       // Lucide name, emoji, or URL
  prefix?: string;     // e.g., "$"
  suffix?: string;     // e.g., "+", "%", "K"
  description?: string;
}
```

---

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
        "content": "Shipped our MVP in a weekend. Incredible.",
        "rating": 5
      },
      {
        "name": "Mike Johnson",
        "role": "Founder, StartupXYZ",
        "avatar": "/images/mike.jpg",
        "content": "Best decision we made for our stack.",
        "rating": 5
      }
    ]
  }
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | "What People Are Saying" | Section title |
| subtitle | string | auto | Section subtitle |
| testimonials | array | [] | Testimonial objects |
| columns | 1\|2\|3 | 3 | Grid columns |
| variant | "default"\|"cards"\|"minimal" | "default" | Visual style |
| showRatings | boolean | true | Show star ratings |

### Testimonial Object

```typescript
{
  name: string;
  role: string;
  avatar: string;     // Emoji, image URL, or initials fallback
  content: string;
  rating?: number;    // 1-5 stars
  company?: string;
}
```

---

## Newsletter

```json
{
  "component": "@framework/website/Newsletter",
  "attributes": {
    "title": "Stay Updated",
    "subtitle": "Weekly tips delivered to your inbox",
    "buttonText": "Subscribe",
    "newsletterDatabase": "subscribers"
  }
}
```

Automatically saves to database via `app.db` and shows toast on success/error.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | "Subscribe to our newsletter" | Section title |
| subtitle | string | auto | Section subtitle |
| placeholder | string | "Enter your email" | Input placeholder |
| buttonText | string | "Subscribe" | Button text |
| newsletterDatabase | string | "newsletter" | Database name |
| variant | "default"\|"gradient"\|"dark"\|"minimal" | "default" | Visual style |
| size | "small"\|"default"\|"large" | "default" | Component size |

### Database Entry

```javascript
{
  email: "user@example.com",
  subscribedAt: "2024-01-15T10:30:00.000Z",
  source: "newsletter-widget"
}
```

---

## IconWrapper

Universal icon utility. Accepts Lucide names, emojis, or image URLs.

```json
{
  "component": "@framework/website/IconWrapper",
  "attributes": {
    "icon": "Rocket",
    "size": "lg"
  }
}
```

### Usage Examples

```javascript
// Lucide icon
{ "icon": "Home" }
{ "icon": "Settings" }

// Emoji
{ "icon": "🚀" }
{ "icon": "💡" }

// Image URL
{ "icon": "/icons/logo.svg" }
{ "icon": "https://example.com/icon.png" }
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| icon | string | - | Lucide name, emoji, or URL |
| size | "sm"\|"md"\|"lg"\|"xl" | "md" | Icon size |
| className | string | "" | Additional classes |

> 💡 **Tip:** FeatureGrid, StatsSection, and other components use IconWrapper internally. Just pass icon strings directly.

---

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
          { "name": "Pricing", "href": "#pricing" },
          { "name": "About", "href": "/about" }
        ]
      }
    },
    {
      "component": "@framework/website/Hero",
      "attributes": {
        "headline": "Build Faster, Ship Sooner",
        "subheadline": "The framework that gets out of your way.",
        "ctaText": "Start Free",
        "ctaUrl": "/signup"
      }
    },
    {
      "component": "@framework/website/FeatureGrid",
      "attributes": {
        "id": "features",
        "title": "Everything You Need"
      }
    },
    {
      "component": "@framework/website/StatsSection",
      "attributes": {
        "title": "Trusted by Teams"
      }
    },
    {
      "component": "@framework/website/TestimonialSection",
      "attributes": {
        "title": "Loved by Developers"
      }
    },
    {
      "component": "@framework/website/Footer",
      "attributes": {
        "logoText": "Acme",
        "showNewsletter": true
      }
    }
  ]
}
```

---

## Theming

All components use semantic theme classes. They work automatically in light and dark mode without configuration.

Common classes used:
- `bg-background` / `bg-card` - Backgrounds
- `text-foreground` / `text-muted-foreground` - Text
- `border-border` - Borders
- `text-primary` / `bg-primary` - Accent colors

> 📖 See [settings/theme.md](../settings/theme.md) for theme customization.
