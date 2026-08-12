// Comment Reporting API
// Handles reporting comments for spam, offensive content, etc.

import { NextResponse } from 'next/server';

/**
 * POST /api/addons/comments/report
 * Report a comment for moderation
 */
export async function POST(request) {
  try {
    const { database, session } = request.addonContext;

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required', message: 'You must be logged in to report comments' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      commentId,
      reason = 'other', // 'spam', 'offensive', 'harassment', 'misinformation', 'other'
      details = '',
      databaseClass = 'comments',
    } = body;

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    const validReasons = ['spam', 'offensive', 'harassment', 'misinformation', 'other'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ error: 'Invalid report reason' }, { status: 400 });
    }

    const userId = session.user.id || session.user.email;

    // Use admin-level access: reports update other users' comments
    // Auth is already validated above (authenticated user required)
    const db = database.use(databaseClass, true);

    const commentResult = await db.fetch({ filters: { id: commentId } });

    if (!commentResult.success || !commentResult.data || commentResult.data.length === 0) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const comment = commentResult.data[0];

    // Get or initialize reports data
    const reports = comment.reports || [];

    // Check if user already reported this comment
    const hasReported = reports.some(report => report.userId === userId);
    if (hasReported) {
      return NextResponse.json(
        { error: 'Already reported', message: 'You have already reported this comment' },
        { status: 400 }
      );
    }

    // Add new report
    reports.push({
      userId,
      reason,
      details,
      reportedAt: new Date().toISOString(),
    });

    // Auto-flag if 3+ reports or harassment
    const shouldFlag = reports.length >= 3 || reason === 'harassment';

    const updateData = { reports };

    if (shouldFlag && comment.moderationStatus !== 'flagged') {
      updateData.moderationStatus = 'flagged';
      updateData.flagReason = `${reports.length} reports received`;
    }

    const updateResult = await db.update(commentId, updateData);

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to record report');
    }

    return NextResponse.json({
      success: true,
      message: 'Report submitted successfully',
      reportCount: reports.length,
      flagged: shouldFlag,
    });
  } catch (error) {
    console.error('Report error:', error);

    return NextResponse.json(
      { error: 'Report failed', message: error.message || 'Failed to submit report' },
      { status: 500 }
    );
  }
}
