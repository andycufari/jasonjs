# Storage & File Uploads

Files are already handled. This is for edge cases.

## You Probably Don't Need This

**FormBuilder handles file uploads automatically.** Just add a file field to your schema:

```javascript
const schema = {
  name: { type: 'text', required: true },

  // Single image upload
  avatar: {
    type: 'image',
    multiple: false,
    maxSize: 5 * 1024 * 1024  // 5MB
  },

  // Multiple file uploads
  attachments: {
    type: 'files',
    maxFiles: 10,
    accept: ['image/*', 'application/pdf']
  }
};
```

**Database schemas handle files too:**

```json
{
  "fields": {
    "profilePicture": {
      "type": "image",
      "multiple": false,
      "maxSize": 5242880
    },
    "gallery": {
      "type": "image",
      "maxFiles": 20
    },
    "documents": {
      "type": "files",
      "accept": ["application/pdf"],
      "maxFiles": 5
    }
  }
}
```

**That's it.** Drag & drop, previews, validation, S3 uploads - all handled.

> 💡 **Tip:** Use FormBuilder or database schemas for 99% of file upload needs. Only use `app.storage` for custom implementations.

---

## Built-In File Types

**Available in FormBuilder and database schemas:**

| Type | Description | Default Multiple | Max Size Default |
|------|-------------|------------------|------------------|
| `image` | Image files (jpg, png, gif, webp) | Yes | 10MB |
| `video` | Video files (mp4, webm, mov) | Yes | 100MB |
| `audio` | Audio files (mp3, wav, m4a) | Yes | 50MB |
| `file` | Single generic file | No | 10MB |
| `files` | Multiple generic files | Yes | 10MB each |

**All file types support:**

- Drag & drop
- File previews
- Progress tracking
- Type validation
- Size validation
- Multiple files (configurable)
- Direct S3 upload (no server bottleneck)

---

## FormBuilder File Uploads

**Single image:**

```jsx
const schema = {
  avatar: {
    type: 'image',
    label: 'Profile Photo',
    multiple: false,
    maxSize: 5 * 1024 * 1024,
    required: true
  }
};
```

**Multiple images:**

```jsx
const schema = {
  gallery: {
    type: 'image',
    label: 'Photo Gallery',
    maxFiles: 20,
    maxSize: 10 * 1024 * 1024,
    showPreviews: true
  }
};
```

**Documents (PDFs):**

```jsx
const schema = {
  resume: {
    type: 'file',
    label: 'Resume',
    accept: ['application/pdf'],
    maxSize: 20 * 1024 * 1024,
    required: true
  }
};
```

**Mixed file types:**

```jsx
const schema = {
  attachments: {
    type: 'files',
    label: 'Attachments',
    accept: ['image/*', 'application/pdf', 'application/msword'],
    maxFiles: 10,
    maxSize: 10 * 1024 * 1024
  }
};
```

**Video/Audio:**

```jsx
const schema = {
  intro: {
    type: 'video',
    label: 'Introduction Video',
    maxSize: 100 * 1024 * 1024  // 100MB
  },
  podcast: {
    type: 'audio',
    label: 'Podcast Episode',
    maxSize: 50 * 1024 * 1024  // 50MB
  }
};
```

**Stored format:**

```javascript
// Single file
{
  url: "https://cdn.yoursite.com/uploads/file.jpg",
  name: "file.jpg",
  type: "image/jpeg",
  size: 1048576,
  key: "site123/uploads/1234567890_abc123_file.jpg",
  uploadedAt: "2024-01-15T10:30:00Z"
}

// Multiple files
[
  { url: "...", name: "file1.jpg", ... },
  { url: "...", name: "file2.jpg", ... }
]
```

> 📖 Full FormBuilder reference: [components/formbuilder.md](components/formbuilder.md)

---

## Database Schema File Fields

**Add file fields to any database schema:**

```json
{
  "database": "posts",
  "fields": {
    "title": {
      "type": "string",
      "required": true
    },
    "coverImage": {
      "type": "image",
      "multiple": false,
      "maxSize": 5242880,
      "required": true
    },
    "gallery": {
      "type": "image",
      "maxFiles": 10,
      "maxSize": 10485760
    },
    "attachments": {
      "type": "files",
      "accept": ["application/pdf"],
      "maxFiles": 5
    }
  }
}
```

**Files are validated and uploaded automatically when creating/updating records.**

---

## App Storage API (Edge Cases)

**Use `app.storage` when you need custom upload logic:**

### app.storage.upload(file, options)

Upload a file programmatically.

```jsx
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

try {
  const result = await app.storage.upload(file, {
    path: 'custom/path',
    maxSize: 10 * 1024 * 1024,
    allowedTypes: ['image/*', 'application/pdf'],
    onProgress: (percent) => {
      console.log(`Upload progress: ${percent}%`);
    }
  });

  console.log(result.url);  // CDN URL
  console.log(result.key);  // S3 key

} catch (error) {
  console.error('Upload failed:', error.message);
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | string | `'uploads'` | Upload path/folder |
| `maxSize` | number | 10MB | Max file size in bytes |
| `allowedTypes` | array | `['image/*', 'video/*', 'audio/*', 'application/pdf']` | MIME types |
| `onProgress` | function | - | Progress callback (0-100) |

**Returns:**

```javascript
{
  success: true,
  url: "https://cdn.yoursite.com/uploads/file.jpg",
  key: "site123/uploads/1234567890_abc123_file.jpg",
  name: "file.jpg",
  type: "image/jpeg",
  size: 1048576,
  uploadedAt: "2024-01-15T10:30:00Z"
}
```

### app.storage.getUrl(key, options)

Get CDN URL with image optimization.

```jsx
const url = await app.storage.getUrl('site123/uploads/image.jpg', {
  width: 800,
  height: 600,
  quality: 85,
  format: 'webp'
});
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `width` | number | Resize width |
| `height` | number | Resize height |
| `quality` | number | Image quality (1-100) |
| `format` | string | Output format (webp, jpg, png) |

### app.storage.delete(key)

Delete a file.

```jsx
const deleted = await app.storage.delete('site123/uploads/old-file.jpg');

if (deleted) {
  console.log('File deleted');
}
```

---

## Custom Upload Component

**For full control over upload UI:**

```jsx
'use client';
import { useState } from 'react';
import { useApp } from '@jasonjs';

function CustomUpload() {
  const app = useApp();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    try {
      const result = await app.storage.upload(file, {
        path: 'custom/uploads',
        maxSize: 10 * 1024 * 1024,
        allowedTypes: ['image/*'],
        onProgress: setProgress
      });

      setUrl(result.url);
      app.ui.toast('Upload successful!', { type: 'success' });

    } catch (error) {
      app.ui.toast(error.message, { type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={handleFileChange}
        disabled={uploading}
        accept="image/*"
      />

      {uploading && (
        <div>
          <div className="progress-bar">
            <div style={{ width: `${progress}%` }} />
          </div>
          <p>{progress}% uploaded</p>
        </div>
      )}

      {url && (
        <img src={url} alt="Uploaded" style={{ maxWidth: 300 }} />
      )}
    </div>
  );
}
```

---

## Use Cases for app.storage

**Most file uploads should use FormBuilder or database schemas. Use `app.storage` for:**

### Custom Drag & Drop

```jsx
function CustomDropzone() {
  const app = useApp();

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];

    const result = await app.storage.upload(file);
    console.log('Uploaded:', result.url);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="dropzone"
    >
      Drop files here
    </div>
  );
}
```

### Camera Capture

```jsx
function CameraUpload() {
  const app = useApp();

  const handleCapture = async (e) => {
    const file = e.target.files[0];

    if (file) {
      const result = await app.storage.upload(file, {
        path: 'photos'
      });

      // Save to database
      await app.db.use('photos').add({
        url: result.url,
        capturedAt: new Date()
      });
    }
  };

  return (
    <input
      type="file"
      accept="image/*"
      capture="environment"
      onChange={handleCapture}
    />
  );
}
```

### Profile Picture with Preview

```jsx
function ProfilePicture({ user }) {
  const app = useApp();
  const [preview, setPreview] = useState(user.avatar);

  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    // Upload to S3
    const result = await app.storage.upload(file, {
      path: 'avatars',
      maxSize: 5 * 1024 * 1024,
      allowedTypes: ['image/*']
    });

    // Update user profile
    await app.db.use('users').update(user.id, {
      avatar: result.url
    });
  };

  return (
    <div>
      <img src={preview} alt="Avatar" className="avatar" />
      <input type="file" accept="image/*" onChange={handleChange} />
    </div>
  );
}
```

### Batch Upload with Progress

```jsx
function BatchUpload() {
  const app = useApp();
  const [files, setFiles] = useState([]);

  const handleFilesChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);

    const uploadPromises = selectedFiles.map(async (file, index) => {
      return app.storage.upload(file, {
        onProgress: (percent) => {
          console.log(`File ${index + 1}: ${percent}%`);
        }
      });
    });

    const results = await Promise.all(uploadPromises);
    setFiles(results);

    app.ui.toast(`${results.length} files uploaded!`, { type: 'success' });
  };

  return (
    <div>
      <input
        type="file"
        multiple
        onChange={handleFilesChange}
      />

      <div className="file-list">
        {files.map((file, i) => (
          <div key={i}>
            <a href={file.url} target="_blank">{file.name}</a>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Configuration

**Add S3 credentials to `settings/.env`:**

```json
{
  "AWS_ACCESS_KEY_ID": "your-access-key",
  "AWS_SECRET_ACCESS_KEY": "your-secret-key",
  "AWS_REGION": "us-east-1",
  "AWS_S3_BUCKET": "your-bucket-name"
}
```

**Optional CDN configuration in `settings/storage.json`:**

```json
{
  "provider": "s3",
  "cdnUrl": "https://cdn.yoursite.com",
  "maxUploadSize": 10485760,
  "allowedTypes": ["image/*", "video/*", "audio/*", "application/pdf"],
  "paths": {
    "uploads": "uploads",
    "avatars": "avatars",
    "documents": "documents"
  }
}
```

---

## Security

**File uploads are automatically:**

- **Tenant-isolated** - Files prefixed with `siteId`
- **Authenticated** - Upload requires login
- **Validated** - Type and size checked server-side
- **Direct to S3** - No server bottleneck (uses pre-signed URLs)
- **Virus scanned** - Optional integration with ClamAV

**File access:**

- Public files: `https://cdn.yoursite.com/site123/uploads/file.jpg`
- Private files: Require signed URLs (coming soon)

---

## Why FormBuilder First?

**FormBuilder gives you:**

- Drag & drop out of the box
- File previews automatically
- Validation (type, size, count)
- Progress bars
- Error handling
- Mobile camera support
- Multiple file management

**All without writing upload code.**

> 💡 **Tip:** Start with FormBuilder. Only drop down to `app.storage` if you need complete custom control over the upload UI or logic.

---

## Troubleshooting

### "Upload failed: Network error"

- Check S3 credentials in `.env`
- Verify CORS settings on S3 bucket
- Check browser console for details

### "File type not allowed"

- Check `accept` or `allowedTypes` configuration
- Verify MIME type matches allowed list
- Common types: `image/*`, `video/*`, `application/pdf`

### "File size exceeds limit"

- Check `maxSize` in schema or options
- Default is 10MB for most types
- Increase if needed: `maxSize: 100 * 1024 * 1024` (100MB)

### Upload works but preview doesn't show

- Check CDN URL is correct
- Verify CORS settings allow image loading
- Check browser console for CORS errors

---

## Summary

**For 99% of use cases:**

1. Add file field to FormBuilder schema
2. Files upload automatically with drag & drop, previews, and validation

**For edge cases:**

1. Use `app.storage.upload(file, options)` for custom upload logic
2. Use `app.storage.getUrl(key, options)` for optimized CDN URLs
3. Use `app.storage.delete(key)` to remove files

**File uploads are built-in. You don't need to think about them.**
