# JasonTable

**Full CRUD data table with zero config.**

One line of JSON gets you search, filter, sort, pagination, inline editing, and more.

```json
{
  "component": "@framework/JasonTable",
  "attributes": {
    "database": "products"
  }
}
```

That's a complete admin interface.

## Quick Start

### Standalone Mode

Let the table fetch its own data:

```json
{
  "component": "@framework/JasonTable",
  "attributes": {
    "database": "products",
    "viewLink": "/products/:slug",
    "editable": true,
    "pageSize": 50
  }
}
```

### Component Mode

Pass data from `jcontext`:

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
| `database` | string | - | Database name - enables standalone mode |
| `data` | array | - | Data to display (component mode) |
| `schema` | object | - | Database schema (auto-fetched in standalone) |
| `editable` | boolean | false | Enable add/edit/delete |
| `viewLink` | string | - | Pattern for view links: `/products/:slug` |
| `pageSize` | number | 25 | Items per page |
| `serverSide` | boolean | false | Server-side pagination (for >1000 records) |
| `compact` | boolean | false | Smaller row height |
| `showTimestamps` | boolean | false | Show created_at/updated_at columns |
| `showRowNumbers` | boolean | false | Show row number column |
| `columns` | array | - | Custom column definitions |
| `relationFilters` | array | [] | Relationship-based filters |
| `initialSort` | object | - | `{ key: 'field', direction: 'asc' }` |
| `height` | number | 550 | Table container height in pixels |
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

Override which columns show and in what order. **Type, options, labels, and editability are auto-enriched from the database schema** — you only need to specify what you want to override:

```jsx
<JasonTable
  database="orders"
  columns={[
    { key: 'order_number', label: 'Order #', maxWidth: 120 },
    { key: 'customer.name', label: 'Customer' },   // dot notation for joined fields
    { key: 'total', label: 'Total' },               // type 'price' auto from schema
    { key: 'status', label: 'Estado' },              // select dropdown auto from schema
    { key: 'customer_geo', label: 'Map' },           // geopoint map link auto from schema
    { key: 'createdAt', label: 'Date', type: 'datetime-local' }
  ]}
/>
```

The key benefit: you don't need to repeat `type`, `options`, or `listEdit` in your column definitions — JasonTable reads them from the database schema automatically.

### Column Options

| Option | Type | Description |
|--------|------|-------------|
| `key` | string | Field name (supports `artist.name` dot notation for joins) |
| `label` | string | Display label (falls back to schema `label`, then formatted key) |
| `type` | string | Override field type (auto-detected from schema if omitted) |
| `maxWidth` | number | Max column width in pixels |
| `linkPattern` | string | Make cell a clickable link: `/products/:slug` |
| `editable` | boolean | Enable inline editing (auto from schema `listEdit` if omitted) |

### Nested/Joined Fields

Access joined data with dot notation:

```jsx
columns={[
  { key: 'artist.name', label: 'Artist', linkPattern: '/artists/:artist._id' },
  { key: 'location.name', label: 'Location' },
  { key: 'created_by.email', label: 'Creator' }
]}
```

## Column Types

Auto-formatted based on schema type:

| Type | Display | Inline Edit |
|------|---------|-------------|
| `text` | Plain text | Text input |
| `price` | `$123.45` (currency from schema) | Number input |
| `date` | `Jan 15, 2025` | Date picker |
| `datetime-local` | `Jan 15, 2025, 2:30 PM` | Datetime picker |
| `boolean` | ✓ or ✗ | Checkbox (auto-saves) |
| `number` | `1,234` | Number input |
| `select` | Resolved label text | Dropdown |
| `geopoint`/`location` | Clickable "Abrir en mapa" Google Maps link | - |
| `file`/`files` | Filename or image thumbnail | - |
| `relation` | Resolved display name from related collection | - |
| `richtext` | Stripped HTML (truncated to 100 chars) | - |
| `array` | Comma-separated values or item count | - |

### Select Options Format

Select fields support both simple strings and value/label objects:

```javascript
// Simple strings — value and display are the same
status: {
  type: 'select',
  options: ['active', 'inactive', 'archived'],
  listEdit: true
}

// Value/label objects — stores value, displays label
status: {
  type: 'select',
  options: [
    { value: 'pending', label: 'Pendiente' },
    { value: 'confirmed', label: 'Confirmado' },
    { value: 'delivered', label: 'Entregado' }
  ],
  listEdit: true
}
```

### Geopoint Display

Geopoint fields automatically render as clickable Google Maps links. Supports:
- `{ lat, lng }` format
- `{ lat, lng, address }` format (shows address in tooltip)
- GeoJSON Point: `{ type: "Point", coordinates: [lng, lat] }`

## View Links

Add eye icon that opens detail page in new tab:

```json
{
  "component": "@framework/JasonTable",
  "attributes": {
    "database": "products",
    "viewLink": "/products/:slug"
  }
}
```

Supports any field: `:id`, `:slug`, `:_id`, or compound: `:category/:slug`.

## Relationship Filters

Add dropdowns for filtering by related records:

```jsx
<JasonTable
  database="orders"
  relationFilters={[
    {
      key: 'customerId',
      label: 'Customer',
      database: 'customers',
      displayField: 'name'
    },
    {
      key: 'productId',
      label: 'Product',
      database: 'products',
      displayField: 'title'
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

Pagination, filtering, and sorting happen on the server instead of loading everything.

## Schema Control

Control column behavior via your database schema:

```javascript
{
  name: { type: 'text', label: 'Product Name' },

  description: {
    type: 'textarea',
    listing: false  // Hide from table, show in edit form
  },

  price: {
    type: 'price',
    listEdit: true,  // Click to edit inline
    maxWidth: 120
  },

  internalNotes: {
    type: 'textarea',
    hidden: true  // Never show (not in table, not in forms)
  }
}
```

| Schema Option | Description |
|---------------|-------------|
| `listing: false` | Hide from table, show in forms |
| `hidden: true` | Hide everywhere |
| `listEdit: true` | Enable inline editing |
| `maxWidth` | Column max width in pixels |

## Inline Editing

Schema fields with `listEdit: true` become editable. Select fields render as dropdowns with proper labels:

```javascript
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

Click cell to edit. Changes save on blur or Enter. Booleans toggle immediately. Select fields with `listEdit` show an always-visible dropdown.

## Events

### Row Actions

```jsx
<JasonTable
  database="products"
  onEditItem={(item) => {
    openEditModal(item);
  }}
  onDeleteItem={async (item) => {
    if (await app.ui.confirm('Delete?')) {
      await app.db.use('products').delete(item.id);
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
    { key: 'stock', label: 'Stock' },
    { key: 'status', label: 'Status' }
  ]}
  relationFilters={[
    { key: 'categoryId', label: 'Category', database: 'categories', displayField: 'name' }
  ]}
  initialSort={{ key: 'createdAt', direction: 'desc' }}
/>
```

## JSON Page Example

Full admin page with just JSON:

```json
{
  "path": "/admin/products",
  "title": "Products",
  "components": [
    {
      "component": "div",
      "attributes": { "className": "container mx-auto p-8" },
      "components": [
        {
          "component": "h1",
          "innerHTML": "Product Management",
          "attributes": { "className": "text-3xl font-bold mb-6" }
        },
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
      ]
    }
  ]
}
```

> **Tip:** Use `listing: false` in your schema to hide long text fields from the table. They'll still show in the edit form.

> See also: [FormBuilder](./formbuilder.md), [Database](../databases.md)
