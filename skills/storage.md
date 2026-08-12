---
skill: storage
when: "Uploading files, images, managing file storage"
requires: []
---

# Storage

> File uploads, image optimization, CDN URLs, and S3 storage operations.

## Quick Start

```jsx
// Component: Upload with app.storage
const handleUpload = async (file) => {
  const result = await app.storage.upload(file, {
    path: 'uploads/avatars',
    maxSize: 5 * 1024 * 1024 // 5MB
  });

  if (result.success) {
    setImageUrl(result.url);
    app.ui.toast('Uploaded!');
  }
};
```

## Preferred: FormBuilder Upload

FormBuilder handles file uploads automatically. Just use the schema:

```jsx
<FormBuilder
  database="profiles"
  schema={{
    avatar: {
      type: 'image',
      variant: 'avatar',
      label: 'Profile Photo'
    },
    gallery: {
      type: 'image',
      multiple: true,
      maxFiles: 5,
      label: 'Gallery'
    },
    resume: {
      type: 'file',
      accept: '.pdf,.doc,.docx',
      maxSize: 10485760,
      label: 'Resume'
    }
  }}
  onSuccess={() => app.ui.toast('Saved!')}
/>
```

## Direct Upload (Component)

For custom upload UI:

```jsx
const ImageUploader = () => {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await app.storage.upload(file, {
        path: 'uploads/images',
        maxSize: 10 * 1024 * 1024
      });
      setUrl(result.url);
    } catch (error) {
      app.ui.toast('Upload failed', { type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {url && <img src={url} alt="Uploaded" />}
    </div>
  );
};
```

## Optimized URLs

Use `app.helpers` for CDN-optimized image URLs:

```jsx
// Thumbnail
const thumb = app.helpers.createThumbnailUrl(imageUrl, {
  size: 150,
  format: 'webp'
});

// Custom dimensions
const optimized = app.helpers.createAssetUrl(imageUrl, {
  width: 800,
  height: 600,
  quality: 85,
  format: 'webp'
});

// Responsive srcSet
const { srcSet, responsive } = app.helpers.createResponsiveUrls(imageUrl);
// srcSet = "url?w=400 400w, url?w=800 800w, url?w=1200 1200w, url?w=1600 1600w"
```

### Image Component Pattern

```jsx
const OptimizedImage = ({ src, alt, width = 800 }) => {
  const optimizedUrl = app.helpers.createAssetUrl(src, {
    width,
    format: 'webp',
    quality: 85
  });

  return (
    <img
      src={optimizedUrl}
      alt={alt}
      loading="lazy"
    />
  );
};
```

## Server-Side Storage (Functions)

```javascript
// @desc Generate and upload PDF report
async function generateReport(app) {
  const { params, db, storage, response } = app;

  // Generate PDF buffer (from library like pdfkit)
  const pdfBuffer = await generatePDF(params.data);

  // Upload to S3
  const result = await storage.upload(pdfBuffer, {
    fileName: `report-${Date.now()}.pdf`,
    fileType: 'application/pdf',
    path: 'reports'
  });

  // Save reference to database
  await db.use('reports').add({
    title: params.title,
    file: result, // { url, key, name, type, size }
    generatedAt: new Date()
  });

  return response({ success: true, url: result.url });
}
```

### Delete Files with Record

```javascript
// @desc Delete product and its images
async function deleteProduct(app) {
  const { params, db, storage, response } = app;

  const product = await db.use('products').getById(params.productId);
  if (!product) {
    return response({ success: false, error: 'Not found' }, 404);
  }

  // Delete all associated images
  if (product.images?.length) {
    for (const image of product.images) {
      await storage.delete(image.key);
    }
  }

  // Delete the record
  await db.use('products').deleteById(params.productId);

  return response({ success: true });
}
```

## File Schema Types

| Type | Use Case | Example |
|------|----------|---------|
| `image` | Single image | Profile photo |
| `image` + `multiple` | Multiple images | Gallery |
| `file` | Single file | PDF document |
| `files` | Multiple files | Attachments |
| `video` | Video file | Upload video |
| `audio` | Audio file | Podcast episode |

### Schema Options

```json
{
  "avatar": {
    "type": "image",
    "variant": "avatar",
    "label": "Profile Photo"
  },
  "gallery": {
    "type": "image",
    "multiple": true,
    "maxFiles": 10
  },
  "document": {
    "type": "file",
    "accept": ".pdf,.doc,.docx",
    "maxSize": 10485760
  }
}
```

| Option | Description |
|--------|-------------|
| `type` | `image`, `file`, `files`, `video`, `audio` |
| `variant` | `default`, `avatar` (circular), `square` |
| `multiple` | Allow multiple files |
| `maxFiles` | Max files when multiple |
| `maxSize` | Max bytes per file |
| `accept` | Accepted MIME types or extensions |

## File Object Structure

Files stored in database:

```javascript
{
  id: "uploads/1234567890_image.jpg",
  url: "https://cdn.example.com/uploads/1234567890_image.jpg",
  key: "uploads/1234567890_image.jpg",
  name: "image.jpg",
  type: "image/jpeg",
  size: 1048576,
  uploadedAt: "2024-01-15T10:30:00Z"
}
```

## Client API Reference

| Method | Description |
|--------|-------------|
| `app.storage.upload(file, opts)` | Upload file, returns `{ url, key, ... }` |
| `app.storage.getUrl(key, opts)` | Get optimized URL |
| `app.storage.delete(key)` | Delete file by key |
| `app.helpers.createAssetUrl(url, opts)` | Create CDN URL |
| `app.helpers.createThumbnailUrl(url, opts)` | Create thumbnail URL |
| `app.helpers.createResponsiveUrls(url, sizes)` | Create srcSet |

## URL Options

| Option | Description |
|--------|-------------|
| `width` | Resize width (pixels) |
| `height` | Resize height (pixels) |
| `quality` | JPEG/WebP quality (1-100) |
| `format` | Output: `webp`, `jpeg`, `png` |
| `fit` | Resize mode: `cover`, `contain`, `fill` |

## Environment Variables

```json
{
  "S3_BUCKET_NAME": "my-app-bucket",
  "S3_REGION": "us-east-1",
  "AWS_ACCESS_KEY_ID": "AKIA...",
  "AWS_SECRET_ACCESS_KEY": "...",
  "NEXT_PUBLIC_ASSET_BASE_URL": "https://cdn.myapp.com"
}
```

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Upload without size limit | Always set `maxSize` |
| Use raw S3 URLs | Use `app.helpers.createAssetUrl()` for CDN |
| Store file buffers in DB | Store URL/key reference only |
| Delete file without DB record | Clean up both together |
| Forget `accept` types | Specify `accept="image/*"` |
| Use `app.storage.list()` client-side | Use server function for listing |
| Hardcode S3 credentials | Use env variables |

## Related

- `skill:forms` - FormBuilder auto-uploads
- `skill:function` - Server-side file operations
- `skill:database` - File fields in schemas
