# Events

**No providers. No prop drilling. No crying.**

Components talk via events. That's why marketplace components just work.

## Quick Start

**Emit an event:**

```jsx
app.events.emit('cart:add', { product, quantity: 1 });
```

**Listen to an event:**

```jsx
useEffect(() => {
  app.events.on('cart:add', (data) => {
    setItems([...items, data.product]);
  });
}, []);
```

That's it. Components communicate without knowing about each other.

---

## Why Events?

**Traditional React: Context + Props Hell**

```jsx
// Parent wraps everything
<CartProvider>
  <UserProvider>
    <ThemeProvider>
      <ProductCard onAdd={handleAdd} cart={cart} />
      <CartDrawer cart={cart} onUpdate={handleUpdate} />
    </ThemeProvider>
  </UserProvider>
</CartProvider>
```

**JasonJS: Events**

```jsx
// ProductCard - doesn't know CartDrawer exists
app.events.emit('cart:add', product);

// CartDrawer - doesn't know ProductCard exists
app.events.on('cart:add', (product) => {
  setItems([...items, product]);
});
```

**They work together without wiring.**

This is why you can drop a marketplace component into any page and it just works.

---

## Basic API

### app.events.emit(channel, data)

Send data to a channel.

```jsx
app.events.emit('user:login', { userId: 123, name: 'John' });
app.events.emit('cart:add', { productId: 'abc', quantity: 2 });
app.events.emit('modal:open', { modal: 'settings' });
```

### app.events.on(channel, callback)

Listen to a channel.

```jsx
app.events.on('user:login', (data) => {
  console.log('User logged in:', data.name);
});

app.events.on('cart:add', (product) => {
  updateCart(product);
});
```

**Returns unsubscribe function:**

```jsx
const unsubscribe = app.events.on('cart:add', handler);

// Later...
unsubscribe();
```

### app.events.off(channel, callback)

Stop listening.

```jsx
const handler = (data) => console.log(data);

app.events.on('cart:add', handler);
app.events.off('cart:add', handler);
```

### app.events.once(channel, callback)

Listen once, then auto-unsubscribe.

```jsx
// Payment success happens once
app.events.once('payment:success', (data) => {
  console.log('Payment completed!');
});
```

---

## React Pattern (Auto Cleanup)

**Always clean up event listeners in useEffect:**

```jsx
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@jasonjs';

function CartDrawer() {
  const app = useApp();
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Listen to cart events
    const handleAdd = (product) => {
      setItems(prev => [...prev, product]);
    };

    const handleRemove = (productId) => {
      setItems(prev => prev.filter(p => p.id !== productId));
    };

    // Subscribe
    app.events.on('cart:add', handleAdd);
    app.events.on('cart:remove', handleRemove);

    // Cleanup on unmount
    return () => {
      app.events.off('cart:add', handleAdd);
      app.events.off('cart:remove', handleRemove);
    };
  }, []);

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

**Shorter with unsubscribe functions:**

```jsx
useEffect(() => {
  const unsubscribe1 = app.events.on('cart:add', handleAdd);
  const unsubscribe2 = app.events.on('cart:remove', handleRemove);

  return () => {
    unsubscribe1();
    unsubscribe2();
  };
}, []);
```

---

## Wildcards

**Listen to multiple related events:**

```jsx
// Listen to all user events
app.events.on('user:*', (data, channel) => {
  console.log(`Event on ${channel}:`, data);
});

// Matches: user:login, user:logout, user:update, etc.
```

**Listen to all events:**

```jsx
app.events.on('*', (data, channel) => {
  console.log(`Global event ${channel}:`, data);
});
```

**Callback signature with wildcards:**

```javascript
app.events.on('cart:*', (data, channel) => {
  // data: event payload
  // channel: exact channel name (e.g., 'cart:add', 'cart:remove')
});
```

---

## Common Patterns

### Shopping Cart

```jsx
// ProductCard.jsx
function ProductCard({ product }) {
  const app = useApp();

  const handleAddToCart = () => {
    app.events.emit('cart:add', {
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1
    });

    app.ui.toast('Added to cart!', { type: 'success' });
  };

  return (
    <div>
      <h3>{product.name}</h3>
      <button onClick={handleAddToCart}>Add to Cart</button>
    </div>
  );
}
```

```jsx
// CartDrawer.jsx
function CartDrawer() {
  const app = useApp();
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleAdd = (item) => {
      setItems(prev => {
        const existing = prev.find(p => p.id === item.id);
        if (existing) {
          return prev.map(p =>
            p.id === item.id
              ? { ...p, quantity: p.quantity + item.quantity }
              : p
          );
        }
        return [...prev, item];
      });

      // Auto-open drawer when item added
      setIsOpen(true);

      // Emit cart updated event
      app.events.emit('cart:updated', { items: [...items, item] });
    };

    return app.events.on('cart:add', handleAdd);
  }, [items]);

  return (
    <div className={`drawer ${isOpen ? 'open' : ''}`}>
      <h2>Cart ({items.length})</h2>
      {items.map(item => (
        <div key={item.id}>
          {item.name} x{item.quantity}
        </div>
      ))}
    </div>
  );
}
```

**Products and cart don't know about each other. They just work.**

### Auth State Sync

```jsx
function UserMenu() {
  const app = useApp();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Listen to auth events
    const handleLogin = (data) => {
      setUser(data.user);
    };

    const handleLogout = () => {
      setUser(null);
    };

    app.events.on('user:login', handleLogin);
    app.events.on('user:logout', handleLogout);

    return () => {
      app.events.off('user:login', handleLogin);
      app.events.off('user:logout', handleLogout);
    };
  }, []);

  if (!user) {
    return <button onClick={() => app.auth.requireLogin()}>Sign In</button>;
  }

  return (
    <div className="user-menu">
      <img src={user.image} alt={user.name} />
      <span>{user.name}</span>
      <button onClick={() => app.auth.signOut()}>Sign Out</button>
    </div>
  );
}
```

**Auth modal, user menu, profile page - all sync via events.**

### Modal Communication

```jsx
// Anywhere in your app
app.events.emit('modal:open', {
  modal: 'confirm-delete',
  data: { id: 123 }
});

// ModalManager.jsx
function ModalManager() {
  const [activeModal, setActiveModal] = useState(null);
  const [modalData, setModalData] = useState(null);

  useEffect(() => {
    const handleOpen = ({ modal, data }) => {
      setActiveModal(modal);
      setModalData(data);
    };

    const handleClose = () => {
      setActiveModal(null);
      setModalData(null);
    };

    app.events.on('modal:open', handleOpen);
    app.events.on('modal:close', handleClose);

    return () => {
      app.events.off('modal:open', handleOpen);
      app.events.off('modal:close', handleClose);
    };
  }, []);

  return (
    <>
      {activeModal === 'confirm-delete' && (
        <ConfirmDeleteModal data={modalData} />
      )}
      {/* Other modals... */}
    </>
  );
}
```

### Live Updates

```jsx
function NotificationBell() {
  const app = useApp();
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Listen to any event that should trigger notification
    const handleNotification = () => {
      setCount(prev => prev + 1);
    };

    app.events.on('comment:new', handleNotification);
    app.events.on('message:new', handleNotification);
    app.events.on('order:status', handleNotification);

    return () => {
      app.events.off('comment:new', handleNotification);
      app.events.off('message:new', handleNotification);
      app.events.off('order:status', handleNotification);
    };
  }, []);

  return (
    <button className="notification-bell">
      🔔 {count > 0 && <span className="badge">{count}</span>}
    </button>
  );
}
```

### Component Coordination

```jsx
// Form.jsx - emits validation events
function Form() {
  const app = useApp();

  const handleValidate = () => {
    const isValid = validateForm();

    app.events.emit('form:validated', {
      isValid,
      errors: getErrors()
    });
  };

  return <form onBlur={handleValidate}>...</form>;
}

// SubmitButton.jsx - listens and enables/disables
function SubmitButton() {
  const app = useApp();
  const [canSubmit, setCanSubmit] = useState(false);

  useEffect(() => {
    const handleValidation = ({ isValid }) => {
      setCanSubmit(isValid);
    };

    return app.events.on('form:validated', handleValidation);
  }, []);

  return (
    <button disabled={!canSubmit}>
      Submit
    </button>
  );
}
```

**Form and button coordinate without parent managing state.**

---

## Built-In Events

**JasonJS emits these events automatically:**

### Auth Events

| Event | Data | Description |
|-------|------|-------------|
| `user:login` | `{ user, verified, signup }` | User logged in |
| `user:logout` | `{ wasAuthenticated, userId }` | User logged out |
| `auth:cancelled` | `{ mode }` | Auth modal cancelled |

```jsx
app.events.on('user:login', ({ user, signup }) => {
  if (signup) {
    app.ui.toast(`Welcome, ${user.name}!`, { type: 'success' });
  }
});
```

### Billing Events

| Event | Data | Description |
|-------|------|-------------|
| `billing:subscribed` | `{ planId, subscription }` | User subscribed |
| `billing:canceled` | `{ subscription }` | Subscription cancelled |
| `billing:upgraded` | `{ oldPlan, newPlan }` | User upgraded |
| `billing:downgraded` | `{ oldPlan, newPlan }` | User downgraded |
| `billing:paymentSucceeded` | `{ payment }` | Payment completed |
| `billing:paymentFailed` | `{ payment }` | Payment failed |

```jsx
app.events.on('billing:subscribed', ({ planId }) => {
  app.ui.toast(`You're now on ${planId}!`, { type: 'success' });

  // Unlock features
  loadPremiumFeatures();
});
```

---

## Event Naming Conventions

**Use namespaces with colons:**

```
entity:action
```

**Good examples:**

```
user:login
user:logout
user:updated

cart:add
cart:remove
cart:cleared

order:created
order:shipped
order:delivered

comment:posted
comment:edited
comment:deleted

modal:open
modal:close

form:submitted
form:validated
```

**Use wildcards to listen to groups:**

```jsx
// Listen to all cart events
app.events.on('cart:*', handler);

// Listen to all user events
app.events.on('user:*', handler);
```

---

## Advanced Patterns

### Request-Response Pattern

```jsx
// Component A requests data
app.events.emit('data:request', { id: 123 });

// Component B responds
app.events.on('data:request', async ({ id }) => {
  const data = await fetchData(id);
  app.events.emit('data:response', { id, data });
});

// Component A receives response
app.events.once('data:response', ({ data }) => {
  console.log('Received data:', data);
});
```

### Event Chains

```jsx
// Start checkout flow
app.events.emit('checkout:start', { items });

// Validate inventory
app.events.on('checkout:start', async ({ items }) => {
  const available = await validateInventory(items);
  app.events.emit('checkout:validated', { items, available });
});

// Process payment
app.events.on('checkout:validated', async ({ items, available }) => {
  if (available) {
    const result = await processPayment(items);
    app.events.emit('checkout:complete', { result });
  }
});

// Show confirmation
app.events.on('checkout:complete', ({ result }) => {
  app.ui.toast('Order placed!', { type: 'success' });
  app.navigate.to('/order/' + result.orderId);
});
```

### Global State without Context

```jsx
// ThemeToggle.jsx
function ThemeToggle() {
  const app = useApp();

  const toggleTheme = () => {
    const newTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    app.events.emit('theme:changed', { theme: newTheme });
  };

  return <button onClick={toggleTheme}>Toggle Theme</button>;
}

// Navbar.jsx
function Navbar() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    return app.events.on('theme:changed', ({ theme }) => {
      setTheme(theme);
      document.body.className = theme;
    });
  }, []);

  return <nav className={`navbar-${theme}`}>...</nav>;
}

// Footer.jsx - also syncs automatically
function Footer() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    return app.events.on('theme:changed', ({ theme }) => {
      setTheme(theme);
    });
  }, []);

  return <footer className={`footer-${theme}`}>...</footer>;
}
```

**All components sync without global state manager.**

---

## Debugging Events

**Enable debug mode in development:**

```jsx
// Shows all events in console
app.events.setDebug(true);
```

**Get event statistics:**

```jsx
const stats = app.events.getStats();
console.log(stats);
// {
//   totalEmits: 453,
//   totalListeners: 12,
//   channelsCount: 8,
//   lastEventsCount: 15,
//   memoryUsage: '2KB'
// }
```

**List active channels:**

```jsx
const channels = app.events.getChannels();
console.log(channels);
// ['user:login', 'cart:*', 'modal:open', ...]
```

**Clear all listeners:**

```jsx
// Clear specific channel
app.events.clear('cart:add');

// Clear all
app.events.clear();
```

---

## Performance

**Event bus is optimized for:**

- ✅ Thousands of events per second
- ✅ Wildcard pattern matching
- ✅ Memory-efficient (automatic cleanup)
- ✅ No React re-renders unless you setState
- ✅ Zero dependencies

**Resource limits (configurable):**

- Max 100 listeners per channel
- Max 1000 total channels
- Max 500 stored last events

---

## Testing

**Mock events in tests:**

```jsx
import { render, screen } from '@testing-library/react';

test('cart updates when product added', () => {
  render(<CartDrawer />);

  // Emit event
  app.events.emit('cart:add', {
    id: '123',
    name: 'Test Product',
    price: 29.99
  });

  // Check UI updated
  expect(screen.getByText('Test Product')).toBeInTheDocument();
});
```

---

## Why This Matters

**Marketplace components work anywhere because:**

1. **No prop drilling** - Components emit/listen to events
2. **No context providers** - Events are global
3. **No wiring** - Drop component in, it works
4. **No dependencies** - Components don't import each other

**Example: Add a marketplace "ProductReviews" component**

```jsx
// ProductReviews.jsx (from marketplace)
function ProductReviews({ productId }) {
  useEffect(() => {
    // Listen to product events
    app.events.on('product:purchased', ({ id }) => {
      if (id === productId) {
        promptForReview();
      }
    });
  }, [productId]);

  return <div>Reviews...</div>;
}
```

**Works immediately. No integration needed.**

Your checkout page already emits `product:purchased`. The review component just listens.

---

## Summary

**Emit events:**
```jsx
app.events.emit('channel', data);
```

**Listen to events:**
```jsx
useEffect(() => {
  return app.events.on('channel', callback);
}, []);
```

**That's all you need.**

No providers. No prop drilling. Components just talk.

> 💡 **Tip:** Use namespaced event names (`entity:action`) and always clean up listeners in useEffect return.
