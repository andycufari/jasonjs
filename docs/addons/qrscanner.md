# QR Scanner Addon

A high-performance QR code scanner component using the native Barcode Detection API with multi-camera support.

## Overview

The QR Scanner addon provides a modal-based QR code scanner that uses the browser's native Barcode Detection API for hardware-accelerated scanning. Perfect for inventory management, event check-ins, asset tracking, and any application that needs to scan QR codes.

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome/Chromium | ✅ Full support |
| Edge | ✅ Full support |
| Samsung Internet | ✅ Full support |
| Safari/iOS | ❌ Not supported |
| Firefox | ❌ Not supported |

**Important:** Always provide a manual input fallback for users on unsupported browsers.

## Installation

The addon is included in JasonJS Framework under `addons/qr-scanner`. No additional installation required.

## Basic Usage

### Import the Component

```jsx
import QRScanner from '@addons/qr-scanner';
```

### Simple Example

```jsx
import { useState } from 'react';
import QRScanner from '@addons/qr-scanner';

export default function MyComponent({ jcontext }) {
  const [isQROpen, setIsQROpen] = useState(false);
  const [scannedValue, setScannedValue] = useState('');

  const handleScan = (value) => {
    console.log('Scanned:', value);
    setScannedValue(value);
  };

  return (
    <div>
      <button onClick={() => setIsQROpen(true)}>
        Scan QR Code
      </button>

      <QRScanner
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        onScan={handleScan}
      />

      {scannedValue && <p>Last scanned: {scannedValue}</p>}
    </div>
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `isOpen` | boolean | Yes | - | Controls modal visibility |
| `onClose` | function | Yes | - | Called when modal is closed |
| `onScan` | function | Yes | - | Called with scanned value (string) |
| `title` | string | No | "Escanear Código QR" | Modal title |
| `successMessage` | string | No | "¡Código QR detectado!" | Success message displayed after scan |
| `autoCloseDelay` | number | No | 1500 | Delay in milliseconds before auto-closing (set to 0 to disable) |

## Common Use Cases

### 1. Database Lookup on Scan

Query your database with the scanned QR code:

```jsx
const handleScan = async (qrCode) => {
  const db = jcontext.app.db.use('products');

  try {
    const result = await db.fetch({ qr_code: qrCode });

    if (result && result.length > 0) {
      console.log('Product found:', result[0]);
      jcontext.app.ui.toast('Product loaded!', 'success');
      setProduct(result[0]);
    } else {
      jcontext.app.ui.toast('Product not found', 'error');
    }
  } catch (error) {
    console.error('Database error:', error);
    jcontext.app.ui.toast('Error loading product', 'error');
  }
};

<QRScanner
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onScan={handleScan}
  title="Scan Product QR"
/>
```

### 2. Form Auto-Fill

Auto-fill form fields based on scanned data:

```jsx
const [formData, setFormData] = useState({
  product_code: '',
  quantity: 1
});

const handleScan = async (value) => {
  // Update form field
  setFormData({ ...formData, product_code: value });

  // Optional: Fetch additional data
  const db = jcontext.app.db.use('products');
  const product = await db.fetch({ code: value });

  if (product && product.length > 0) {
    // Pre-fill other fields
    setFormData({
      product_code: value,
      product_name: product[0].name,
      price: product[0].price
    });
  }
};

<input
  type="text"
  value={formData.product_code}
  onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
  placeholder="Product code"
/>
<button onClick={() => setIsQROpen(true)}>📷 Scan</button>

<QRScanner
  isOpen={isQROpen}
  onClose={() => setIsQROpen(false)}
  onScan={handleScan}
/>
```

### 3. Event Check-In System

```jsx
const handleCheckIn = async (ticketCode) => {
  const db = jcontext.app.db.use('tickets');

  try {
    const ticket = await db.fetch({ code: ticketCode });

    if (!ticket || ticket.length === 0) {
      jcontext.app.ui.toast('Invalid ticket', 'error');
      return;
    }

    if (ticket[0].checked_in) {
      jcontext.app.ui.toast('Already checked in!', 'warning');
      return;
    }

    // Mark as checked in
    await db.update(ticket[0].id, {
      checked_in: true,
      checked_in_at: new Date().toISOString()
    });

    jcontext.app.ui.toast(`Welcome, ${ticket[0].attendee_name}!`, 'success');
  } catch (error) {
    jcontext.app.ui.toast('Check-in failed', 'error');
  }
};

<QRScanner
  isOpen={isCheckInOpen}
  onClose={() => setIsCheckInOpen(false)}
  onScan={handleCheckIn}
  title="Scan Ticket"
  autoCloseDelay={2000}
/>
```

### 4. Inventory Tracking

```jsx
const handleAssetScan = async (assetCode) => {
  const db = jcontext.app.db.use('assets');

  const asset = await db.fetch({ code: assetCode });

  if (asset && asset.length > 0) {
    // Log location or status change
    await db.update(asset[0].id, {
      last_scanned: new Date().toISOString(),
      location: currentLocation,
      scanned_by: jcontext.app.auth.currentUser.id
    });

    setCurrentAsset(asset[0]);
    jcontext.app.ui.toast('Asset tracked!', 'success');
  }
};

<QRScanner
  isOpen={isScannerOpen}
  onClose={() => setIsScannerOpen(false)}
  onScan={handleAssetScan}
  title="Scan Asset Tag"
/>
```

### 5. Table Row Auto-Fill

Perfect for data entry forms with multiple rows:

```jsx
const [rows, setRows] = useState([]);
const [activeRowId, setActiveRowId] = useState(null);

const handleScan = async (qrValue) => {
  if (!activeRowId) return;

  // Update the row's field
  setRows(rows.map(row =>
    row.id === activeRowId
      ? { ...row, code: qrValue }
      : row
  ));

  // Optional: Load existing data
  const db = jcontext.app.db.use('items');
  const existing = await db.fetch({ code: qrValue });

  if (existing && existing.length > 0) {
    // Auto-fill entire row
    setRows(rows.map(row =>
      row.id === activeRowId
        ? { ...row, ...existing[0] }
        : row
    ));
  }
};

{rows.map(row => (
  <tr key={row.id}>
    <td>
      <input value={row.code} onChange={...} />
      <button onClick={() => {
        setActiveRowId(row.id);
        setIsQROpen(true);
      }}>
        📷
      </button>
    </td>
    {/* other fields */}
  </tr>
))}

<QRScanner
  isOpen={isQROpen}
  onClose={() => setIsQROpen(false)}
  onScan={handleScan}
/>
```

## Customization

### Change Messages and Timing

```jsx
<QRScanner
  isOpen={isOpen}
  onClose={handleClose}
  onScan={handleScan}
  title="Custom Scanner Title"
  successMessage="Code scanned successfully!"
  autoCloseDelay={3000}  // 3 seconds
/>
```

### Disable Auto-Close

```jsx
<QRScanner
  isOpen={isOpen}
  onClose={handleClose}
  onScan={handleScan}
  autoCloseDelay={0}  // Manual close only
/>
```

## Features

### Multi-Camera Support
- Automatically detects all available cameras
- Defaults to back/environment camera on mobile
- Switch button appears when multiple cameras available
- Seamless camera switching without closing modal

### High Performance
- Native Barcode Detection API (hardware accelerated)
- Up to 1920x1080 resolution
- 30 FPS frame rate
- Continuous autofocus support
- Graceful fallback for unsupported constraints

### User Experience
- Visual frame overlay guides QR code placement
- Success/error feedback messages
- Auto-close on successful scan (configurable)
- Manual close button always available
- Responsive design (mobile & desktop)
- Dark theme optimized

### Resource Management
- Automatically stops camera when modal closes
- Cleans up resources on component unmount
- No memory leaks
- No battery drain when not in use

## Error Handling

### Validate Scanned Data

Always validate QR content before using:

```jsx
const handleScan = async (value) => {
  // Validate format
  if (!/^[A-Z0-9]{10}$/.test(value)) {
    jcontext.app.ui.toast('Invalid QR code format', 'error');
    return;
  }

  // Process valid code
  const result = await processQRCode(value);
};
```

### Handle Database Errors

```jsx
const handleScan = async (value) => {
  try {
    const db = jcontext.app.db.use('products');
    const result = await db.fetch({ code: value });

    if (!result || result.length === 0) {
      jcontext.app.ui.toast('Product not found', 'error');
      return;
    }

    processProduct(result[0]);

  } catch (error) {
    console.error('Scan error:', error);
    jcontext.app.ui.toast('An error occurred', 'error');
  }
};
```

## Troubleshooting

### Scanner Not Opening
- Verify browser support (Chrome/Edge required)
- Ensure HTTPS connection (camera requires secure context)
- Check camera permissions in browser settings

### Camera Not Working
- Grant camera permission when prompted
- Close other apps using the camera
- Try switching cameras if multiple available
- Check browser console for specific errors

### QR Codes Not Detecting
- Ensure good lighting conditions
- Hold QR code steady within the frame
- Adjust distance (not too close or far)
- Clean camera lens
- Use high-contrast QR codes (dark on light background)

### Performance Issues
- Close other camera-using apps/tabs
- Check device GPU capabilities
- Ensure device is not in power-saving mode

## Best Practices

1. **Always Provide Fallback**
   ```jsx
   <input type="text" value={code} onChange={...} />
   <button onClick={() => setIsQROpen(true)}>Or Scan QR</button>
   ```

2. **Clear Instructions**
   Tell users what QR code to scan and what will happen

3. **Visual Feedback**
   Always show what was scanned and confirm the action

4. **Error Recovery**
   Allow users to retry on failed scans

5. **Accessibility**
   Don't make QR scanning the only option - provide manual input

6. **Security**
   - Always validate scanned data server-side
   - Sanitize QR content before display (XSS prevention)
   - Use parameterized queries (automatic with app.db)
   - Implement rate limiting on sensitive operations

## Security Considerations

```jsx
// ✅ GOOD: Validate and sanitize
const handleScan = async (value) => {
  // Validate format
  if (!/^[A-Z0-9]{10}$/.test(value)) {
    return;
  }

  // Use parameterized query (app.db does this automatically)
  const result = await db.fetch({ code: value });

  // Sanitize before display
  const sanitized = value.replace(/[<>]/g, '');
  displayValue(sanitized);
};

// ❌ BAD: No validation
const handleScan = async (value) => {
  // Don't trust the input blindly
  executeRawQuery(`SELECT * FROM products WHERE code = '${value}'`);
  element.innerHTML = value; // XSS risk!
};
```

## Mobile Optimization

The scanner is automatically optimized for mobile:
- Uses environment-facing (back) camera by default
- Responsive modal sizing
- Touch-friendly buttons
- Handles device orientation changes
- Automatic camera permission handling

## Performance Notes

- Component caches camera settings between scans
- Detection loop is optimized to prevent unnecessary renders
- Automatically pauses when tab is not visible
- Memory efficient with automatic cleanup

## Integration Examples

See the full working example at [addons/qr-scanner/example.jsx](../../addons/qr-scanner/example.jsx)

## API Reference

### Component Export

```jsx
import QRScanner from '@addons/qr-scanner';
```

### Type Definitions

```typescript
interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
  title?: string;
  successMessage?: string;
  autoCloseDelay?: number;
}
```

## Related Addons

- **Comments**: For user feedback on scanned items
- **Notion Blog**: Document QR code workflows
- **React Bits**: Add visual effects to scanner UI

## License

MIT - Part of JasonJS Framework
