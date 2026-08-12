// components/plugins/notion-blog/ShareButton.jsx
'use client';

import React from 'react';
import ShareModal from '@/components/framework/ShareModal';
import { useShare } from '@/core/hooks/useShare';
import { Share2 } from 'lucide-react';

/**
 * ShareButton - Client component for sharing articles
 *
 * @param {Object} props
 * @param {string} props.url - URL to share
 * @param {string} props.title - Title to share
 * @param {string} props.description - Description/text to share
 * @param {string} props.language - Language for i18n (from jcontext)
 * @param {Object} props.options - ShareModal options
 * @param {string} props.className - Optional custom classes
 * @param {string} props.variant - Button variant: 'icon' | 'elegant' | 'text' | 'full' (default: 'elegant')
 */
export default function ShareButton({
  url,
  title,
  description = '',
  language = 'en',
  options = {},
  className = '',
  variant = 'elegant'
}) {
  const { shareIsOpen, openShare, closeShare, shareProps } = useShare();

  const handleShare = () => {
    openShare({
      url,
      title,
      text: description,
      options: {
        socialNetworks: ['linkedin', 'whatsapp', 'twitter', 'facebook'],
        ...options
      }
    });
  };

  const getShareLabel = () => {
    return language === 'es' ? 'Compartir' : 'Share';
  };

  const variants = {
    icon: (
      <button
        onClick={handleShare}
        className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className}`}
        aria-label={getShareLabel()}
        title={getShareLabel()}
      >
        <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>
    ),
    elegant: (
      <button
        onClick={handleShare}
        className={`group flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-200 ${className}`}
        aria-label={getShareLabel()}
      >
        <Share2 className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {getShareLabel()}
        </span>
      </button>
    ),
    text: (
      <button
        onClick={handleShare}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className}`}
      >
        <Share2 className="w-4 h-4" />
        <span className="text-sm font-medium">{getShareLabel()}</span>
      </button>
    ),
    full: (
      <button
        onClick={handleShare}
        className={`flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium ${className}`}
      >
        <Share2 className="w-5 h-5" />
        <span>{getShareLabel()}</span>
      </button>
    )
  };

  return (
    <>
      {variants[variant] || variants.elegant}
      <ShareModal
        isOpen={shareIsOpen}
        onClose={closeShare}
        language={language}
        {...shareProps}
      />
    </>
  );
}

ShareButton.displayName = 'ShareButton';
