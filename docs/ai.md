# AI Features

Add AI to your app in three lines.

## Quick Start

**Generate text:**

```jsx
const result = await app.ai.prompt('{{productDescription}}', {
  variables: { name: 'Coffee Mug', features: 'Keeps drinks hot for 6 hours' }
});

console.log(result.text);
```

**Generate images:**

```jsx
const result = await app.ai.image('{{productPhoto}}', {
  variables: { product: 'Coffee Mug', style: 'minimalist', background: 'white' }
});

console.log(result.images[0].url); // CDN URL, permanent
```

**That's it.** Templates handle prompts. You just pass variables.

---

## Setup

There are two ways to enable AI, depending on what you need.

### Option 1: Minimal Setup (Just Text Generation)

If you only need `app.ai.prompt()` in server functions, you don't need an `ai.json` at all. Just add an API key to `settings/.env`:

```json
{
  "OPENAI_API_KEY": "sk-..."
}
```

That's it. The framework auto-detects the key and enables text generation with sensible defaults:
- Arbitrary prompts allowed (functions only, not client-side)
- Text generation enabled, image/speech disabled
- All supported models for your provider automatically available

**Supported providers** (set any one or more):

| Environment Variable | Provider | Auto-enabled Models |
|---------------------|----------|-------------------|
| `OPENAI_API_KEY` | OpenAI | gpt-5-mini, gpt-5 |
| `ANTHROPIC_API_KEY` | Anthropic | claude-haiku-4.5, claude-sonnet-4.5 |
| `GOOGLE_AI_API_KEY` | Google | gemini-2.0-flash |

### Option 2: Full Setup (Templates, Images, Speech, Agents)

For client-side AI, image generation, speech, AI agents, or custom security controls, create `settings/ai.json`:

```json
{
  "prompts": {
    "productDescription": {
      "template": "Write a compelling product description for {{name}}. Highlight: {{features}}. Keep it under 100 words.",
      "model": "gpt-4o-mini"
    },
    "productPhoto": {
      "template": "Professional product photography of {{product}}. Style: {{style}}. Background: {{background}}. High quality, 4K.",
      "type": "image"
    }
  }
}
```

Then use templates from components:

```jsx
const result = await app.ai.prompt('{{productDescription}}', {
  variables: { name: product.name, features: product.features }
});
```

### Why Templates?

Templates exist for three reasons:

1. **Security** — Client-side components can only use predefined templates, not arbitrary prompts
2. **Cost control** — You define max tokens, models, and rate limits per template
3. **Reusability** — Write once, use everywhere

---

## API

### app.ai.prompt(template, options)

Generate text from template.

```jsx
const result = await app.ai.prompt('{{myTemplate}}', {
  variables: {
    var1: 'value1',
    var2: 'value2'
  }
});

if (result.success) {
  console.log(result.text);
  console.log(result.cost);     // API cost in USD
  console.log(result.usage);    // Token usage
}
```

**Returns:**

```javascript
{
  success: true,
  text: "Generated text here...",
  cost: 0.002,
  usage: { prompt: 45, completion: 128, total: 173 }
}
```

### app.ai.image(prompt, options)

Generate or edit images. Accepts a direct prompt or template reference.

**Generate a new image:**

```jsx
const result = await app.ai.image('A sunset over mountains', {
  size: '1024x1024'
});

// Or with template
const result = await app.ai.image('{{myImageTemplate}}', {
  variables: { subject: 'Mountain landscape', style: 'watercolor' }
});

if (result.success) {
  const imageUrl = result.images[0].url;  // CDN URL
}
```

**Edit an existing image:**

Pass images via the `editMode` option. Accepts FileUpload objects (from FormBuilder), URLs, or file paths — auto-detected.

```jsx
// FileUpload object from FormBuilder
const result = await app.ai.image('Remove the background', {
  editMode: true,
  images: [formData.photo]  // { url, type: "image/jpeg", name, ... }
});

// URL string
const result = await app.ai.image('Make it a watercolor painting', {
  editMode: true,
  images: ['https://cdn.example.com/photo.jpg']
});

// Mix formats
const result = await app.ai.image('Combine these images', {
  editMode: true,
  images: [formData.photo, 'https://example.com/overlay.png']
});
```

**Images are automatically uploaded to S3 and served via CDN.**

**Returns:**

```javascript
{
  success: true,
  images: [
    {
      url: "https://cdn.yoursite.com/ai/abc123.png",
      s3Key: "site123/ai/abc123.png",
      size: 245678
    }
  ],
  cost: 0.04
}
```

### app.ai.speech(template, options)

Convert text to speech.

```jsx
const result = await app.ai.speech('{{voiceover}}', {
  variables: {
    text: 'Welcome to our website',
    tone: 'friendly'
  }
});

if (result.success) {
  const audio = new Audio(`data:audio/mp3;base64,${result.audio}`);
  audio.play();
}
```

### app.ai.isAvailable()

Check if AI is enabled.

```jsx
const available = await app.ai.isAvailable();

if (available) {
  // Show AI features
}
```

---

## Common Patterns

### Generate Product Descriptions

```jsx
function ProductCard({ product }) {
  const app = useApp();
  const [description, setDescription] = useState(product.description);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);

    const result = await app.ai.prompt('{{productDescription}}', {
      variables: {
        name: product.name,
        features: product.features.join(', '),
        audience: 'tech enthusiasts'
      }
    });

    if (result.success) {
      setDescription(result.text);

      // Save to database
      await app.db.use('products').update(product.id, {
        description: result.text
      });

      app.ui.toast('Description generated!', { type: 'success' });
    }

    setGenerating(false);
  };

  return (
    <div>
      <h3>{product.name}</h3>
      <p>{description}</p>
      <button onClick={handleGenerate} disabled={generating}>
        {generating ? 'Generating...' : 'Generate with AI'}
      </button>
    </div>
  );
}
```

### Image Generator

```jsx
function ImageGenerator() {
  const app = useApp();
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);

    const result = await app.ai.image('{{generateArt}}', {
      variables: {
        description: prompt,
        style: 'photorealistic',
        quality: 'hd'
      }
    });

    if (result.success) {
      setImageUrl(result.images[0].url);
    } else {
      app.ui.toast(result.error, { type: 'error' });
    }

    setLoading(false);
  };

  return (
    <div>
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your image..."
      />
      <button onClick={generate} disabled={loading || !prompt}>
        {loading ? 'Generating...' : 'Generate Image'}
      </button>

      {imageUrl && (
        <img src={imageUrl} alt="Generated" style={{ maxWidth: '100%' }} />
      )}
    </div>
  );
}
```

### Content Summarizer

```jsx
function ArticleSummarizer({ article }) {
  const app = useApp();
  const [summary, setSummary] = useState('');

  const summarize = async () => {
    const result = await app.ai.prompt('{{summarize}}', {
      variables: {
        text: article.content,
        sentences: 3
      }
    });

    if (result.success) {
      setSummary(result.text);
    }
  };

  return (
    <div>
      <button onClick={summarize}>Summarize Article</button>
      {summary && (
        <div className="summary">
          <strong>Summary:</strong>
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
}
```

### Batch Generation (Server Function)

```javascript
// functions/generateDescriptions.js
async function generateDescriptions(app) {
  const { ai, db, response } = app;

  const products = await db.use('products').fetch({ description: null });

  const results = [];

  for (const product of products) {
    const result = await ai.prompt('{{productDescription}}', {
      variables: {
        name: product.name,
        features: product.features.join(', ')
      }
    });

    if (result.success) {
      await db.use('products').update(product.id, {
        description: result.text,
        aiGenerated: true
      });

      results.push({
        id: product.id,
        success: true,
        cost: result.cost
      });
    }
  }

  const totalCost = results.reduce((sum, r) => sum + r.cost, 0);

  return response({
    processed: results.length,
    totalCost
  });
}
```

---

## Template Configuration

**Full template options:**

```json
{
  "prompts": {
    "templateName": {
      "template": "Your prompt with {{variables}}",
      "model": "gpt-4o-mini",
      "maxTokens": 500,
      "temperature": 0.7,
      "allowedContexts": ["client", "functions"],
      "type": "text"
    }
  }
}
```

**Options:**

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `model` | `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo` | `gpt-4o-mini` | Model to use |
| `maxTokens` | number | 500 | Max output tokens |
| `temperature` | 0.0 - 2.0 | 0.7 | Creativity (0 = focused, 2 = creative) |
| `allowedContexts` | array | `["client", "functions"]` | Where template can be used |
| `type` | `text`, `image`, `speech` | `text` | Generation type |

**Model comparison:**

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `gpt-4o-mini` | Fast | Cheapest | Most use cases |
| `gpt-4o` | Medium | Medium | Complex tasks |
| `gpt-4-turbo` | Slower | Most expensive | Highest quality |

---

## Image Generation

**Image template:**

```json
{
  "prompts": {
    "productPhoto": {
      "template": "Professional photo of {{product}}. Style: {{style}}. Background: {{background}}.",
      "type": "image",
      "model": "gpt-image-1",
      "size": "1024x1024",
      "quality": "auto"
    }
  }
}
```

**Generation options:**

| Option | Values | Default |
|--------|--------|---------|
| `size` | `1024x1024`, `1024x1536`, `1536x1024` | `1024x1024` |
| `quality` | `low`, `medium`, `high`, `auto` | `auto` |
| `format` | `png`, `jpeg`, `webp` | `png` |

**Images are automatically:**
- Uploaded to S3
- Served via CDN
- Optimized for web
- Permanently stored

---

## Image Editing

Edit existing images by passing them with `editMode: true`. The `images` array accepts any mix of:

| Input type | Example |
|------------|---------|
| FileUpload object | `formData.photo` — `{ url, type: "image/jpeg", name, ... }` |
| URL string | `"https://cdn.example.com/photo.jpg"` |
| File path | `"/tmp/image.png"` (server functions only) |
| File/Blob | Native `File` object |

**Edit options:**

| Option | Values | Default |
|--------|--------|---------|
| `editMode` | `true` | — |
| `images` | Array of inputs (see above) | — |
| `size` | `1024x1024`, `1024x1536`, `1536x1024` | `1024x1024` |
| `quality` | `low`, `medium`, `high`, `auto` | `auto` |
| `background` | `opaque`, `transparent` | — |
| `format` | `png`, `jpeg`, `webp` | `png` |
| `compression` | `0-100` (jpeg/webp only) | — |

### FileUpload + AI Edit Pattern

Upload an image via FormBuilder's FileUpload, then edit it with AI:

```jsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FileUpload from '@framework/FileUpload';

const AIImageEditor = ({ jcontext }) => {
  const [image, setImage] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleEdit = async () => {
    if (!image || !prompt) return;
    setLoading(true);
    try {
      const res = await app.ai.image(prompt, {
        editMode: true,
        images: [image]
      });
      if (res.success) {
        setResult(res.images[0]);
        app.ui.toast('Image edited!', { type: 'success' });
      } else {
        app.ui.toast(res.error, { type: 'error' });
      }
    } catch (e) {
      app.ui.toast(e.message, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const imageSrc = image && (typeof image === 'object' ? image.url : image);
  const resultSrc = result && (result.url || ('data:image/png;base64,' + result.base64));

  return (
    <div className="space-y-4">
      <FileUpload value={image} onChange={setImage} accept={['image/*']} jcontext={jcontext} />
      {imageSrc && <img src={imageSrc} alt="Original" className="max-w-md rounded-lg" />}
      <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the edit..." />
      <Button onClick={handleEdit} disabled={loading || !image || !prompt}>
        {loading ? 'Editing...' : 'Edit with AI'}
      </Button>
      {resultSrc && <img src={resultSrc} alt="Edited" className="max-w-md rounded-lg" />}
    </div>
  );
};

export default AIImageEditor;
```

### Server Function Example

```javascript
// @desc Edit product image with AI
async function editProductImage(app) {
  const { params, ai, db, response } = app;

  const product = await db.use('products').getById(params.productId);
  if (!product || !product.image) {
    return response({ error: 'Product or image not found' }, 404);
  }

  // product.image is a FileUpload object { url, type, name }
  const result = await ai.image(params.prompt, {
    editMode: true,
    images: [product.image],
    background: 'transparent'
  });

  if (result.success) {
    await db.use('products').update(params.productId, {
      editedImage: result.images[0]
    });
  }

  return response(result);
}
```

---

## Speech Generation

**Speech template:**

```json
{
  "prompts": {
    "voiceover": {
      "template": "{{text}}",
      "type": "speech",
      "voice": "alloy",
      "speed": 1.0
    }
  }
}
```

**Voice options:**

| Voice | Description |
|-------|-------------|
| `alloy` | Neutral, balanced |
| `echo` | Male, warm |
| `fable` | Expressive, upbeat |
| `onyx` | Male, deep |
| `nova` | Female, warm |
| `shimmer` | Female, bright |

---

## Rate Limiting

**Configure per domain in `settings/ai.json`:**

```json
{
  "config": {
    "limits": {
      "requestsPerMinute": 10,
      "requestsPerHour": 100,
      "requestsPerDay": 500,
      "maxInputTokens": 4000
    }
  }
}
```

**Limits are enforced automatically.** When exceeded, users get a helpful error message.

> **Input vs Output tokens:** `maxInputTokens` (config) caps the prompt size and rejects prompts that are too long. `maxTokens` (prompt option) caps the response length. They are independent settings.

---

## Cost Management

**Set daily spending limit:**

```json
{
  "config": {
    "maxCostPerDay": 10.00
  }
}
```

**Track costs:**

```jsx
const result = await app.ai.prompt('{{template}}', { variables });

if (result.success) {
  console.log('Cost:', result.cost);  // In USD
  console.log('Tokens:', result.usage.total);
}
```

**Get usage stats (server function):**

```javascript
async function getAIUsage(app) {
  const { ai, response } = app;

  const stats = await ai.getUsageStats();

  return response({
    today: stats.today,
    thisMonth: stats.thisMonth,
    totalCost: stats.totalCost
  });
}
```

---

## Security

**Client-side restrictions:**
- ✅ Can only use predefined templates
- ✅ Cannot use arbitrary prompts
- ✅ Rate limited per user
- ✅ All requests authenticated

**Server-side capabilities:**
- ✅ Can use templates
- ✅ Can use custom prompts (if enabled)
- ✅ Full API access
- ✅ No rate limits

**Enable arbitrary prompts (server only):**

```json
{
  "config": {
    "security": {
      "allowArbitraryPrompts": true
    }
  }
}
```

---

## Error Handling

```jsx
const result = await app.ai.prompt('{{template}}', { variables });

if (!result.success) {
  // Handle errors
  if (result.error.includes('Rate limit')) {
    app.ui.toast('Too many requests. Try again in a minute.', { type: 'warning' });
  } else if (result.error.includes('not available')) {
    app.ui.toast('AI features not enabled', { type: 'info' });
  } else if (result.error.includes('cost limit')) {
    app.ui.toast('Daily AI budget reached', { type: 'error' });
  } else {
    app.ui.toast(result.error, { type: 'error' });
  }
}
```

---

## Best Practices

### 1. Use Specific Templates

```json
// ❌ BAD - too vague
{
  "template": "Write something about {{topic}}"
}

// ✅ GOOD - specific instructions
{
  "template": "Write a 100-word product description for {{name}}. Highlight: {{features}}. Tone: professional. Include a call-to-action."
}
```

### 2. Set Token Limits

```json
// ❌ BAD - no limit, can get expensive
{
  "template": "Write about {{topic}}"
}

// ✅ GOOD - controlled length
{
  "template": "Write about {{topic}}",
  "maxTokens": 300
}
```

### 3. Cache Results

```jsx
const generateDescription = async (product) => {
  // Check cache first
  const cacheKey = `ai:description:${product.id}`;
  const cached = app.cache.get(cacheKey);
  if (cached) return cached;

  // Generate
  const result = await app.ai.prompt('{{productDescription}}', {
    variables: { name: product.name, features: product.features }
  });

  // Cache for 1 day
  if (result.success) {
    app.cache.set(cacheKey, result.text, 86400);
  }

  return result.text;
};
```

### 4. Validate Output

```jsx
const result = await app.ai.prompt('{{template}}', { variables });

if (result.success) {
  // Sanitize HTML if rendering
  const sanitized = DOMPurify.sanitize(result.text);

  // Check length
  if (sanitized.length > 1000) {
    // Truncate or reject
  }

  // Save to database
  await app.db.use('content').add({ text: sanitized });
}
```

### 5. Show Loading States

```jsx
const [loading, setLoading] = useState(false);

const generate = async () => {
  setLoading(true);
  try {
    const result = await app.ai.prompt('{{template}}', { variables });
    // Handle result
  } finally {
    setLoading(false);  // Always reset loading state
  }
};
```

---

## Troubleshooting

### "AI not available"

- Check that at least one API key exists in `settings/.env` (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_AI_API_KEY`)
- If using templates or client-side AI, verify `settings/ai.json` exists
- Check your API key has credits with the provider

### "Rate limit exceeded"

- Wait a minute before retrying
- Increase limits in `settings/ai.json`
- Consider caching results

### "Template not found"

- Check template name matches exactly
- Use `{{templateName}}` syntax
- Verify template exists in `settings/ai.json`

### Images not generating

- Check S3 credentials in `.env`
- Verify bucket permissions
- Check S3 bucket exists

---

## Summary

**Quickest path:** Set an API key in `settings/.env` → `app.ai.prompt()` works in server functions immediately. No `ai.json` needed.

**Full setup:** Create `settings/ai.json` when you need templates (client-side AI), image/speech generation, AI agents, or custom security/rate limits.

**Templates provide:**
- Security (no arbitrary prompts from client)
- Cost control (token limits per template)
- Reusability (use anywhere)
- Rate limiting (automatic)

> **Tip:** Don't create `ai.json` just for basic text generation. Set the API key in `.env` and it auto-enables.
