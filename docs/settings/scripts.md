# External Scripts

Add analytics, tracking, and external JavaScript libraries.

## Quick Start

Add to any page's JSON:

```json
{
  "scripts": {
    "gtag": "G-XXXXXXXXXX"
  },
  "components": [...]
}
```

Google Analytics is now tracking that page.

---

## Analytics

### Google Analytics

```json
{
  "scripts": {
    "gtag": "G-XXXXXXXXXX"
  }
}
```

### Google Ads Conversion

```json
{
  "scripts": {
    "gtag": "AW-XXXXXXXXXX",
    "gtagEvent": {
      "type": "conversion",
      "send_to": "AW-XXXXXXXXXX/xxxxx"
    }
  }
}
```

### Multiple Conversion Events

```json
{
  "scripts": {
    "gtag": "AW-XXXXXXXXXX",
    "gtagEvent": [
      {
        "type": "conversion",
        "send_to": "AW-XXXXXXXXXX/signup",
        "value": 1.0,
        "currency": "USD"
      },
      {
        "type": "conversion",
        "send_to": "AW-XXXXXXXXXX/purchase"
      }
    ]
  }
}
```

### Meta Pixel (Facebook)

Single pixel:

```json
{
  "scripts": {
    "meta_pixels": "1234567890"
  }
}
```

Multiple pixels (e.g. a hub site firing pixels for several brands):

```json
{
  "scripts": {
    "meta_pixels": ["1234567890", "0987654321"]
  }
}
```

The framework injects the Meta Pixel base code once, calls `fbq('init', ...)` for each pixel, then fires a single `fbq('track', 'PageView')`. A `<noscript>` image fallback is added per pixel.

### Mixpanel

```json
{
  "scripts": {
    "mixpanel": "YOUR_MIXPANEL_TOKEN"
  }
}
```

Use in components:

```jsx
const handleClick = () => {
  if (window.mixpanel) {
    window.mixpanel.track('Button Clicked', { button_name: 'CTA' });
  }
};
```

---

## External Libraries

### Load a Library

```json
{
  "scripts": {
    "custom": [
      {
        "src": "https://cdn.example.com/library.js",
        "expose": "LibraryName"
      }
    ]
  }
}
```

### Wait for Library to Load

Use `app.scripts.waitFor()` in components:

```jsx
import { useEffect, useState } from 'react';

const MyComponent = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    app.scripts.waitFor('LibraryName').then(() => {
      setReady(true);
      window.LibraryName.init();
    });
  }, []);

  if (!ready) return <div>Loading...</div>;

  return <div>Library loaded!</div>;
};
```

### Multiple Globals

Some libraries expose multiple variables:

```json
{
  "scripts": {
    "custom": [
      {
        "src": "https://cdn.example.com/dos.js",
        "expose": ["Dos", "emulators"]
      }
    ]
  }
}
```

```jsx
useEffect(() => {
  Promise.all([
    app.scripts.waitFor('Dos'),
    app.scripts.waitFor('emulators')
  ]).then(() => {
    // Both globals are ready
    const ci = new Dos(canvas);
  });
}, []);
```

### Inline Scripts

Execute custom JavaScript:

```json
{
  "scripts": {
    "custom": [
      {
        "content": "window.APP_CONFIG = { debug: true, api: 'https://api.example.com' };"
      }
    ]
  }
}
```

---

## CSP Proxy

By default, external scripts are proxied to bypass Content Security Policy restrictions. Disable for trusted CDNs:

```json
{
  "scripts": {
    "custom": [
      {
        "src": "https://cdn.jsdelivr.net/npm/library@1.0.0/dist/lib.min.js",
        "expose": "Lib",
        "proxy": false
      }
    ]
  }
}
```

---

## Complete Example

```json
{
  "meta": { "title": "Landing Page" },
  "scripts": {
    "gtag": "G-XXXXXXXXXX",
    "gtagEvent": {
      "type": "conversion",
      "send_to": "AW-XXXXXXXXXX/signup"
    },
    "mixpanel": "YOUR_MIXPANEL_TOKEN",
    "custom": [
      {
        "content": "window.APP_ENV = 'production';"
      },
      {
        "src": "https://unpkg.com/three@0.150.0/build/three.min.js",
        "expose": "THREE",
        "proxy": false
      }
    ]
  },
  "components": [...]
}
```

With tracked component:

```jsx
const TrackedButton = () => {
  const handleClick = () => {
    // Google Analytics
    if (window.gtag) {
      window.gtag('event', 'button_click', {
        event_category: 'engagement',
        event_label: 'cta_button'
      });
    }

    // Mixpanel
    if (window.mixpanel) {
      window.mixpanel.track('CTA Clicked');
    }
  };

  return <button onClick={handleClick}>Track This!</button>;
};
```

---

## Reference

### Scripts Object

| Property | Type | Description |
|----------|------|-------------|
| `gtag` | string | Google Analytics/Ads ID (G-XXX or AW-XXX) |
| `gtagEvent` | object\|array | Conversion tracking event(s) |
| `meta_pixels` | string\|array | Meta (Facebook) Pixel ID(s) — fires one base + N inits + one PageView |
| `mixpanel` | string | Mixpanel project token |
| `custom` | array | Custom external or inline scripts |

### Custom Script Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `src` | string | No* | External script URL |
| `content` | string | No* | Inline script content |
| `expose` | string\|array | No | Global variable name(s) |
| `proxy` | boolean | No | Use CSP proxy (default: true) |

*Either `src` or `content` is required, not both.

### app.scripts Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `app.scripts.waitFor(name)` | Promise | Wait for global to be available |

---

## Common Mistakes

| Don't | Do |
|-------|-----|
| Access `window.Library` immediately | Use `app.scripts.waitFor('Library')` |
| `expose: "Lib1, Lib2"` (string) | `expose: ["Lib1", "Lib2"]` (array) |
| Both `src` and `content` together | Use one or the other |
| Load scripts via `<script>` in components | Define in page `scripts` field |
| Forget error handling | Add `.catch()` or timeout |
