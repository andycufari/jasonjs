---
skill: addons/comments
when: "Adding comments, reviews, discussions, Q&A, or feedback to pages"
requires: []
---

# Comments Addon

> Threaded comments with authentication, voting, reporting, AI moderation, and i18n.

## Quick Start

```jsx
import Comments from '@/addons/comments';

<Comments
  databaseClass="comments"
  relId={post.id}
  relType="post"
/>
```

That's it. The addon handles auth, database, threading, pagination, and real-time updates.

## Import

```jsx
import Comments from '@/addons/comments';
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `databaseClass` | string | No | Database collection name (default: `"comments"`) |
| `relId` | string | Yes | ID of the entity being commented on |
| `relType` | string | No | Type label (e.g., `"post"`, `"product"`) |
| `options` | object | No | Configuration options (see below) |

## Options

```jsx
<Comments
  databaseClass="comments"
  relId={item.id}
  relType="product"
  options={{
    maxDepth: 3,              // Max reply nesting (default: 3)
    enableModeration: false,  // AI content moderation (default: false)
    enableVoting: true,       // Upvote/downvote (default: false)
    enableReporting: true,    // Report abuse (default: true)
    commentsPerPage: 10,      // Pagination size (default: 10)
    allowEditing: true,       // Edit own comments (default: true)
    editTimeLimit: 300,       // Edit window in seconds (default: 300)
    sortOrder: 'newest'       // 'newest' | 'oldest' | 'best' | 'top' | 'controversial'
  }}
/>
```

## Database Schema

The addon installs a `comments` database collection. You can use a custom name via `databaseClass`.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `content` | textarea | Comment text (max 1000 chars) |
| `relId` | string | Related entity ID |
| `relType` | string | Entity type label |
| `parentId` | string | Parent comment ID (threading) |
| `moderationStatus` | select | `approved`, `pending`, `rejected`, `flagged` |
| `voteScore` | number | Net score (upvotes - downvotes) |
| `votes` | object | `{ up: [userIds], down: [userIds] }` |
| `reports` | array | User abuse reports |

**Auto-managed by framework** (do not set manually):
- `created_by` - Author user ID
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `updated_by` - Last updater

### Security Rules

```javascript
{
  read:   { level: 'public', filter: { moderationStatus: 'approved' } },
  create: { level: 'authenticated' },
  update: { level: 'owner' },
  delete: { level: 'owner' }  // Admins bypass via role check
}
```

- **Guests**: Read approved comments only
- **Authenticated**: Post, edit own (5-min window), vote, report
- **Admins**: Delete any comment

### Auto-Join

`autoJoinUsers: true` — each comment gets a `user` object joined from `created_by`:

```javascript
comment.user = { id, name, image, email }
```

## Use Cases

### Blog Comments

```jsx
<Comments
  databaseClass="comments"
  relId={article.id}
  relType="blog-post"
  options={{ maxDepth: 2, sortOrder: 'newest' }}
/>
```

### Product Reviews

```jsx
<Comments
  databaseClass="product_reviews"
  relId={product.id}
  relType="product"
  options={{
    maxDepth: 1,
    enableVoting: true,
    enableModeration: true,
    sortOrder: 'top'
  }}
/>
```

### Q&A / Documentation Feedback

```jsx
<Comments
  databaseClass="doc_questions"
  relId={doc.id}
  relType="documentation"
  options={{
    enableVoting: true,
    sortOrder: 'top',
    commentsPerPage: 20
  }}
/>
```

### Event Discussion

```jsx
<Comments
  databaseClass="event_comments"
  relId={event.id}
  relType="event"
  options={{ maxDepth: 2, enableReporting: true }}
/>
```

## Multiple Comment Sections

Use different `databaseClass` per content type to keep data separate:

```jsx
// Blog — uses "comments" collection
<Comments databaseClass="comments" relId={post.id} relType="post" />

// Products — uses "product_reviews" collection
<Comments databaseClass="product_reviews" relId={product.id} relType="product" />

// Docs — uses "doc_feedback" collection
<Comments databaseClass="doc_feedback" relId={doc.id} relType="docs" />
```

Each collection gets its own security rules, indexes, and data isolation.

## Authentication

The addon uses `app.auth.requireLogin()` for inline auth prompts — no page redirects. When an unauthenticated user tries to comment, vote, or report, a login modal appears in-place.

## Moderation

When `enableModeration: true`:

1. New comments are sent to AI for content analysis
2. Clean comments are auto-approved
3. Suspicious comments are flagged for admin review
4. Rejected comments return an error to the user

Requires `OPENAI_API_KEY` in environment.

## Sorting

| Value | Behavior |
|-------|----------|
| `newest` | Most recent first |
| `oldest` | Oldest first |
| `best` | Score + recency weighted |
| `top` | Highest vote score |
| `controversial` | Most total votes (up + down) |

## API Routes

The addon exposes server-side API routes (handled automatically by the component):

| Route | Method | Description |
|-------|--------|-------------|
| `/api/addons/comments/submit` | POST | Create or edit a comment |
| `/api/addons/comments/submit?id=xxx` | DELETE | Delete a comment |
| `/api/addons/comments/vote` | POST | Upvote/downvote |
| `/api/addons/comments/report` | POST | Report for moderation |
| `/api/addons/comments/moderate` | POST | AI moderation (admin) |

You don't need to call these directly — the `<Comments>` component handles everything.

## Complete Page Example

```jsx
import Comments from '@/addons/comments';

export default function BlogPost({ jcontext }) {
  const post = jcontext.fetch_data?.post;

  if (!post) return <div>Post not found</div>;

  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
      <div className="prose mb-12" dangerouslySetInnerHTML={{ __html: post.content }} />

      <section className="border-t pt-8">
        <h2 className="text-xl font-semibold mb-6">Comments</h2>
        <Comments
          databaseClass="comments"
          relId={post.id}
          relType="blog-post"
          options={{
            maxDepth: 2,
            enableVoting: true,
            enableReporting: true,
            sortOrder: 'best'
          }}
        />
      </section>
    </article>
  );
}
```

## Gotchas

| Don't | Do |
|-------|-----|
| Set `created_by`, `created_at` manually | Let the framework handle auto-fields |
| Use same `databaseClass` for different content types | Use separate collections per type |
| Set `maxDepth` too high | Keep at 2-3 for mobile readability |
| Forget `relId` | Always pass the entity ID |
| Build custom comment UI from scratch | Use `<Comments>` — it handles auth, threading, pagination, i18n |

## Related

- `skill:database` - Database schemas and queries
- `skill:auth` - Authentication system
- `skill:forms` - Form building (for custom comment forms)
