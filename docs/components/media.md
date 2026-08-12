# File Upload

**Drag-and-drop file uploads with S3 storage.**

Upload images, videos, audio, PDFs - FormBuilder handles it automatically.

## In FormBuilder (Easiest)

Add file fields to your schema:

```javascript
{
  // Avatar picker (circular)
  profilePic: {
    type: 'image',
    variant: 'avatar',
    pickerSize: 'lg',
    maxSize: 5242880  // 5MB
  },

  // Logo picker (square)
  logo: {
    type: 'image',
    variant: 'square',
    pickerSize: 'md'
  },

  // Gallery
  gallery: {
    type: 'image',
    multiple: true,
    maxFiles: 10
  },

  // PDF documents
  resume: {
    type: 'file',
    accept: ['application/pdf'],
    maxSize: 20971520  // 20MB
  },

  // Multiple files
  attachments: {
    type: 'files',
    maxFiles: 5
  }
}
```

FormBuilder renders the upload UI automatically.

## Standalone Component

Use FileUpload directly:

```jsx
import FileUpload from '@/components/framework/FileUpload';

const [files, setFiles] = useState([]);

<FileUpload
  value={files}
  onChange={setFiles}
  multiple={true}
  accept={['image/*', 'video/*', 'application/pdf']}
  maxSize={10485760}  // 10MB
  maxFiles={5}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | array/object | `[]` | Current files |
| `onChange` | function | - | `(files) => void` |
| `multiple` | boolean | `true` | Allow multiple files |
| `accept` | array | `['image/*', 'video/*', 'audio/*', 'application/pdf']` | MIME types |
| `maxSize` | number | `10485760` | Max size in bytes (10MB default) |
| `maxFiles` | number | `10` | Max number of files |
| `variant` | string | `'default'` | `default`, `avatar`, `square` |
| `pickerSize` | string | `'lg'` | `sm`, `md`, `lg`, `xl` (for avatar/square) |
| `showPreviews` | boolean | `true` | Show image previews |
| `placeholder` | string | `'Drag files here...'` | Upload area text |
| `disabled` | boolean | `false` | Disable upload |

## Field Types

### image

```javascript
{
  profilePic: {
    type: 'image',
    variant: 'avatar',  // Circular picker
    pickerSize: 'lg',   // sm, md, lg, xl
    maxSize: 5242880
  },
  gallery: {
    type: 'image',
    multiple: true,
    maxFiles: 20
  }
}
```

**Variants:**
- `default` - Standard dropzone with previews
- `avatar` - Circular picker (profile photos)
- `square` - Square picker (logos, thumbnails)

**Picker sizes:**
- `sm`: 64x64px
- `md`: 96x96px
- `lg`: 128x128px (default)
- `xl`: 160x160px

### video

```javascript
{
  intro: {
    type: 'video',
    maxSize: 104857600  // 100MB
  }
}
```

Accepts: mp4, webm, ogg, mov

### audio

```javascript
{
  podcast: {
    type: 'audio',
    maxSize: 52428800  // 50MB
  }
}
```

Accepts: mp3, wav, ogg, m4a

### file / files

```javascript
{
  // Single file
  contract: {
    type: 'file',
    accept: ['application/pdf'],
    maxSize: 20971520
  },

  // Multiple files
  documents: {
    type: 'files',
    accept: ['image/*', 'application/pdf'],
    maxFiles: 10
  }
}
```

## Storage Format

Files are stored as objects with metadata:

```javascript
// Single file
{
  id: 'site123/uploads/1234567890_abc123_photo.jpg',
  url: 'https://cdn.example.com/site123/uploads/1234567890_abc123_photo.jpg',
  name: 'photo.jpg',
  type: 'image/jpeg',
  size: 1048576,
  uploadedAt: '2025-01-15T10:30:00Z'
}

// Multiple files (array)
[
  { id: '...', url: '...', name: 'photo1.jpg', ... },
  { id: '...', url: '...', name: 'photo2.jpg', ... }
]
```

## Displaying Files

### Images

```jsx
{product.image && (
  <img src={product.image.url} alt={product.name} />
)}

{/* Multiple images */}
{product.gallery?.map(img => (
  <img key={img.id} src={img.url} alt="" />
))}
```

### Videos

```jsx
{post.video && (
  <video controls>
    <source src={post.video.url} type={post.video.type} />
  </video>
)}
```

### Audio

```jsx
{episode.audio && (
  <audio controls>
    <source src={episode.audio.url} type={episode.audio.type} />
  </audio>
)}
```

### Download Links

```jsx
{document.file && (
  <a href={document.file.url} download={document.file.name}>
    Download {document.file.name}
  </a>
)}
```

## Complete Example

```jsx
import FormBuilder from '@/components/framework/FormBuilder';

export default function ProductForm({ jcontext }) {
  return (
    <FormBuilder
      schema={{
        name: { type: 'text', required: true },

        // Avatar picker
        thumbnail: {
          type: 'image',
          label: 'Thumbnail',
          variant: 'square',
          pickerSize: 'lg',
          maxSize: 2097152  // 2MB
        },

        // Gallery
        photos: {
          type: 'image',
          label: 'Product Photos',
          multiple: true,
          maxFiles: 10,
          maxSize: 5242880  // 5MB each
        },

        // Video
        demo: {
          type: 'video',
          label: 'Demo Video',
          maxSize: 52428800  // 50MB
        },

        // PDF
        manual: {
          type: 'file',
          label: 'User Manual',
          accept: ['application/pdf'],
          maxSize: 10485760  // 10MB
        }
      }}
      config={{ database: 'products' }}
    />
  );
}
```

Then display:

```jsx
export default function ProductPage({ product }) {
  return (
    <div>
      {/* Thumbnail */}
      {product.thumbnail && (
        <img
          src={product.thumbnail.url}
          alt={product.name}
          className="w-32 h-32 object-cover rounded"
        />
      )}

      {/* Photo gallery */}
      <div className="grid grid-cols-3 gap-4">
        {product.photos?.map(photo => (
          <img
            key={photo.id}
            src={photo.url}
            alt=""
            className="w-full h-48 object-cover rounded"
          />
        ))}
      </div>

      {/* Demo video */}
      {product.demo && (
        <video controls className="w-full rounded">
          <source src={product.demo.url} type={product.demo.type} />
        </video>
      )}

      {/* Download manual */}
      {product.manual && (
        <a
          href={product.manual.url}
          download={product.manual.name}
          className="btn"
        >
          Download Manual
        </a>
      )}
    </div>
  );
}
```

## Access Control

Files inherit the record's privacy settings:

```javascript
{
  profilePic: {
    type: 'image',
    variant: 'avatar'
  }
}
```

**Private record** → Image URL requires authentication
**Public record** → Image URL is publicly accessible

File URLs are automatically scoped to the tenant and respect database security rules.

## File Validation

Built-in validation for:
- File type (MIME type)
- File size
- File count
- Dimensions (images only, via browser)

```javascript
{
  avatar: {
    type: 'image',
    variant: 'avatar',
    maxSize: 2097152,  // 2MB
    accept: ['image/jpeg', 'image/png', 'image/webp']
  }
}
```

Validation errors show automatically in FormBuilder.

## S3 Storage

Files upload directly to S3 via pre-signed URLs:

1. FormBuilder requests upload URL from `/api/storage/upload-url`
2. Browser uploads file directly to S3
3. S3 key and URL saved to database
4. Files served via CDN

No files pass through your server - efficient and scalable.

## Size Limits

**Default limits:**
- Images: 10MB per file
- Videos: 100MB per file
- Audio: 50MB per file
- Documents: 20MB per file

**Override in schema:**
```javascript
{
  video: {
    type: 'video',
    maxSize: 524288000  // 500MB
  }
}
```

## Accepted Formats

### Images
JPEG, PNG, WebP, GIF, SVG

### Videos
MP4, WebM, OGG, MOV, QuickTime

### Audio
MP3, WAV, OGG, M4A, AAC

### Documents
PDF, DOC, DOCX, XLS, XLSX, TXT

Customize with `accept`:
```javascript
{
  contract: {
    type: 'file',
    accept: ['application/pdf', 'application/msword']
  }
}
```

> 💡 **Tip:** Use `variant: 'avatar'` for profile pictures and `variant: 'square'` for logos. They provide a better UX than the default dropzone.

> 📖 See also: [FormBuilder](./formbuilder.md), [Storage](../storage.md)
