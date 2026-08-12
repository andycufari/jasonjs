// components/framework/website/IconWrapper.jsx
'use client';
import React from 'react';
import * as LucideIcons from 'lucide-react';

/**
 * IconWrapper - Universal icon component
 *
 * Accepts:
 * - Lucide icon name: "Home", "Settings", "User"
 * - Emoji: "🚀", "💡", "⚡"
 * - Image URL: "/icons/logo.png", "https://..."
 * - React component: <CustomIcon />
 */

const SIZES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8'
};

export default function IconWrapper({
  icon,
  size = 'md',
  className = ''
}) {
  if (!icon) return null;

  const sizeClass = SIZES[size] || SIZES.md;

  // React element - render as-is
  if (React.isValidElement(icon)) {
    return React.cloneElement(icon, {
      className: `${sizeClass} ${className} ${icon.props?.className || ''}`.trim()
    });
  }

  // Not a string - can't handle
  if (typeof icon !== 'string') return null;

  // Emoji detection (single character or emoji sequence)
  const isEmoji = /^[\p{Emoji}]$/u.test(icon) ||
                  /^[\u{1F300}-\u{1FAD6}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(icon);

  if (isEmoji) {
    return (
      <span className={`${sizeClass} flex items-center justify-center ${className}`.trim()} role="img">
        {icon}
      </span>
    );
  }

  // URL detection (image)
  if (icon.startsWith('/') || icon.startsWith('http://') || icon.startsWith('https://')) {
    return (
      <img
        src={icon}
        alt=""
        className={`${sizeClass} object-contain ${className}`.trim()}
      />
    );
  }

  // Lucide icon name
  const LucideIcon = LucideIcons[icon];
  if (LucideIcon) {
    return <LucideIcon className={`${sizeClass} ${className}`.trim()} />;
  }

  // Fallback - treat as text/emoji
  return (
    <span className={`${sizeClass} flex items-center justify-center ${className}`.trim()}>
      {icon}
    </span>
  );
}

IconWrapper.displayName = 'IconWrapper';
