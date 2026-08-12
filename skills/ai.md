---
skill: ai
when: "Adding AI features, text generation, chat, images"
requires: []
---

# AI

> Text generation, image generation, speech, and AI agents.

## Setup

**Minimal (text generation only):** Set an API key in `settings/.env` — no `ai.json` needed:

```json
{ "OPENAI_API_KEY": "sk-..." }
```

Or `ANTHROPIC_API_KEY` or `GOOGLE_AI_API_KEY`. Auto-enables `app.ai.prompt()` in functions with arbitrary prompts allowed.

**Advanced (templates, images, speech, agents, security):** Create `settings/ai.json` — see Agent Config section.

## Quick Start

```jsx
// Component: Generate text
const response = await app.ai.prompt('Write a tagline for a coffee shop');
// response.text, response.cost
```

## Text Generation

### From Components

```jsx
// Simple prompt
const response = await app.ai.prompt('Explain quantum computing in simple terms');
// response.text = "..."
// response.cost = 0.002

// With template reference
const response = await app.ai.prompt('{{productDescription}}', {
  variables: { productName: 'Coffee Mug' }
});

// With options
const response = await app.ai.prompt(prompt, {
  model: 'gpt-4o-mini',
  maxTokens: 200,
  temperature: 0.7
});
```

### From Functions (Faster)

Server-side AI calls skip HTTP overhead:

```javascript
// @desc Generate product description
async function generateDescription(app) {
  const { params, ai, response } = app;

  const result = await ai.prompt('{{productDescription}}', {
    variables: { product: params.productName }
  });

  if (!result.success) {
    return response({ error: result.error }, 500);
  }

  return response({
    success: true,
    description: result.text,
    cost: result.cost
  });
}
```

## Image Generation

```jsx
// Generate from prompt
const result = await app.ai.image('A sunset over mountains', {
  size: '1024x1024'
});

if (result.success) {
  setImageUrl(result.images[0].url); // CDN URL, permanent
}
```

### Options

| Option | Description |
|--------|-------------|
| `size` | `1024x1024`, `1024x1536`, `1536x1024` |
| `quality` | `low`, `medium`, `high`, `auto` |
| `format` | `png`, `jpeg`, `webp` |

## Image Editing

Edit existing images with AI. Pass images from FileUpload, URLs, or file paths — auto-detected.

```jsx
// From FileUpload (FormBuilder field)
const result = await app.ai.image('Remove the background', {
  editMode: true,
  images: [formData.photo] // { url, type, name, ... }
});

// From URL
const result = await app.ai.image('Make it a watercolor painting', {
  editMode: true,
  images: ['https://cdn.example.com/photo.jpg']
});

// Mix and match
const result = await app.ai.image('Combine these into a collage', {
  editMode: true,
  images: [formData.photo, 'https://example.com/overlay.png']
});
```

### Edit Options

| Option | Description |
|--------|-------------|
| `editMode` | `true` to enable edit mode |
| `images` | Array of: FileUpload objects, URLs, or file paths |
| `size` | `1024x1024`, `1024x1536`, `1536x1024` |
| `quality` | `low`, `medium`, `high`, `auto` |
| `background` | `opaque`, `transparent` |
| `format` | `png`, `jpeg`, `webp` |
| `compression` | `0-100` (jpeg/webp only) |

### FileUpload + AI Edit Pattern

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

## Text to Speech

```jsx
const result = await app.ai.speech('Hello, welcome to our app!', {
  voice: 'alloy'
});

if (result.success) {
  const audio = new Audio(result.audioUrl);
  audio.play();
}

// Get available voices
const voices = await app.ai.getVoices();
// ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
```

## Chat Interface

```jsx
const ChatUI = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Call server function for chat
    const response = await app.functions.call('chat', {
      messages: [...messages, userMsg]
    });

    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: response.text }
    ]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-96">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <span className="font-bold">{m.role}:</span> {m.content}
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-4 border-t">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded"
        />
        <button onClick={send} disabled={loading}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
```

## AI Agents (Functions)

Agents are AI with tools - the LLM can call your functions.

### Server Function

```javascript
// @desc Chat with support agent
async function chatSupport(app) {
  const { params, ai, response } = app;

  // Agent defined in settings/ai.json
  const result = await ai.chat('supportAgent', params.history);

  return response({
    success: true,
    text: result.text,
    toolEvents: result.toolEvents // What tools were called
  });
}
```

### Agent Config (settings/ai.json)

```json
{
  "templates": {
    "productDescription": "Write a compelling product description for: {{product}}"
  },
  "agents": {
    "supportAgent": {
      "system_prompt": "private/SupportPrompt",
      "model": "gpt-4o-mini",
      "maxIterations": 10,
      "tools": [
        {
          "function": "getOrderStatus",
          "description": "Get order status by ID",
          "parameters": {
            "type": "object",
            "properties": {
              "orderId": { "type": "string" }
            },
            "required": ["orderId"]
          }
        },
        {
          "function": "searchProducts",
          "description": "Search products by keyword",
          "parameters": {
            "type": "object",
            "properties": {
              "query": { "type": "string" }
            }
          }
        }
      ]
    }
  }
}
```

## Streaming Responses

For real-time text streaming:

```jsx
import { streamAI } from '@/core/services/ai';

const StreamingChat = () => {
  const [text, setText] = useState('');

  const generate = async () => {
    setText('');

    await streamAI(
      'Write a story about a robot',
      { model: 'gpt-4o-mini' },
      (chunk, fullText) => {
        setText(fullText); // Update as chunks arrive
      }
    );
  };

  return (
    <div>
      <button onClick={generate}>Generate</button>
      <p>{text}</p>
    </div>
  );
};
```

## API Reference

### Client-Side (app.ai)

| Method | Description |
|--------|-------------|
| `app.ai.prompt(text, opts)` | Generate text |
| `app.ai.image(prompt, opts)` | Generate or edit image |
| `app.ai.speech(text, opts)` | Text to speech |
| `app.ai.getVoices()` | List available voices |
| `app.ai.isAvailable()` | Check if AI is configured |

### Server-Side (Functions)

| Method | Description |
|--------|-------------|
| `ai.prompt(template, opts)` | Generate text |
| `ai.chat(agentName, history)` | Chat with agent |
| `ai.image(prompt, opts)` | Generate or edit image |
| `ai.speech(text, opts)` | Text to speech |

### Prompt Options

| Option | Default | Description |
|--------|---------|-------------|
| `model` | `gpt-5-mini` | Model to use |
| `maxTokens` | 500 | Max **output** (response) tokens |
| `temperature` | 0.7 | Creativity (0-2) |
| `variables` | `{}` | Template variables |
| `system` | - | System prompt string |

### Config Limits (settings/ai.json)

| Config Field | Default | Description |
|--------------|---------|-------------|
| `limits.maxInputTokens` | 4000 | Max **input** (prompt) tokens — rejects prompts that exceed this |
| `limits.requestsPerMinute` | 10 | Rate limit per user |
| `limits.requestsPerDay` | 500 | Daily rate limit per user |

> **Note:** `maxTokens` (prompt option) caps the response size. `maxInputTokens` (config) caps the prompt size. They are independent.

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Create `ai.json` just for basic text | Set API key in `.env` — it auto-enables |
| Call AI on every keystroke | Debounce or use submit button |
| Forget loading states | AI calls take seconds |
| Expose API keys | AI configured server-side |
| Hardcode prompts | Use templates in ai.json |
| Forget cost tracking | Return `result.cost` to monitor |
| Skip error handling | Check `result.success` |

## Related

- `skill:function` - Server-side AI functions
- `skill:component` - AI in components
