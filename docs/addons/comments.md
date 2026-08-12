# Comments Addon

Threaded comments for any content — blog posts, products, docs, events. Ships with authentication integration, optional voting and AI moderation, reporting, pagination, and i18n (English/Spanish, auto-detected from locale).

- **Package**: `@addons/comments`
- **Main component**: `Comments` (plus `CommentForm`, `CommentList`, `CommentThread`, `CommentItem` used internally)
- **Requires**: nothing extra — works out of the box; auth for posting

## Basic usage

Page JSON:

```json
{
  "fetch_data": {
    "post": { "database": "posts", "query": { "slug": "{{params.slug}}" }, "findOne": true }
  },
  "components": [
    { "component": "h1", "innerHTML": "{{post.title}}" },
    {
      "component": "@addons/comments/Comments",
      "attributes": {
        "databaseClass": "comments",
        "relId": "{{post.id}}",
        "relType": "post"
      }
    }
  ]
}
```

Or in a component:

```jsx
import Comments from '@addons/comments/components/Comments';

<Comments databaseClass="comments" relId={post.id} relType="post" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `relId` | string | required | ID of the thing being commented on |
| `relType` | string | `"default"` | Kind of entity (`"post"`, `"product"`, ...) |
| `databaseClass` | string | `"comments"` | Collection name — use one per content type |
| `options` | object | see below | Behavior configuration |

### Options

```json
{
  "maxDepth": 3,
  "enableModeration": false,
  "enableVoting": false,
  "enableReporting": true,
  "commentsPerPage": 10,
  "allowEditing": true,
  "editTimeLimit": 300,
  "sortOrder": "newest"
}
```

`sortOrder`: `"newest"` | `"oldest"` | `"votes"`. `editTimeLimit` is seconds after posting during which the author can edit.

## Recipes

```json
// Product reviews — flat, vote-sorted
{ "component": "@addons/comments/Comments",
  "attributes": { "databaseClass": "product_reviews", "relId": "{{product.id}}", "relType": "product",
    "options": { "maxDepth": 1, "enableVoting": true, "sortOrder": "votes" } } }

// Q&A — votes surface the best answer
{ "component": "@addons/comments/Comments",
  "attributes": { "databaseClass": "doc_questions", "relId": "{{doc.id}}", "relType": "documentation",
    "options": { "enableVoting": true, "sortOrder": "votes" } } }
```

## Permissions

- **Guests** read approved comments.
- **Authenticated users** post, edit their own (within the edit window), vote, and report. Posting triggers an inline login prompt via `app.auth.requireLogin()` — no redirect.
- **Admins** delete anything and run moderation.

The collection is created with security rules baked in: public read is filtered to `moderationStatus: "approved"`, create requires auth, update/delete are owner-only. User profiles are auto-joined onto comments via `created_by`.

## API routes

Under `/api/addons/comments/` (used by the components; all server-validated and rate-limited):

- `POST /submit` — create/edit · `DELETE /submit?id=xxx` — delete (owner or admin)
- `POST /vote` — upvote/downvote
- `POST /report` — report for moderation
- `POST /moderate` — AI moderation (admin)
- `GET /fetch` — paginated comment fetching

## Tips

- Use a separate `databaseClass` per content type (`comments`, `product_reviews`, ...) — cleaner data and independent moderation.
- `maxDepth: 2` reads better on mobile.
- Enable `enableModeration` on public-facing sites; it uses the AI service (`app.ai`), so an AI provider key must be configured.
