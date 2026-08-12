---
skill: tables
when: "Building data tables, admin interfaces, CRUD views"
requires: []
---

# Tables

> JasonTable for full CRUD data tables with zero config.

## Quick Start

One line gets search, filter, sort, pagination, and inline editing:

```json
{
  "component": "@framework/JasonTable",
  "attributes": {
    "database": "products"
  }
}
```

## Import

```jsx
import JasonTable from '@/components/framework/JasonTable';
```

## Modes

### Standalone (Auto-Fetch)

```jsx
<JasonTable
  database="products"
  editable={true}
  viewLink="/products/:slug"
  pageSize={50}
/>
```

### Component (Pass Data)

```jsx
<JasonTable
  data={jcontext.fetch_data.products}
  schema={jcontext.databaseSchemas.products}
  editable={true}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `database` | string | - | Database (standalone mode) |
| `data` | array | - | Data array (component mode) |
| `schema` | object | - | Schema (auto-fetched in standalone) |
| `editable` | boolean | false | Enable add/edit/delete |
| `viewLink` | string | - | Link pattern: `/products/:slug` |
| `pageSize` | number | 25 | Items per page |
| `serverSide` | boolean | false | Server pagination (for >1000 records) |
| `compact` | boolean | false | Smaller row height |
| `columns` | array | - | Custom column definitions |
| `relationFilters` | array | [] | Relationship dropdowns |
| `initialSort` | object | - | `{ key: 'field', direction: 'asc' }` |
| `showTimestamps` | boolean | false | Show created_at/updated_at columns |
| `showRowNumbers` | boolean | false | Show row number column |
| `height` | number | 550 | Table container height |
| `enableSearch` | boolean | true | Show search bar |
| `enableFilters` | boolean | true | Show column filters |
| `enableSorting` | boolean | true | Enable column sorting |
| `enableSelection` | boolean | true | Enable row checkboxes |
| `enableResizing` | boolean | true | Enable column resizing |
| `className` | string | '' | Additional CSS classes |
| `actionButtons` | array | [] | Custom action buttons per row |
| `selectedItems` | array | [] | Controlled selection state |
| `onSelectionChange` | function | - | Selection change callback |
| `onEditItem` | function | - | Edit button callback |
| `onDeleteItem` | function | - | Delete button callback |
| `onDoubleClick` | function | - | Row double-click callback |
| `onLoadData` | function | - | Data load callback |

## Custom Columns

When using `columns`, type/options/editability are **auto-enriched from the database schema** — you only need to specify overrides:

```jsx
<JasonTable
  database="orders"
  columns={[
    { key: 'order_number', label: 'Order #', maxWidth: 120 },
    { key: 'customer.name', label: 'Customer' },   // dot notation for joins
    { key: 'total', label: 'Total' },               // type auto-detected from schema
    { key: 'status', label: 'Estado' },              // select dropdown auto from schema
    { key: 'customer_geo', label: 'Mapa' },          // geopoint map link auto from schema
    { key: 'createdAt', label: 'Date', type: 'datetime-local' }
  ]}
/>
```

### Column Options

| Option | Type | Description |
|--------|------|-------------|
| `key` | string | Field (supports `artist.name` dots for joins) |
| `label` | string | Display label (falls back to schema label) |
| `type` | string | Override field type (auto-detected from schema) |
| `maxWidth` | number | Max width in pixels |
| `linkPattern` | string | Make cell a link: `/products/:slug` |
| `editable` | boolean | Enable inline editing (auto from schema `listEdit`) |

### Column Types

| Type | Display |
|------|---------|
| `price` | `$123.45` (currency from schema) |
| `date` | `Jan 15, 2025` |
| `datetime-local` | `Jan 15, 2025, 2:30 PM` |
| `boolean` | ✓ or ✗ |
| `number` | `1,234` |
| `select` | Label text (dropdown on edit) |
| `geopoint`/`location` | Clickable Google Maps link |
| `file`/`files` | Filename or image thumbnail |
| `relation` | Resolved display name |
| `richtext` | Stripped HTML (truncated) |
| `array` | Comma-separated or count |

## View Links

Add eye icon to open detail page:

```jsx
<JasonTable
  database="products"
  viewLink="/products/:slug"
/>
```

Supports any field: `:id`, `:slug`, `:_id`, or compound: `:category/:slug`.

## Relationship Filters

Add dropdowns for filtering by relations:

```jsx
<JasonTable
  database="orders"
  relationFilters={[
    {
      key: 'customerId',
      label: 'Customer',
      database: 'customers',
      displayField: 'name'
    }
  ]}
/>
```

## Server-Side Mode

For large datasets (>1000 records):

```jsx
<JasonTable
  database="orders"
  serverSide={true}
  pageSize={50}
  initialSort={{ key: 'createdAt', direction: 'desc' }}
/>
```

Pagination, filtering, and sorting happen server-side.

## Inline Editing

Schema fields with `listEdit: true` become editable. Select fields render as dropdowns:

```javascript
// Database schema
{
  price: { type: 'price', listEdit: true },
  status: {
    type: 'select',
    options: [
      { value: 'pending', label: 'Pendiente' },
      { value: 'confirmed', label: 'Confirmado' }
    ],
    listEdit: true
  },
  featured: { type: 'boolean', listEdit: true }
}
```

Options support both formats: `['active', 'inactive']` or `[{ value: 'active', label: 'Active' }]`.

Array fields display as comma-separated values in the table. Edit via the edit modal (add/remove items UI):

```javascript
{
  tags: {
    type: 'array',
    label: 'Tags',
    items: { type: 'text', placeholder: 'Enter tag' },
    maxItems: 10
  }
}
```

Click cell to edit. Changes save on blur or Enter.

## Schema Control

Control visibility via schema:

```javascript
{
  name: { type: 'text' },

  description: {
    type: 'textarea',
    listing: false  // Hide from table, show in forms
  },

  internalNotes: {
    type: 'textarea',
    hidden: true  // Hide everywhere
  }
}
```

| Schema Option | Description |
|---------------|-------------|
| `listing: false` | Hide from table, show in forms |
| `hidden: true` | Hide everywhere |
| `listEdit: true` | Enable inline editing |
| `maxWidth` | Column max width |

## Events

### Row Actions

```jsx
<JasonTable
  database="products"
  onEditItem={(item) => openEditModal(item)}
  onDeleteItem={async (item) => {
    if (await app.ui.confirm('Delete?')) {
      await app.db.use('products').deleteById(item._id);
    }
  }}
  onDoubleClick={(item) => {
    window.location.href = `/products/${item.slug}`;
  }}
/>
```

### Selection

```jsx
const [selected, setSelected] = useState([]);

<JasonTable
  database="products"
  selectedItems={selected}
  onSelectionChange={setSelected}
/>

{selected.length > 0 && (
  <button onClick={() => bulkDelete(selected)}>
    Delete {selected.length} items
  </button>
)}
```

## Complete Example

```jsx
<JasonTable
  database="products"
  editable={true}
  viewLink="/products/:slug"
  serverSide={true}
  pageSize={50}
  columns={[
    { key: 'name', label: 'Product' },
    { key: 'price', label: 'Price' },
    { key: 'category.name', label: 'Category' },
    { key: 'stock', label: 'Stock' }
  ]}
  relationFilters={[
    { key: 'categoryId', label: 'Category', database: 'categories', displayField: 'name' }
  ]}
  initialSort={{ key: 'createdAt', direction: 'desc' }}
/>
```

## JSON Page Example

```json
{
  "component": "@framework/JasonTable",
  "attributes": {
    "database": "products",
    "editable": true,
    "viewLink": "/products/:slug",
    "pageSize": 50,
    "relationFilters": [
      {
        "key": "categoryId",
        "label": "Category",
        "database": "categories",
        "displayField": "name"
      }
    ]
  }
}
```

## Gotchas

| Don't | Do |
|-------|-----|
| Load 10000 records client-side | Use `serverSide={true}` |
| Forget `editable` for CRUD | Add `editable={true}` |
| Show long text in columns | Use `listing: false` in schema |
| Redefine type in custom columns | Let schema auto-enrich |
| Use string options when you need labels | Use `{ value, label }` format |

## Related

- `skill:database` - Database schemas
- `skill:forms` - FormBuilder for edit modals
