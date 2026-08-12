# Cache

Most things are cached automatically. This is for manual caching.

## You Probably Don't Need This

**Database queries, file reads, and API calls are already cached automatically.**

Manual caching is only for:
- Expensive computations
- External API responses
- Processed data that's slow to generate

---

## Quick Start

**Client-side (components):**

```jsx
'use client';
import { useApp } from '@jasonjs';

function MyComponent() {
  const app = useApp();

  const getExpensiveData = () => {
    // Check cache first
    const cached = app.cache.get('expensive-data');
    if (cached) return cached;

    // Compute expensive data
    const data = computeSomethingExpensive();

    // Cache for 5 minutes (300 seconds)
    app.cache.set('expensive-data', data, 300);

    return data;
  };

  return <div>{getExpensiveData()}</div>;
}
```

**Server-side (functions):**

```javascript
// functions/myFunction.js
async function myFunction(app) {
  // Check cache first
  const cached = await app.cache.get('api-response');
  if (cached) {
    return app.response({ data: cached });
  }

  // Fetch from external API
  const data = await fetchExternalAPI();

  // Cache for 10 minutes (600 seconds)
  await app.cache.set('api-response', data, 600);

  return app.response({ data });
}
```

---

## API

### Client-Side (Synchronous)

**app.cache.set(key, value, ttl)**

```jsx
// Cache for 5 minutes
app.cache.set('user-settings', settings, 300);

// Default TTL is 5 minutes
app.cache.set('data', data);
```

**app.cache.get(key, defaultValue)**

```jsx
const settings = app.cache.get('user-settings');

// With default value
const settings = app.cache.get('user-settings', {});
```

**app.cache.has(key)**

```jsx
if (app.cache.has('user-settings')) {
  console.log('Settings cached');
}
```

**app.cache.delete(key)**

```jsx
app.cache.delete('user-settings');
```

**app.cache.clear(pattern)**

```jsx
// Clear all
app.cache.clear();

// Clear by pattern
app.cache.clear('user:*');
```

**app.cache.stats()**

```jsx
const stats = app.cache.stats();
console.log(stats);
// { hits: 45, misses: 12, size: 23, totalSize: '156KB' }
```

---

### Server-Side (Async)

**Everything is async on the server:**

```javascript
// Set (async)
await app.cache.set('key', value, 300);

// Get (async)
const value = await app.cache.get('key');

// Has (async)
const exists = await app.cache.has('key');

// Delete (async)
await app.cache.delete('key');

// TTL (server only)
const remaining = await app.cache.ttl('key');

// Status (server only)
const status = await app.cache.status();
```

---

## Common Patterns

### Cache API Response

```jsx
async function fetchWeather(city) {
  const cacheKey = `weather:${city}`;

  // Check cache
  const cached = app.cache.get(cacheKey);
  if (cached) return cached;

  // Fetch from API
  const response = await fetch(`https://api.weather.com/${city}`);
  const data = await response.json();

  // Cache for 30 minutes
  app.cache.set(cacheKey, data, 1800);

  return data;
}
```

### Cache Expensive Computation

```jsx
function calculateStats(data) {
  const cacheKey = `stats:${data.id}`;

  const cached = app.cache.get(cacheKey);
  if (cached) return cached;

  // Expensive computation
  const stats = {
    total: data.reduce((sum, n) => sum + n, 0),
    average: data.reduce((sum, n) => sum + n, 0) / data.length,
    // ... more expensive calculations
  };

  // Cache for 1 hour
  app.cache.set(cacheKey, stats, 3600);

  return stats;
}
```

### Cache with Invalidation

```jsx
function CachedUserProfile({ userId }) {
  const app = useApp();
  const cacheKey = `profile:${userId}`;

  const [profile, setProfile] = useState(() => {
    return app.cache.get(cacheKey);
  });

  useEffect(() => {
    if (!profile) {
      loadProfile();
    }

    // Listen for profile updates
    const handleUpdate = () => {
      app.cache.delete(cacheKey);
      loadProfile();
    };

    app.events.on('profile:updated', handleUpdate);

    return () => {
      app.events.off('profile:updated', handleUpdate);
    };
  }, [userId]);

  const loadProfile = async () => {
    const data = await app.db.use('users').getById(userId);
    setProfile(data);
    app.cache.set(cacheKey, data, 600);
  };

  return <div>{profile?.name}</div>;
}
```

### Cache User Preferences

```jsx
function useUserPreferences() {
  const app = useApp();

  const getPreferences = () => {
    const cached = app.cache.get('user:preferences');
    if (cached) return cached;

    // Load from database
    const prefs = loadPreferences();
    app.cache.set('user:preferences', prefs, 3600);
    return prefs;
  };

  const updatePreferences = (newPrefs) => {
    // Update database
    savePreferences(newPrefs);

    // Update cache
    app.cache.set('user:preferences', newPrefs, 3600);
  };

  return { getPreferences, updatePreferences };
}
```

### Clear Cache on Logout

```jsx
useEffect(() => {
  const handleLogout = () => {
    // Clear all user-related cache
    app.cache.clear('user:*');
  };

  app.events.on('user:logout', handleLogout);

  return () => {
    app.events.off('user:logout', handleLogout);
  };
}, []);
```

---

## TTL (Time-To-Live)

**Default is 5 minutes (300 seconds).**

Common TTL values:

| Duration | Seconds | Use Case |
|----------|---------|----------|
| 1 minute | 60 | Frequently changing data |
| 5 minutes | 300 | Default, most use cases |
| 15 minutes | 900 | Semi-static data |
| 1 hour | 3600 | User preferences |
| 1 day | 86400 | Static configuration |

```jsx
// 1 minute
app.cache.set('key', value, 60);

// 1 hour
app.cache.set('key', value, 3600);

// 1 day
app.cache.set('key', value, 86400);
```

---

## Cache Keys

**Use namespaced keys:**

```
entity:action:identifier
```

**Good examples:**

```javascript
app.cache.set('user:profile:123', data);
app.cache.set('api:weather:london', data);
app.cache.set('stats:monthly:2024-01', data);
app.cache.set('settings:theme:dark', data);
```

**Clear by namespace:**

```javascript
// Clear all user cache
app.cache.clear('user:*');

// Clear all API cache
app.cache.clear('api:*');

// Clear specific user
app.cache.clear('user:profile:123');
```

---

## Automatic Caching

**These are already cached for you:**

### Database Queries

```jsx
// First call: hits database
const users = await app.db.use('users').fetch();

// Subsequent calls: returns cached result
const users = await app.db.use('users').fetch();
```

**Cache duration:** 5 minutes
**Invalidation:** Automatic on database writes

### File System

```javascript
// First load: reads from disk/database
const page = await getPage(domain, '/home');

// Subsequent loads: cached
const page = await getPage(domain, '/home');
```

**Cache duration:** 5 minutes
**Invalidation:** Manual via API

### Component Bundles

Dynamic components are cached after first compilation.

**Cache duration:** 1 hour in production, 1 minute in dev

---

## Size Limits

**Client-side cache:**
- Max 1MB per item
- Max 100 items total
- Automatic cleanup of expired items

**Server-side cache:**
- No size limit per item
- Uses Redis if available (distributed)
- Falls back to in-memory Map

---

## Pattern Matching

**Clear cache by pattern:**

```javascript
// Clear all user cache
app.cache.clear('user:*');

// Clear all cache for specific user
app.cache.clear('user:123:*');

// Clear all API cache
app.cache.clear('api:*');

// Clear everything
app.cache.clear();
```

---

## Statistics

**Get cache performance stats:**

```jsx
const stats = app.cache.stats();
console.log(stats);
```

**Returns:**

```javascript
{
  hits: 45,        // Cache hits
  misses: 12,      // Cache misses
  size: 23,        // Number of items
  totalSize: '156KB'  // Memory usage
}
```

**Use for monitoring:**

```jsx
useEffect(() => {
  const interval = setInterval(() => {
    const stats = app.cache.stats();
    console.log('Cache hit rate:', stats.hits / (stats.hits + stats.misses));
  }, 60000); // Every minute

  return () => clearInterval(interval);
}, []);
```

---

## Server-Side Only Features

### app.cache.ttl(key)

Get remaining TTL in seconds.

```javascript
const remaining = await app.cache.ttl('key');
console.log(`Expires in ${remaining} seconds`);
```

### app.cache.status()

Get cache system status (Redis quota, connection, etc).

```javascript
const status = await app.cache.status();
console.log(status);
// { connected: true, memoryUsage: '2MB', quota: '10MB' }
```

---

## When to Use Manual Cache

**Use `app.cache` when:**

✅ Calling external APIs
✅ Computing expensive calculations
✅ Processing large datasets
✅ User preferences and settings
✅ Rate-limited API responses

**Don't use `app.cache` when:**

❌ Database queries (already cached)
❌ File system reads (already cached)
❌ Component renders (React handles this)
❌ Simple calculations (not worth overhead)

---

## Cache vs Database

**Cache is temporary, database is permanent:**

```jsx
// ❌ DON'T use cache for persistent data
app.cache.set('user-profile', profile);

// ✅ DO use database for persistent data
await app.db.use('users').update(userId, profile);

// ✅ DO use cache to avoid re-fetching
const cached = app.cache.get('user-profile');
if (!cached) {
  const profile = await app.db.use('users').getById(userId);
  app.cache.set('user-profile', profile, 600);
}
```

**Cache is for performance, not storage.**

---

## Development vs Production

**In development:**
- Cache is disabled by default for hot reload
- Shorter TTLs (1 minute for bundles)
- Debug logging enabled

**In production:**
- Full caching enabled
- Longer TTLs (1 hour for bundles)
- No debug logging

**Override in dev:**

```jsx
// Force caching in development
app.cache.set('key', value, 300, { force: true });
```

---

## Best Practices

### 1. Use Descriptive Keys

```javascript
// ❌ BAD
app.cache.set('data', data);

// ✅ GOOD
app.cache.set('api:weather:london', data);
```

### 2. Set Appropriate TTLs

```javascript
// ❌ BAD - too short, defeats purpose
app.cache.set('key', value, 1);

// ❌ BAD - too long, stale data
app.cache.set('key', value, 86400 * 30);

// ✅ GOOD - matches data update frequency
app.cache.set('key', value, 300);
```

### 3. Invalidate on Update

```javascript
const updateUser = async (userId, updates) => {
  await app.db.use('users').update(userId, updates);

  // Invalidate cache
  app.cache.delete(`user:${userId}`);
};
```

### 4. Check Cache First

```javascript
// ❌ BAD - always fetches
const data = await fetchData();
app.cache.set('data', data);

// ✅ GOOD - checks cache first
const cached = app.cache.get('data');
if (cached) return cached;

const data = await fetchData();
app.cache.set('data', data);
```

### 5. Clean Up

```javascript
// Clear cache on logout
app.events.on('user:logout', () => {
  app.cache.clear('user:*');
});

// Clear cache periodically
setInterval(() => {
  app.cache.clear('temp:*');
}, 3600000); // Every hour
```

---

## Debugging

**Enable cache logging:**

```jsx
// See all cache operations in console
app.cache.setDebug(true);
```

**Check what's cached:**

```jsx
const keys = app.cache.keys();
console.log('Cached keys:', keys);
```

**Monitor hit rate:**

```jsx
const stats = app.cache.stats();
const hitRate = stats.hits / (stats.hits + stats.misses);
console.log(`Hit rate: ${(hitRate * 100).toFixed(1)}%`);
```

---

## Summary

**Client-side cache (sync):**
```jsx
app.cache.set('key', value, 300);
const value = app.cache.get('key');
app.cache.delete('key');
app.cache.clear('pattern:*');
```

**Server-side cache (async):**
```javascript
await app.cache.set('key', value, 300);
const value = await app.cache.get('key');
await app.cache.delete('key');
```

**Most caching is automatic. Use `app.cache` for:**
- External API responses
- Expensive computations
- User preferences

> 💡 **Tip:** Always set a reasonable TTL. Data should be fresh enough to be useful, but cached long enough to improve performance.
