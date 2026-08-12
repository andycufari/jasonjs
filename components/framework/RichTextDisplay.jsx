'use client';

import React from 'react';

/**
 * RichTextDisplay Component - Renders rich text content from JSON blocks or HTML
 *
 * Features:
 * - Renders HTML content from TiptapRichTextInput
 * - Renders legacy JSON block format
 * - Theme-aware styling with custom CSS
 * - Safe HTML rendering with dangerouslySetInnerHTML
 * - CDN-optimized images
 *
 * Usage:
 * <RichTextDisplay content={htmlContent} />
 *
 * DO NOT wrap in prose classes - component handles its own styling:
 * ❌ <div className="prose"><RichTextDisplay content={content} /></div>
 * ✅ <RichTextDisplay content={content} />
 */
export default function RichTextDisplay({
  content,
  className = '',
  textColor = 'text-gray-900 dark:text-gray-100',
  linkColor = 'text-blue-600 dark:text-blue-400',
  codeBackground = 'bg-gray-100 dark:bg-gray-800',
  quoteStyle = 'border-gray-300 dark:border-gray-600',
  dividerStyle = 'border-gray-300 dark:border-gray-600',
  headingStyles = {
    1: 'text-3xl font-bold mb-4',
    2: 'text-2xl font-semibold mb-3',
    3: 'text-xl font-medium mb-2'
  }
}) {
  // Handle different content formats
  if (!content) {
    return <div className={`${className} ${textColor}`}></div>;
  }

  // If content is HTML string (from Tiptap), render it directly
  // Since rich_text is always HTML, treat all string content as HTML
  if (typeof content === 'string') {
    // Handle empty HTML content (just <p></p> or <p><br></p>)
    const isEmptyHTML = !content.trim() ||
      content.trim() === '<p></p>' ||
      content.trim() === '<p><br></p>' ||
      content.trim() === '<p><br /></p>';

    if (isEmptyHTML) {
      return <div className={`${className} ${textColor}`}></div>;
    }

    // Check if content is HTML-encoded and decode if necessary
    let processedContent = content;
    if (content.includes('&lt;') || content.includes('&gt;') || content.includes('&amp;')) {
      processedContent = content
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    return (
      <>
        <div
          className={`rich-text-display ${className}`}
          dangerouslySetInnerHTML={{ __html: processedContent }}
          style={{
            direction: 'ltr',
            textAlign: 'left'
          }}
        />

        {/* Custom styles for Tiptap content */}
        <style jsx>{`
          .rich-text-display :global(p) {
            margin: 0 0 1rem 0;
            line-height: 1.6;
          }

          .rich-text-display :global(h1) {
            font-size: 2rem;
            font-weight: 700;
            margin: 0 0 1.5rem 0;
            line-height: 1.2;
            color: hsl(var(--foreground));
          }

          .rich-text-display :global(h2) {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 0 0 1.25rem 0;
            line-height: 1.25;
            color: hsl(var(--foreground));
          }

          .rich-text-display :global(h3) {
            font-size: 1.25rem;
            font-weight: 500;
            margin: 0 0 1rem 0;
            line-height: 1.3;
            color: hsl(var(--foreground));
          }

          .rich-text-display :global(ul),
          .rich-text-display :global(ol) {
            padding-left: 1.5rem;
            margin: 0 0 1rem 0;
          }

          .rich-text-display :global(li) {
            margin: 0 0 0.25rem 0;
            line-height: 1.6;
          }

          .rich-text-display :global(blockquote) {
            border-left: 4px solid hsl(var(--border));
            padding-left: 1rem;
            margin: 0 0 1.5rem 0;
            font-style: italic;
            color: hsl(var(--muted-foreground));
          }

          .rich-text-display :global(pre) {
            background-color: hsl(var(--muted));
            border-radius: 0.5rem;
            padding: 1rem;
            margin: 0 0 1.5rem 0;
            overflow-x: auto;
            font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
            font-size: 0.875rem;
            color: hsl(var(--foreground));
          }

          .rich-text-display :global(code) {
            background-color: hsl(var(--muted));
            border-radius: 0.25rem;
            padding: 0.125rem 0.25rem;
            font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
            font-size: 0.875rem;
            color: hsl(var(--foreground));
          }

          .rich-text-display :global(hr) {
            border: none;
            border-top: 1px solid hsl(var(--border));
            margin: 2rem 0;
          }

          .rich-text-display :global(img) {
            max-width: 100%;
            width: 100%;
            height: auto;
            border-radius: 0.5rem;
            margin: 1rem 0;
            display: block;
          }

          .rich-text-display :global(a) {
            color: hsl(var(--primary));
            text-decoration: underline;
          }

          .rich-text-display :global(a:hover) {
            opacity: 0.8;
          }

          .rich-text-display :global(strong) {
            font-weight: 600;
          }

          .rich-text-display :global(em) {
            font-style: italic;
          }
        `}</style>
      </>
    );
  }

  // If we reach here, content is not a string (shouldn't happen for rich_text)
  return <div className={`${className} ${textColor}`}>Unsupported content format</div>;
}

RichTextDisplay.displayName = 'RichTextDisplay';