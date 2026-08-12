---
skill: scripts
when: "Adding analytics, tracking, or external JavaScript libraries"
requires: []
---

# External Scripts

> Add Google Analytics, Mixpanel, conversion tracking, and external JavaScript libraries

## Quick Start

```json
{
  "scripts": {
    "gtag": "G-XXXXXXXXXX",
    "custom": [
      {
        "src": "https://cdn.example.com/library.js",
        "expose": "LibraryName"
      }
    ]
  }
}
```

## Analytics & Tracking

### Pattern: Google Analytics

```json
{
  "scripts": {
    "gtag": "G-XXXXXXXXXX"
  }
}
```

This automatically loads Google Analytics and initializes tracking.

### Pattern: Google Ads Conversion Tracking

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

### Pattern: Multiple Conversion Events

Track multiple events (signup, purchase, etc.):

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

### Pattern: Meta Pixel (Facebook)

Single pixel:

```json
{
  "scripts": {
    "meta_pixels": "1234567890"
  }
}
```

Multiple pixels on the same site (e.g. a hub site firing a pixel per brand):

```json
{
  "scripts": {
    "meta_pixels": ["1234567890", "0987654321"]
  }
}
```

The framework injects the Meta Pixel base code once, calls `fbq('init', ...)` for each pixel, then fires a single `fbq('track', 'PageView')`. A `<noscript>` image fallback is added per pixel.

Track custom events from components:

```jsx
const handlePurchase = (order) => {
  if (window.fbq) {
    window.fbq('track', 'Purchase', { value: order.total, currency: 'USD' });
  }
};
```

### Pattern: Mixpanel

```json
{
  "scripts": {
    "mixpanel": "YOUR_MIXPANEL_TOKEN"
  }
}
```

Access in components:

```jsx
const MyComponent = () => {
  const handleClick = () => {
    // Mixpanel is automatically initialized
    if (window.mixpanel) {
      window.mixpanel.track('Button Clicked', {
        button_name: 'CTA'
      });
    }
  };

  return <button onClick={handleClick}>Track Me</button>;
};
```

## External Libraries

### Pattern: Single External Script

Load an external library and expose it globally:

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

Use in components with `app.scripts.waitFor()`:

```jsx
import { useEffect, useState } from 'react';

const MyComponent = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for external script to load
    app.scripts.waitFor('LibraryName').then(() => {
      setReady(true);
      // Now use the library
      window.LibraryName.init();
    });
  }, []);

  if (!ready) return <div>Loading library...</div>;

  return <div>Library loaded!</div>;
};
```

### Pattern: Multiple Exposed Globals

Some libraries expose multiple global variables:

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

Wait for all exposed globals:

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

### Pattern: Multiple External Scripts

Load several libraries:

```json
{
  "scripts": {
    "custom": [
      {
        "src": "https://cdn.example.com/library1.js",
        "expose": "Library1"
      },
      {
        "src": "https://cdn.example.com/library2.js",
        "expose": "Library2"
      },
      {
        "src": "https://unpkg.com/three@0.150.0/build/three.min.js",
        "expose": "THREE"
      }
    ]
  }
}
```

### Pattern: Inline Scripts

Execute custom JavaScript directly:

```json
{
  "scripts": {
    "custom": [
      {
        "content": "console.log('Initialized'); window.myConfig = { api: 'https://api.example.com' };"
      }
    ]
  }
}
```

### Pattern: Mixed Scripts

Combine analytics, external libraries, and inline scripts:

```json
{
  "scripts": {
    "gtag": "G-XXXXXXXXXX",
    "mixpanel": "YOUR_TOKEN",
    "custom": [
      {
        "content": "window.APP_CONFIG = { debug: true };"
      },
      {
        "src": "https://cdn.example.com/widget.js",
        "expose": "Widget"
      }
    ]
  }
}
```

## CSP & Proxy Control

### Pattern: Disable CSP Proxy

By default, external scripts are proxied through `/api/proxy` to bypass Content Security Policy restrictions. If your domain is whitelisted in `next.config.js` CSP settings, disable the proxy for better performance:

```json
{
  "scripts": {
    "custom": [
      {
        "src": "https://trusted-cdn.example.com/script.js",
        "expose": "Script",
        "proxy": false
      }
    ]
  }
}
```

### Pattern: External Script Without Proxy

For trusted domains already in CSP whitelist:

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

## Using app.scripts in Components

### Pattern: Wait for Script to Load

```jsx
const GameComponent = () => {
  const [dosReady, setDosReady] = useState(false);

  useEffect(() => {
    app.scripts.waitFor('Dos').then(() => {
      console.log('DOS.js is ready');
      setDosReady(true);
    });
  }, []);

  return dosReady ? <DosGame /> : <Loading />;
};
```

### Pattern: Wait for Multiple Scripts

```jsx
const ComplexComponent = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      app.scripts.waitFor('THREE'),
      app.scripts.waitFor('CANNON'),
      app.scripts.waitFor('GLTFLoader')
    ]).then(() => {
      console.log('All libraries loaded');
      setReady(true);
    });
  }, []);

  return ready ? <Scene3D /> : <Spinner />;
};
```

### Pattern: Timeout Handling

```jsx
const SafeComponent = () => {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setStatus('timeout');
    }, 5000);

    app.scripts.waitFor('ExternalLib')
      .then(() => {
        clearTimeout(timeout);
        setStatus('ready');
      })
      .catch(() => {
        clearTimeout(timeout);
        setStatus('error');
      });

    return () => clearTimeout(timeout);
  }, []);

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'timeout') return <div>Loading timeout</div>;
  if (status === 'error') return <div>Failed to load</div>;

  return <div>Ready!</div>;
};
```

## Complete Example

```json
{
  "meta": {
    "title": "Analytics & Scripts Demo"
  },
  "scripts": {
    "gtag": "G-XXXXXXXXXX",
    "gtagEvent": [
      {
        "type": "conversion",
        "send_to": "AW-XXXXXXXXXX/signup"
      }
    ],
    "mixpanel": "YOUR_MIXPANEL_TOKEN",
    "custom": [
      {
        "content": "window.APP_ENV = 'production';"
      },
      {
        "src": "https://cdn.example.com/analytics.js",
        "expose": "Analytics"
      },
      {
        "src": "https://unpkg.com/three@0.150.0/build/three.min.js",
        "expose": "THREE",
        "proxy": false
      }
    ]
  },
  "components": [
    {
      "component": "Hero",
      "attributes": {
        "title": "Tracked Landing Page"
      }
    }
  ]
}
```

With component:

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

    // Custom analytics (wait for script)
    app.scripts.waitFor('Analytics').then(() => {
      window.Analytics.track('cta_click');
    });
  };

  return <button onClick={handleClick}>Track This!</button>;
};
```

## API Reference

### Scripts Object

| Property | Type | Description |
|----------|------|-------------|
| `gtag` | string | Google Analytics/Ads ID (G-XXX or AW-XXX) |
| `gtagEvent` | object\|array | Conversion tracking event(s) |
| `meta_pixels` | string\|array | Meta (Facebook) Pixel ID(s) — single string or array for multi-pixel sites |
| `mixpanel` | string | Mixpanel project token |
| `custom` | array | Custom external or inline scripts |

### Custom Script Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `src` | string | No* | External script URL |
| `content` | string | No* | Inline script content |
| `expose` | string\|array | No | Global variable name(s) to expose |
| `proxy` | boolean | No | Use CSP proxy (default: true) |

*Either `src` or `content` is required, not both.

### gtag Event Object

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Event type (default: "conversion") |
| `send_to` | string | Conversion ID (AW-XXX/label) |
| `value` | number | Conversion value |
| `currency` | string | Currency code (USD, EUR, etc.) |

### app.scripts Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `app.scripts.waitFor(name)` | Wait for exposed script to load | Promise<void> |

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Use external script without `expose` | Always set `expose` if accessing global variables |
| `expose: "Lib1, Lib2"` (string) | `expose: ["Lib1", "Lib2"]` (array) |
| Access `window.Library` immediately | Use `app.scripts.waitFor('Library')` first |
| Forget `proxy: false` for whitelisted domains | Set `proxy: false` for better performance |
| Both `src` and `content` in same object | Use one or the other, not both |
| Load scripts in component with `<script>` | Define in page JSON `scripts` field |
| Hard-code analytics events everywhere | Use a tracking utility function |
| Mix gtag IDs (G- and AW-) without testing | Test conversion tracking separately |
| Forget error handling with waitFor | Add `.catch()` or timeout logic |

## How It Works

1. **Script Injection**: Framework injects scripts into `<head>` during page render
2. **Exposure Tracking**: If `expose` is set, framework tracks when globals become available
3. **app.scripts Bridge**: `app.scripts.waitFor()` returns a promise that resolves when the global exists
4. **CSP Proxy**: External scripts are proxied through `/api/proxy?url=...` unless `proxy: false`

## Related

- `skill:component` - Using scripts in components
- `skill:page` - Page JSON structure
- `skill:theming` - Visual styling configuration
