---
skill: media
when: "Handling images, videos, audio, file uploads"
requires: []
---

# Media

> File uploads, images, videos, audio - FormBuilder handles it automatically.

## Quick Start

Add file fields to your schema:

```javascript
{
  avatar: { type: 'image', variant: 'avatar' },
  gallery: { type: 'image', multiple: true, maxFiles: 10 },
  video: { type: 'video', maxSize: 104857600 },
  document: { type: 'file', accept: ['application/pdf'] }
}
```

FormBuilder renders the upload UI automatically.

## Image Fields

### Avatar (Circular)

```javascript
{
  profilePic: {
    type: 'image',
    variant: 'avatar',
    pickerSize: 'lg',  // sm, md, lg, xl
    maxSize: 5242880   // 5MB
  }
}
```

### Square (Logos)

```javascript
{
  logo: {
    type: 'image',
    variant: 'square',
    pickerSize: 'md'
  }
}
```

### Gallery (Multiple)

```javascript
{
  photos: {
    type: 'image',
    multiple: true,
    maxFiles: 20,
    maxSize: 5242880
  }
}
```

### Picker Sizes

| Size | Dimensions |
|------|------------|
| `sm` | 64x64px |
| `md` | 96x96px |
| `lg` | 128x128px |
| `xl` | 160x160px |

## Video Fields

```javascript
{
  intro: {
    type: 'video',
    maxSize: 104857600  // 100MB
  }
}
```

Accepts: mp4, webm, ogg, mov

## Audio Fields

```javascript
{
  podcast: {
    type: 'audio',
    maxSize: 52428800  // 50MB
  }
}
```

Accepts: mp3, wav, ogg, m4a

## File Fields

### Single File

```javascript
{
  resume: {
    type: 'file',
    accept: ['application/pdf'],
    maxSize: 20971520  // 20MB
  }
}
```

### Multiple Files

```javascript
{
  attachments: {
    type: 'files',
    maxFiles: 5,
    accept: ['image/*', 'application/pdf']
  }
}
```

## Standalone Component

Use FileUpload directly:

```jsx
import FileUpload from '@/components/framework/FileUpload';

const [files, setFiles] = useState([]);

<FileUpload
  value={files}
  onChange={setFiles}
  multiple={true}
  accept={['image/*', 'video/*']}
  maxSize={10485760}
  maxFiles={5}
/>
```

### Props

| Prop | Default | Description |
|------|---------|-------------|
| `value` | `[]` | Current files |
| `onChange` | - | `(files) => void` |
| `multiple` | true | Allow multiple |
| `accept` | all media | MIME types array |
| `maxSize` | 10MB | Max bytes per file |
| `maxFiles` | 10 | Max file count |
| `variant` | "default" | "default", "avatar", "square" |
| `pickerSize` | "lg" | "sm", "md", "lg", "xl" |

## Storage Format

Files stored as objects:

```javascript
{
  id: 'uploads/1234567890_photo.jpg',
  url: 'https://cdn.example.com/uploads/1234567890_photo.jpg',
  name: 'photo.jpg',
  type: 'image/jpeg',
  size: 1048576,
  uploadedAt: '2025-01-15T10:30:00Z'
}
```

Multiple files stored as array.

## Displaying Media

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
{doc.file && (
  <a href={doc.file.url} download={doc.file.name}>
    Download {doc.file.name}
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

        thumbnail: {
          type: 'image',
          variant: 'square',
          pickerSize: 'lg',
          maxSize: 2097152
        },

        photos: {
          type: 'image',
          multiple: true,
          maxFiles: 10
        },

        demo: {
          type: 'video',
          maxSize: 52428800
        },

        manual: {
          type: 'file',
          accept: ['application/pdf']
        }
      }}
      config={{ database: 'products' }}
    />
  );
}
```

## Accepted Formats

### Images
JPEG, PNG, WebP, GIF, SVG

### Videos
MP4, WebM, OGG, MOV

### Audio
MP3, WAV, OGG, M4A, AAC

### Documents
PDF, DOC, DOCX, XLS, XLSX, TXT

## Size Limits

| Type | Default |
|------|---------|
| Images | 10MB |
| Videos | 100MB |
| Audio | 50MB |
| Documents | 20MB |

Override with `maxSize` in bytes.

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Forget `maxSize` | Always set reasonable limits |
| Access `file` directly | Access `file.url` |
| Use raw URLs | Files have `{url, name, type, size}` |
| Forget `controls` on video/audio | Add `controls` attribute |
| Hardcode MIME types | Use wildcards: `image/*` |

## Related

- `skill:forms` - FormBuilder file fields
- `skill:storage` - Direct upload API
