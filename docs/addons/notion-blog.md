# Notion Blog Addon

A complete blog system powered by Notion databases, with support for grid/list layouts, full article rendering with Notion blocks, and social sharing.

## Overview

- **Package**: `@addons/notion-blog`
- **Components**: List, Article
- **Features**: Grid/list layouts, hover effects, full Notion block rendering, audio support
- **Database**: Notion (via connector)

## Quick Start

### 1. Configure Database

Add to your `settings/database.json`:

```json
{
  "blog": {
    "type": "notion",
    "config": {
      "api_key": "[[env.NOTION_API_KEY]]",
      "database_id": "YOUR_NOTION_DATABASE_ID"
    },
    "schema": {
      "Title": "title",
      "Slug": "rich_text",
      "Description": "rich_text",
      "Author": "rich_text",
      "Image": "files",
      "Audio": "files",
      "Published": "checkbox",
      "Created Date": "date",
      "Tags": "multi_select",
      "Language": "multi_select"
    },
    "security": {
      "read": { "level": "public" },
      "create": { "level": "authenticated" },
      "update": { "level": "owner" },
      "delete": { "level": "owner" }
    }
  }
}
```

### 2. Add Environment Variable

In `settings/.env.json`:

```json
{
  "NOTION_API_KEY": "secret_xxxxxxxxxxxxx"
}
```

### 3. Create Blog List Page

Create `pages/blog.json`:

```json
{
  "layout": "main",
  "fetch_data": {
    "blog": {
      "database": "blog",
      "filters": {
        "Published": true
      },
      "sort": {
        "property": "Created Date",
        "direction": "descending"
      }
    }
  },
  "components": [
    {
      "component": "@addons/notion-blog/List",
      "attributes": {
        "database": "blog",
        "postUrl": "/blog/post",
        "layout": {
          "type": "grid",
          "columns": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
          "gap": "gap-8"
        },
        "header": {
          "title": "Blog"
        },
        "display": {
          "showDate": true,
          "showDescription": true,
          "showImage": true,
          "excerptLength": 120
        },
        "fields": {
          "titleField": "Title",
          "slugField": "Slug",
          "descriptionField": "Description",
          "imageField": "Image"
        }
      }
    }
  ]
}
```

### 4. Create Article Page

Create `pages/blog/post/:slug.json`:

```json
{
  "layout": "main",
  "fetch_data": {
    "blog": {
      "database": "blog",
      "fetchType": "page",
      "filters": {
        "Slug": "{{params.slug}}"
      },
      "single": true
    }
  },
  "components": [
    {
      "component": "@addons/notion-blog/Article",
      "attributes": {
        "database": "blog",
        "navigation": {
          "backLink": "/blog",
          "backLabel": "← Back to Blog"
        },
        "display": {
          "showDescription": true,
          "showCoverImage": true,
          "showIcon": true,
          "showAudio": true
        },
        "share": {
          "enabled": true
        },
        "fields": {
          "title": "Title",
          "description": "Description",
          "author": "Author",
          "date": "Created Date",
          "image": "Image"
        }
      }
    }
  ]
}
```

**Note:** The `database` attribute is optional. If you have only one `fetch_data` key, the Article component will auto-detect and use it. If you have multiple fetch_data keys, it will use the first one (with a console warning) or you can specify explicitly.

Simplified example (no `database` attribute needed):
```json
{
  "fetch_data": {
    "blog": { "database": "blog", "fetchType": "page", "filters": { "Slug": "{{params.slug}}" } }
  },
  "components": [{
    "component": "@addons/notion-blog/Article"
    // database attribute omitted - auto-detects "blog"
  }]
}
```

## Fetch Data Configuration

### Simplified Filter Format

The framework automatically transforms simple filters to Notion's native format using the schema:

```json
{
  "filters": {
    "Published": true
  }
}
```

Transforms to:

```json
{
  "filter": {
    "property": "Published",
    "checkbox": { "equals": true }
  }
}
```

### Sort Configuration

Single sort object:

```json
{
  "sort": {
    "property": "Created Date",
    "direction": "descending"
  }
}
```

Or array of sorts:

```json
{
  "sorts": [
    { "property": "Created Date", "direction": "descending" },
    { "property": "Title", "direction": "ascending" }
  ]
}
```

### Fetch Types

- **Default (list)**: Returns array of posts with properties only
- **`fetchType: "page"`**: Returns single post with full Notion blocks (content)

### Single vs Multiple Results

- **Default**: Returns array of results
- **`single: true`**: Returns single object (first result)

## Components

### List Component

Displays a collection of blog posts in grid or list layout.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `database` | string | required | Name of fetch_data key containing posts |
| `postUrl` | string | required | Base URL for post links |
| `layout.type` | string | `"list"` | `"grid"` or `"list"` |
| `layout.columns` | string | `"grid-cols-1 md:grid-cols-2 lg:grid-cols-3"` | Tailwind grid classes |
| `layout.gap` | string | `"gap-6"` | Tailwind gap classes |
| `header.title` | string | `"All Posts"` | Page title |
| `header.coverImage` | string | - | Hero image URL |
| `header.backLink` | string | - | Back button URL |
| `display.showDate` | boolean | `true` | Show publication date |
| `display.showAuthor` | boolean | `true` | Show author name |
| `display.showDescription` | boolean | `true` | Show post excerpt |
| `display.showImage` | boolean | `true` | Show cover image |
| `display.excerptLength` | number | `null` | Max characters (null = full) |
| `fields.titleField` | string | `"Title"` | Notion field for title |
| `fields.slugField` | string | `"Slug"` | Notion field for slug |
| `fields.descriptionField` | string | `"Description"` | Notion field for excerpt |
| `fields.imageField` | string | `"Image"` | Notion field for image |
| `fields.dateField` | string | `"Date"` | Notion field for date |

#### Styling Props

| Prop | Default | Description |
|------|---------|-------------|
| `styles.container` | `"max-w-6xl mx-auto px-4 py-8"` | Container classes |
| `styles.headerTitle` | `"text-2xl font-semibold text-gray-300 mb-6"` | Title classes |
| `styles.gridCard` | `"border-t-2 border-gray-800 pt-6"` | Grid card classes |
| `styles.gridCardHover` | `"hover:opacity-80"` | Grid card hover classes |
| `styles.gridTitle` | `"text-xl font-bold hover:text-gray-400"` | Grid title classes |
| `styles.gridDescription` | `"text-gray-400 text-sm mt-3"` | Grid description classes |
| `styles.gridReadMore` | `"text-xs font-bold uppercase"` | Grid read more classes |

### Article Component

Renders a full blog article with Notion blocks.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `database` | string | auto-detected | Name of fetch_data key containing article. Auto-detects if only one fetch_data key exists. |
| `navigation.backLink` | string | - | Back button URL |
| `navigation.backLabel` | string | `"← Back to all posts"` | Back button text |
| `display.showDescription` | boolean | `true` | Show description |
| `display.showCoverImage` | boolean | `true` | Show cover image |
| `display.showIcon` | boolean | `true` | Show page icon |
| `display.showAudio` | boolean | `true` | Show audio player |
| `share.enabled` | boolean | `false` | Enable share buttons |
| `share.networks` | array | `["twitter", "linkedin"]` | Share platforms |

## Notion Database Schema

### Required Properties

| Property | Type | Description |
|----------|------|-------------|
| Title | title | Post title |
| Slug | rich_text | URL-friendly slug |
| Description | rich_text | Post excerpt |
| Image | files | Cover image |
| Published | checkbox | Visibility control |

### Optional Properties

| Property | Type | Description |
|----------|------|-------------|
| Author | rich_text | Author name |
| Created Date | date | Publication date |
| Tags | multi_select | Post tags |
| Audio | files | Audio file for article |
| Language | multi_select | Content language |

## Styling Examples

### Light Theme

```json
"styles": {
  "container": "max-w-7xl mx-auto px-6 py-12",
  "headerTitle": "text-4xl font-bold text-gray-900 mb-12 text-center",
  "gridCard": "bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm",
  "gridCardHover": "hover:shadow-xl hover:border-primary/30",
  "gridTitle": "text-2xl font-bold text-gray-900 group-hover:text-primary transition-colors",
  "gridDescription": "text-gray-600 text-base leading-relaxed",
  "gridReadMore": "text-primary font-semibold text-sm uppercase"
}
```

### Dark Theme

```json
"styles": {
  "container": "max-w-7xl mx-auto px-6 py-12",
  "headerTitle": "text-4xl font-bold text-white mb-12 text-center",
  "gridCard": "bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden backdrop-blur-sm",
  "gridCardHover": "hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10",
  "gridTitle": "text-2xl font-bold text-white group-hover:text-primary transition-colors",
  "gridDescription": "text-gray-400 text-base leading-relaxed",
  "gridReadMore": "text-primary font-semibold text-sm uppercase tracking-wider"
}
```

### Article Styles (Light Theme)

```json
"styles": {
  "container": "min-h-screen",
  "article": "max-w-4xl mx-auto px-6 py-12",
  "title": "text-4xl font-bold text-gray-900 mb-6",
  "description": "text-xl text-gray-600 mb-8",
  "coverImage": "rounded-xl mb-8 w-full object-cover",
  "backLinkStyle": "text-gray-600 hover:text-primary transition-colors mb-8 inline-block",
  "content": "mt-8 prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-primary"
}
```

## Supported Notion Blocks

The Article component renders:

- **Text**: paragraph, heading_1, heading_2, heading_3
- **Lists**: bulleted_list_item, numbered_list_item (nested supported)
- **Media**: image, video, audio, file
- **Formatting**: code, quote, callout, toggle
- **Links**: bookmark, link_preview
- **Layout**: divider, table

## Troubleshooting

### Posts Not Showing

1. Check `Published` checkbox is true in Notion
2. Verify database schema matches your Notion properties
3. Check `[[env.NOTION_API_KEY]]` is correctly configured
4. Use `?dev=true` to bypass cache

### Article Content Empty

1. Ensure `fetchType: "page"` is set
2. Verify `single: true` is included
3. Check the Notion page has content (blocks)

### Images Not Loading

1. Images are automatically proxied via `/api/proxy/image`
2. Check Notion integration has access to the database
3. Verify image URLs in Notion are valid

### Filter Errors

1. Ensure schema defines the field type correctly
2. Check field names match exactly (case-sensitive)
3. Use native Notion filter format as fallback:

```json
"filters": {
  "filter": {
    "property": "Published",
    "checkbox": { "equals": true }
  }
}
```

## Performance

- **Caching**: Page data cached for 60 seconds via Redis
- **Images**: Lazy loaded with Next.js Image component
- **Dev Mode**: Use `?dev=true` to bypass cache during development
