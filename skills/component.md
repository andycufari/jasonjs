---
skill: component
when: "Building any React component"
requires: []
---

# Component Building

> Build React components with the `app` object for database, UI, auth, and events.

## Quick Start

```jsx
// @desc Product card with add to cart
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const ProductCard = ({ jcontext, product }) => {
  const [loading, setLoading] = useState(false);

  const handleAddToCart = async () => {
    setLoading(true);
    try {
      await app.db.use('cart').add({
        productId: product._id,
        quantity: 1
      });
      app.ui.toast('Added to cart!', { type: 'success' });
      app.events.emit('cart:updated');
    } catch (error) {
      app.ui.toast('Failed to add', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-bold">{product.name}</h3>
        <p className="text-muted-foreground">${product.price}</p>
        <Button onClick={handleAddToCart} disabled={loading}>
          {loading ? 'Adding...' : 'Add to Cart'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
```

## Component Structure

```jsx
// @desc Brief description for file discovery
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const ComponentName = ({ jcontext, customProp }) => {
  // 1. Get data from jcontext (immutable per page render)
  const initialUser = jcontext?.user;
  const { slug } = jcontext?.params || {};
  const prefetchedData = jcontext?.fetch_data?.products || [];

  // 2. Local state - use app.auth for reactive auth
  const [items, setItems] = useState([]);
  const [user, setUser] = useState(initialUser);

  // 3. Effects with cleanup
  useEffect(() => {
    // Listen for auth changes (jcontext.user won't update mid-session)
    const unsubLogin = app.events.on('user.login', (data) => setUser(data.user));
    const unsubLogout = app.events.on('user.logout', () => setUser(null));
    const unsubItems = app.events.on('item:created', loadItems);
    return () => { unsubLogin(); unsubLogout(); unsubItems(); };
  }, []);

  // 4. Handlers
  const handleAction = async () => {
    // ... logic
  };

  // 5. Render
  return <div className="p-4">{/* JSX */}</div>;
};

export default ComponentName;
```

## App Object Reference

```jsx
// DATABASE
await app.db.use('posts').add({ title: 'New' });
await app.db.use('posts').getById('id123');
await app.db.use('posts').query({ status: 'active' }).limit(10);
await app.db.use('posts').update('id123', { title: 'Updated' });
await app.db.use('posts').delete('id123');

// UI FEEDBACK
app.ui.toast('Saved!', { type: 'success' }); // success | error | info
app.ui.toast('Error!', { type: 'error', duration: 6000 });
const confirmed = await app.ui.confirm('Delete this?');
app.ui.loading(true);  // Show loader
app.ui.loading(false); // Hide loader

// AUTHENTICATION
const user = app.auth.user;
const isLoggedIn = app.auth.isAuthenticated;
const isAdmin = app.auth.isAdmin;
if (app.auth.hasRole('editor')) { /* ... */ }
await app.auth.requireLogin(); // Shows modal, returns user
await app.auth.signOut();

// EVENTS
app.events.emit('cart:add', { product, quantity: 1 });
const unsubscribe = app.events.on('cart:updated', handler);
app.events.on('cart:*', handler); // Wildcard

// NAVIGATION
app.navigate.to('/dashboard');
app.navigate.back();
app.navigate.forward();
app.navigate.replace('/new-url');
app.navigate.reload();
app.navigate.external('https://google.com'); // Opens in new tab

// SERVER FUNCTIONS
const result = await app.functions.call('processOrder', { orderId });

// THEME
app.ui.theme.toggle();
app.ui.theme.set('dark');

// STORAGE
const { url } = await app.storage.upload(file);
```

## Patterns

### Pattern: Data Loading (Server Pre-fetched via fetch_data)

When a page JSON has `fetch_data`, data is fetched server-side and passed to components via `jcontext.fetch_data`. The key is the `id` (if provided) or the `database` name. If fetching the same database twice, you **must** use `id` to differentiate.

**Page JSON — pass data via `{{database_name}}` in attributes:**
```json
{
  "fetch_data": {
    "database": "todos",
    "query": {},
    "sort": { "createdAt": -1 }
  },
  "components": [
    {
      "component": "TodoList",
      "attributes": {
        "initialTodos": "{{todos}}"
      }
    }
  ]
}
```

**Component receives the data as a prop (attributes are spread as JSX props):**
```jsx
const TodoList = ({ jcontext, initialTodos = [] }) => {
  const [items, setItems] = useState(initialTodos);

  return <ul>{items.map(item => <li key={item._id}>{item.title}</li>)}</ul>;
};
```

**Or read directly from jcontext (also works):**
```jsx
const TodoList = ({ jcontext }) => {
  const prefetched = jcontext?.fetch_data?.todos || [];
  const [items, setItems] = useState(prefetched);

  return <ul>{items.map(item => <li key={item._id}>{item.title}</li>)}</ul>;
};
```

> **Template key rule:** The key is the `id` (if provided) or the `database` name from fetch_data. `{{todos}}` works because the database is `"todos"`. There is no generic `{{data}}` key.

**Multiple sources with `id`:**
```json
{
  "fetch_data": [
    { "id": "active", "database": "todos", "query": { "completed": false } },
    { "id": "done", "database": "todos", "query": { "completed": true } }
  ]
}
```
```jsx
// Access by id: jcontext.fetch_data.active, jcontext.fetch_data.done
const active = jcontext?.fetch_data?.active || [];
const done = jcontext?.fetch_data?.done || [];
```

### Pattern: Data Loading (Client-side)

```jsx
const DataList = ({ jcontext }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const load = async () => {
      const data = await app.db.use('items')
        .query({ active: true })
        .orderBy('createdAt', 'desc')
        .limit(20);
      setItems(data);
    };
    load();
  }, []);

  return <ul>{items.map(item => <li key={item._id}>{item.name}</li>)}</ul>;
};
```

### Pattern: Protected Action

```jsx
const ProtectedButton = () => {
  const handleClick = async () => {
    try {
      // Requires login - shows modal if not authenticated
      const user = await app.auth.requireLogin();

      // Now user is guaranteed to be logged in
      await app.db.use('favorites').add({ userId: user.id });
      app.ui.toast('Added to favorites!');
    } catch (error) {
      // User cancelled login
    }
  };

  return <Button onClick={handleClick}>Save to Favorites</Button>;
};
```

### Pattern: Event Communication

```jsx
// ProductGallery.jsx - emits events
const ProductGallery = () => {
  const handleAdd = (product) => {
    app.events.emit('cart:add', { product, quantity: 1 });
  };
  // ...
};

// CartWidget.jsx - listens to events
const CartWidget = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const unsubscribe = app.events.on('cart:add', () => {
      setCount(prev => prev + 1);
    });
    return unsubscribe; // Always cleanup!
  }, []);

  return <span>Cart ({count})</span>;
};
```

### Pattern: Real-Time Updates

```jsx
const LiveOrders = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    // Subscribe to database changes via Server-Sent Events
    const subscription = app.db.use('orders')
      .subscribe({ status: 'pending' }, (data) => {
        // data format depends on your subscription endpoint
        setOrders(prev => [data, ...prev]);
      });

    return () => subscription.unsubscribe();
  }, []);

  return <ul>{orders.map(o => <li key={o._id}>{o.id}</li>)}</ul>;
};
```

**Note**: Subscription data format depends on your server implementation.

## Imports

```jsx
// React
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// UI Components (named imports, lowercase files)
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

// Icons
import { Search, ShoppingCart, X, Check, ArrowRight } from 'lucide-react';

// Animations
import { motion, AnimatePresence } from 'framer-motion';

// Framework components
import FormBuilder from '@framework/FormBuilder';
import JasonTable from '@framework/JasonTable';

// Sibling components
import ProductCard from './ProductCard';
```

## Styling

```jsx
// USE theme classes
<div className="bg-background text-foreground">
<button className="bg-primary text-primary-foreground">
<p className="text-muted-foreground">

// Responsive (mobile-first)
<div className="p-4 md:p-6 lg:p-8">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
<div className="flex flex-col md:flex-row gap-4">

// States
<button className="hover:bg-primary/90 disabled:opacity-50">
```

## Built-in Events

| Event | When | Data |
|-------|------|------|
| `user.login` | User logged in | `{ user }` |
| `user.logout` | User logged out | `{ wasAuthenticated, userId }` |
| `billing:subscribed` | User subscribed | `{ planId, subscription }` |
| `billing:canceled` | Subscription canceled | `{ subscriptionId }` |
| `auth.requireLogin` | Login modal requested | `{}` |

**Custom events**: Use any pattern like `cart:add`, `item:created`. Wildcards work: `cart:*`.

## Image Fields

`app.storage` uploads are stored as objects, not plain URL strings:

```json
{ "url": "https://cdn.example.com/photo.jpg", "name": "photo.jpg", "type": "image/jpeg", "size": 204800 }
```

Always handle both formats when rendering images:

```jsx
const ImageDisplay = ({ image }) => {
  const src = typeof image === 'object' ? image.url : image;
  if (!src) return null;
  return <img src={src} alt={image?.name || ''} />;
};
```

## Transpiler Limitations

Components are compiled client-side with Babel's `react` preset only. Several modern JS features are **not supported** and will cause blank pages or silent failures:

| Feature | Status | Workaround |
|---------|--------|------------|
| Optional chaining `?.` | **Not supported** | Use `&&` chains or ternary: `obj && obj.prop` |
| Nullish coalescing `??` | **Not supported** | Use `\|\|` (when falsy check is acceptable) or ternary |
| `catch {}` (no param) | **Not supported** | Always name the param: `catch (e) {}` |
| Logical assignment `\|\|=` `&&=` `??=` | **Not supported** | Use explicit assignment |
| `const` / `let` / arrow functions | Supported | Works in modern browsers (not transpiled) |
| JSX | Supported | Transpiled by Babel react preset |
| Async/await | Supported | Works in modern browsers |

**Example — common pitfall:**

```jsx
// ❌ BREAKS - optional chaining not transpiled
const name = user?.profile?.name ?? 'Anonymous';

// ✅ WORKS
const name = (user && user.profile && user.profile.name) || 'Anonymous';
```

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| `import app from '@jasonjs'` | `app` is global - just use it |
| `import Button from '@/components/ui/Button'` | `import { Button } from '@/components/ui/button'` |
| Forget `jcontext` param | Always: `({ jcontext, ...props })` |
| Rely on `jcontext.user` to update | Use `app.auth.user` or events for reactive auth |
| `bg-[#6366f1]` | `bg-primary` (use theme) |
| `text-gray-900` | `text-foreground` |
| Forget event cleanup | Always return unsubscribe from `useEffect` |
| `app.events.off()` for cleanup | Use returned function from `on()` |
| Skip loading states | Add loading UI for async |
| Skip error handling | Wrap async in try/catch |
| Use Context for cross-component | Use events between components |
| Use made-up keys like `{{data}}` | Key is the `id` or `database` name: `{{todos}}`, `{{posts}}` |
| Render image field as `<img src={image}>` | Handle object format: `src={typeof image === 'object' ? image.url : image}` |
| Use `?.` or `??` in components | Use `&&` chains and `\|\|` instead (transpiler limitation) |

## Related

- `skill:database` - Full query API
- `skill:forms` - FormBuilder patterns
- `skill:auth` - Authentication details
- `skill:billing` - Payment integration
