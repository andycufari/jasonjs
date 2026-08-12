# JSON Pages

Pages are JSON files that define what renders. Server-rendered, client-hydrated.

```json
{
  "meta": {
    "title": "My Page",
    "description": "Page description for SEO"
  },
  "components": [
    {
      "component": "h1",
      "innerHTML": "Hello World"
    }
  ]
}
```

## Page Structure

```json
{
  "meta": {},           // SEO metadata
  "auth": false,        // Require login? (default: false)
  "roles": [],          // Required roles (if auth: true)
  "layout": {},         // Page-level layout settings
  "fetch_data": {},     // Server-side data fetching
  "components": [],     // The actual content
  "include_components": {}, // Custom component declarations
  "theme": {},          // Page-specific theme overrides
  "scripts": {},        // External scripts
  "fonts": {},          // Custom fonts
  "include_css": []     // External stylesheets
}
```

---

## Components

### HTML Elements

Any valid HTML tag works:

```json
{
  "component": "div",
  "attributes": {
    "className": "container mx-auto p-4",
    "id": "main-content"
  },
  "components": [
    {
      "component": "h1",
      "innerHTML": "Page Title"
    },
    {
      "component": "p",
      "innerHTML": "Some text content"
    }
  ]
}
```

**Common elements:** `div`, `section`, `header`, `main`, `footer`, `article`, `nav`, `h1`-`h6`, `p`, `span`, `a`, `img`, `button`, `input`, `form`, `ul`, `ol`, `li`

### Text Content

Use `innerHTML` for text. Don't put strings in `components`.

```json
// Correct
{ "component": "p", "innerHTML": "Hello world" }

// Wrong - strings in components array break rendering
{ "component": "p", "components": ["Hello world"] }
```

### Nesting

Use `components` array for children:

```json
{
  "component": "section",
  "components": [
    { "component": "h2", "innerHTML": "Section Title" },
    { "component": "p", "innerHTML": "Section content" }
  ]
}
```

---

## Component Resolution

```
@system/Name        → components/system/Name.jsx (built-in, trusted)
@ui/Name            → components/ui/Name.jsx (UI library)
@framework/cat/Name → components/framework/cat/Name.jsx
@package/Name       → downloaded package component
./Name              → sites/[siteId]/components/Name.jsx (tenant)
Name                → system component or HTML element
```

### Examples

```json
// Built-in auth component
{ "component": "@system/UserButton" }

// Framework website component
{ "component": "@framework/website/Hero", "attributes": { "title": "Welcome" } }

// Custom tenant component (must declare in include_components)
{ "component": "./MyHeader" }

// HTML element
{ "component": "div", "innerHTML": "Plain HTML" }
```

### Custom Components

Declare tenant components in `include_components`:

```json
{
  "include_components": {
    "MyHeader": "components/MyHeader",
    "ProductCard": "components/shop/ProductCard"
  },
  "components": [
    { "component": "./MyHeader" },
    { "component": "./ProductCard", "attributes": { "product": "{{data}}" } }
  ]
}
```

---

## Attributes

### Common Attributes

```json
{
  "attributes": {
    "className": "flex items-center gap-4",
    "id": "unique-id",
    "style": { "color": "red", "fontSize": "16px" },
    "data-testid": "my-element"
  }
}
```

### Link Attributes

```json
{
  "component": "a",
  "attributes": {
    "href": "/about",
    "target": "_blank",
    "rel": "noopener noreferrer"
  },
  "innerHTML": "Learn More"
}
```

### Image Attributes

```json
{
  "component": "img",
  "attributes": {
    "src": "/images/hero.jpg",
    "alt": "Hero image",
    "width": 800,
    "height": 600,
    "loading": "lazy"
  }
}
```

### Form Attributes

```json
{
  "component": "input",
  "attributes": {
    "type": "email",
    "name": "email",
    "placeholder": "you@example.com",
    "required": true
  }
}
```

---

## Data Interpolation

Use `{{variable}}` syntax to inject dynamic data.

### Available Variables

| Variable | Source |
|----------|--------|
| `{{data}}` | Single `fetch_data` result |
| `{{users}}` | Named fetch_data source (`id: "users"`) |
| `{{user}}` | Current authenticated user |
| `{{params.slug}}` | URL parameters |
| `{{searchParams.q}}` | Query string parameters |

### Usage

```json
// In text
{ "component": "h1", "innerHTML": "Welcome, {{user.name}}" }

// In attributes
{ "component": "img", "attributes": { "src": "{{data.image}}", "alt": "{{data.title}}" } }

// In fetch_data queries
{ "fetch_data": { "query": { "user_id": "{{user.id}}" } } }
```

**See:** [attributes.md](./attributes.md) for expressions and conditionals.

---

## Authentication

### Public Page (Default)

```json
{ "auth": false }
```

### Protected Page

```json
{ "auth": true }
```

Unauthenticated users redirect to login.

### Role-Based Access

```json
{
  "auth": true,
  "roles": ["admin", "editor"]
}
```

User must have at least one of the listed roles.

---

## Layout

Page-level layout settings:

```json
{
  "layout": {
    "className": "min-h-screen bg-background"
  }
}
```

---

## Common Patterns

### Container Layout

```json
{
  "component": "div",
  "attributes": { "className": "container mx-auto px-4 py-8 max-w-6xl" },
  "components": [...]
}
```

### Section with Header

```json
{
  "component": "section",
  "attributes": { "className": "py-20" },
  "components": [
    {
      "component": "div",
      "attributes": { "className": "container mx-auto px-4 text-center" },
      "components": [
        { "component": "h2", "attributes": { "className": "text-3xl font-bold mb-4" }, "innerHTML": "Features" },
        { "component": "p", "attributes": { "className": "text-muted-foreground" }, "innerHTML": "What we offer" }
      ]
    }
  ]
}
```

### Grid Layout

```json
{
  "component": "div",
  "attributes": { "className": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
  "components": [...]
}
```

### Flexbox Layout

```json
{
  "component": "div",
  "attributes": { "className": "flex items-center justify-between" },
  "components": [...]
}
```

---

## Full Example

```json
{
  "meta": {
    "title": "Dashboard - MyApp",
    "description": "Your personal dashboard"
  },
  "auth": true,
  "fetch_data": {
    "source": "mongodb",
    "database": "stats",
    "query": { "user_id": "{{user.id}}" }
  },
  "components": [
    {
      "component": "header",
      "attributes": { "className": "border-b p-4" },
      "components": [
        {
          "component": "div",
          "attributes": { "className": "container mx-auto flex justify-between items-center" },
          "components": [
            { "component": "h1", "attributes": { "className": "text-2xl font-bold" }, "innerHTML": "Dashboard" },
            { "component": "@system/UserButton" }
          ]
        }
      ]
    },
    {
      "component": "main",
      "attributes": { "className": "container mx-auto p-4" },
      "components": [
        { "component": "h2", "innerHTML": "Welcome back, {{user.name}}" },
        { "component": "p", "innerHTML": "Total visits: {{data.visits}}" }
      ]
    }
  ]
}
```

---

## Common Mistakes

| Wrong | Right | Why |
|-------|-------|-----|
| `"components": ["text"]` | `"innerHTML": "text"` | Strings break the renderer |
| `"class": "..."` | `"className": "..."` | React uses className |
| `{{data.name}}` without fetch_data | Add `fetch_data` config | Data must be fetched first |
| `"component": "@mycomp/X"` | Declare in `include_components` | Custom components need declaration |

---

## See Also

- [attributes.md](./attributes.md) - Dynamic expressions
- [data.md](./data.md) - Data fetching
- [../seo.md](../seo.md) - Meta tags and SEO
- [routing.md](./routing.md) - URL routing
