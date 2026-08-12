---
skill: realtime
when: "Building live dashboards, chat, real-time updates"
requires: []
---

# Realtime

> Database subscriptions, event-driven updates, and WebSocket connections.

## Quick Start

```jsx
const LiveOrders = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    // Initial load
    app.db.use('orders').query({ status: 'pending' }).then(setOrders);

    // Real-time updates
    const subscription = app.db.use('orders')
      .subscribe({ status: 'pending' }, (change) => {
        if (change.type === 'create') {
          setOrders(prev => [change.data, ...prev]);
        } else if (change.type === 'update') {
          setOrders(prev => prev.map(o =>
            o._id === change.id ? change.data : o
          ));
        } else if (change.type === 'delete') {
          setOrders(prev => prev.filter(o => o._id !== change.id));
        }
      });

    return () => subscription.unsubscribe(); // Always cleanup!
  }, []);

  return (
    <ul>
      {orders.map(order => (
        <li key={order._id}>{order.customer} - {order.status}</li>
      ))}
    </ul>
  );
};
```

## Database Subscriptions

Subscribe to collection changes with filters:

```jsx
// Subscribe to all changes
const sub = app.db.use('messages').subscribe({}, callback);

// Subscribe with filter
const sub = app.db.use('orders').subscribe(
  { status: 'processing', assignedTo: userId },
  (change) => { /* ... */ }
);

// Cleanup
sub.unsubscribe();
```

### Change Object

```javascript
{
  type: 'create' | 'update' | 'delete',
  id: 'record_id',
  data: { /* full record for create/update */ },
  changes: { /* changed fields for update */ }
}
```

## Event Bus

Inter-component communication without prop drilling:

```jsx
// Component A: Emit events
const handleAddToCart = (product) => {
  app.events.emit('cart:add', { product, quantity: 1 });
};

// Component B: Listen for events
useEffect(() => {
  const unsubscribe = app.events.on('cart:add', ({ product }) => {
    setCartCount(prev => prev + 1);
    app.ui.toast(`${product.name} added!`);
  });

  return unsubscribe; // Always cleanup!
}, []);
```

### Wildcard Listeners

```jsx
// Listen to all cart events
app.events.on('cart:*', (data, { channel }) => {
  console.log(`Cart event: ${channel}`, data);
});

// Listen to all billing events
app.events.on('billing:*', handler);
```

### Built-in Events

| Event | When | Data |
|-------|------|------|
| `user.login` | User logged in | `{ user, verified }` |
| `user.logout` | User logged out | `{ wasAuthenticated }` |
| `billing:subscribed` | New subscription | `{ planId, subscription }` |
| `billing:canceled` | Subscription canceled | `{ subscriptionId }` |
| `auth.requireLogin` | Login modal requested | `{ options }` |

## WebSocket Connections

For custom real-time protocols:

```jsx
useEffect(() => {
  // Connect with JSON message handling
  const ws = app.functions.socket.connectJSON('wss://api.example.com/ws', {
    onMessage: (data) => {
      setMessages(prev => [...prev, data]);
    },
    onOpen: () => console.log('Connected'),
    onClose: () => console.log('Disconnected'),
    onError: (err) => console.error('WS Error:', err)
  });

  // Send JSON messages
  ws.sendJSON({ type: 'subscribe', channel: 'updates' });

  return () => ws.close();
}, []);
```

### Raw WebSocket

```jsx
const ws = app.functions.socket.connect('wss://api.example.com/ws', {
  onMessage: (event) => {
    const data = JSON.parse(event.data);
    // Handle message
  }
});

ws.send(JSON.stringify({ type: 'ping' }));
```

## Common Patterns

### Chat Messages

```jsx
const ChatRoom = ({ roomId }) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Load history
    app.db.use('messages')
      .query({ roomId })
      .orderBy('createdAt', 'asc')
      .limit(50)
      .then(setMessages);

    // Subscribe to new messages
    const sub = app.db.use('messages')
      .subscribe({ roomId }, (change) => {
        if (change.type === 'create') {
          setMessages(prev => [...prev, change.data]);
        }
      });

    return () => sub.unsubscribe();
  }, [roomId]);

  const sendMessage = async (text) => {
    await app.db.use('messages').add({
      roomId,
      text,
      sender: app.auth.user.name
    });
  };

  return (
    <div>
      {messages.map(msg => (
        <div key={msg._id}>{msg.sender}: {msg.text}</div>
      ))}
      <MessageInput onSend={sendMessage} />
    </div>
  );
};
```

### Live Dashboard Counter

```jsx
const LiveStats = () => {
  const [stats, setStats] = useState({ orders: 0, revenue: 0 });

  useEffect(() => {
    // Load initial
    loadStats().then(setStats);

    // Listen for updates
    const unsub = app.events.on('order:created', () => {
      loadStats().then(setStats);
    });

    return unsub;
  }, []);

  return (
    <div>
      <Stat label="Orders" value={stats.orders} />
      <Stat label="Revenue" value={stats.revenue} />
    </div>
  );
};
```

### Notification Badge

```jsx
const NotificationBadge = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const unsub = app.events.on('notification:new', () => {
      setCount(prev => prev + 1);
    });

    const clear = app.events.on('notifications:read', () => {
      setCount(0);
    });

    return () => { unsub(); clear(); };
  }, []);

  if (count === 0) return null;
  return <Badge>{count}</Badge>;
};
```

## API Reference

| Method | Description |
|--------|-------------|
| `app.db.use(name).subscribe(filters, cb)` | Subscribe to DB changes |
| `subscription.unsubscribe()` | Stop subscription |
| `app.events.emit(channel, data)` | Emit event |
| `app.events.on(channel, callback)` | Listen for events |
| `app.events.once(channel, callback)` | One-time listener |
| `app.events.off(channel, callback)` | Remove listener |
| `app.events.getLastEvent(channel)` | Get last emitted data |
| `app.functions.socket.connect(url, opts)` | Raw WebSocket |
| `app.functions.socket.connectJSON(url, opts)` | JSON WebSocket |

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Forget cleanup | Always return unsubscribe from `useEffect` |
| Subscribe without initial load | Fetch first, then subscribe |
| Create multiple subscriptions for same filter | One subscription per filter |
| Use `app.events.off()` directly | Use returned function from `on()` |
| Mutate state directly in callback | Use functional updates: `setPrev => ...` |
| Subscribe in render | Subscribe in `useEffect` only |

## Related

- `docs/realtime.md` - Human reference (event bus, SSE subscriptions, sockets)
- `skill:component` - Event patterns in components
- `skill:database` - Query subscriptions
