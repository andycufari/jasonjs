'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useApp } from '@/core/hooks/useApp';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp, ChevronDown, MessageSquare, MoreHorizontal,
  Edit3, Trash2, Flag, X, Check,
} from 'lucide-react';
import { t, formatRelativeTime } from '../i18n';
import CommentForm from './CommentForm';

/**
 * CommentItem Component - Individual comment with voting and actions
 */
export default function CommentItem({
  comment,
  databaseClass = 'comments',
  onReply,
  onDelete,
  onUpdate,
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
}) {
  const app = useApp();
  const { data: session } = useSession();

  const isAuthenticated = !!session?.user;
  const currentUser = session?.user;
  const currentUserId = currentUser?.id || currentUser?.email;

  const initialUserVote = () => {
    if (!currentUserId || !comment.votes) return null;
    if (comment.votes.up?.includes(currentUserId)) return 'up';
    if (comment.votes.down?.includes(currentUserId)) return 'down';
    return null;
  };

  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content || '');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [userVote, setUserVote] = useState(initialUserVote());
  const [voteCount, setVoteCount] = useState(comment.voteScore || 0);
  const [isVoting, setIsVoting] = useState(false);
  const editTextareaRef = useRef(null);

  const isOwner = (comment.created_by || comment.userId) === currentUserId;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;
  const commentCreatedAt = comment.created_at || comment.createdAt;
  const commentUpdatedAt = comment.updated_at || comment.updatedAt;
  const canEdit = isOwner && allowEditing && isWithinEditTime(commentCreatedAt, editTimeLimit);
  const canReply = level < maxDepth;

  const commentUser = comment.user || {
    name: comment.userName || 'Unknown User',
    image: comment.userAvatar || null,
    initials: comment.userInitials || 'U',
  };

  function isWithinEditTime(createdAt, limitSeconds) {
    if (!createdAt) return false;
    return (new Date() - new Date(createdAt)) / 1000 <= limitSeconds;
  }

  const handleVote = async (voteType) => {
    if (!isAuthenticated) { const user = await app.auth.requireLogin(); if (!user) return; }
    if (isVoting) return;
    setIsVoting(true);
    try {
      const newVote = userVote === voteType ? null : voteType;
      const oldVote = userVote;
      const oldCount = voteCount;
      setUserVote(newVote);
      let newCount = voteCount;
      if (oldVote === 'up' && newVote === null) newCount -= 1;
      else if (oldVote === 'down' && newVote === null) newCount += 1;
      else if (oldVote === null && newVote === 'up') newCount += 1;
      else if (oldVote === null && newVote === 'down') newCount -= 1;
      else if (oldVote === 'up' && newVote === 'down') newCount -= 2;
      else if (oldVote === 'down' && newVote === 'up') newCount += 2;
      setVoteCount(newCount);

      const response = await fetch('/api/addons/comments/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id || comment._id, vote: newVote, databaseClass }),
      });
      if (!response.ok) {
        setUserVote(oldVote);
        setVoteCount(oldCount);
      }
    } catch (error) {
      console.error('Vote error:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleReplyClick = async () => {
    if (!isAuthenticated) { const user = await app.auth.requireLogin(); if (!user) return; }
    setIsReplying(true);
    setShowMenu(false);
  };

  const handleReplySubmit = (replyComment) => {
    setIsReplying(false);
    onReply?.(replyComment);
  };

  const handleEditClick = () => {
    const currentContent = comment.content || '';
    setEditContent(currentContent);
    setIsEditing(true);
    setShowMenu(false);
    setTimeout(() => {
      editTextareaRef.current?.focus();
      editTextareaRef.current?.setSelectionRange(currentContent.length, currentContent.length);
    }, 50);
  };

  const handleSaveEdit = async () => {
    const trimmed = (editContent || '').trim();
    if (!trimmed || trimmed === comment.content) { setIsEditing(false); return; }
    try {
      const response = await fetch('/api/addons/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id || comment._id, content: trimmed, relId, relType, databaseClass }),
      });
      if (!response.ok) throw new Error('Failed to update comment');
      setIsEditing(false);
      onUpdate?.({ ...comment, content: trimmed });
      app?.ui?.toast?.(t('comments.success.comment_updated'), { type: 'success' });
    } catch (error) {
      console.error('Edit error:', error);
      app?.ui?.toast?.(t('comments.errors.update_failed'), { type: 'error' });
    }
  };

  const handleDelete = async () => {
    const confirmed = await app.ui.confirm(t('comments.delete_confirm_message'), {
      title: t('comments.confirm_delete'),
      okText: t('comments.delete'),
      cancelText: t('comments.cancel'),
      type: 'destructive'
    });
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/addons/comments/submit?id=${comment.id || comment._id}&databaseClass=${databaseClass}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || t('comments.errors.delete_failed'));
      app?.ui?.toast?.(t('comments.success.comment_deleted'), { type: 'success' });
      onDelete?.(comment.id || comment._id);
    } catch (error) {
      console.error('Delete comment error:', error);
      app?.ui?.toast?.(error.message || t('comments.errors.delete_failed'), { type: 'error' });
      setIsDeleting(false);
    }
  };

  const handleReport = async () => {
    if (!isAuthenticated) { const user = await app.auth.requireLogin(); if (!user) return; }
    setShowMenu(false);
    const confirmed = await app.ui.confirm(t('comments.report_confirm_message') || 'Are you sure you want to report this comment?', {
      title: t('comments.report_title'),
      okText: t('comments.report_submit'),
      cancelText: t('comments.cancel'),
      type: 'default'
    });
    if (!confirmed) return;
    try {
      const response = await fetch('/api/addons/comments/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: comment.id || comment._id, reason: 'spam', databaseClass }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Report failed');
      }
      app?.ui?.toast?.(t('comments.report_success'), { type: 'success' });
    } catch (error) {
      console.error('Report error:', error);
      app?.ui?.toast?.(error.message || t('comments.report_error'), { type: 'error' });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`flex gap-2 py-2 ${showMenu ? 'relative z-10' : ''} ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}
    >
      {/* Voting column */}
      {enableVoting && (
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <button
            type="button"
            className={`flex items-center justify-center w-6 h-6 rounded bg-transparent border-none cursor-pointer transition-colors hover:bg-muted ${userVote === 'up' ? 'text-orange-500' : 'text-muted-foreground'}`}
            onClick={() => handleVote('up')}
            disabled={isVoting}
            aria-label="Upvote"
          >
            <ChevronUp className="w-[1.125rem] h-[1.125rem]" />
          </button>
          <span className={`text-xs font-semibold min-w-[1.5rem] text-center ${voteCount > 0 ? 'text-orange-500' : voteCount < 0 ? 'text-blue-500' : 'text-foreground'}`}>
            {voteCount}
          </span>
          <button
            type="button"
            className={`flex items-center justify-center w-6 h-6 rounded bg-transparent border-none cursor-pointer transition-colors hover:bg-muted ${userVote === 'down' ? 'text-blue-500' : 'text-muted-foreground'}`}
            onClick={() => handleVote('down')}
            disabled={isVoting}
            aria-label="Downvote"
          >
            <ChevronDown className="w-[1.125rem] h-[1.125rem]" />
          </button>
        </div>
      )}

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          {showAvatar && (
            <div className="flex-shrink-0">
              {commentUser.image ? (
                <img src={commentUser.image} alt={commentUser.name} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-[0.625rem]">
                  {commentUser.initials || commentUser.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-[0.8125rem] text-foreground">{commentUser.name}</span>
            {showTimestamp && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(commentCreatedAt)}</span>
              </>
            )}
            {commentUpdatedAt && commentCreatedAt && Math.abs(new Date(commentUpdatedAt) - new Date(commentCreatedAt)) > 5000 && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground italic">({t('comments.edited')})</span>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="my-1.5">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={editTextareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm leading-relaxed resize-y min-h-[4rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1.5 border border-border rounded text-muted-foreground text-xs font-medium hover:bg-muted transition-colors"
                  onClick={() => setIsEditing(false)}
                >
                  <X className="w-3 h-3" /> {t('comments.cancel')}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSaveEdit}
                  disabled={!editContent.trim()}
                >
                  <Check className="w-3 h-3" /> {t('comments.save')}
                </button>
              </div>
            </div>
          ) : (
            <p className="m-0 text-foreground text-sm leading-relaxed whitespace-pre-wrap break-words">{comment.content}</p>
          )}
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-2 mt-1">
            {canReply && (
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-1 rounded text-muted-foreground text-xs font-medium hover:bg-muted hover:text-primary transition-colors"
                onClick={handleReplyClick}
              >
                <MessageSquare className="w-3.5 h-3.5" /> {t('comments.reply')}
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-1 rounded text-muted-foreground text-xs font-medium hover:bg-muted hover:text-foreground transition-colors"
                onClick={handleEditClick}
              >
                <Edit3 className="w-3.5 h-3.5" /> {t('comments.edit')}
              </button>
            )}
            {((isOwner || isAdmin) || (enableReporting && !isOwner)) && (
              <div className="relative">
                <button
                  type="button"
                  className="flex items-center px-2 py-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  onClick={() => setShowMenu(!showMenu)}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                      className="absolute top-full right-0 mt-1 min-w-[120px] bg-background border border-border rounded-md shadow-md z-50 overflow-hidden"
                    >
                      {(isOwner || isAdmin) && (
                        <button
                          type="button"
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                          onClick={() => { setShowMenu(false); handleDelete(); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {t('comments.delete')}
                        </button>
                      )}
                      {enableReporting && !isOwner && (
                        <button
                          type="button"
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          onClick={handleReport}
                        >
                          <Flag className="w-3.5 h-3.5" /> {t('comments.report')}
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Reply form */}
        <AnimatePresence>
          {isReplying && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 pt-2 overflow-hidden"
            >
              <CommentForm
                databaseClass={databaseClass}
                relId={relId}
                relType={relType}
                parentId={comment.id || comment._id}
                enableModeration={enableModeration}
                onSuccess={handleReplySubmit}
                onCancel={() => setIsReplying(false)}
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}
    </motion.div>
  );
}

CommentItem.displayName = 'CommentItem';
