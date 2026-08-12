# Notion Database

Use Notion as your data source with automatic property transformation.

## Quick Start

**1. Create database configuration in `settings/database.json`:**

```json
{
  "blog": {
    "type": "notion",
    "config": {
      "api_key": "[[env.NOTION_API_KEY]]",
      "database_id": "your-database-id-here"
    },
    "schema": {
      "Title": "title",
      "Status": "select",
      "Tags": "multi_select",
      "Published": "date",
      "Author": "rich_text"
    }
  }
}
```

**2. Query in page:**

```json
{
  "fetch_data": {
    "database": "blog",
    "filters": { "Status": "Published" },
    "sort": { "Published": -1 },
    "limit": 10
  },
  "components": [
    {
      "component": "h1",
      "innerHTML": "{{data[0].Title}}"
    }
  ]
}
```

**3. Query in component:**

```jsx
const posts = await app.db.use('blog')
  .query({ Status: 'Published' })
  .orderBy('Published', 'desc')
  .limit(10);
```

---

## Configuration

### Database Config Structure

Define your Notion database in `settings/database.json`:

```json
{
  "database_name": {
    "type": "notion",
    "config": {
      "api_key": "[[env.NOTION_API_KEY]]",
      "database_id": "abc123..."
    },
    "schema": {
      "PropertyName": "notion_type"
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Must be `"notion"` |
| `config.api_key` | Yes | Notion integration API key (use env var) |
| `config.database_id` | Yes | Notion database ID (from URL) |
| `schema` | Recommended | Maps property names to Notion types |

### Getting Database ID

From Notion database URL:
```
https://notion.so/workspace/abc123def456...?v=...
                         ^^^^^^^^^^^^^^
                         This is your database_id
```

### Getting API Key

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Copy the "Internal Integration Token"
4. Add to your `.env`: `NOTION_API_KEY=secret_xxx`
5. Share your database with the integration (click "..." > "Add connections")

---

## Schema Types

Define your schema to enable proper query filtering and data transformation.

### Property Type Mapping

| Schema Type | Notion Type | Example Value |
|-------------|-------------|---------------|
| `title` | Title | `"My Post"` |
| `rich_text` / `text` / `string` | Rich Text | `"Description text"` |
| `number` | Number | `42` |
| `select` | Select | `"Option A"` |
| `multi_select` / `multiselect` | Multi-select | `["Tag1", "Tag2"]` |
| `date` | Date | `"2024-01-15"` |
| `checkbox` | Checkbox | `true` |
| `url` | URL | `"https://..."` |
| `email` | Email | `"user@example.com"` |
| `relation` | Relation | `["page-id-1", "page-id-2"]` |
| `files` | Files | `"https://..."` or `["url1", "url2"]` |

### Complete Schema Example

```json
{
  "articles": {
    "type": "notion",
    "config": {
      "api_key": "[[env.NOTION_API_KEY]]",
      "database_id": "abc123"
    },
    "schema": {
      "Title": "title",
      "Slug": "rich_text",
      "Content": "rich_text",
      "Status": "select",
      "Tags": "multi_select",
      "PublishDate": "date",
      "Featured": "checkbox",
      "Author": "relation",
      "Views": "number",
      "ExternalLink": "url",
      "ContactEmail": "email"
    }
  }
}
```

---

## Query Formats

The framework supports three query formats, automatically detected.

### 1. Simple Query (Recommended)

Simple key-value filters, automatically transformed to Notion format:

```json
{
  "fetch_data": {
    "database": "blog",
    "filters": {
      "Status": "Published",
      "Featured": true
    },
    "sort": { "PublishDate": -1 },
    "limit": 10
  }
}
```

**In components:**

```jsx
const posts = await app.db.use('blog')
  .query({ Status: 'Published', Featured: true })
  .orderBy('PublishDate', 'desc')
  .limit(10);
```

### 2. Native Notion Format

For complex queries, use Notion's native filter/sorts structure:

```json
{
  "fetch_data": {
    "database": "blog",
    "filters": {
      "filter": {
        "and": [
          {
            "property": "Status",
            "select": { "equals": "Published" }
          },
          {
            "property": "PublishDate",
            "date": { "on_or_after": "2024-01-01" }
          }
        ]
      },
      "sorts": [
        { "property": "PublishDate", "direction": "descending" }
      ]
    }
  }
}
```

### 3. Direct AND/OR Operators

```json
{
  "fetch_data": {
    "database": "blog",
    "filters": {
      "and": [
        { "property": "Status", "select": { "equals": "Published" } },
        { "property": "Featured", "checkbox": { "equals": true } }
      ]
    }
  }
}
```

---

## Query Operators

### Simple Query Operators

Use object values for operators:

```jsx
// Greater than
const expensive = await app.db.use('products')
  .query({ Price: { gt: 100 } });

// Less than or equal
const recent = await app.db.use('posts')
  .query({ Views: { lte: 1000 } });

// Contains (for text)
const matching = await app.db.use('articles')
  .query({ Title: { contains: 'JavaScript' } });

// Not equal
const active = await app.db.use('tasks')
  .query({ Status: { not: 'Archived' } });
```

| Operator | Description | Example |
|----------|-------------|---------|
| `gt` | Greater than | `{ Price: { gt: 100 } }` |
| `gte` | Greater than or equal | `{ Price: { gte: 100 } }` |
| `lt` | Less than | `{ Price: { lt: 50 } }` |
| `lte` | Less than or equal | `{ Price: { lte: 50 } }` |
| `contains` | Text contains | `{ Title: { contains: 'hello' } }` |
| `starts_with` | Starts with | `{ Name: { starts_with: 'A' } }` |
| `ends_with` | Ends with | `{ Email: { ends_with: '.com' } }` |
| `not` | Not equal | `{ Status: { not: 'deleted' } }` |

### Array Values (OR condition)

Pass an array to create OR conditions:

```jsx
// Status is "Draft" OR "Review"
const drafts = await app.db.use('posts')
  .query({ Status: ['Draft', 'Review'] });
```

---

## Date Operators

### Relative Dates

Use template syntax for relative dates:

```json
{
  "fetch_data": {
    "database": "posts",
    "filters": {
      "filter": {
        "property": "PublishDate",
        "date": {
          "on_or_after": "{{-7 days}}"
        }
      }
    }
  }
}
```

| Template | Description |
|----------|-------------|
| `{{-1 day}}` | 1 day ago |
| `{{-7 days}}` | 7 days ago |
| `{{-2 weeks}}` | 2 weeks ago |
| `{{-1 month}}` | 1 month ago |
| `{{-3 months}}` | 3 months ago |

**Note:** Amount can be negative (past) or positive (future).

### Native Date Filters

```json
{
  "filter": {
    "property": "DueDate",
    "date": {
      "before": "2024-06-01",
      "after": "2024-01-01"
    }
  }
}
```

| Filter | Description |
|--------|-------------|
| `equals` | Exact date match |
| `before` | Before date |
| `after` | After date |
| `on_or_before` | On or before |
| `on_or_after` | On or after |
| `past_week` | Within past week |
| `past_month` | Within past month |
| `past_year` | Within past year |
| `next_week` | Within next week |
| `next_month` | Within next month |
| `next_year` | Within next year |

---

## Fetch Types

### List Query (Default)

Returns array of records from database:

```json
{
  "fetch_data": {
    "database": "posts",
    "filters": { "Status": "Published" }
  }
}
```

### Single Page Query

Fetch single page with content blocks using `fetchType: "page"`:

```json
{
  "fetch_data": {
    "database": "posts",
    "filters": {
      "Slug": "{{params.slug}}",
      "fetchType": "page"
    },
    "findOne": true
  }
}
```

**Returns:**
```json
{
  "id": "page-id",
  "Title": "My Article",
  "Status": "Published",
  "createdAt": "2024-01-15T...",
  "updatedAt": "2024-01-20T...",
  "cover": "https://...",
  "blocks": [
    {
      "type": "paragraph",
      "content": "Text content here",
      "text": [{ "plain_text": "Text content here", "annotations": {...} }]
    },
    {
      "type": "heading_1",
      "content": "Section Title"
    },
    {
      "type": "image",
      "url": "https://...",
      "caption": "Image caption"
    }
  ]
}
```

---

## Block Types

When fetching with `fetchType: "page"`, blocks are transformed:

| Block Type | Properties |
|------------|------------|
| `paragraph` | `content`, `text[]` |
| `heading_1` | `content`, `text[]` |
| `heading_2` | `content`, `text[]` |
| `heading_3` | `content`, `text[]` |
| `bulleted_list_item` | `content`, `text[]`, `children[]` |
| `numbered_list_item` | `content`, `text[]`, `children[]` |
| `quote` | `content`, `text[]` |
| `callout` | `content`, `text[]`, `icon` |
| `code` | `content`, `text[]`, `language` |
| `image` | `url`, `caption` |
| `video` | `url`, `caption` |
| `audio` | `url`, `caption` |
| `file` | `url`, `name` |
| `bookmark` | `url`, `caption` |
| `toggle` | `content`, `text[]`, `children[]` |
| `table` | `rows[][]`, `hasHeader` |
| `divider` | (no additional props) |

### Rich Text Format

The `text[]` array preserves formatting:

```json
{
  "text": [
    {
      "plain_text": "Bold text",
      "annotations": {
        "bold": true,
        "italic": false,
        "strikethrough": false,
        "underline": false,
        "code": false,
        "color": "default"
      },
      "href": null
    },
    {
      "plain_text": "link text",
      "href": "https://example.com",
      "annotations": {...}
    }
  ]
}
```

---

## CRUD Operations

### Create

```jsx
const newPost = await app.db.use('blog').add({
  Title: 'New Article',
  Status: 'Draft',
  Tags: ['JavaScript', 'Tutorial'],
  PublishDate: '2024-06-15'
});
```

**With primary key (upsert):**

If schema defines `primary_key`, existing records are updated:

```json
{
  "blog": {
    "type": "notion",
    "schema": {
      "Slug": "rich_text",
      "primary_key": "Slug"
    }
  }
}
```

```jsx
// Creates new or updates existing by Slug
await app.db.use('blog').add({
  Slug: 'my-article',
  Title: 'Updated Title'
});
```

### Update

```jsx
// By page ID
await app.db.use('blog').update('page-id-here', {
  Status: 'Published',
  PublishDate: new Date().toISOString()
});
```

**Special operations:**

```jsx
// Increment a number
await app.db.use('posts').update('page-id', {
  operation: 'increment',
  field: 'Views',
  value: 1
});

// Append to multi-select
await app.db.use('posts').update('page-id', {
  operation: 'append',
  field: 'Tags',
  value: 'New Tag'
});

// Remove from multi-select
await app.db.use('posts').update('page-id', {
  operation: 'remove',
  field: 'Tags',
  value: 'Old Tag'
});

// Toggle checkbox
await app.db.use('tasks').update('page-id', {
  operation: 'toggle',
  field: 'Completed'
});
```

### Delete

Notion pages are archived (not permanently deleted):

```jsx
await app.db.use('blog').deleteById('page-id');
```

---

## Relations

### Configuring Relation Fields

```json
{
  "articles": {
    "type": "notion",
    "schema": {
      "Title": "title",
      "Author": "relation",
      "Categories": "relation"
    }
  }
}
```

### Querying by Relation

```jsx
// Find articles by author
const byAuthor = await app.db.use('articles')
  .query({ Author: 'author-page-id' });

// Multiple relations (OR)
const byCategories = await app.db.use('articles')
  .query({ Categories: ['cat-id-1', 'cat-id-2'] });
```

### Creating with Relations

```jsx
await app.db.use('articles').add({
  Title: 'New Article',
  Author: 'author-page-id',           // Single relation
  Categories: ['cat-id-1', 'cat-id-2'] // Multiple relations
});
```

---

## Transformed Output

### Property Transformation

Notion API responses are automatically simplified:

**Notion API returns:**
```json
{
  "properties": {
    "Title": {
      "type": "title",
      "title": [{ "plain_text": "My Post" }]
    },
    "Tags": {
      "type": "multi_select",
      "multi_select": [
        { "name": "JavaScript" },
        { "name": "Tutorial" }
      ]
    }
  }
}
```

**Framework transforms to:**
```json
{
  "id": "page-id",
  "Title": "My Post",
  "Tags": ["JavaScript", "Tutorial"],
  "createdAt": "2024-01-15T...",
  "updatedAt": "2024-01-20T..."
}
```

### Auto-Added Fields

| Field | Source |
|-------|--------|
| `id` | Page ID |
| `createdAt` | `created_time` |
| `updatedAt` | `last_edited_time` |
| `cover` | Page cover image (if set) |
| `icon` | Page icon (emoji or URL) |

---

## Files and Media

### Files Property

Single file returns URL string, multiple files return array:

```json
{
  "schema": {
    "Attachment": "files"
  }
}
```

```jsx
// Single file
record.Attachment // "https://s3.../file.pdf"

// Multiple files
record.Attachments // ["https://...", "https://..."]
```

### Media Proxy

Notion-hosted files use signed URLs that expire. The framework auto-proxies these:

```
Original: https://prod-files-secure.s3.us-west-2.amazonaws.com/...
Proxied:  /api/proxy/image?url=...
```

This ensures images and files work reliably in your app.

---

## Page-Level Data Fetching

### Single Fetch

```json
{
  "fetch_data": {
    "database": "posts",
    "filters": { "Status": "Published" },
    "sort": { "PublishDate": -1 },
    "limit": 10
  },
  "components": [
    {
      "each": "data",
      "as": "post",
      "component": "div",
      "components": [
        { "innerHTML": "{{post.Title}}" }
      ]
    }
  ]
}
```

### Multiple Data Sources

```json
{
  "fetch_data": {
    "posts": {
      "database": "blog",
      "filters": { "Status": "Published" },
      "limit": 5
    },
    "featured": {
      "database": "blog",
      "filters": { "Featured": true },
      "findOne": true
    }
  },
  "components": [
    { "innerHTML": "Featured: {{featured.Title}}" },
    {
      "each": "posts",
      "as": "post",
      "component": "div",
      "innerHTML": "{{post.Title}}"
    }
  ]
}
```

### With URL Parameters

```json
{
  "fetch_data": {
    "database": "posts",
    "filters": {
      "Slug": "{{params.slug}}",
      "fetchType": "page"
    },
    "findOne": true
  },
  "components": [
    { "component": "h1", "innerHTML": "{{data.Title}}" },
    {
      "each": "data.blocks",
      "as": "block",
      "component": "@system/NotionBlock",
      "attributes": { "block": "{{block}}" }
    }
  ]
}
```

---

## Sorting

### Simple Sort

```json
{
  "fetch_data": {
    "database": "posts",
    "sort": { "PublishDate": -1 }
  }
}
```

| Value | Direction |
|-------|-----------|
| `-1` | Descending |
| `1` | Ascending |
| `"desc"` | Descending |
| `"asc"` | Ascending |

### Multiple Sorts

Use native format for multiple sort fields:

```json
{
  "fetch_data": {
    "database": "posts",
    "filters": {
      "sorts": [
        { "property": "Featured", "direction": "descending" },
        { "property": "PublishDate", "direction": "descending" }
      ]
    }
  }
}
```

### In Components

```jsx
const posts = await app.db.use('blog')
  .query({ Status: 'Published' })
  .orderBy('PublishDate', 'desc');
```

---

## Common Mistakes

### Wrong: `type` in fetch_data

The database type is defined in `settings/database.json`, NOT in `fetch_data`:

```json
// ❌ WRONG - type doesn't belong here
{
  "fetch_data": {
    "categories": {
      "type": "notion",
      "database": "blog",
      "query": {
        "filter": {
          "property": "Published",
          "checkbox": { "equals": true }
        },
        "sorts": [
          { "property": "Created Date", "direction": "descending" }
        ]
      }
    }
  }
}
```

```json
// ✅ CORRECT - type comes from database config
{
  "fetch_data": {
    "categories": {
      "database": "blog",
      "filters": {
        "filter": {
          "property": "Published",
          "checkbox": { "equals": true }
        },
        "sorts": [
          { "property": "Created Date", "direction": "descending" }
        ]
      }
    }
  }
}
```

Or even simpler with schema-based transformation:

```json
// ✅ SIMPLEST - let framework transform
{
  "fetch_data": {
    "categories": {
      "database": "blog",
      "filters": { "Published": true },
      "sort": { "Created Date": -1 }
    }
  }
}
```

### Wrong: `query` instead of `filters`

While `query` works (it's normalized to `filters`), prefer `filters` for consistency:

```json
// ⚠️ Works but not recommended
{ "query": { "Status": "Published" } }

// ✅ Preferred
{ "filters": { "Status": "Published" } }
```

---

## Complete Examples

### Blog Post List Page

```json
{
  "fetch_data": {
    "database": "blog",
    "filters": { "Status": "Published" },
    "sort": { "PublishDate": -1 },
    "limit": 20
  },
  "component": "@saas-kit/PageContainer",
  "components": [
    {
      "component": "h1",
      "className": "text-3xl font-bold mb-8",
      "innerHTML": "Blog"
    },
    {
      "each": "data",
      "as": "post",
      "component": "article",
      "className": "mb-6 p-4 border rounded",
      "components": [
        {
          "component": "a",
          "attributes": { "href": "/blog/{{post.Slug}}" },
          "components": [
            { "component": "h2", "innerHTML": "{{post.Title}}" }
          ]
        },
        { "innerHTML": "{{post.Excerpt}}" },
        {
          "component": "div",
          "className": "flex gap-2 mt-2",
          "each": "post.Tags",
          "as": "tag",
          "innerHTML": "{{tag}}"
        }
      ]
    }
  ]
}
```

### Blog Post Detail Page

**Route:** `/blog/[slug].json`

```json
{
  "fetch_data": {
    "database": "blog",
    "filters": {
      "Slug": "{{params.slug}}",
      "fetchType": "page"
    },
    "findOne": true
  },
  "meta": {
    "title": "{{data.Title}}",
    "description": "{{data.Excerpt}}"
  },
  "component": "@saas-kit/PageContainer",
  "components": [
    {
      "if": "data.cover",
      "component": "img",
      "attributes": {
        "src": "{{data.cover}}",
        "alt": "{{data.Title}}"
      },
      "className": "w-full h-64 object-cover rounded mb-8"
    },
    {
      "component": "h1",
      "className": "text-4xl font-bold mb-4",
      "innerHTML": "{{data.Title}}"
    },
    {
      "component": "@system/NotionContent",
      "attributes": { "blocks": "{{data.blocks}}" }
    }
  ]
}
```

### Products with Filtering

```jsx
// Component: ProductFilter.jsx
export default function ProductFilter({ app }) {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('');
  const [priceRange, setPriceRange] = useState('all');

  const loadProducts = async () => {
    let query = app.db.use('products').query({ InStock: true });

    if (category) {
      query = query.query({ Category: category });
    }

    if (priceRange === 'under50') {
      query = query.lt('Price', 50);
    } else if (priceRange === 'over100') {
      query = query.gt('Price', 100);
    }

    const results = await query.orderBy('Price', 'asc').limit(50);
    setProducts(results);
  };

  useEffect(() => {
    loadProducts();
  }, [category, priceRange]);

  return (
    <div>
      {/* Filter controls */}
      <select onChange={e => setCategory(e.target.value)}>
        <option value="">All Categories</option>
        <option value="Electronics">Electronics</option>
        <option value="Clothing">Clothing</option>
      </select>

      {/* Product grid */}
      {products.map(product => (
        <div key={product.id}>
          <h3>{product.Title}</h3>
          <p>${product.Price}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Comparison with Other Databases

| Feature | Notion | Jason/MongoDB |
|---------|--------|---------------|
| Real-time subscriptions | No | Yes |
| Full-text search | Limited | Yes |
| Geospatial queries | No | Yes |
| Complex aggregations | No | Yes |
| Rich content blocks | Yes | No |
| Visual editing | Yes (in Notion) | No |
| API rate limits | Yes (3 req/s) | No |
| Auto-generated IDs | UUID | ObjectId |

---

## See Also

- [Databases](../databases.md) - General database operations
- [Databases](../databases.md) - `settings/database.json` configuration
