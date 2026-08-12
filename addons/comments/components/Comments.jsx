'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useApp } from '@/core/hooks/useApp';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, TrendingUp, Clock, Flame, ChevronDown } from 'lucide-react';
import { t as translate } from '../i18n';
import CommentForm from './CommentForm';
import CommentList from './CommentList';

/**
 * Comments Addon - Main Container Component
 *
 * A Reddit-style comments system with threading, voting, and real-time updates.
 *
 * @param {string} databaseClass - Database collection name (default: 'comments')
 * @param {string} relId - Required. ID of the related entity (post.id, product.id, etc.)
 * @param {string} relType - Type of related entity (optional: 'post', 'product', etc.)
 * @param {object} options - Configuration options
 * @param {string} placeholder - Custom placeholder for the comment form
 */

const DEFAULT_CONFIG = {
  maxDepth: 3,
  enableModeration: false,
  enableVoting: true,
  enableReporting: true,
  commentsPerPage: 10,
  allowEditing: true,
  editTimeLimit: 300,
  showTimestamp: true,
  showAvatar: true,
  sortOrder: 'best',
  className: '',
  rateLimits: {
    maxCommentsPerMinute: 2,
    maxCommentsPerHour: 5,
    maxCommentsPerDay: 50,
  },
};

const SORT_OPTIONS = [
  { value: 'best', label: 'Best', icon: Flame },
  { value: 'newest', label: 'New', icon: Clock },
  { value: 'oldest', label: 'Old', icon: Clock },
  { value: 'top', label: 'Top', icon: TrendingUp },
];

export default function Comments({
  databaseClass = 'comments',
  relId,
  relType = 'default',
  options = {},
  placeholder,
}) {
  const app = useApp();
  const { data: session } = useSession();

  if (!relId) {
    console.error('Comments: relId prop is required');
    return (
      <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/30">
        <p className="text-red-600 dark:text-red-400 text-sm">Error: relId is required for Comments component</p>
      </div>
    );
  }

  const config = useMemo(() => ({
    ...DEFAULT_CONFIG,
    emptyMessage: translate('comments.no_comments'),
    ...options
  }), [options]);

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOrder, setSortOrder] = useState(config.sortOrder);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const getCreatedAt = (c) => c.created_at || c.createdAt;

  const sortComments = useCallback((commentsToSort) => {
    const sorted = [...commentsToSort];
    switch (sortOrder) {
      case 'best':
        sorted.sort((a, b) => {
          const scoreA = (a.voteScore || 0) + (Date.now() - new Date(getCreatedAt(a)).getTime()) / -3600000;
          const scoreB = (b.voteScore || 0) + (Date.now() - new Date(getCreatedAt(b)).getTime()) / -3600000;
          return scoreB - scoreA;
        });
        break;
      case 'top':
        sorted.sort((a, b) => (b.voteScore || 0) - (a.voteScore || 0));
        break;
      case 'newest':
        sorted.sort((a, b) => new Date(getCreatedAt(b)) - new Date(getCreatedAt(a)));
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(getCreatedAt(a)) - new Date(getCreatedAt(b)));
        break;
      case 'controversial':
        sorted.sort((a, b) => {
          const totalA = (a.votes?.up?.length || 0) + (a.votes?.down?.length || 0);
          const totalB = (b.votes?.up?.length || 0) + (b.votes?.down?.length || 0);
          return totalB - totalA;
        });
        break;
      default:
        sorted.sort((a, b) => new Date(getCreatedAt(b)) - new Date(getCreatedAt(a)));
    }
    return sorted;
  }, [sortOrder]);

  const fetchComments = useCallback(async () => {
    if (!relId) return;
    setLoading(true);
    setError(null);
    try {
      const filters = { relId, moderationStatus: 'approved' };
      if (relType) filters.relType = relType;
      const result = await app.db.use(databaseClass).query(filters).limit(1000);
      const commentsArray = Array.isArray(result) ? result : [];
      setComments(sortComments(commentsArray));
    } catch (err) {
      // Authentication errors are expected when user is not logged in
      // Comments with public read should still work, but if the database
      // requires auth, just show empty state instead of an error
      const isAuthError = err.message?.includes('Authentication') ||
                          err.message?.includes('401') ||
                          err.status === 401;
      if (!isAuthError) {
        console.error('Failed to fetch comments:', err);
        setError(err.message || translate('comments.errors.load_failed'));
      }
    } finally {
      setLoading(false);
    }
  }, [app, relId, relType, databaseClass, sortComments]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  useEffect(() => {
    if (comments.length > 0) {
      setComments(prev => sortComments(prev));
    }
  }, [sortOrder]);

  const handleCommentSubmit = useCallback((newComment) => {
    if (!newComment) return;
    const commentWithDefaults = {
      ...newComment,
      id: newComment.id || newComment._id || `temp-${Date.now()}`,
      user: newComment.user || {
        id: session?.user?.id,
        name: session?.user?.name || 'You',
        image: session?.user?.image,
        email: session?.user?.email,
      },
      created_by: newComment.created_by || session?.user?.id || session?.user?.email,
      voteScore: newComment.voteScore ?? 0,
      votes: newComment.votes || { up: [], down: [] },
      created_at: newComment.created_at || newComment.createdAt || new Date().toISOString(),
      moderationStatus: newComment.moderationStatus || 'approved',
    };
    setComments(prev => {
      if (newComment.parentId) return [...prev, commentWithDefaults];
      return [commentWithDefaults, ...prev];
    });
  }, [session]);

  const handleCommentsChange = useCallback((updatedComments) => {
    setComments(updatedComments);
  }, []);

  const handleReplyAdded = useCallback((newReply) => {
    setComments(prev => [...prev, newReply]);
  }, []);

  const totalComments = comments.length;
  const currentSortOption = SORT_OPTIONS.find(opt => opt.value === sortOrder) || SORT_OPTIONS[0];
  const SortIcon = currentSortOption.icon;

  return (
    <div className={`w-full text-foreground ${config.className}`} data-database={databaseClass}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
          <span className="font-semibold text-foreground">
            {totalComments} {totalComments === 1 ? translate('comments.comment') : translate('comments.title')}
          </span>
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border border-border rounded-md text-muted-foreground text-sm font-medium hover:border-primary hover:text-foreground transition-colors"
            onClick={() => setShowSortMenu(!showSortMenu)}
          >
            <SortIcon className="w-3.5 h-3.5" />
            <span>{currentSortOption.label}</span>
            <ChevronDown className="w-4 h-4 ml-0.5" />
          </button>

          <AnimatePresence>
            {showSortMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-1 min-w-[140px] bg-background border border-border rounded-md shadow-md z-50 overflow-hidden"
              >
                {SORT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex items-center gap-2 w-full px-3 py-2 text-sm cursor-pointer transition-colors ${
                        sortOrder === option.value
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                      onClick={() => {
                        setSortOrder(option.value);
                        setShowSortMenu(false);
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Comment form */}
      <div className="mb-6">
        <CommentForm
          databaseClass={databaseClass}
          relId={relId}
          relType={relType}
          enableModeration={config.enableModeration}
          onSuccess={handleCommentSubmit}
          rateLimits={config.rateLimits}
          placeholder={placeholder}
        />
      </div>

      {/* Loading */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-12 text-center text-muted-foreground"
          >
            <div className="w-8 h-8 mx-auto mb-3 border-2 border-border border-t-primary rounded-full animate-spin" />
            <p className="text-sm">{translate('comments.loading')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg text-center"
          >
            <p className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</p>
            <button
              type="button"
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-md transition-colors"
              onClick={fetchComments}
            >
              {translate('comments.load_more')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments list */}
      {!loading && !error && (
        <CommentList
          comments={comments}
          databaseClass={databaseClass}
          maxDepth={config.maxDepth}
          allowEditing={config.allowEditing}
          editTimeLimit={config.editTimeLimit}
          showAvatar={config.showAvatar}
          showTimestamp={config.showTimestamp}
          sortOrder={sortOrder}
          commentsPerPage={config.commentsPerPage}
          relId={relId}
          relType={relType}
          enableModeration={config.enableModeration}
          enableVoting={config.enableVoting}
          enableReporting={config.enableReporting}
          onCommentsChange={handleCommentsChange}
          onReplyAdded={handleReplyAdded}
        />
      )}

      {/* Click outside to close sort menu */}
      {showSortMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
      )}
    </div>
  );
}

Comments.displayName = 'Comments';
