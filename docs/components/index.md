# Components

Components in JasonJS come from three sources:

1. **Framework** - Built-in components (`@framework/*`)
2. **Addons** - Optional feature kits (`@addons/*`) — see [addons/index.md](../addons/index.md)
3. **User** - Your custom components (no prefix or `./`)

## In JSON Pages

```json
{
  "components": [
    {
      "component": "@framework/JasonTable",
      "attributes": { "database": "products" }
    },
    {
      "component": "@framework/auth/AuthGuard",
      "attributes": { "requiredRole": ["admin"] }
    },
    {
      "component": "@addons/notion-blog/List",
      "attributes": { "limit": 10 }
    },
    {
      "component": "ProductCard",
      "attributes": { "showPrice": true }
    }
  ]
}
```

| Type | Prefix | Example |
|------|--------|---------|
| Framework | `@framework/` | `@framework/FormBuilder` |
| Framework Auth | `@framework/auth/` | `@framework/auth/UserButton` |
| Framework Billing | `@framework/billing/` | `@framework/billing/PricingTable` |
| Addons | `@addons/` | `@addons/comments/Comments` |
| User | none or `./` | `MyComponent` or `./MyComponent` |

---

## Building User Components

User components are React components you create. They receive props from the JSON page.

### Basic Example

```jsx
import React, { useState } from 'react';
import app from '@jasonjs';
import { Button } from '@/components/ui/button';

const ProductCard = ({ jcontext, product, showPrice = true }) => {
  const [likes, setLikes] = useState(product?.likes || 0);

  const handleLike = async () => {
    await app.db.use('products').update(product.id, { likes: likes + 1 });
    setLikes(likes + 1);
    app.ui.toast('Liked!');
  };

  return (
    <div className="p-4 border rounded">
      <h2>{product?.title}</h2>
      {showPrice && <p>${product?.price}</p>}
      <Button onClick={handleLike}>❤️ {likes}</Button>
    </div>
  );
};

export default ProductCard;
```

### Key Rules

| Rule | Why |
|------|-----|
| `export default` | Named exports won't work |
| Import `app` from `@jasonjs` | Access framework APIs |

---

## The `app` Object 🧰

The `app` object is your Swiss Army knife. Import it from `@jasonjs` to access database, functions, auth, UI, and events.

```jsx
import app from '@jasonjs';

// Database
await app.db.use('products').find({ active: true });
await app.db.use('orders').add({ userId, items });

// Server functions
await app.functions.call('sendEmail', { to, subject });

// Auth
await app.auth.requireLogin({ message: 'Sign in to continue' });

// UI
app.ui.toast('Saved!');
await app.ui.confirm('Delete?');
```

> 📖 Full reference: [app.md](../app.md)

---

## Events 📡

**No providers. No prop drilling. No crying.**

JasonJS uses an event bus for component communication. JSON pages don't manage state up and down—components emit and listen to events instead.

This makes components truly **plug-and-play**. A `ProductCard` and `CartDrawer` can work together without ever knowing the other exists. They just speak the same "event language."

```jsx
// ProductCard.jsx — emits event, has no idea CartDrawer exists
const ProductCard = ({ product }) => {
  const handleAdd = () => {
    app.events.emit('cart:add', product);
    app.ui.toast('Added to cart');
  };

  return <Button onClick={handleAdd}>Add to Cart</Button>;
};

// CartDrawer.jsx — listens for events, doesn't care who sent them
const CartDrawer = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const unsub = app.events.on('cart:add', (product) => {
      setItems(prev => [...prev, product]);
    });
    return unsub; // cleanup on unmount
  }, []);

  return <div>{items.length} items</div>;
};
```

Drop these components anywhere on any page—they just work. ✨

### Event Patterns

```jsx
// Emit events
app.events.emit('cart:add', product);
app.events.emit('user:login', user);
app.events.emit('filters:changed', { category: 'shoes' });

// Listen
app.events.on('cart:add', (product) => { ... });

// Listen once (payment success, you only need it once... hopefully)
app.events.once('payment:success', (data) => { ... });

// Wildcard — catch all cart events
app.events.on('cart:*', (data, eventName) => { ... });
```

> 💡 **Tip:** Use namespaced events (`cart:add`, `user:login`, `filters:reset`) to keep things organized. Your future self will thank you.

---

## The `jcontext` Prop

**Only components used directly in JSON pages receive `jcontext`.** Child components receive what you pass to them.

```jsx
// ProductPage.jsx - used in JSON, receives jcontext automatically
const ProductPage = ({ jcontext }) => {
  const products = jcontext.fetch_data?.products || [];

  return (
    <div>
      {products.map(p => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
};

// ProductCard.jsx - child component, receives only what parent passes
const ProductCard = ({ product }) => {
  return <div>{product.title}</div>;
};
```

### What's in jcontext

```jsx
const MyComponent = ({ jcontext }) => {
  // Pre-fetched data from page's fetch_data config
  const posts = jcontext.fetch_data?.posts || [];

  // Current user (if logged in)
  const user = jcontext.user;

  // Auth state
  const isLoggedIn = jcontext.auth?.isAuthenticated;

  // URL info
  const slug = jcontext.params?.slug;
  const path = jcontext.pathname;

  // Site info
  const domain = jcontext.domain;

  // Database schemas (useful for FormBuilder)
  const schema = jcontext.databaseSchemas?.products;

  return <div>...</div>;
};
```

---

## Available Imports

### Core

```jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import app from '@jasonjs';
import Link from 'next/link';
import Image from 'next/image';
```

### UI (shadcn)

```jsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
```

### Animation & Icons

```jsx
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Heart, User, ChevronRight } from 'lucide-react';
```

### Framework

```jsx
import { LoadingCard, ErrorCard, EmptyState } from '@framework';
import FormBuilder from '@framework/FormBuilder';
import JasonTable from '@framework/JasonTable';
import FileUpload from '@framework/FileUpload';
```

### Utilities

```jsx
import { format, parseISO } from 'date-fns';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
```

### 3D (Three.js)

```jsx
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
```

---

## Importing Other User Components

Use `./` prefix to import your other components:

```jsx
import ChildComponent from './ChildComponent';

const ParentComponent = ({ jcontext }) => {
  return (
    <div>
      <ChildComponent data={jcontext.fetch_data?.items} />
    </div>
  );
};

export default ParentComponent;
```

---

## Quick Reference

| Task | Code |
|------|------|
| Toast | `app.ui.toast('Message')` |
| Confirm | `await app.ui.confirm('Delete?')` |
| Database query | `await app.db.use('items').find({})` |
| Call function | `await app.functions.call('name', data)` |
| Require login | `await app.auth.requireLogin()` |
| Track event | `app.analytics.track('event', data)` |

---

## Component Categories

| Category | Doc |
|----------|-----|
| Website (Navbar, Hero, Footer) | [website.md](./website.md) |
| UI (shadcn) | [ui.md](./ui.md) |
| Auth | [auth.md](./auth.md) |
| Tables | [jasontable.md](./jasontable.md) |
| Forms | [formbuilder.md](./formbuilder.md) |
| Media | [media.md](./media.md) |
