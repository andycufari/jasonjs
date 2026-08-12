# Realtime

Three tools cover live behavior in JasonJS, from lightest to heaviest:

1. **`app.events`** — the in-page event bus. Components react to each other without wiring. No server involved.
2. **`app.db.use(...).subscribe(...)`** — live database subscriptions. The browser holds a Server-Sent Events (SSE) connection to `/api/data/<database>/subscribe`; changes stream in as they happen. **Requires MongoDB** — the server side is built on MongoDB Change Streams, and the file store throws a clear error.
3. **`app.functions.socket`** — raw/JSON WebSocket helpers for connecting to *external* real-time services.

Reach for them in that order.

## The event bus — `app.events`

Components communicate through named channels instead of props or context. This is the mechanism that lets independently-built components (including drop-in marketplace components) work together:

```jsx
// ProductCard.jsx — knows nothing about the cart UI
app.events.emit('cart:add', { product, quantity: 1 });

// CartDrawer.jsx — knows nothing about product cards
useEffect(() => {
  const unsubscribe = app.events.on('cart:add', ({ product }) => {
    setCount(prev => prev + 1);
    app.ui.toast(`${product.name} added!`);
  });
  return unsubscribe;   // always clean up
}, []);
```

### API

| Method | Description |
|--------|-------------|
| `app.events.emit(channel, data)` | Emit to a channel |
| `app.events.on(channel, cb)` | Listen; **returns an unsubscribe function** |
| `app.events.once(channel, cb)` | One-shot listener |
| `app.events.off(channel, cb)` | Remove a specific handler (prefer the returned unsubscriber) |
| `app.events.getLastEvent(channel)` | Last data emitted on an exact channel |

Wildcards match channel prefixes:

```jsx
app.events.on('cart:*', (data, { channel }) => {
  console.log(`cart event: ${channel}`, data);
});
```

Late subscribers can replay the most recent event on an exact (non-wildcard) channel:

```jsx
app.events.on('user.login', handler, { replay: true });
```

### Framework events you can listen for

| Event | When |
|-------|------|
| `user.login` / `user.logout` | Auth state changes |
| `billing:subscribed` / `billing:canceled` | Subscription lifecycle |
| `auth.requireLogin` | Something requested the login modal |

Emitting your own domain events (`order:created`, `notification:new`, ...) from functions-calling components is the idiomatic way to make dashboards and badges live without polling.

## Database subscriptions

Live queries over your data. Fetch first, then subscribe — the subscription only delivers *changes*:

```jsx
const LiveOrders = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    // 1. Initial load
    app.db.use('orders').query({ status: 'pending' }).then(setOrders);

    // 2. Live changes
    const sub = app.db.use('orders').subscribe({ status: 'pending' }, (change) => {
      if (change.type === 'create') setOrders(prev => [change.data, ...prev]);
      else if (change.type === 'update') setOrders(prev => prev.map(o => o._id === change.id ? change.data : o));
      else if (change.type === 'delete') setOrders(prev => prev.filter(o => o._id !== change.id));
    });

    return () => sub.unsubscribe();   // always clean up
  }, []);

  return <ul>{orders.map(o => <li key={o._id}>{o.customer} — {o.status}</li>)}</ul>;
};
```

The change object:

```javascript
{
  type: 'create' | 'update' | 'delete',
  id: 'record_id',
  data: { /* full record for create/update */ }
}
```

Notes:

- **Transport** is SSE (`EventSource`) — works through ordinary HTTP, no WebSocket infrastructure needed. If the connection errors, your callback receives `{ type: 'error' }`.
- **Security rules apply.** The subscribe endpoint enforces the database's `security.read` level (`authenticated` / `owner` / `admin`) just like reads do.
- **MongoDB only.** Subscriptions are backed by Change Streams. On the file store, `subscribe` throws with a message telling you to set `MONGODB_URI`.
- One subscription per filter — don't open a new one per render.

### Pattern: chat room

```jsx
useEffect(() => {
  app.db.use('messages').query({ roomId }).orderBy('createdAt', 'asc').limit(50).then(setMessages);

  const sub = app.db.use('messages').subscribe({ roomId }, (change) => {
    if (change.type === 'create') setMessages(prev => [...prev, change.data]);
  });
  return () => sub.unsubscribe();
}, [roomId]);

const send = (text) => app.db.use('messages').add({ roomId, text, sender: app.auth.user.name });
```

## External WebSockets — `app.functions.socket`

For third-party real-time APIs (not needed for JasonJS's own data — use subscriptions for that):

```jsx
useEffect(() => {
  const ws = app.functions.socket.connectJSON('wss://api.example.com/ws', {
    onMessage: (data) => setTicks(prev => [...prev, data]),
    onOpen:    () => console.log('connected'),
    onError:   (err) => console.error(err)
  });
  ws.sendJSON({ type: 'subscribe', channel: 'prices' });
  return () => ws.close();
}, []);
```

`connect(url, handlers)` is the raw variant — same handlers, but `onMessage` receives the raw event and you parse yourself. Both return the underlying `WebSocket` (or `null` server-side).

## Gotchas

| Don't | Do |
|-------|----|
| Forget cleanup | Return the unsubscriber from `useEffect` — events *and* subscriptions |
| Subscribe before loading | Fetch initial data, then subscribe to changes |
| Poll `app.db` on an interval | Subscribe (Mongo) or emit an event after writes |
| Mutate state in callbacks | Use functional updates (`setX(prev => ...)`) |
| Expect subscriptions on the file store | Set `MONGODB_URI` |

The agent-oriented version with more patterns (live counters, notification badges): [skills/realtime.md](../skills/realtime.md).
