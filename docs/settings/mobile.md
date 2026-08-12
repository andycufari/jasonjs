# Mobile & Native Apps 📱

**Configure native device features for iOS/Android apps.**

## Quick Start

```json
// settings/mobile.json
{
  "enabled": true,
  "bridgeSecret": "[[env.MOBILE_BRIDGE_SECRET]]",
  "autoInit": true,
  "permissions": {
    "gps": true,
    "camera": true,
    "haptics": true,
    "biometrics": true,
    "notifications": true
  }
}
```

```javascript
// In components
const position = await app.mobile.gps.getCurrentPosition();
const photo = await app.mobile.camera.takePhoto({ quality: 0.8 });
await app.mobile.haptics.impact('medium');
```

When running in a browser, it automatically uses web APIs (like `navigator.geolocation`).

---

## How It Works

JasonJS apps run inside a **React Native wrapper** for iOS/Android. The same code works on web and mobile:

```javascript
// Same code, different execution
const position = await app.mobile.gps.getCurrentPosition();

// Web: Uses navigator.geolocation
// Native: Uses device GPS (more accurate)
```

Your app detects the environment automatically.

---

## Configuration

### Minimal

```json
{
  "enabled": true
}
```

Enables all features with web fallbacks.

### Complete

```json
{
  "enabled": true,
  "bridgeSecret": "[[env.MOBILE_BRIDGE_SECRET]]",
  "autoInit": true,
  "permissions": {
    "gps": true,
    "camera": true,
    "haptics": true,
    "biometrics": true,
    "contacts": false,
    "notifications": true,
    "sensors": true,
    "clipboard": true,
    "sharing": true
  },
  "fallbacks": {
    "enabled": true,
    "gps": true,
    "clipboard": true,
    "sharing": true,
    "haptics": true
  }
}
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable mobile bridge |
| `bridgeSecret` | string | `""` | Auth secret for native shell |
| `autoInit` | boolean | `true` | Auto-initialize on load |
| `permissions` | object | See below | Native feature permissions |
| `fallbacks` | object | See below | Web API fallbacks |

### Permissions

Control which native features are available:

| Permission | Native Access | Web Fallback |
|------------|--------------|--------------|
| `gps` | Device GPS | `navigator.geolocation` |
| `camera` | Camera/Photos | File picker |
| `haptics` | Vibration motor | `navigator.vibrate()` |
| `biometrics` | Face ID / Touch ID | WebAuthn |
| `contacts` | Address book | None |
| `notifications` | Push notifications | Browser notifications |
| `sensors` | Accelerometer/Gyro | Device motion events |
| `clipboard` | System clipboard | `navigator.clipboard` |
| `sharing` | Native share sheet | `navigator.share()` |

**Default:** All `true` except `contacts` (false for privacy)

### Fallbacks

Enable web API fallbacks when not in native app:

```json
{
  "fallbacks": {
    "enabled": true,    // Master switch
    "gps": true,        // Use browser geolocation
    "clipboard": true,  // Use clipboard API
    "sharing": true,    // Use Web Share API
    "haptics": true     // Use vibration API
  }
}
```

Set `enabled: false` to disable all fallbacks (native-only mode).

---

## Usage

### Detection

```javascript
// Check if running in native app
if (app.mobile.isNative) {
  // Native-specific code
}

// Check if ready
if (app.mobile.isReady) {
  // Safe to use APIs
}
```

### GPS

```javascript
// Get current location
const position = await app.mobile.gps.getCurrentPosition({
  accuracy: 'high',  // 'low' | 'balanced' | 'high' | 'highest'
  timeout: 15000
});

// Returns: { latitude, longitude, altitude, accuracy, timestamp }

// Watch position
const stop = await app.mobile.gps.watchPosition(
  (position) => {
    console.log('New location:', position);
  },
  { accuracy: 'balanced' }
);

// Stop watching
await stop();
```

### Camera

```javascript
// Take photo
const result = await app.mobile.camera.takePhoto({
  quality: 0.8,        // 0-1
  base64: true,        // Include base64 data
  allowsEditing: false
});

// Returns: { canceled, uri, base64?, width, height, type, fileName }

// Pick from library
const result = await app.mobile.camera.pickImage({
  quality: 0.8,
  multiple: false
});

// Pick video
const result = await app.mobile.camera.pickVideo({
  maxDuration: 60  // seconds
});
```

### Haptics

```javascript
// Impact feedback
await app.mobile.haptics.impact('medium');  // 'light' | 'medium' | 'heavy'

// Notification feedback
await app.mobile.haptics.notification('success');  // 'success' | 'warning' | 'error'

// Selection feedback
await app.mobile.haptics.selection();
```

### Biometrics

```javascript
// Check availability
const status = await app.mobile.biometrics.isAvailable();
// { available, hasHardware, isEnrolled, types: ['faceId' | 'touchId' | ...] }

// Authenticate
const result = await app.mobile.biometrics.authenticate({
  promptMessage: 'Verify your identity',
  cancelLabel: 'Cancel',
  fallbackLabel: 'Use Passcode'
});

// { success: boolean, error?: string }
```

### Notifications

```javascript
// Request permission
const { granted } = await app.mobile.notifications.requestPermission();

// Schedule local notification
await app.mobile.notifications.scheduleLocal({
  title: 'Reminder',
  body: 'Check the app!',
  data: { screen: 'home' },
  trigger: { seconds: 60 }  // null for immediate
});

// Badge count
await app.mobile.notifications.setBadgeCount(5);
await app.mobile.notifications.setBadgeCount(0);  // Clear
```

### Clipboard

```javascript
// Copy
await app.mobile.clipboard.copy('Hello World');

// Paste
const { text } = await app.mobile.clipboard.paste();

// Check if has content
const { hasContent } = await app.mobile.clipboard.hasContent();
```

### Sharing

```javascript
const result = await app.mobile.sharing.share({
  message: 'Check this out!',
  title: 'Shared from MyApp',
  url: 'https://example.com/page',
  dialogTitle: 'Share via'  // Android only
});

// { success: boolean, canceled?: boolean }
```

### Sensors

```javascript
// Check availability
const availability = await app.mobile.sensors.isAvailable();
// { accelerometer: boolean, gyroscope: boolean, magnetometer: boolean }

// Accelerometer
const stop = await app.mobile.sensors.accelerometer.start(
  (data) => {
    console.log(`X: ${data.x}, Y: ${data.y}, Z: ${data.z}`);
  },
  100  // interval in ms
);

await stop();

// Gyroscope
const stop = await app.mobile.sensors.gyroscope.start(
  (data) => {
    console.log(`Alpha: ${data.alpha}, Beta: ${data.beta}, Gamma: ${data.gamma}`);
  },
  100
);

await stop();
```

### Device Info

```javascript
const info = await app.mobile.device.getInfo();

// {
//   platform: 'ios' | 'android' | 'web',
//   version: string,
//   modelName: string,
//   osName: string,
//   osVersion: string,
//   deviceType: 'phone' | 'tablet' | 'desktop'
// }
```

---

## React Hook

```javascript
import { useMobile } from '@/core/services/mobile';

function MyComponent() {
  const { isNative, isReady, deviceInfo } = useMobile();

  if (!isReady) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <p>Platform: {isNative ? 'Native' : 'Web'}</p>
      <p>Device: {deviceInfo?.modelName}</p>
    </div>
  );
}
```

---

## Security

### Bridge Secret

The `bridgeSecret` authenticates your app with the native shell:

```json
{
  "bridgeSecret": "[[env.MOBILE_BRIDGE_SECRET]]"
}
```

**Important:**
- Store in `settings/.env.json` variables (never `public`)
- Use unique secrets per environment
- Configure the same secret in your React Native wrapper
- Prevents unauthorized native API access

### Best Practices

- Disable unused permissions
- Use `contacts` only if absolutely needed
- Rotate secrets periodically
- Validate all data from native APIs
- Disable fallbacks if native-only

---

## Troubleshooting

### Bridge Not Connecting

```javascript
// Debug info
app.mobile.debug();

// Check status
console.log('Is Native:', app.mobile.isNative);
console.log('Is Ready:', app.mobile.isReady);
console.log('Config:', app.mobile.getConfig());
```

### Permission Denied

1. Check `permissions` in `mobile.json`
2. Ensure native app requested OS permissions
3. Check device Settings → Your App → Permissions

### Web Fallback Not Working

1. Verify `fallbacks.enabled` is `true`
2. Ensure HTTPS (required for clipboard, geolocation, etc.)
3. Check browser support for the web API

---

## Notes

- Same code runs on web, iOS, and Android
- Web fallbacks work on most modern browsers
- Some features require HTTPS on web
- Native apps need OS permission prompts
- Bridge requires React Native WebView wrapper

