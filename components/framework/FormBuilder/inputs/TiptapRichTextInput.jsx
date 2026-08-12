'use client';

import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline, Link as LinkIcon,
  List, ListOrdered, Image as ImageIcon,
  Heading1, Heading2, Heading3,
  Quote, Code, Minus, Undo, Redo
} from 'lucide-react';
import FileUpload from '../../FileUpload';

/**
 * TiptapRichTextInput Component - A modern rich text editor using Tiptap
 *
 * Features:
 * - Modern WYSIWYG editing experience
 * - Proper HTML output
 * - Better accessibility and UX
 * - Dark mode support
 * - Extensible and customizable
 */
export default function TiptapRichTextInput({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  fieldSchema = {},
  error,
  touched,
  disabled = false,
  placeholder = "Start typing...",
  className = '',
  jcontext = {}
}) {
  const [showImageModal, setShowImageModal] = React.useState(false);
  const [showLinkModal, setShowLinkModal] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');

  // Process initial value - handle both string and object formats (memoized)
  const getInitialContent = React.useCallback(() => {
    console.log('TiptapRichTextInput: Processing value:', value);
    console.log('TiptapRichTextInput: Value type:', typeof value);

    if (!value) return '';

    // If it's already HTML string, use it directly
    if (typeof value === 'string') {
      // Check if the string is HTML-encoded and decode it
      let processedValue = value;

      // Basic HTML entity decoding if needed
      if (processedValue.includes('&lt;') || processedValue.includes('&gt;') || processedValue.includes('&amp;')) {
        processedValue = processedValue
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      }

      console.log('TiptapRichTextInput: Processed HTML:', processedValue);
      return processedValue;
    }

    // If it's the old block-based format, convert to HTML
    if (typeof value === 'object' && value.blocks) {
      // Convert blocks to simple HTML for compatibility
      return value.blocks.map(block => {
        switch (block.type) {
          case 'heading':
            return `<h${block.level || 1}>${block.content || ''}</h${block.level || 1}>`;
          case 'paragraph':
            return `<p>${block.content || ''}</p>`;
          case 'list':
            const tag = block.listType === 'numbered' ? 'ol' : 'ul';
            return `<${tag}><li>${block.content || ''}</li></${tag}>`;
          case 'quote':
            return `<blockquote><p>${block.content || ''}</p></blockquote>`;
          case 'code':
            return `<pre><code>${block.content || ''}</code></pre>`;
          case 'divider':
            return '<hr />';
          case 'image':
            return `<img src="${block.url || ''}" alt="${block.caption || ''}" />`;
          default:
            return `<p>${block.content || ''}</p>`;
        }
      }).join('');
    }

    return '';
  }, [value]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: getInitialContent(),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Always output HTML string for compatibility with RichTextDisplay
      onChange(html);
    },
    onBlur,
    editable: !disabled,
    immediatelyRender: false, // Fix SSR hydration issues
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[150px] p-4 text-sm leading-normal',
        style: 'direction: ltr; text-align: left; line-height: 1.4;',
        dir: 'ltr',
      },
    },
  });

  // Initialize editor content on first mount
  React.useEffect(() => {
    if (editor && value !== undefined) {
      const initialContent = getInitialContent();
      console.log('TiptapRichTextInput: Setting initial content:', initialContent);
      console.log('TiptapRichTextInput: Content type:', typeof initialContent);

      if (initialContent) {
        // Clear any existing content first
        editor.commands.clearContent();

        // Try different approaches to set HTML content
        try {
          // Method 1: Direct setContent
          editor.commands.setContent(initialContent, false);
        } catch (error) {
          console.error('TiptapRichTextInput: Error setting content directly:', error);

          // Method 2: Insert as HTML
          try {
            editor.commands.insertContent(initialContent);
          } catch (insertError) {
            console.error('TiptapRichTextInput: Error inserting content:', insertError);
          }
        }
      }
    }
  }, [editor]); // Only run when editor is ready

  // Update editor content when value prop changes (for controlled updates)
  React.useEffect(() => {
    if (editor && value !== undefined) {
      const currentContent = editor.getHTML();
      const newContent = getInitialContent();

      // Only update if content is actually different and we're not in the middle of editing
      if (currentContent !== newContent && !editor.isFocused) {
        console.log('TiptapRichTextInput: Updating content from', currentContent, 'to', newContent);
        editor.commands.setContent(newContent, false, { parseOptions: { preserveWhitespace: 'full' } });
      }
    }
  }, [value, getInitialContent]);

  // Toolbar actions
  const toolbarActions = [
    {
      group: 'history',
      items: [
        {
          icon: Undo,
          action: () => editor.chain().focus().undo().run(),
          active: false,
          disabled: !editor?.can().undo(),
          tooltip: 'Undo (⌘Z)'
        },
        {
          icon: Redo,
          action: () => editor.chain().focus().redo().run(),
          active: false,
          disabled: !editor?.can().redo(),
          tooltip: 'Redo (⌘⇧Z)'
        }
      ]
    },
    {
      group: 'headings',
      items: [
        {
          icon: Heading1,
          action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          active: editor?.isActive('heading', { level: 1 }),
          tooltip: 'Heading 1'
        },
        {
          icon: Heading2,
          action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          active: editor?.isActive('heading', { level: 2 }),
          tooltip: 'Heading 2'
        },
        {
          icon: Heading3,
          action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          active: editor?.isActive('heading', { level: 3 }),
          tooltip: 'Heading 3'
        }
      ]
    },
    {
      group: 'formatting',
      items: [
        {
          icon: Bold,
          action: () => editor.chain().focus().toggleBold().run(),
          active: editor?.isActive('bold'),
          tooltip: 'Bold (⌘B)'
        },
        {
          icon: Italic,
          action: () => editor.chain().focus().toggleItalic().run(),
          active: editor?.isActive('italic'),
          tooltip: 'Italic (⌘I)'
        },
        {
          icon: LinkIcon,
          action: () => {
            const { from, to } = editor.state.selection;
            const hasSelection = from !== to;
            if (hasSelection) {
              setShowLinkModal(true);
            } else {
              // Toggle existing link
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run();
              } else {
                setShowLinkModal(true);
              }
            }
          },
          active: editor?.isActive('link'),
          tooltip: 'Add Link (⌘K)'
        }
      ]
    },
    {
      group: 'blocks',
      items: [
        {
          icon: List,
          action: () => editor.chain().focus().toggleBulletList().run(),
          active: editor?.isActive('bulletList'),
          tooltip: 'Bullet List'
        },
        {
          icon: ListOrdered,
          action: () => editor.chain().focus().toggleOrderedList().run(),
          active: editor?.isActive('orderedList'),
          tooltip: 'Numbered List'
        },
        {
          icon: Quote,
          action: () => editor.chain().focus().toggleBlockquote().run(),
          active: editor?.isActive('blockquote'),
          tooltip: 'Quote'
        },
        {
          icon: Code,
          action: () => editor.chain().focus().toggleCodeBlock().run(),
          active: editor?.isActive('codeBlock'),
          tooltip: 'Code Block'
        },
        {
          icon: Minus,
          action: () => editor.chain().focus().setHorizontalRule().run(),
          active: false,
          tooltip: 'Horizontal Rule'
        }
      ]
    },
    {
      group: 'media',
      items: [
        {
          icon: ImageIcon,
          action: () => setShowImageModal(true),
          active: false,
          tooltip: 'Insert Image'
        }
      ]
    }
  ];

  // Handle image upload
  const handleImageUpload = useCallback((files) => {
    if (!files) return;

    // FileUpload with multiple={false} returns a single object, not an array
    const file = Array.isArray(files) ? files[0] : files;
    if (!file) return;

    const imageUrl = file.url || file;
    console.log('[TiptapRichTextInput] Inserting image:', imageUrl);

    editor.chain().focus().setImage({ src: imageUrl }).run();
    setShowImageModal(false);
  }, [editor]);

  // Handle link insertion
  const handleLinkInsert = useCallback(() => {
    if (!linkUrl) return;
    
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    
    if (hasSelection) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().insertContent(`<a href="${linkUrl}">${linkUrl}</a>`).run();
    }
    
    setShowLinkModal(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  if (!editor) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded mb-2"></div>
        <div className="h-32 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className={`tiptap-rich-text-input ${className}`}>
      {/* Debug info - remove after testing */}
      {process.env.NODE_ENV === 'development' && value && (
        <details className="mb-2 text-xs">
          <summary className="cursor-pointer text-gray-500">Debug: Raw Value</summary>
          <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        </details>
      )}

      {/* Label */}
      {fieldSchema.label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-foreground mb-2"
        >
          {fieldSchema.label}
          {fieldSchema.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      {/* Toolbar */}
      {!disabled && (
        <div className="flex flex-wrap gap-1 p-2 bg-muted border border-border rounded-t-lg">
          {toolbarActions.map((group, groupIndex) => (
            <div key={group.group} className="flex gap-1">
              {group.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <button
                    key={`${group.group}-${itemIndex}`}
                    type="button"
                    onClick={item.action}
                    disabled={disabled || item.disabled}
                    className={`
                      p-2 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-primary
                      ${item.active 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                      }
                      ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    title={item.tooltip}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
              {groupIndex < toolbarActions.length - 1 && (
                <div className="w-px bg-border mx-1 self-stretch" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <div
        className={`
          bg-background
          border border-border
          ${!disabled ? 'rounded-b-lg' : 'rounded-lg'}
          ${disabled ? 'bg-muted cursor-not-allowed' : ''}
          ${error && touched ? 'border-destructive' : ''}
          focus-within:border-primary
          min-h-[200px]
        `}
      >
        <EditorContent 
          editor={editor}
          className="prose-editor"
        />
      </div>

      {/* Help text */}
      {fieldSchema.help && (
        <p className="mt-1 text-sm text-muted-foreground">
          {fieldSchema.help}
        </p>
      )}

      {/* Error message */}
      {error && touched && (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      )}

      {/* Image Upload Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md border">
            <h3 className="text-lg font-semibold mb-4 text-card-foreground">Insert Image</h3>
            <FileUpload
              value={[]}
              onChange={handleImageUpload}
              multiple={false}
              accept={['image/*']}
              maxSize={5 * 1024 * 1024}
              showPreviews={false}
              placeholder="Drop image or click to select"
              jcontext={jcontext}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md border">
            <h3 className="text-lg font-semibold mb-4 text-card-foreground">Add Link</h3>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLinkInsert();
                }
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkInsert}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tiptap Editor Styles */}
      <style jsx>{`
        .tiptap-rich-text-input :global(.ProseMirror) {
          outline: none;
          direction: ltr;
          text-align: left;
          font-size: 14px;
          line-height: 1.4;
          color: hsl(var(--foreground));
        }
        
        .tiptap-rich-text-input :global(.ProseMirror p) {
          margin: 0 0 8px 0;
          line-height: 1.4;
        }
        
        .tiptap-rich-text-input :global(.ProseMirror h1) {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 12px 0;
          line-height: 1.2;
          color: hsl(var(--foreground));
        }
        
        .tiptap-rich-text-input :global(.ProseMirror h2) {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 10px 0;
          line-height: 1.2;
          color: hsl(var(--foreground));
        }
        
        .tiptap-rich-text-input :global(.ProseMirror h3) {
          font-size: 18px;
          font-weight: 500;
          margin: 0 0 8px 0;
          line-height: 1.2;
          color: hsl(var(--foreground));
        }
        
        .tiptap-rich-text-input :global(.ProseMirror ul),
        .tiptap-rich-text-input :global(.ProseMirror ol) {
          padding-left: 24px;
          margin: 0 0 8px 0;
        }
        
        .tiptap-rich-text-input :global(.ProseMirror li) {
          margin: 0 0 2px 0;
          line-height: 1.4;
        }
        
        .tiptap-rich-text-input :global(.ProseMirror blockquote) {
          border-left: 4px solid hsl(var(--border));
          padding-left: 16px;
          margin: 0 0 12px 0;
          font-style: italic;
          color: hsl(var(--muted-foreground));
        }
        
        .tiptap-rich-text-input :global(.ProseMirror pre) {
          background-color: hsl(var(--muted));
          border-radius: 6px;
          padding: 12px;
          margin: 0 0 12px 0;
          overflow-x: auto;
          font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
          font-size: 13px;
          color: hsl(var(--foreground));
        }
        
        .tiptap-rich-text-input :global(.ProseMirror code) {
          background-color: hsl(var(--muted));
          border-radius: 3px;
          padding: 2px 4px;
          font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
          font-size: 13px;
          color: hsl(var(--foreground));
        }
        
        .tiptap-rich-text-input :global(.ProseMirror hr) {
          border: none;
          border-top: 1px solid hsl(var(--border));
          margin: 16px 0;
        }
        
        .tiptap-rich-text-input :global(.ProseMirror img) {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
        }
        
        /* Placeholder styles */
        .tiptap-rich-text-input :global(.ProseMirror p.is-editor-empty:first-child::before) {
          color: hsl(var(--muted-foreground));
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        
        /* Link styles */
        .tiptap-rich-text-input :global(.ProseMirror a) {
          color: hsl(var(--primary));
          text-decoration: underline;
        }
        
        .tiptap-rich-text-input :global(.ProseMirror a:hover) {
          color: hsl(var(--primary));
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}

TiptapRichTextInput.displayName = 'TiptapRichTextInput';
