/**
 * MarkdownView - Universal Markdown Renderer
 *
 * Works both server-side (JSON pages) and client-side (user component imports).
 * Adapts to current Tailwind theme (light/dark) using CSS variables.
 *
 * @example JSON Page usage (SSR):
 * {
 *   "component": "@framework/utils/MarkdownView",
 *   "attributes": {
 *     "source": "https://example.com/readme.md",
 *     "codeHighlight": "full"
 *   }
 * }
 *
 * @example Direct import (works in both server and client components):
 * import MarkdownView from '@/components/framework/utils/MarkdownView';
 * <MarkdownView content={markdownString} />
 *
 * @example With URL source (requires async handling on client):
 * // For client components with URL source, pre-fetch the content
 * const [md, setMd] = useState('');
 * useEffect(() => { fetch(url).then(r => r.text()).then(setMd); }, [url]);
 * <MarkdownView content={md} />
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

/**
 * Code block component with optional syntax highlighting
 * Adapts colors via CSS variables for theme compatibility
 */
function CodeBlockRenderer({
  children,
  className,
  codeHighlight = 'basic',
  ...props
}) {
  // Extract language from className (e.g., "language-javascript")
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'javascript'; // Default to javascript/jsx
  const codeString = String(children).replace(/\n$/, '');

  // Inline code (not in a code block)
  if (!className && !props.node?.position) {
    return (
      <code className="markdown-inline-code" {...props}>
        {children}
      </code>
    );
  }

  // Full syntax highlighting with Prism
  if (codeHighlight === 'full' || codeHighlight === true) {
    return (
      <div className="markdown-code-block">
        <SyntaxHighlighter
          language={language}
          PreTag="div"
          className="markdown-syntax-highlighter"
          useInlineStyles={false} // Use CSS classes instead for theme support
          codeTagProps={{ className: 'markdown-code' }}
        >
          {codeString}
        </SyntaxHighlighter>
        {language && (
          <span className="markdown-code-language">{language}</span>
        )}
      </div>
    );
  }

  // Basic styling without language-specific colors
  return (
    <div className="markdown-code-block">
      <pre className="markdown-pre">
        <code className={`markdown-code ${className || ''}`} {...props}>
          {codeString}
        </code>
      </pre>
      {language && (
        <span className="markdown-code-language">{language}</span>
      )}
    </div>
  );
}

/**
 * Core markdown rendering component (synchronous)
 * Used by both server and client rendering paths
 */
function MarkdownContent({
  markdown,
  className = '',
  codeHighlight = 'basic',
  allowHtml = false,
  prose = true,
}) {
  if (!markdown) {
    return (
      <div className={`markdown-view markdown-empty ${className}`}>
        <p className="text-muted-foreground italic">No markdown content provided.</p>
      </div>
    );
  }

  // Build prose classes for Tailwind Typography
  // Uses dark:prose-invert for automatic light/dark theme support
  let proseClasses = '';
  if (prose === true) {
    proseClasses = 'prose prose-slate dark:prose-invert max-w-none';
  } else if (typeof prose === 'string') {
    proseClasses = prose;
  }

  // Configure rehype plugins for security
  const rehypePlugins = allowHtml ? [] : [rehypeSanitize];

  // Custom components for markdown elements
  const components = {
    // Code blocks with highlighting support
    code: (props) => (
      <CodeBlockRenderer {...props} codeHighlight={codeHighlight} />
    ),

    // Links open in new tab for external URLs
    a: ({ href, children, ...props }) => {
      const isExternal = href?.startsWith('http') || href?.startsWith('//');
      return (
        <a
          href={href}
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="markdown-link"
          {...props}
        >
          {children}
        </a>
      );
    },

    // Images with lazy loading
    img: ({ src, alt, ...props }) => (
      <img
        src={src}
        alt={alt || ''}
        loading="lazy"
        className="markdown-image"
        {...props}
      />
    ),

    // Blockquotes with theme-aware styling
    blockquote: ({ children, ...props }) => (
      <blockquote className="markdown-blockquote" {...props}>
        {children}
      </blockquote>
    ),

    // Tables with theme-aware borders
    table: ({ children, ...props }) => (
      <div className="markdown-table-wrapper">
        <table className="markdown-table" {...props}>
          {children}
        </table>
      </div>
    ),
  };

  return (
    <div className={`markdown-view ${proseClasses} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

/**
 * MarkdownView Component - Main export
 *
 * This is a synchronous component that works in both server and client contexts.
 * For URL sources on the server, use MarkdownViewAsync.
 * For URL sources on the client, pre-fetch the content and pass it as `content`.
 *
 * @param {Object} props
 * @param {string} [props.source] - URL to fetch markdown from (server-side only, see MarkdownViewAsync)
 * @param {string} [props.content] - Direct markdown content string
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean|'full'|'basic'} [props.codeHighlight='basic'] - Code highlighting mode
 * @param {boolean} [props.allowHtml=false] - Allow raw HTML in markdown (security risk)
 * @param {boolean|string} [props.prose=true] - Use Tailwind prose classes
 */
export default function MarkdownView({
  source,
  content,
  className = '',
  codeHighlight = 'basic',
  allowHtml = false,
  prose = true,
}) {
  // If content is provided, render directly
  // If only source is provided but no content, show a message
  // (source fetching requires async - use MarkdownViewAsync for server-side)
  const markdown = content || (source ? `_Loading from: ${source}_` : null);

  return (
    <MarkdownContent
      markdown={markdown}
      className={className}
      codeHighlight={codeHighlight}
      allowHtml={allowHtml}
      prose={prose}
    />
  );
}

/**
 * Async version for server-side rendering with URL fetching
 * Use this in JSON pages when you need to fetch from a URL
 *
 * @example
 * {
 *   "component": "@framework/utils/MarkdownViewAsync",
 *   "attributes": { "source": "https://..." }
 * }
 */
export async function MarkdownViewAsync({
  source,
  content,
  className = '',
  codeHighlight = 'basic',
  allowHtml = false,
  prose = true,
}) {
  let markdown = content;

  // Fetch from URL if source is provided and no content
  if (!markdown && source) {
    try {
      const response = await fetch(source, {
        cache: 'no-store',
        headers: {
          'Accept': 'text/plain, text/markdown, */*'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      markdown = await response.text();
    } catch (error) {
      console.error('[MarkdownViewAsync] Fetch error:', error);
      markdown = `> **Error loading markdown:** ${error.message}`;
    }
  }

  return (
    <MarkdownContent
      markdown={markdown}
      className={className}
      codeHighlight={codeHighlight}
      allowHtml={allowHtml}
      prose={prose}
    />
  );
}

MarkdownView.displayName = 'MarkdownView';
MarkdownView.isFrameworkComponent = true;

MarkdownViewAsync.displayName = 'MarkdownViewAsync';
MarkdownViewAsync.isFrameworkComponent = true;
