# Geolocation & Maps

Location features in JasonJS span four layers: getting the user's position (`app.browser.location`), storing it (`geopoint` fields, GeoJSON), querying it (geospatial methods on `app.db`), and displaying it (the `@framework/LMap` Leaflet component).

> **Requires MongoDB for queries.** Geospatial queries (`nearBy`, `within*`) are served by MongoDB's 2dsphere indexes. The zero-config file store throws a clear error for them — set `MONGODB_URI` to use location search. Getting the user's position and showing maps works everywhere.

## The five-minute version

```jsx
// 1. Get the user's position (asks for browser permission)
const loc = await app.browser.location.get();
// → { latitude, longitude, accuracy, altitude, ... }

// 2. Find places within 5km
const places = await app.db.use('places')
  .nearBy('location', [loc.longitude, loc.latitude], 5000);

// 3. Show them on a map
<LMap markers={places.map(p => ({
  lat: p.location.coordinates[1],
  lng: p.location.coordinates[0],
  popup: `<b>${p.name}</b>`
}))} height="500px" />
```

**The one rule that prevents 90% of geo bugs:** GeoJSON stores `[longitude, latitude]`; Leaflet (and `LMap`) wants `{ lat, lng }`. Every handoff between the database and the map flips the order:

```javascript
{ lat: doc.location.coordinates[1], lng: doc.location.coordinates[0] }
```

---

## Getting the user's position

```jsx
const loc = await app.browser.location.get();   // throws if denied/unavailable
```

Handle denial gracefully — it's common:

```jsx
try {
  const loc = await app.browser.location.get();
  setCoords([loc.longitude, loc.latitude]);
} catch (err) {
  app.ui.toast('Could not get your location', { type: 'error' });
}
```

Watch for movement:

```jsx
useEffect(() => {
  const watchId = app.browser.location.watch((pos) => {
    setCoords([pos.longitude, pos.latitude]);
  });
  return () => navigator.geolocation.clearWatch(watchId);
}, []);
```

On native (the mobile container), the same calls use the device GPS — no code changes.

## Storing locations

Declare a `geopoint` field in your database schema (`settings/database.json`):

```json
{
  "stores": {
    "type": "jason",
    "schema": {
      "name": { "type": "text", "label": "Name" },
      "location": { "type": "geopoint", "label": "Location" }
    }
  }
}
```

`geopoint` fields automatically get a 2dsphere index. Values are GeoJSON Points:

```javascript
{
  name: "Coffee Shop",
  location: { type: "Point", coordinates: [-73.935242, 40.730610] }  // [lng, lat]
}
```

**Address input with autocomplete:** `@framework/FormBuilder` renders a location picker for `geopoint` fields, and a text field with `location: true, location_ref: 'coordinates'` autocompletes addresses (OpenStreetMap Nominatim) and fills the referenced geopoint:

```json
{
  "address": { "type": "text", "label": "Address", "location": true, "location_ref": "location" },
  "location": { "type": "geopoint", "hidden": true }
}
```

## Querying by location

All geospatial methods work on both client and server through `app.db`:

```javascript
// Within a distance (meters). Optional 4th arg = minimum distance.
const nearby = await app.db.use('stores')
  .nearBy('location', [lng, lat], 5000);

// Combine with filters and sorting
const results = await app.db.use('restaurants')
  .query({ cuisine: 'italian', isOpen: true })
  .nearBy('location', coords, 2000)
  .orderBy('rating', 'desc')
  .limit(10);

// Within a circle / bounding box / arbitrary GeoJSON shape
await app.db.use('stores').query({}).withinCircle('location', [lng, lat], 5000);
await app.db.use('stores').query({}).withinBounds('location', [west, south], [east, north]);
await app.db.use('stores').query({}).withinGeometry('location', { type: 'Polygon', coordinates: [...] });
```

Pages can fetch nearby data declaratively:

```json
{
  "fetch_data": {
    "database": "stores",
    "nearBy": { "field": "location", "coordinates": [-73.935, 40.730], "maxDistance": 5000 },
    "limit": 20
  }
}
```

Utility helpers on `app.utils`:

```javascript
app.utils.calculateDistance([lng1, lat1], [lng2, lat2]);  // meters
app.utils.formatCoordinates([lng, lat]);                  // "40.7306° N, 73.9352° W"
app.utils.getBoundingBox([lng, lat], 5000);               // { sw, ne }
```

General query documentation: [databases.md](./databases.md).

## Displaying maps — `@framework/LMap`

A Leaflet map with markers, popups, user location, exploration mode, and legends. In a JSON page:

```json
{
  "component": "@framework/LMap",
  "attributes": { "height": "500px", "markers": "{{data}}" }
}
```

In a component:

```jsx
import LMap from '@/components/framework/LMap';

<LMap
  markers={[{ lat: -34.603, lng: -58.381, popup: '<b>Buenos Aires</b>' }]}
  mapConfig={{ center: [-34.6, -58.4], zoom: 12 }}
  height="500px"
/>
```

### Key props

| Prop | Type | Description |
|------|------|-------------|
| `markers` | array | `{ lat, lng, popup?, icon?, iconSize?, iconAnchor?, clickable? }` |
| `userLocation` | object | `{ lat, lng, popup? }` — renders the "you are here" marker |
| `searchRadius` | number | Circle (meters) drawn around `userLocation` |
| `mapConfig` | object | `{ center: [lat, lng], zoom }` — changing `center` animates a pan |
| `onMarkerClick` | fn | `(marker, index) => void`; markers become clickable instead of showing popups |
| `onMapClick` | fn | Leaflet click event — read `e.latlng` for pin-placement UIs |
| `onBoundsChange` | fn | `({ bounds, center, zoom, isExploring })`, debounced 500ms |
| `enableExploration` | bool | Adds a "search this area" toggle for search-as-you-pan |
| `legend` | object | `{ items: [{ label, style }] }` |
| `height` | string | CSS value — always include units (`"500px"`, `"calc(100vh - 80px)"`) |
| `tileLayer` | string | Custom tile provider URL (default OpenStreetMap) |

### Always use custom marker icons

Leaflet's default marker images don't load in the JasonJS runtime — always pass `icon` HTML:

```jsx
const pinIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#3b82f6"/><circle cx="16" cy="16" r="6" fill="white"/></svg>';

const markers = [{ lat: -34.6, lng: -58.38, icon: pinIcon, iconSize: [32, 40], iconAnchor: [16, 40] }];
```

Any HTML works — colored dots, status badges, counts:

```jsx
icon: `<div style="background:${store.isOpen ? '#22c55e' : '#ef4444'};color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:2px solid white;">${store.isOpen ? '✓' : '✕'}</div>`
```

### Pattern: nearby search around the user

```jsx
const NearbyMap = () => {
  const [userLoc, setUserLoc] = useState(null);
  const [markers, setMarkers] = useState([]);
  const radius = 5000;

  useEffect(() => {
    (async () => {
      try {
        const loc = await app.browser.location.get();
        setUserLoc({ lat: loc.latitude, lng: loc.longitude, popup: 'You are here' });
        const nearby = await app.db.use('stores')
          .nearBy('location', [loc.longitude, loc.latitude], radius);
        setMarkers(nearby.map(s => ({
          lat: s.location.coordinates[1],
          lng: s.location.coordinates[0],
          popup: `<b>${s.name}</b>`
        })));
      } catch {
        app.ui.toast('Could not get location', { type: 'error' });
      }
    })();
  }, []);

  return <LMap markers={markers} userLocation={userLoc} searchRadius={radius} height="600px" />;
};
```

### Pattern: search as you pan

```jsx
<LMap
  markers={markers}
  enableExploration={true}
  explorationButton={{ text: 'Search this area' }}
  onBoundsChange={async ({ bounds, isExploring }) => {
    if (!isExploring) return;
    const results = await app.db.use('places').query({})
      .withinBounds('location', [bounds.west, bounds.south], [bounds.east, bounds.north])
      .limit(50);
    setMarkers(results.map(toMarker));
  }}
  height="600px"
/>
```

Keep marker counts to ~50–100 per view; use exploration mode instead of loading everything.

## Gotchas

| Don't | Do |
|-------|----|
| Store `[lat, lng]` | GeoJSON is `[lng, lat]` — longitude first |
| `mapConfig.center: [lng, lat]` | Leaflet centers are `[lat, lng]` |
| Assume location permission | Catch the rejection and degrade gracefully |
| Rely on default Leaflet markers | Always pass custom `icon` HTML |
| Run `nearBy` on the file store | Geospatial queries need `MONGODB_URI` |
| Store coordinates as a bare array | Use `{ type: 'Point', coordinates: [lng, lat] }` |

The agent-oriented version of this guide, with more component patterns (dual address+pin input, clickable marker lists, legends): [skills/geolocation.md](../skills/geolocation.md).
