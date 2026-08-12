'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useApp } from '@/core/hooks/useApp';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Loader2 } from 'lucide-react';
import { t } from '../i18n';

/**
 * CommentForm Component - Expandable comment form
 */
export default function CommentForm({
  databaseClass = 'comments',
  relId,
  relType = 'default',
  parentId = null,
  enableModeration = false,
  onSuccess,
  onCancel,
  rateLimits = {
    maxCommentsPerMinute: 2,
    maxCommentsPerHour: 5,
    maxCommentsPerDay: 50,
  },
  maxLength = 1000,
  autoFocus = false,
  placeholder,
}) {
  const app = useApp();
  const { data: session } = useSession();
  const textareaRef = useRef(null);

  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isFocused, setIsFocused] = useState(autoFocus);

  const isReply = !!parentId;
  const isAuthenticated = !!session?.user;
  const user = session?.user || null;

  const charCount = content.length;
  const isNearLimit = charCount > maxLength * 0.9;
  const isOverLimit = charCount > maxLength;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) textareaRef.current.focus();
  }, [autoFocus]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError(null);

    if (!isAuthenticated) {
      const user = await app.auth.requireLogin({ message: t('comments.login_to_comment') });
      if (!user) return;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) { setError(t('comments.errors.content_required')); return; }
    if (trimmedContent.length > maxLength) { setError(t('comments.errors.content_too_long', { max: maxLength })); return; }
    if (!relId) { setError('relId is required'); return; }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/addons/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmedContent, relId, relType, parentId, databaseClass, enableModeration, rateLimits }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) setError(data.message || t('comments.errors.rate_limit_exceeded'));
        else if (response.status === 401) { setError(t('comments.errors.auth_required')); app.auth.requireLogin({ message: t('comments.login_to_comment') }); }
        else setError(data.message || t('comments.errors.submission_failed'));
        return;
      }

      if (enableModeration && data.moderation?.status === 'pending') {
        app?.ui?.toast?.(t('comments.pending_approval'), { type: 'info' });
      } else {
        app?.ui?.toast?.(t('comments.success.comment_posted'), { type: 'success' });
      }

      setContent('');
      setIsFocused(false);
      if (onSuccess && data.comment) onSuccess(data.comment);
    } catch (err) {
      console.error('Comment submission error:', err);
      setError(t('comments.errors.network_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setContent('');
    setError(null);
    setIsFocused(false);
    onCancel?.();
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (content.trim() && !isSubmitting && !isOverLimit) handleSubmit();
    }
    if (e.key === 'Escape' && isReply) handleCancel();
  };

  // Prompt login when unauthenticated user focuses the textarea
  const handleUnauthFocus = async () => {
    const user = await app.auth.requireLogin({ message: t('comments.login_to_comment') });
    if (user && textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const defaultPlaceholder = isReply ? t('comments.write_reply') : t('comments.write_comment');

  return (
    <motion.form
      initial={isReply ? { opacity: 0, y: -10 } : false}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isReply ? 'my-3' : 'mb-6'}`}
      onSubmit={handleSubmit}
    >
      {/* Avatar */}
      {!isReply && user && (
        <div className="flex-shrink-0">
          {user.image ? (
            <img src={user.image} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
              {(user.name || user.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col gap-2">
        {/* Textarea */}
        <div className={`relative border rounded-lg bg-background transition-all ${error ? 'border-red-500' : 'border-border'} ${isFocused ? 'border-primary ring-2 ring-primary/10' : ''}`}>
          <textarea
            ref={textareaRef}
            className="w-full px-4 py-3 bg-transparent border-none outline-none text-foreground text-[0.9375rem] leading-relaxed resize-none min-h-[2.75rem] placeholder:text-muted-foreground"
            placeholder={placeholder || defaultPlaceholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => { if (!isAuthenticated) { handleUnauthFocus(); return; } setIsFocused(true); }}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            rows={isFocused || isReply ? 3 : 1}
          />
          {!isFocused && !isReply && !content && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
              {t('comments.post')}
            </div>
          )}
        </div>

        {/* Actions */}
        <AnimatePresence>
          {(isFocused || content || isReply) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-between items-center py-1"
            >
              <div className="flex items-center gap-4">
                <span className={`text-xs ${isOverLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {charCount}/{maxLength}
                </span>
                <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[0.6875rem] font-mono">⌘</kbd>
                  +
                  <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[0.6875rem] font-mono">Enter</kbd>
                </span>
              </div>

              <div className="flex gap-2">
                {(isReply || content) && (
                  <button
                    type="button"
                    className="px-3.5 py-2 border border-border rounded-md text-muted-foreground text-sm font-medium hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    {t('comments.cancel')}
                  </button>
                )}
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                  disabled={isSubmitting || !content.trim() || isOverLimit}
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('comments.posting')}</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" />{isReply ? t('comments.reply') : t('comments.post')}</>
                  )}
                </button>
              </div>
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
              className="flex items-center justify-between px-3.5 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg text-red-600 dark:text-red-400 text-sm"
            >
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="p-1 opacity-70 hover:opacity-100 transition-opacity">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Moderation notice */}
        {enableModeration && isFocused && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300 text-xs"
          >
            {t('comments.moderation.checking')}
          </motion.div>
        )}
      </div>
    </motion.form>
  );
}

CommentForm.displayName = 'CommentForm';
