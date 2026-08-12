# FormBuilder

**Auto-generate forms from database schemas.**

Pass a schema, get a complete form with validation, multi-step support, and auto-save.

## Quick Start

### Auto-Save Mode (No Handler Needed)

```jsx
<FormBuilder
  schema={jcontext.databaseSchemas.products}
  config={{ database: 'products' }}
/>
```

That's it. Creates for new records, updates for existing (when `initialData` has an `id`).

### Custom Handler

```jsx
<FormBuilder
  schema={jcontext.databaseSchemas.products}
  onSubmit={async (data) => {
    await app.db.use('products').add(data);
    app.ui.toast('Created!');
  }}
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `schema` | object | Yes | Database schema |
| `initialData` | object | No | Pre-fill form (for editing) |
| `onSubmit` | function | No* | `(data) => Promise` - Called on submit |
| `onCancel` | function | No | Called when cancel clicked |
| `onStepChange` | function | No | `(stepIndex) => void` - Multi-step callback |
| `config` | object | No | Configuration options |

*Either `onSubmit` or `config.database` is required.

## Config Options

```jsx
config={{
  // Auto-save
  database: 'products',  // Auto-saves to this collection

  // Buttons
  submitText: 'Create Product',
  cancelText: 'Cancel',
  showCancel: true,

  // Behavior
  disabled: false,
  resetOnSuccess: true,

  // Validation
  validateOnBlur: true,
  validateOnChange: false,
  showRequiredIndicator: true,

  // Fields
  fields: ['name', 'price'],     // Show only these
  exclude: ['createdAt'],         // Hide these

  // Multi-step
  animation: 'slideUp',           // slideUp, fadeIn, slideHorizontal
  showIndicator: true,
  indicatorVariant: 'dots',       // dots, progress, numbered
  validateOnStep: true,           // Validate before next step
  showPressEnter: true,
  nextText: 'Next',
  previousText: 'Back',

  // i18n
  language: 'es',                 // en, es, pt, fr, de

  // Styling
  className: 'max-w-lg mx-auto'
}}
```

## Field Types

### Text

```javascript
{
  name: { type: 'text', label: 'Name', required: true },
  email: { type: 'email', label: 'Email', required: true },
  bio: { type: 'textarea', label: 'Bio', rows: 4 },
  content: { type: 'rich_text', label: 'Content' }
}
```

### Numbers

```javascript
{
  age: { type: 'number', min: 0, max: 120 },
  price: { type: 'price', symbol: '$', required: true }
}
```

### Selections

```javascript
{
  category: {
    type: 'select',
    options: ['Electronics', 'Clothing', 'Books'],
    required: true
  },
  tags: {
    type: 'array',
    multiple: true,
    options: ['Featured', 'Sale', 'New']
  },
  active: { type: 'boolean', default: true }
}
```

### Dates

```javascript
{
  birthdate: { type: 'date', max: '2010-01-01' },
  eventStart: { type: 'datetime-local', required: true },
  openTime: { type: 'time' }
}
```

### Files

```javascript
{
  // Avatar picker (circular)
  profilePic: {
    type: 'image',
    variant: 'avatar',
    pickerSize: 'lg',  // sm, md, lg, xl
    maxSize: 5242880   // 5MB
  },

  // Logo picker (square)
  logo: {
    type: 'image',
    variant: 'square',
    pickerSize: 'md'
  },

  // Gallery (multiple images)
  gallery: {
    type: 'image',
    multiple: true,
    maxFiles: 10,
    showPreviews: true
  },

  // Single file
  document: {
    type: 'file',
    accept: ['application/pdf'],
    maxSize: 20971520  // 20MB
  },

  // Multiple files
  attachments: {
    type: 'files',
    maxFiles: 5,
    accept: ['image/*', 'application/pdf']
  },

  // Video/Audio
  introVideo: { type: 'video', maxSize: 104857600 },
  podcast: { type: 'audio' }
}
```

### Location

```javascript
{
  // Address with autocomplete + geocoding
  address: {
    type: 'string',
    location: true,
    location_ref: 'coordinates',  // Saves lat/lng here
    placeholder: 'Enter address'
  },
  coordinates: {
    type: 'geopoint',
    hidden: true  // Filled automatically
  },

  // Or just a map picker
  storeLocation: { type: 'location' }
}
```

### Scale/Rating

```javascript
{
  // Star rating
  satisfaction: {
    type: 'scale',
    min: 1,
    max: 5,
    display: 'emoji',
    emoji: '⭐'
  },

  // Skill level bar
  experience: {
    type: 'scale',
    min: 0,
    max: 10,
    display: 'segments',  // segments, emoji, slider, labels
    labelStart: 'Beginner',
    labelEnd: 'Expert',
    showValue: true
  },

  // NPS score
  nps: {
    type: 'scale',
    min: 0,
    max: 10,
    display: 'labels',
    labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  }
}
```

### Relation

```javascript
{
  category: {
    type: 'relation',
    collection: 'categories',
    displayField: 'name',
    valueField: '_id',
    required: true
  },
  tags: {
    type: 'relation',
    collection: 'tags',
    displayField: 'title',
    multiple: true,
    searchable: true
  }
}
```

### Phone

```javascript
{
  phone: { type: 'phone', required: true },
  whatsapp: { type: 'tel' }
}
```

## Multi-Step Forms

Add `step` property to fields:

```javascript
{
  // Step 1
  name: {
    type: 'text',
    required: true,
    step: 1,
    stepTitle: 'Basic Info',
    stepSubtitle: 'Tell us about yourself'
  },
  email: { type: 'email', step: 1 },

  // Step 2
  address: { type: 'string', location: true, step: 2, stepTitle: 'Location' },

  // Step 3
  bio: { type: 'textarea', step: 3, stepTitle: 'About You' }
}
```

FormBuilder auto-detects steps and renders a wizard with:
- Progress indicator (dots/progress bar/numbers)
- Next/Previous buttons
- Per-step validation
- Keyboard navigation (Enter for next)

### Step Callback

```jsx
<FormBuilder
  schema={schema}
  onSubmit={handleSubmit}
  onStepChange={(stepIndex) => {
    console.log('Moved to step', stepIndex);
    // Track analytics, save draft, etc.
  }}
/>
```

## Edit Mode

Pass `initialData` to pre-fill:

```jsx
const EditProduct = ({ jcontext }) => {
  const product = jcontext.fetch_data.product;

  return (
    <FormBuilder
      schema={jcontext.databaseSchemas.products}
      initialData={product}
      config={{
        database: 'products',  // Auto-detects update because product has id
        submitText: 'Save Changes'
      }}
    />
  );
};
```

When `initialData` has an `id` or `_id`, auto-save mode uses `update()` instead of `add()`.

## Validation

### Built-in Validation

```javascript
{
  email: {
    type: 'email',  // Auto-validates email format
    required: true
  },
  age: {
    type: 'number',
    min: 0,
    max: 120
  },
  username: {
    type: 'text',
    required: true,
    minLength: 3,
    maxLength: 20
  },
  website: {
    type: 'url'  // Auto-validates URL format
  }
}
```

### Custom Validation

```jsx
const handleSubmit = async (data) => {
  if (data.password !== data.confirmPassword) {
    app.ui.toast('Passwords do not match', { type: 'error' });
    return;
  }

  await app.db.use('users').add(data);
};
```

## Hidden Fields

```javascript
{
  createdAt: { type: 'date', hidden: true },
  internalNotes: { type: 'textarea', hidden: true }
}
```

Or use `config.exclude`:

```jsx
<FormBuilder
  schema={schema}
  config={{ exclude: ['createdAt', 'updatedAt'] }}
/>
```

## i18n

```jsx
<FormBuilder
  schema={schema}
  config={{ language: 'es' }}  // en, es, pt, fr, de
/>
```

Translates all UI text (buttons, validation messages, placeholders).

## Complete Example

```jsx
import FormBuilder from '@/components/framework/FormBuilder';

export default function ProductForm({ jcontext }) {
  const product = jcontext.fetch_data?.product; // For editing

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">
        {product ? 'Edit Product' : 'New Product'}
      </h1>

      <FormBuilder
        schema={jcontext.databaseSchemas.products}
        initialData={product}
        config={{
          database: 'products',
          submitText: product ? 'Save Changes' : 'Create Product',
          showCancel: true,
          exclude: ['createdAt', 'updatedAt'],
          validateOnBlur: true
        }}
        onCancel={() => app.navigate.to('/products')}
      />
    </div>
  );
}
```

## Full Schema Example

```javascript
{
  // Step 1: Basic Info
  name: {
    type: 'text',
    label: 'Product Name',
    required: true,
    step: 1,
    stepTitle: 'Basic Information'
  },
  description: {
    type: 'textarea',
    label: 'Description',
    rows: 4,
    step: 1
  },

  // Step 2: Pricing
  price: {
    type: 'price',
    label: 'Price',
    required: true,
    symbol: '$',
    step: 2,
    stepTitle: 'Pricing'
  },
  compareAtPrice: {
    type: 'price',
    label: 'Compare At Price',
    step: 2
  },

  // Step 3: Inventory
  sku: {
    type: 'text',
    label: 'SKU',
    step: 3,
    stepTitle: 'Inventory'
  },
  quantity: {
    type: 'number',
    label: 'Stock Quantity',
    min: 0,
    step: 3
  },

  // Step 4: Images
  mainImage: {
    type: 'image',
    label: 'Main Image',
    variant: 'square',
    pickerSize: 'lg',
    step: 4,
    stepTitle: 'Images'
  },
  gallery: {
    type: 'image',
    label: 'Additional Images',
    multiple: true,
    maxFiles: 10,
    step: 4
  },

  // Step 5: Details
  category: {
    type: 'select',
    label: 'Category',
    options: ['Electronics', 'Clothing', 'Books'],
    required: true,
    step: 5,
    stepTitle: 'Details'
  },
  tags: {
    type: 'array',
    label: 'Tags',
    multiple: true,
    options: ['Featured', 'Sale', 'New'],
    step: 5
  },
  active: {
    type: 'boolean',
    label: 'Active',
    default: true,
    step: 5
  },

  // Hidden fields
  createdAt: { type: 'date', hidden: true },
  updatedAt: { type: 'date', hidden: true }
}
```

> 💡 **Tip:** FormBuilder auto-saves drafts to localStorage. Users can refresh and resume filling out forms.

> 📖 See also: [JasonTable](./jasontable.md), [Database](../databases.md), [App Object](../app.md)
