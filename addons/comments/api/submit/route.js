// Comment Submission API
// Handles creating and updating comments with rate limiting and moderation

import { NextResponse } from 'next/server';
import { checkRateLimit, recordComment } from '../rate-limit';

/**
 * Moderate comment content using AI
 */
async function moderateComment(content) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/addons/comments/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      console.error('Moderation API failed');
      return { isAppropriate: true, reason: null };
    }

    return await response.json();
  } catch (error) {
    console.error('Moderation error:', error);
    return { isAppropriate: true, reason: null };
  }
}

/**
 * POST /api/addons/comments/submit
 * Create or update a comment
 */
export async function POST(request) {
  try {
    const { database, session } = request.addonContext;

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', message: 'You must be logged in to comment' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      content,
      relId,
      relType = 'default',
      parentId = null,
      databaseClass = 'comments',
      enableModeration = false,
      commentId = null, // For updates
      rateLimits = {
        maxCommentsPerMinute: 2,
        maxCommentsPerHour: 5,
        maxCommentsPerDay: 50,
      },
    } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (!relId) {
      return NextResponse.json({ error: 'relId is required' }, { status: 400 });
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length === 0) {
      return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 });
    }

    if (trimmedContent.length > 1000) {
      return NextResponse.json(
        { error: 'Content too long', message: 'Comment must be 1000 characters or less' },
        { status: 400 }
      );
    }

    const userId = session.user.id || session.user.email;

    // Normal database access — owner-level security enforced by framework
    const db = database.use(databaseClass);

    // For new comments, check rate limits
    if (!commentId) {
      const rateLimitCheck = checkRateLimit(userId, rateLimits);

      if (!rateLimitCheck.allowed) {
        return NextResponse.json(
          { error: 'Rate limit exceeded', message: rateLimitCheck.message },
          { status: 429 }
        );
      }
    }

    // If updating, verify ownership and time limit
    if (commentId) {
      const existingResult = await db.fetch({ filters: { id: commentId } });

      if (!existingResult.success || !existingResult.data || existingResult.data.length === 0) {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
      }

      const existingComment = existingResult.data[0];

      // Check ownership (created_by is auto-set by framework)
      if (existingComment.created_by !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'You can only edit your own comments' },
          { status: 403 }
        );
      }

      // Check time limit (5 minutes)
      const createdAt = new Date(existingComment.created_at || existingComment.createdAt);
      const timeDiff = (new Date() - createdAt) / 1000;

      if (timeDiff > 300) {
        return NextResponse.json(
          { error: 'Edit time expired', message: 'Comments can only be edited within 5 minutes' },
          { status: 403 }
        );
      }
    }

    // Moderate content if enabled
    let moderationStatus = 'approved';
    let moderationReason = null;

    if (enableModeration) {
      const moderationResult = await moderateComment(trimmedContent);

      if (!moderationResult.isAppropriate) {
        return NextResponse.json(
          {
            error: 'Moderation failed',
            message: 'Your comment was flagged by our moderation system',
            reason: moderationResult.reason || 'Content flagged by moderation',
          },
          { status: 400 }
        );
      }
    }

    let comment;

    if (commentId) {
      // Update existing comment — framework enforces owner-level check via created_by
      const updateResult = await db.update(commentId, {
        content: trimmedContent,
        isModerated: enableModeration,
        moderationStatus,
        moderationReason,
      });

      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update comment');
      }

      comment = updateResult.data?.getValues ? updateResult.data.getValues() : updateResult.data;
    } else {
      // Create new comment
      // created_by, created_at, updated_at are auto-set by framework
      const createResult = await db.add({
        content: trimmedContent,
        relId,
        relType,
        parentId,
        isModerated: enableModeration,
        moderationStatus,
        moderationReason,
      });

      // Record uses Proxy — use getValues() for plain object
      comment = createResult.getValues ? createResult.getValues() : { ...createResult._data || createResult };

      recordComment(userId);
    }

    if (!comment.id && comment._id) {
      comment.id = comment._id.toString();
    }

    // Add user info to comment for display
    if (!comment.user && session.user) {
      comment.user = {
        id: session.user.id,
        name: session.user.name,
        image: session.user.image,
        email: session.user.email,
      };
    }

    return NextResponse.json({
      success: true,
      comment,
      moderation: {
        enabled: enableModeration,
        status: moderationStatus,
        reason: moderationReason,
      },
    });
  } catch (error) {
    console.error('Comment submission error:', error);

    return NextResponse.json(
      { error: 'Submission failed', message: error.message || 'Failed to submit comment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/addons/comments/submit?id=xxx
 * Delete a comment (owner or admin)
 */
export async function DELETE(request) {
  try {
    const { database, session } = request.addonContext;

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', message: 'You must be logged in to delete comments' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('id');
    const databaseClass = searchParams.get('databaseClass') || 'comments';

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    const userId = session.user.id || session.user.email;
    const isAdmin = session.user.role === 'admin' || session.user.isAdmin;

    // Use admin-level access for fetching (to read any comment) and cascade deleting replies
    const db = database.use(databaseClass, true);

    const commentResult = await db.fetch({ filters: { id: commentId } });

    if (!commentResult.success || !commentResult.data || commentResult.data.length === 0) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const comment = commentResult.data[0];

    // Check ownership or admin — addon validates, not the database layer
    const isOwner = comment.created_by === userId;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You can only delete your own comments' },
        { status: 403 }
      );
    }

    // Delete comment and cascade-delete replies
    await db.deleteById(commentId);

    const repliesResult = await db.fetch({ filters: { parentId: commentId } });
    if (repliesResult.success && repliesResult.data) {
      for (const reply of repliesResult.data) {
        await db.deleteById(reply.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Comment deletion error:', error);

    return NextResponse.json(
      { error: 'Deletion failed', message: error.message || 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
