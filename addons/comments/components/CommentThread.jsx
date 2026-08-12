'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { t } from '../i18n';
import CommentItem from './CommentItem';

/**
 * CommentThread Component - Reddit-style collapsible thread
 */
export default function CommentThread({
  comment,
  allComments = [],
  databaseClass = 'comments',
  level = 0,
  maxDepth = 3,
  allowEditing = true,
  editTimeLimit = 300,
  showAvatar = true,
  showTimestamp = true,
  relId,
  relType,
  enableModeration = false,
  enableVoting = true,
  enableReporting = true,
  onCommentChange,
  onReplyAdded,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const replies = useMemo(() => {
    const commentId = comment.id || comment._id;
    return allComments.filter((c) => c.parentId === commentId);
  }, [allComments, comment.id, comment._id]);

  const hasReplies = replies.length > 0;

  const totalDescendants = useMemo(() => {
    const commentId = comment.id || comment._id;
    if (!commentId) return 0;
    let count = 0;
    const visited = new Set();
    const countDescendants = (parentId) => {
      if (!parentId || visited.has(parentId)) return;
      visited.add(parentId);
      const children = allComments.filter((c) => {
        const childId = c.id || c._id;
        return c.parentId === parentId && childId !== parentId;
      });
      count += children.length;
      children.forEach((child) => {
        const childId = child.id || child._id;
        if (childId && childId !== parentId) countDescendants(childId);
      });
    };
    countDescendants(commentId);
    return count;
  }, [allComments, comment.id, comment._id]);

  const handleReply = (newReply) => {
    onReplyAdded?.(newReply);
    onCommentChange?.([...allComments, newReply]);
  };

  const handleDelete = (commentId) => {
    const removeIds = new Set([commentId]);
    const findDescendants = (parentId) => {
      const children = allComments.filter((c) => c.parentId === parentId);
      children.forEach((child) => {
        removeIds.add(child.id || child._id);
        findDescendants(child.id || child._id);
      });
    };
    findDescendants(commentId);
    const updatedComments = allComments.filter((c) => !removeIds.has(c.id) && !removeIds.has(c._id));
    onCommentChange?.(updatedComments);
  };

  const handleUpdate = (updatedComment) => {
    const updatedComments = allComments.map((c) =>
      (c.id === updatedComment.id || c._id === updatedComment._id)
        ? { ...c, ...updatedComment }
        : c
    );
    onCommentChange?.(updatedComments);
  };

  return (
    <div className={`flex relative ${level === 0 ? 'mb-3' : ''}`}>
      {/* Collapse line (Reddit-style) */}
      {level > 0 && (
        <button
          type="button"
          className="relative w-6 flex-shrink-0 p-0 bg-transparent border-none cursor-pointer group"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? t('comments.show_replies', { count: totalDescendants }) : t('comments.hide_replies')}
        >
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border -translate-x-1/2 transition-all group-hover:bg-primary group-hover:w-[3px]" />
        </button>
      )}

      <div className="flex-1 min-w-0">
        <CommentItem
          comment={comment}
          databaseClass={databaseClass}
          level={level}
          maxDepth={maxDepth}
          allowEditing={allowEditing}
          editTimeLimit={editTimeLimit}
          showAvatar={showAvatar}
          showTimestamp={showTimestamp}
          relId={relId}
          relType={relType}
          enableModeration={enableModeration}
          enableVoting={enableVoting}
          enableReporting={enableReporting}
          onReply={handleReply}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />

        {/* Nested replies */}
        <AnimatePresence>
          {hasReplies && !isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-1 overflow-hidden"
            >
              {replies.map((reply) => (
                <CommentThread
                  key={reply.id || reply._id}
                  comment={reply}
                  allComments={allComments}
                  databaseClass={databaseClass}
                  level={level + 1}
                  maxDepth={maxDepth}
                  allowEditing={allowEditing}
                  editTimeLimit={editTimeLimit}
                  showAvatar={showAvatar}
                  showTimestamp={showTimestamp}
                  relId={relId}
                  relType={relType}
                  enableModeration={enableModeration}
                  enableVoting={enableVoting}
                  enableReporting={enableReporting}
                  onCommentChange={onCommentChange}
                  onReplyAdded={onReplyAdded}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed indicator */}
        <AnimatePresence>
          {hasReplies && isCollapsed && (
            <motion.button
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              type="button"
              className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-muted/50 border border-border rounded-md text-primary text-xs font-medium hover:bg-background hover:border-primary transition-colors"
              onClick={() => setIsCollapsed(false)}
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>{t('comments.show_replies', { count: totalDescendants })}</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

CommentThread.displayName = 'CommentThread';
