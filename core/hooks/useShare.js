'use client';
import { useState, useCallback } from 'react';

/**
 * Hook to easily use the ShareModal component
 *
 * Usage:
 * const { shareIsOpen, openShare, closeShare, shareProps } = useShare();
 *
 * // In your component JSX:
 * <ShareModal isOpen={shareIsOpen} onClose={closeShare} {...shareProps} />
 *
 * // To trigger sharing:
 * openShare({ url: 'https://example.com', title: 'Check this out!' })
 */
export function useShare() {
  const [shareIsOpen, setShareIsOpen] = useState(false);
  const [shareProps, setShareProps] = useState({
    url: '',
    title: '',
    text: '',
    options: {}
  });

  const openShare = useCallback((props = {}) => {
    setShareProps({
      url: props.url || (typeof window !== 'undefined' ? window.location.href : ''),
      title: props.title || '',
      text: props.text || '',
      options: props.options || {}
    });
    setShareIsOpen(true);
  }, []);

  const closeShare = useCallback(() => {
    setShareIsOpen(false);
  }, []);

  return {
    shareIsOpen,
    openShare,
    closeShare,
    shareProps
  };
}

export default useShare;