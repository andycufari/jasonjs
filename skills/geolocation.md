---
skill: geolocation
when: "Building location-based features, maps, nearby search, displaying markers, LMap component"
requires: []
---

# Geolocation & Maps

> User location, nearby queries, map display, markers, and geospatial searches.

## Quick Start

```jsx
// Get user location
const loc = await app.browser.location.get();
const coords = [loc.longitude, loc.latitude];

// Find nearby places
const places = await app.db.use('places')
  .nearBy('location', coords, 5000); // 5km radius
```

## End-to-End Flow

1. **Schema** → `"type": "geopoint"` auto-creates 2dsphere index
2. **FormBuilder** → Renders LocationInput with address search (Nominatim) + manual coordinates
3. **Storage** → GeoJSON Point: `{ type: "Point", coordinates: [lng, lat] }` — **lng first**
4. **Querying** → `app.db.use('x').nearBy('location', [lng, lat], meters)`
5. **JasonTable** → Displays coordinates + clickable "Abrir en mapa" Google Maps link
6. **LMap** → Extract: `{ lat: doc.location.coordinates[1], lng: doc.location.coordinates[0] }`

## Get User Location

```jsx
const LocationButton = () => {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);

  const getLocation = async () => {
    try {
      const loc = await app.browser.location.get();
      setCoords([loc.longitude, loc.latitude]);
    } catch (err) {
      setError('Location permission denied');
    }
  };

  return (
    <div>
      <button onClick={getLocation}>Get My Location</button>
      {coords && <p>Location: {coords[0]}, {coords[1]}</p>}
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};
```

### Watch Location Changes

```jsx
useEffect(() => {
  const watchId = app.browser.location.watch((position) => {
    setCoords([position.longitude, position.latitude]);
  });

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}, []);
```

## Nearby Queries

```jsx
// Basic nearby search
const nearby = await app.db.use('stores')
  .nearBy('location', [lng, lat], 5000); // 5km

// With filters and sorting
const results = await app.db.use('restaurants')
  .query({ cuisine: 'italian', isOpen: true })
  .nearBy('location', coords, 2000)
  .orderBy('rating', 'desc')
  .limit(10);

// Minimum distance too
const notTooClose = await app.db.use('places')
  .nearBy('location', coords, 10000, 1000); // 1-10km away
```

## Geospatial Query Methods

```jsx
// Within circle
const inArea = await app.db.use('stores')
  .query({})
  .withinCircle('location', [lng, lat], 5000); // 5km radius

// Within bounding box
const inBox = await app.db.use('stores')
  .query({})
  .withinBounds('location', [-74.0, 40.7], [-73.9, 40.8]); // SW, NE corners

// Within custom geometry (GeoJSON)
const inPolygon = await app.db.use('stores')
  .query({})
  .withinGeometry('location', {
    type: 'Polygon',
    coordinates: [[[lng1, lat1], [lng2, lat2], [lng3, lat3], [lng1, lat1]]]
  });
```

## Location Form Fields

### Schema

```json
{
  "address": {
    "type": "text",
    "label": "Address",
    "location": true,
    "location_ref": "coordinates"
  },
  "coordinates": {
    "type": "geopoint",
    "label": "Location",
    "showCoordinates": true
  }
}
```

### FormBuilder

```jsx
<FormBuilder
  database="stores"
  schema={{
    name: { type: 'text', label: 'Store Name' },
    address: {
      type: 'text',
      label: 'Address',
      location: true,
      location_ref: 'coordinates'
    },
    coordinates: {
      type: 'geopoint',
      showCoordinates: true
    }
  }}
  onSuccess={() => app.ui.toast('Saved!')}
/>
```

When `location: true` is set on a text field with `location_ref`, typing an address will autocomplete and populate the referenced geopoint field.

### Standalone Location Components

The location sub-components can be used independently outside of FormBuilder:

```jsx
import LocationTextInput from '@/components/framework/FormBuilder/inputs/LocationTextInput';
import LocationInput from '@/components/framework/FormBuilder/inputs/LocationInput';
```

Use `LocationTextInput` when you need address autocomplete without a full FormBuilder form.

## Database Schema

```json
{
  "type": "jason",
  "schema": {
    "name": { "type": "text", "label": "Name" },
    "location": {
      "type": "geopoint",
      "label": "Location",
      "index": true
    }
  }
}
```

**Important:** `geopoint` fields automatically create a 2dsphere index for geospatial queries.

## Page-Level Fetch

```json
{
  "fetch_data": {
    "database": "stores",
    "nearBy": {
      "field": "location",
      "coordinates": [-73.935, 40.730],
      "maxDistance": 5000
    },
    "limit": 20
  }
}
```

## Store Location Data

Location data is stored as GeoJSON:

```javascript
// Saved automatically by FormBuilder
{
  name: "Coffee Shop",
  location: {
    type: "Point",
    coordinates: [-73.935242, 40.730610] // [lng, lat]
  }
}
```

## Utility Functions

```jsx
// Calculate distance between points
const distance = app.utils.calculateDistance(
  [lng1, lat1],
  [lng2, lat2]
); // Returns meters

// Format coordinates for display
const formatted = app.utils.formatCoordinates([lng, lat]);
// "40.7306° N, 73.9352° W"

// Get bounding box around a point
const bbox = app.utils.getBoundingBox([lng, lat], 5000); // 5km
// { sw: [lng, lat], ne: [lng, lat] }
```

## LMap Component

### In a JSON Page

```json
{
  "components": [
    {
      "component": "@framework/LMap",
      "attributes": {
        "height": "500px",
        "markers": "{{data}}",
        "onMarkerClick": "{{onMarkerClick}}"
      }
    }
  ]
}
```

### In a Component

```jsx
import LMap from '@/components/framework/LMap';

const StoreLocator = ({ jcontext }) => {
  const [stores, setStores] = useState([]);

  useEffect(() => {
    app.db.use('stores').get().then(data => {
      setStores(data.map(s => ({
        lat: s.location.coordinates[1],
        lng: s.location.coordinates[0],
        popup: `<b>${s.name}</b><br/>${s.address}`,
        icon: `<div style="background:#3b82f6;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:bold;">S</div>`
      })));
    });
  }, []);

  return <LMap markers={stores} height="500px" className="rounded-xl" />;
};

export default StoreLocator;
```

## LMap Patterns

### Static Markers

```jsx
<LMap
  markers={[
    { lat: -34.603, lng: -58.381, popup: '<b>Buenos Aires</b>' },
    { lat: -34.920, lng: -57.954, popup: '<b>La Plata</b>' },
    { lat: -31.420, lng: -64.188, popup: '<b>Cordoba</b>' }
  ]}
  height="400px"
  mapConfig={{ center: [-34.0, -60.0], zoom: 6 }}
/>
```

### Clickable Markers (No Popup)

Navigate or show details when a marker is clicked.

```jsx
const MapWithClickableMarkers = ({ jcontext }) => {
  const [selected, setSelected] = useState(null);
  const [places, setPlaces] = useState([]);

  useEffect(() => {
    app.db.use('places').get({ limit: 50 }).then(data => {
      setPlaces(data.map(p => ({
        ...p,
        lat: p.location.coordinates[1],
        lng: p.location.coordinates[0],
        clickable: true
      })));
    });
  }, []);

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <LMap
          markers={places}
          onMarkerClick={(marker, index) => setSelected(marker)}
          height="500px"
        />
      </div>
      {selected && (
        <div className="w-80 p-4 bg-white rounded-lg shadow">
          <h3 className="font-bold">{selected.name}</h3>
          <p>{selected.address}</p>
        </div>
      )}
    </div>
  );
};
```

When `onMarkerClick` is provided and `clickable !== false`, markers trigger the callback instead of showing a popup.

### User Location + Nearby Search

Show the user's position and nearby results with a search radius circle.

```jsx
const NearbyMap = ({ jcontext }) => {
  const [userLoc, setUserLoc] = useState(null);
  const [markers, setMarkers] = useState([]);
  const radius = 5000; // 5km

  useEffect(() => {
    const init = async () => {
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
      } catch (err) {
        app.ui.toast('Could not get location', { type: 'error' });
      }
    };
    init();
  }, []);

  return (
    <LMap
      markers={markers}
      userLocation={userLoc}
      searchRadius={radius}
      height="600px"
    />
  );
};
```

### Exploration Mode (Search as You Pan)

Reload results when the user moves the map.

```jsx
const ExploreMap = ({ jcontext }) => {
  const [markers, setMarkers] = useState([]);

  const handleBoundsChange = async ({ bounds, center, zoom, isExploring }) => {
    if (!isExploring) return;

    const results = await app.db.use('places')
      .query({})
      .withinBounds('location',
        [bounds.west, bounds.south],
        [bounds.east, bounds.north]
      )
      .limit(50);

    setMarkers(results.map(p => ({
      lat: p.location.coordinates[1],
      lng: p.location.coordinates[0],
      popup: `<b>${p.name}</b>`
    })));
  };

  return (
    <LMap
      markers={markers}
      enableExploration={true}
      explorationButton={{
        text: 'Search this area',
        activeText: 'Searching this area',
        helpText: 'Pan the map to search other areas'
      }}
      onBoundsChange={handleBoundsChange}
      height="600px"
    />
  );
};
```

### Custom Marker Icons

Use HTML for fully custom marker visuals.

```jsx
const markers = stores.map(store => ({
  lat: store.location.coordinates[1],
  lng: store.location.coordinates[0],
  icon: `
    <div style="
      background: ${store.isOpen ? '#22c55e' : '#ef4444'};
      color: white;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">${store.isOpen ? '✓' : '✕'}</div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
  className: 'custom-marker'
}));

<LMap markers={markers} height="500px" />
```

### Map with Legend

```jsx
<LMap
  markers={markers}
  height="500px"
  legend={{
    items: [
      { label: 'Open', style: { background: '#22c55e', width: 16, height: 16, borderRadius: '50%' } },
      { label: 'Closed', style: { background: '#ef4444', width: 16, height: 16, borderRadius: '50%' } },
      { label: 'Your Location', style: { background: '#3b82f6', width: 16, height: 16, borderRadius: '50%' } }
    ]
  }}
/>
```

### Map Click to Add Location

```jsx
const LocationPicker = ({ jcontext }) => {
  const [pin, setPin] = useState(null);

  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng;
    setPin({ lat, lng, popup: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
  };

  const markers = pin ? [pin] : [];

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-2">Click the map to place a pin</p>
      <LMap
        markers={markers}
        onMapClick={handleMapClick}
        height="400px"
        mapConfig={{ center: [-34.603, -58.381], zoom: 13 }}
      />
      {pin && (
        <p className="mt-2 text-sm">
          Selected: {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
        </p>
      )}
    </div>
  );
};
```

### Dual Location Input (Address + Map Pin)

Combine FormBuilder address autocomplete with a map pin picker. Best for delivery apps, logistics, and service booking.

| Approach | Best For |
|----------|----------|
| **Address only** (FormBuilder `location: true`) | Known addresses, postal delivery |
| **Map pin only** (LMap `onMapClick`) | Outdoor locations, beaches, parks |
| **Dual input** (both) | Delivery apps — FormBuilder handles validation, LMap is the fallback |

```jsx
import LMap from '@/components/framework/LMap';
import FormBuilder from '@/components/framework/FormBuilder';

var schema = {
  delivery_address: {
    type: 'text',
    label: 'Delivery Address',
    location: true,
    location_ref: 'delivery_geo',
    placeholder: 'Search address...'
  },
  delivery_geo: { type: 'geopoint', hidden: true }
};

var pinIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#3b82f6"/><circle cx="16" cy="16" r="6" fill="white"/></svg>';

const DeliveryPicker = ({ jcontext }) => {
  var [mapPin, setMapPin] = useState(null);
  var [showMap, setShowMap] = useState(false);
  var formRef = useRef();

  var handleMapClick = function(e) {
    setMapPin({
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      icon: pinIcon,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      popup: 'Delivery here'
    });
  };

  var handleSubmit = function(data) {
    var geo = data.delivery_geo;
    var lat, lng;
    if (geo && geo.coordinates) {
      lng = geo.coordinates[0];
      lat = geo.coordinates[1];
    } else if (mapPin) {
      lat = mapPin.lat;
      lng = mapPin.lng;
    }
    // use lat, lng for order...
  };

  return (
    <div>
      <FormBuilder
        ref={formRef}
        schema={schema}
        onSubmit={handleSubmit}
        submitLabel="Confirm"
      />
      <button onClick={function() { setShowMap(true); }}>
        Or pick on map
      </button>
      {showMap && (
        <LMap
          markers={mapPin ? [mapPin] : []}
          onMapClick={handleMapClick}
          height="300px"
        />
      )}
    </div>
  );
};
```

- FormBuilder `location: true` handles address autocomplete and populates the hidden geopoint
- LMap `onMapClick` handles manual pin placement as fallback
- On submit, prefer FormBuilder geopoint (structured), fall back to map pin coords
- GeoJSON order: `coordinates[0]` = longitude, `coordinates[1]` = latitude

## LMap Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `markers` | `array` | `[]` | Array of marker objects |
| `userLocation` | `object` | `null` | `{ lat, lng, icon?, popup? }` |
| `searchRadius` | `number` | `null` | Circle radius in meters around userLocation |
| `mapConfig` | `object` | `{}` | `{ center: [lat, lng], zoom, zoomControl }` |
| `onMarkerClick` | `function` | `null` | `(marker, index) => void` |
| `onMapClick` | `function` | `null` | Leaflet click event handler |
| `onBoundsChange` | `function` | `null` | `({ bounds, center, zoom, isExploring }) => void` |
| `enableExploration` | `boolean` | `false` | Show explore toggle button |
| `explorationButton` | `object` | `null` | `{ text, activeText, helpText }` |
| `height` | `string` | `'600px'` | Container height (CSS value) |
| `className` | `string` | `''` | CSS class on outer container |
| `legend` | `object` | `null` | `{ items: [{ label, style?, className? }] }` |
| `tileLayer` | `string` | OpenStreetMap URL | Custom tile provider URL |
| `children` | `node` | — | Custom overlays inside container |

### Marker Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `lat` | `number` | Yes | Latitude |
| `lng` | `number` | Yes | Longitude |
| `popup` | `string` | No | HTML popup content (only if not clickable) |
| `icon` | `string` | No | Custom HTML for marker icon |
| `iconSize` | `[w, h]` | No | Icon dimensions (default `[32, 32]`) |
| `iconAnchor` | `[x, y]` | No | Anchor point (default `[16, 16]`) |
| `popupAnchor` | `[x, y]` | No | Popup offset (default `[0, -16]`) |
| `className` | `string` | No | CSS class for icon container |
| `clickable` | `boolean` | No | Set `false` to force popup mode when `onMarkerClick` exists |

### Center Auto-Pan

When `mapConfig.center` changes, the map animates to the new position automatically. Useful for "focus on selected" patterns:

```jsx
const [selected, setSelected] = useState(null);

<LMap
  markers={markers}
  mapConfig={{
    center: selected ? [selected.lat, selected.lng] : [-34.603, -58.381],
    zoom: selected ? 15 : 12
  }}
  onMarkerClick={(marker) => setSelected(marker)}
  height="500px"
/>
```

Changing `mapConfig.center` triggers a smooth animated pan. Changing `mapConfig.zoom` alongside it updates zoom too.

### Bounds Change Callback

```javascript
onBoundsChange({
  bounds: { north, south, east, west },
  center: { lat, lng },
  zoom: number,
  isExploring: boolean
})
```

Debounced at 500ms. Only fires when user is in exploration mode if `enableExploration` is used.

## API Reference

| Method | Description |
|--------|-------------|
| `app.browser.location.get()` | Get current position |
| `app.browser.location.watch(cb)` | Watch position changes |
| `app.browser.location.coords` | Cached coordinates (if available) |
| `app.db.use(n).nearBy(f, coords, max, min?)` | Find within distance |
| `.withinCircle(f, center, radius)` | Find within circle |
| `.withinBounds(f, sw, ne)` | Find within box |
| `.withinGeometry(f, geojson)` | Find within shape |
| `app.utils.calculateDistance(p1, p2)` | Distance in meters |
| `app.utils.formatCoordinates(coords)` | Format for display |
| `app.utils.getBoundingBox(center, dist)` | Get bounding box |

## Gotchas

| Don't | Do |
|----------|-------|
| Use `[lat, lng]` order | Use `[lng, lat]` (GeoJSON standard) |
| Query without index | Use `geopoint` type (auto-indexes) |
| Forget permission handling | Handle denied gracefully |
| Assume location is available | Check if `coords` is null |
| Store coordinates as array | Use `{ type: 'Point', coordinates: [...] }` |
| Use default Leaflet markers (no `icon` prop) | Always provide custom `icon` HTML — default marker-icon.png/marker-shadow.png don't load in the JasonJS runtime |
| `mapConfig={{ center: [lng, lat] }}` | `mapConfig={{ center: [lat, lng] }}` (Leaflet uses lat,lng) |
| Put strings in `popup` when using `onMarkerClick` | Use `clickable: false` on markers that should show popup |
| Set `height` without units | Use CSS value: `"500px"`, `"100vh"`, `"calc(100vh - 80px)"` |
| Forget to map GeoJSON coordinates | `{ lat: doc.location.coordinates[1], lng: doc.location.coordinates[0] }` |
| Load hundreds of markers at once | Limit to ~50-100 for performance, paginate with exploration mode |

### Minimal Custom Marker Icon

Always use a custom icon instead of relying on Leaflet's default markers:

```jsx
var pinIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#3b82f6"/><circle cx="16" cy="16" r="6" fill="white"/></svg>';

var markers = [{ lat: -34.6, lng: -58.38, icon: pinIcon, iconSize: [32, 40], iconAnchor: [16, 40] }];
```

## Related

- `docs/geolocation.md` - Human reference for location features and LMap
- `skill:database` - Geospatial queries, geopoint field type
- `skill:forms` - Location input fields with address autocomplete
