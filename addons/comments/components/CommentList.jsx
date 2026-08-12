'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquareOff, ChevronDown } from 'lucide-react';
import { t as translate } from '../i18n';
import CommentThread from './CommentThread';

/**
 * CommentList Component - Comment list with load more
 */
export default function CommentList({
  comments = [],
  databaseClass = 'comments',
  maxDepth = 3,
  allowEditing = true,
  editTimeLimit = 300,
  showAvatar = true,
  showTimestamp = true,
  sortOrder = 'best',
  commentsPerPage = 10,
  relId,
  relType,
  enableModeration = false,
  enableVoting = true,
  enableReporting = true,
  onCommentsChange,
  onReplyAdded,
}) {
  const [displayCount, setDisplayCount] = useState(commentsPerPage);

  const topLevelComments = useMemo(() => {
    return comments.filter((c) => !c.parentId);
  }, [comments]);

  const displayedComments = useMemo(() => {
    return topLevelComments.slice(0, displayCount);
  }, [topLevelComments, displayCount]);

  const hasMore = topLevelComments.length > displayCount;
  const remainingCount = topLevelComments.length - displayCount;
  const commentCount = topLevelComments.length;

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + commentsPerPage);
  };

  const handleCommentsChange = (updatedComments) => {
    onCommentsChange?.(updatedComments);
  };

  if (commentCount === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-12 text-center"
      >
        <MessageSquareOff className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <p className="font-medium text-foreground">{translate('comments.no_comments')}</p>
        <p className="text-sm text-muted-foreground mt-1">{translate('comments.write_comment')}</p>
      </motion.div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col">
        <AnimatePresence mode="popLayout">
          {displayedComments.map((comment, index) => (
            <motion.div
              key={comment.id || comment._id || `comment-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
              layout
            >
              <CommentThread
                comment={comment}
                allComments={comments}
                databaseClass={databaseClass}
                level={0}
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
                onCommentChange={handleCommentsChange}
                onReplyAdded={onReplyAdded}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Load more */}
      <AnimatePresence>
        {hasMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-center"
          >
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-muted/50 border border-border rounded-md text-primary text-sm font-medium hover:bg-background hover:border-primary transition-colors"
              onClick={handleLoadMore}
            >
              <ChevronDown className="w-4 h-4" />
              <span>{translate('comments.load_more')} ({remainingCount})</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

CommentList.displayName = 'CommentList';
