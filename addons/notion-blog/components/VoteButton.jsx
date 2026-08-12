// components/plugins/notion-blog/VoteButton.jsx
'use client';

import { useDatabase } from '@/core/client/db';
import { useState } from 'react';
import { ArrowBigUp, ArrowBigDown } from 'lucide-react';

// Helper to manage votes in localStorage for non-authenticated users
const VoteStorage = {
  getVote: (postId) => {
    if (typeof window === 'undefined') return null;
    try {
      const votes = JSON.parse(window.localStorage.getItem('post_votes') || '{}');
      return votes[postId] || null;
    } catch (e) {
      return null;
    }
  },

  setVote: (postId, vote) => {
    if (typeof window === 'undefined') return;
    try {
      const votes = JSON.parse(window.localStorage.getItem('post_votes') || '{}');
      votes[postId] = vote;
      window.localStorage.setItem('post_votes', JSON.stringify(votes));
    } catch (e) {
      console.error('Failed to save vote:', e);
    }
  }
};

export default function VoteButton({
  postId,
  initialVotes = 0,
  userVote = null,
  databaseId,
  minVotesToShow = 0,
  user,
  onVoteChange = null
}) {
  const [votes, setVotes] = useState(initialVotes);
  const [currentVote, setCurrentVote] = useState(user ? userVote : VoteStorage.getVote(postId));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const db = useDatabase?.(databaseId);

  const formatVoteCount = (count) => {
    if (count < minVotesToShow) return '•';
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const updateVoteOptimistically = async (newVote) => {
    if (!db) {
      setError('Voting is not available');
      return;
    }

    setError(null);
    setIsLoading(true);
    const previousVote = currentVote;
    const previousVotes = votes;

    try {
      setCurrentVote(newVote);
      setVotes(prev => prev + (newVote === 'up' ? 1 : -1));

      if (user) {
        await db.update(postId, {
          operation: 'vote',
          field: 'votes',
          value: newVote === 'up' ? 1 : -1,
          userId: user.id,
          userVote: newVote
        });
      } else {
        await db.update(postId, {
          operation: 'increment',
          field: 'votes',
          value: newVote === 'up' ? 1 : -1
        });
        VoteStorage.setVote(postId, newVote);
      }

      if (onVoteChange) {
        onVoteChange(votes + (newVote === 'up' ? 1 : -1), newVote);
      }
    } catch (error) {
      setCurrentVote(previousVote);
      setVotes(previousVotes);
      setError('Failed to vote. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (direction) => {
    if (isLoading) return;

    if (currentVote === direction) {
      try {
        setIsLoading(true);
        setCurrentVote(null);
        const newVotes = votes + (direction === 'up' ? -1 : 1);
        setVotes(newVotes);

        if (user) {
          await db.update(postId, {
            operation: 'removeVote',
            field: 'votes',
            value: direction === 'up' ? -1 : 1,
            userId: user.id
          });
        } else {
          await db.increment(postId, 'votes', direction === 'up' ? -1 : 1);
          VoteStorage.setVote(postId, null);
        }

        if (onVoteChange) {
          onVoteChange(newVotes, null);
        }
      } catch (error) {
        setError('Failed to remove vote. Please try again.');
        setCurrentVote(direction);
        setVotes(votes);
      } finally {
        setIsLoading(false);
      }
    } else {
      await updateVoteOptimistically(direction);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center space-x-1">
        <button
          onClick={() => handleVote('up')}
          disabled={isLoading}
          className={`p-1 rounded hover:bg-gray-100 transition-colors ${
            currentVote === 'up' ? 'text-primary' : 'text-gray-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="Upvote"
          title="Upvote"
        >
          <ArrowBigUp className="w-5 h-5" />
        </button>

        <span className={`text-sm font-medium ${
          votes > 0 ? 'text-primary' : votes < 0 ? 'text-red-500' : 'text-gray-500'
        }`} title={`${votes} votes`}>
          {formatVoteCount(votes)}
        </span>

        <button
          onClick={() => handleVote('down')}
          disabled={isLoading}
          className={`p-1 rounded hover:bg-gray-100 transition-colors ${
            currentVote === 'down' ? 'text-red-500' : 'text-gray-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="Downvote"
          title="Downvote"
        >
          <ArrowBigDown className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  );
}
