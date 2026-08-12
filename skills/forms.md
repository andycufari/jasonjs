---
skill: forms
when: "Building forms, data entry, multi-step wizards"
requires: []
---

# Forms

> FormBuilder for schema-driven forms with auto-save, validation, and multi-step support.

## Quick Start

### Auto-Save (Simplest)

```jsx
<FormBuilder
  schema={jcontext.databaseSchemas.contacts}
  config={{ database: 'contacts' }}
/>
```

No `onSubmit` needed. Creates new records, updates existing (when `initialData` has `id`).

### Custom Handler

```jsx
<FormBuilder
  schema={jcontext.databaseSchemas.contacts}
  onSubmit={async (data) => {
    await app.db.use('contacts').add(data);
    app.ui.toast('Saved!');
  }}
/>
```

## Import

```jsx
import FormBuilder from '@/components/framework/FormBuilder';
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `schema` | object | Yes | Field definitions |
| `initialData` | object | No | Pre-fill values (edit mode) |
| `onSubmit` | function | No* | `(data) => Promise` |
| `onCancel` | function | No | Called on cancel |
| `onStepChange` | function | No | `(stepIndex) => void` |
| `config` | object | No | Options below |

*Either `onSubmit` or `config.database` required.

## Config Options

```jsx
config={{
  // Auto-save
  database: 'products',

  // Buttons
  submitText: 'Save',
  cancelText: 'Cancel',
  showCancel: true,

  // Fields
  fields: ['name', 'email'],   // Only these
  exclude: ['createdAt'],      // Hide these

  // Validation
  validateOnBlur: true,
  showRequiredIndicator: true,

  // Multi-step
  animation: 'slideUp',        // slideUp, fadeIn
  indicatorVariant: 'dots',    // dots, progress, numbered
  validateOnStep: true,

  // i18n
  language: 'es'               // en, es, pt, fr, de
}}
```

## Field Types

### Text

```javascript
{
  name: { type: 'text', required: true },
  email: { type: 'email', required: true },
  bio: { type: 'textarea', rows: 4 },
  content: { type: 'rich_text' }
}
```

### Numbers

```javascript
{
  age: { type: 'number', min: 0, max: 120 },
  price: { type: 'price', symbol: '$' }
}
```

### Selections

```javascript
{
  category: {
    type: 'select',
    options: ['Electronics', 'Clothing'],
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

### Files

```javascript
{
  avatar: {
    type: 'image',
    variant: 'avatar',     // avatar, square, default
    pickerSize: 'lg'       // sm, md, lg, xl
  },
  gallery: {
    type: 'image',
    multiple: true,
    maxFiles: 10
  },
  document: {
    type: 'file',
    accept: ['application/pdf'],
    maxSize: 20971520
  }
}
```

### Location

```javascript
{
  address: {
    type: 'string',
    location: true,
    location_ref: 'coordinates'
  },
  coordinates: {
    type: 'geopoint',
    hidden: true
  }
}
```

### Scale/Rating

```javascript
{
  rating: {
    type: 'scale',
    min: 1, max: 5,
    display: 'emoji',
    emoji: '⭐'
  },
  experience: {
    type: 'scale',
    min: 0, max: 10,
    display: 'segments',
    labelStart: 'Beginner',
    labelEnd: 'Expert'
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
    required: true
  }
}
```

## Multi-Step Forms

Add `step` property to create wizard:

```javascript
{
  name: {
    type: 'text',
    required: true,
    step: 1,
    stepTitle: 'Your Name',
    stepSubtitle: "What's your name?"
  },
  company: {
    type: 'text',
    step: 2,
    stepTitle: 'Company'
  },
  role: {
    type: 'select',
    step: 3,
    stepTitle: 'Role',
    options: ['Developer', 'Designer', 'Manager']
  }
}
```

FormBuilder auto-detects steps and renders wizard with progress indicator, validation, and keyboard navigation.

## Edit Mode

```jsx
const EditProduct = ({ jcontext }) => {
  const product = jcontext.fetch_data.product;

  return (
    <FormBuilder
      schema={jcontext.databaseSchemas.products}
      initialData={product}
      config={{
        database: 'products',
        submitText: 'Save Changes'
      }}
    />
  );
};
```

When `initialData` has `id` or `_id`, auto-save uses `update()` instead of `add()`.

## Validation

### Built-in

```javascript
{
  email: { type: 'email' },           // Auto-validates format
  url: { type: 'url' },               // Auto-validates URL
  age: { type: 'number', min: 0, max: 120 },
  username: { type: 'text', minLength: 3, maxLength: 20 }
}
```

### Custom

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
  createdAt: { type: 'date', hidden: true }
}
```

Or via config:

```jsx
<FormBuilder
  schema={schema}
  config={{ exclude: ['createdAt', 'updatedAt'] }}
/>
```

## Complete Example

```jsx
import FormBuilder from '@/components/framework/FormBuilder';

export default function ProductForm({ jcontext }) {
  const product = jcontext.fetch_data?.product;

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
          submitText: product ? 'Save' : 'Create',
          showCancel: true,
          exclude: ['createdAt', 'updatedAt']
        }}
        onCancel={() => app.navigate.to('/products')}
      />
    </div>
  );
}
```

## Gotchas

| ❌ Don't | ✅ Do |
|----------|-------|
| Write `onSubmit` just to save | Use `config.database` for auto-save |
| Mix controlled/uncontrolled | Use FormBuilder consistently |
| Forget loading state | FormBuilder handles this |
| Add `step` accidentally | Only add when wizard needed |
| Hardcode form in JSON page | Create component, reference in page |

## Related

- `skill:database` - Database schemas
- `skill:storage` - File uploads
- `skill:geolocation` - Location fields
