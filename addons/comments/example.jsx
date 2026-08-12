// Example Usage of Comments Addon - Reddit-style Discussion System
// Copy this code to use the comments system in your JasonJS application

'use client';

// Import the Comments addon
// In user components: import Comments from '@addons/comments'
// In framework code: import Comments from '@/addons/comments'
import Comments from '@/addons/comments';

/**
 * Example 1: Basic Usage
 * Minimal setup for blog posts
 *
 * Features:
 * - Optimistic UI updates (comments appear instantly)
 * - Reddit-style voting (upvote/downvote)
 * - Threaded replies with collapsible threads
 * - Sort by Best, New, Old, or Top
 */
export function BlogPostWithComments({ post }) {
  return (
    <article className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
      <div className="prose mb-8">{post.content}</div>

      {/* Add comments - just pass relId and relType */}
      <Comments relId={post.id} relType="post" />
    </article>
  );
}

/**
 * Example 2: Wait Room / Community
 * Like Reddit discussions for community engagement
 */
export function WaitRoomComments({ postId }) {
  return (
    <Comments
      relId={postId}
      relType="waitroom_post"
      placeholder="Say hi to the community..."
      options={{
        enableVoting: true,
        enableReporting: true,
        maxDepth: 3,
        sortOrder: 'newest', // Show newest first for real-time feel
      }}
    />
  );
}

/**
 * Example 3: E-commerce Product Reviews
 * Comments as product reviews with moderation
 */
export function ProductWithReviews({ product }) {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <img src={product.image} alt={product.name} className="rounded-lg" />
        <div>
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
          <p className="text-xl text-gray-600 mb-4">${product.price}</p>
          <p className="mb-4">{product.description}</p>
        </div>
      </div>

      {/* Product reviews with AI moderation */}
      <section className="border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>
        <Comments
          databaseClass="product_reviews"
          relId={product.id}
          relType="product"
          placeholder="Share your experience with this product..."
          options={{
            enableModeration: true, // AI checks for spam/fake reviews
            enableVoting: true, // Let customers upvote helpful reviews
            maxDepth: 2, // Allow replies but keep it simple
            commentsPerPage: 10,
            sortOrder: 'best', // Show most helpful first
          }}
        />
      </section>
    </div>
  );
}

/**
 * Example 4: Community Forum
 * Deep threading for discussions (Reddit-style)
 */
export function ForumThread({ thread }) {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h1 className="text-2xl font-bold mb-4">{thread.title}</h1>
        <p className="text-gray-700">{thread.description}</p>
      </div>

      {/* Forum discussion with deep threading */}
      <Comments
        databaseClass="forum_posts"
        relId={thread.id}
        relType="forum"
        placeholder="Join the discussion..."
        options={{
          maxDepth: 5, // Allow deep nested discussions
          enableVoting: true,
          enableModeration: false, // Community-moderated via votes
          enableReporting: true,
          allowEditing: true,
          editTimeLimit: 600, // 10 minutes to edit
          sortOrder: 'best', // Best comments rise to top
          commentsPerPage: 20,
        }}
      />
    </div>
  );
}

/**
 * Example 5: Strict Moderation Site
 * High security with aggressive rate limiting
 */
export function ModeratedArticle({ article }) {
  return (
    <article className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">{article.title}</h1>
      <div className="prose mb-8">{article.content}</div>

      {/* Strict moderation and rate limiting */}
      <Comments
        relId={article.id}
        relType="article"
        placeholder="Share your thoughts..."
        options={{
          enableModeration: true,
          enableVoting: false, // No voting for moderated content
          maxDepth: 1, // No nested replies
          allowEditing: false, // No editing once posted
          rateLimits: {
            maxCommentsPerMinute: 1,
            maxCommentsPerHour: 3,
            maxCommentsPerDay: 10,
          },
        }}
      />
    </article>
  );
}

/**
 * Example 6: Q&A Format
 * Questions and answers, flat list with voting
 */
export function QuestionPage({ question }) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-8">
        <h1 className="text-2xl font-bold mb-2">{question.title}</h1>
        <p className="text-gray-700">{question.description}</p>
      </div>

      <section>
        <h2 className="text-xl font-bold mb-4">Answers</h2>
        <Comments
          databaseClass="answers"
          relId={question.id}
          relType="question"
          placeholder="Write your answer..."
          options={{
            enableVoting: true, // Best answers rise to top
            maxDepth: 1, // One level of replies only
            sortOrder: 'top', // Highest voted first
            commentsPerPage: 30,
          }}
        />
      </section>
    </div>
  );
}

/**
 * Example 7: Maximum Features
 * All features enabled for premium content
 */
export function FullFeaturedComments({ content }) {
  return (
    <Comments
      databaseClass="premium_comments"
      relId={content.id}
      relType={content.type}
      placeholder="What do you think?"
      options={{
        maxDepth: 5,
        enableModeration: true,
        enableVoting: true,
        enableReporting: true,
        commentsPerPage: 25,
        allowEditing: true,
        editTimeLimit: 900, // 15 minutes
        showTimestamp: true,
        showAvatar: true,
        sortOrder: 'best',
        className: 'my-custom-comments',
        rateLimits: {
          maxCommentsPerMinute: 3,
          maxCommentsPerHour: 10,
          maxCommentsPerDay: 100,
        },
      }}
    />
  );
}

/**
 * Example 8: Minimal Setup
 * Just the essentials - optimistic updates included by default!
 */
export function MinimalComments({ itemId }) {
  return <Comments relId={itemId} />;
}

// Export all examples
export default {
  BlogPostWithComments,
  WaitRoomComments,
  ProductWithReviews,
  ForumThread,
  ModeratedArticle,
  QuestionPage,
  FullFeaturedComments,
  MinimalComments,
};
