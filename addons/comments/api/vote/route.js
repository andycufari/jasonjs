// Comment Voting API
// Handles upvote/downvote functionality with duplicate prevention

import { NextResponse } from 'next/server';

/**
 * POST /api/addons/comments/vote
 * Handle upvote/downvote on a comment
 */
export async function POST(request) {
  try {
    const { database, session } = request.addonContext;

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', message: 'You must be logged in to vote' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      commentId,
      vote, // 'up', 'down', or null (to remove vote)
      databaseClass = 'comments',
    } = body;

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    if (vote !== null && vote !== 'up' && vote !== 'down') {
      return NextResponse.json({ error: 'Invalid vote type' }, { status: 400 });
    }

    const userId = session.user.id || session.user.email;

    // Use admin-level access: votes update other users' comments
    // Auth is already validated above (authenticated user required)
    const db = database.use(databaseClass, true);

    const commentResult = await db.fetch({ filters: { id: commentId } });

    if (!commentResult.success || !commentResult.data || commentResult.data.length === 0) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const comment = commentResult.data[0];

    // Get or initialize vote data
    const votes = comment.votes || { up: [], down: [] };
    const currentVoteScore = comment.voteScore || 0;

    const hasUpvoted = votes.up?.includes(userId);
    const hasDownvoted = votes.down?.includes(userId);

    let newVoteScore = currentVoteScore;
    let newVotes = {
      up: [...(votes.up || [])],
      down: [...(votes.down || [])]
    };

    if (vote === null) {
      if (hasUpvoted) {
        newVotes.up = newVotes.up.filter(id => id !== userId);
        newVoteScore -= 1;
      } else if (hasDownvoted) {
        newVotes.down = newVotes.down.filter(id => id !== userId);
        newVoteScore += 1;
      }
    } else if (vote === 'up') {
      if (hasDownvoted) {
        newVotes.down = newVotes.down.filter(id => id !== userId);
        newVotes.up.push(userId);
        newVoteScore += 2;
      } else if (!hasUpvoted) {
        newVotes.up.push(userId);
        newVoteScore += 1;
      }
    } else if (vote === 'down') {
      if (hasUpvoted) {
        newVotes.up = newVotes.up.filter(id => id !== userId);
        newVotes.down.push(userId);
        newVoteScore -= 2;
      } else if (!hasDownvoted) {
        newVotes.down.push(userId);
        newVoteScore -= 1;
      }
    }

    const updateResult = await db.update(commentId, {
      votes: newVotes,
      voteScore: newVoteScore,
    });

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update vote');
    }

    return NextResponse.json({
      success: true,
      voteScore: newVoteScore,
      userVote: vote,
      votes: newVotes,
    });
  } catch (error) {
    console.error('Vote error:', error);

    return NextResponse.json(
      { error: 'Vote failed', message: error.message || 'Failed to register vote' },
      { status: 500 }
    );
  }
}
