'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Bold, Italic, Underline, Link,
  List, ListOrdered, Image,
  Heading1, Heading2, Heading3,
  Quote, Code, Minus
} from 'lucide-react';
import FileUpload from '../../FileUpload';

/**
 * RichTextInput Component - A block-based rich text editor
 *
 * Features:
 * - Block-based structure (paragraphs, headings, lists, images)
 * - Inline formatting (bold, italic, underline, links)
 * - Image upload integration
 * - JSON output format
 */
export default function RichTextInput({
  id,
  name,
  value = { blocks: [] },
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
  // Parse value if it's a string
  const initialValue = typeof value === 'string' && value ?
    (value.startsWith('{') ? JSON.parse(value) : { blocks: [{ type: 'paragraph', content: value }] }) :
    (value || { blocks: [] });

  const [content, setContent] = useState(initialValue);
  const [selectedBlock, setSelectedBlock] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const editorRef = useRef(null);
  const [selection, setSelection] = useState(null);

  // Toolbar configuration
  const toolbarGroups = [
    {
      name: 'headings',
      tools: [
        { icon: Heading1, action: 'heading1', tooltip: 'Heading 1' },
        { icon: Heading2, action: 'heading2', tooltip: 'Heading 2' },
        { icon: Heading3, action: 'heading3', tooltip: 'Heading 3' }
      ]
    },
    {
      name: 'formatting',
      tools: [
        { icon: Bold, action: 'bold', tooltip: 'Bold (⌘B)' },
        { icon: Italic, action: 'italic', tooltip: 'Italic (⌘I)' },
        { icon: Underline, action: 'underline', tooltip: 'Underline (⌘U)' },
        { icon: Link, action: 'link', tooltip: 'Add Link (⌘K)' }
      ]
    },
    {
      name: 'blocks',
      tools: [
        { icon: List, action: 'bullet-list', tooltip: 'Bullet List' },
        { icon: ListOrdered, action: 'numbered-list', tooltip: 'Numbered List' },
        { icon: Quote, action: 'quote', tooltip: 'Quote' },
        { icon: Code, action: 'code', tooltip: 'Code Block' },
        { icon: Minus, action: 'divider', tooltip: 'Divider' }
      ]
    },
    {
      name: 'media',
      tools: [
        { icon: Image, action: 'image', tooltip: 'Insert Image' }
      ]
    }
  ];

  // Initialize with empty paragraph if no blocks (only once)
  useEffect(() => {
    if (!content.blocks || content.blocks.length === 0) {
      const newContent = {
        blocks: [{ type: 'paragraph', content: '', id: generateId() }]
      };
      setContent(newContent);
      // Don't call onChange here to avoid infinite loop
    }
  }, []); // Empty dependency array - only run once

  // Generate unique ID for blocks
  const generateId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Handle toolbar actions
  const handleToolbarAction = (action) => {
    if (disabled) return;

    switch (action) {
      case 'heading1':
      case 'heading2':
      case 'heading3':
        convertBlockToHeading(parseInt(action.slice(-1)));
        break;
      case 'bold':
      case 'italic':
      case 'underline':
        toggleInlineStyle(action);
        break;
      case 'link':
        setShowLinkModal(true);
        break;
      case 'bullet-list':
        convertBlockToList('bullet');
        break;
      case 'numbered-list':
        convertBlockToList('numbered');
        break;
      case 'quote':
        convertBlockToQuote();
        break;
      case 'code':
        convertBlockToCode();
        break;
      case 'divider':
        insertDivider();
        break;
      case 'image':
        setShowImageModal(true);
        break;
    }
  };

  // Convert current block to heading
  const convertBlockToHeading = (level) => {
    const newBlocks = [...content.blocks];
    if (newBlocks[selectedBlock]) {
      newBlocks[selectedBlock] = {
        ...newBlocks[selectedBlock],
        type: 'heading',
        level
      };
      updateContent({ blocks: newBlocks });
    }
  };

  // Convert block to list
  const convertBlockToList = (listType) => {
    const newBlocks = [...content.blocks];
    if (newBlocks[selectedBlock]) {
      newBlocks[selectedBlock] = {
        ...newBlocks[selectedBlock],
        type: 'list',
        listType
      };
      updateContent({ blocks: newBlocks });
    }
  };

  // Convert block to quote
  const convertBlockToQuote = () => {
    const newBlocks = [...content.blocks];
    if (newBlocks[selectedBlock]) {
      newBlocks[selectedBlock] = {
        ...newBlocks[selectedBlock],
        type: 'quote'
      };
      updateContent({ blocks: newBlocks });
    }
  };

  // Convert block to code
  const convertBlockToCode = () => {
    const newBlocks = [...content.blocks];
    if (newBlocks[selectedBlock]) {
      newBlocks[selectedBlock] = {
        ...newBlocks[selectedBlock],
        type: 'code'
      };
      updateContent({ blocks: newBlocks });
    }
  };

  // Insert divider
  const insertDivider = () => {
    const newBlocks = [...content.blocks];
    newBlocks.splice(selectedBlock + 1, 0, {
      type: 'divider',
      id: generateId()
    });
    updateContent({ blocks: newBlocks });
    setSelectedBlock(selectedBlock + 1);
  };

  // Toggle inline style
  const toggleInlineStyle = (style) => {
    const block = content.blocks[selectedBlock];
    if (!block) return;

    const marks = block.marks || [];
    const newMarks = marks.includes(style)
      ? marks.filter(m => m !== style)
      : [...marks, style];

    const newBlocks = [...content.blocks];
    newBlocks[selectedBlock] = {
      ...block,
      marks: newMarks
    };
    updateContent({ blocks: newBlocks });
  };

  // Handle image upload
  const handleImageUpload = (files) => {
    if (!files || files.length === 0) return;

    const imageBlock = {
      type: 'image',
      url: files[0].url || files[0],
      caption: '',
      id: generateId()
    };

    const newBlocks = [...content.blocks];
    newBlocks.splice(selectedBlock + 1, 0, imageBlock);
    updateContent({ blocks: newBlocks });
    setSelectedBlock(selectedBlock + 1);
    setShowImageModal(false);
  };

  // Handle link insertion
  const handleLinkInsert = () => {
    if (!linkUrl) return;

    const block = content.blocks[selectedBlock];
    if (!block) return;

    const newBlocks = [...content.blocks];
    newBlocks[selectedBlock] = {
      ...block,
      link: linkUrl
    };
    updateContent({ blocks: newBlocks });
    setShowLinkModal(false);
    setLinkUrl('');
  };

  // Update content and notify parent
  const updateContent = (newContent) => {
    setContent(newContent);
    onChange(newContent);
  };

  // Handle block content change
  const handleBlockChange = (blockIndex, newContent) => {
    const newBlocks = [...content.blocks];
    newBlocks[blockIndex] = {
      ...newBlocks[blockIndex],
      content: newContent
    };
    updateContent({ blocks: newBlocks });
  };

  // Handle key press in block
  const handleKeyDown = (e, blockIndex) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Create new block after current
      const newBlock = {
        type: 'paragraph',
        content: '',
        id: generateId()
      };
      const newBlocks = [...content.blocks];
      newBlocks.splice(blockIndex + 1, 0, newBlock);
      updateContent({ blocks: newBlocks });
      setSelectedBlock(blockIndex + 1);

      // Focus the new block after a brief delay
      setTimeout(() => {
        const newBlockIndex = blockIndex + 1;
        const editorContainer = editorRef.current;
        if (editorContainer) {
          const blocks = editorContainer.querySelectorAll('[contenteditable="true"]');
          if (blocks[newBlockIndex]) {
            blocks[newBlockIndex].focus();
          }
        }
      }, 10);
    } else if (e.key === 'Backspace' && content.blocks[blockIndex]?.content === '') {
      e.preventDefault();
      // Remove empty block (if not the only one)
      if (content.blocks.length > 1) {
        const newBlocks = content.blocks.filter((_, idx) => idx !== blockIndex);
        updateContent({ blocks: newBlocks });
        const newSelectedIndex = Math.max(0, blockIndex - 1);
        setSelectedBlock(newSelectedIndex);

        // Focus the previous block
        setTimeout(() => {
          const editorContainer = editorRef.current;
          if (editorContainer) {
            const blocks = editorContainer.querySelectorAll('[contenteditable="true"]');
            if (blocks[newSelectedIndex]) {
              blocks[newSelectedIndex].focus();
            }
          }
        }, 10);
      }
    }
  };

  // Render block based on type
  const renderBlock = (block, index) => {
    const isSelected = index === selectedBlock;
    const baseClasses = `block w-full px-3 py-2 rounded transition-colors text-gray-900 dark:text-gray-100 text-left focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500`;
    const ltrStyle = {
      direction: 'ltr',
      textAlign: 'left',
      unicodeBidi: 'plaintext'
    };

    switch (block.type) {
      case 'heading':
        const HeadingTag = `h${block.level}`;
        const headingClasses = {
          1: 'text-3xl font-bold',
          2: 'text-2xl font-semibold',
          3: 'text-xl font-medium'
        };
        return React.createElement(
          HeadingTag,
          {
            key: block.id || index,
            contentEditable: !disabled,
            className: `${baseClasses} ${headingClasses[block.level]}`,
            style: ltrStyle,
            dir: 'ltr',
            onFocus: () => setSelectedBlock(index),
            onInput: (e) => handleBlockChange(index, e.currentTarget.textContent),
            onKeyDown: (e) => handleKeyDown(e, index),
            suppressContentEditableWarning: true
          },
          block.content || ''
        );

      case 'list':
        const ListTag = block.listType === 'numbered' ? 'ol' : 'ul';
        return (
          <ListTag
            key={block.id || index}
            className={`${baseClasses} ${block.listType === 'numbered' ? 'list-decimal' : 'list-disc'} list-inside`}
          >
            <li
              contentEditable={!disabled}
              className="focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={ltrStyle}
              dir="ltr"
              onFocus={() => setSelectedBlock(index)}
              onInput={(e) => handleBlockChange(index, e.currentTarget.textContent)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              suppressContentEditableWarning={true}
            >
              {block.content || ''}
            </li>
          </ListTag>
        );

      case 'quote':
        return (
          <blockquote
            key={block.id || index}
            contentEditable={!disabled}
            className={`${baseClasses} border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic`}
            style={ltrStyle}
            dir="ltr"
            onFocus={() => setSelectedBlock(index)}
            onInput={(e) => handleBlockChange(index, e.currentTarget.textContent)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            suppressContentEditableWarning={true}
          >
            {block.content || ''}
          </blockquote>
        );

      case 'code':
        return (
          <pre
            key={block.id || index}
            className={`${baseClasses} bg-gray-100 dark:bg-gray-800 font-mono text-sm overflow-x-auto`}
          >
            <code
              contentEditable={!disabled}
              className="focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={ltrStyle}
              dir="ltr"
              onFocus={() => setSelectedBlock(index)}
              onInput={(e) => handleBlockChange(index, e.currentTarget.textContent)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              suppressContentEditableWarning={true}
            >
              {block.content || ''}
            </code>
          </pre>
        );

      case 'divider':
        return (
          <hr
            key={block.id || index}
            className="my-4 border-gray-300 dark:border-gray-600"
            onClick={() => setSelectedBlock(index)}
          />
        );

      case 'image':
        return (
          <div
            key={block.id || index}
            className={`${baseClasses} space-y-2`}
            onClick={() => setSelectedBlock(index)}
          >
            <img
              src={block.url}
              alt={block.caption || ''}
              className="max-w-full rounded"
            />
            {block.caption && (
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {block.caption}
              </p>
            )}
          </div>
        );

      case 'paragraph':
      default:
        const showPlaceholder = index === 0 && (!block.content || block.content.trim() === '');
        return (
          <p
            key={block.id || index}
            contentEditable={!disabled}
            className={`${baseClasses} min-h-[1.5rem] ${showPlaceholder ? 'text-gray-400 dark:text-gray-500' : ''}`}
            style={ltrStyle}
            dir="ltr"
            onFocus={() => {
              setSelectedBlock(index);
              // Clear placeholder on focus if it's the first block and empty
              if (showPlaceholder && !block.content) {
                handleBlockChange(index, '');
              }
            }}
            onInput={(e) => {
              const content = e.currentTarget.textContent;
              handleBlockChange(index, content);
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            suppressContentEditableWarning={true}
          >
            {block.content || (showPlaceholder ? placeholder : '')}
          </p>
        );
    }
  };

  // Format content with marks
  const formatContent = (block) => {
    let html = block.content || '';

    if (block.marks && block.marks.length > 0) {
      block.marks.forEach(mark => {
        switch (mark) {
          case 'bold':
            html = `<strong>${html}</strong>`;
            break;
          case 'italic':
            html = `<em>${html}</em>`;
            break;
          case 'underline':
            html = `<u>${html}</u>`;
            break;
        }
      });
    }

    if (block.link) {
      html = `<a href="${block.link}" class="text-blue-600 underline">${html}</a>`;
    }

    return html;
  };

  return (
    <div className={`rich-text-input ${className}`} style={{ direction: 'ltr', textAlign: 'left' }}>
      {/* Label */}
      {fieldSchema.label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {fieldSchema.label}
          {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Toolbar */}
      {!disabled && (
        <div className="flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-t-lg">
          {toolbarGroups.map((group, groupIndex) => (
            <div key={group.name} className="flex gap-1">
              {group.tools.map(tool => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.action}
                    type="button"
                    onClick={() => handleToolbarAction(tool.action)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    title={tool.tooltip}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
              {groupIndex < toolbarGroups.length - 1 && (
                <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1 self-stretch" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        className={`
          min-h-[200px] max-h-[500px] overflow-y-auto
          bg-white dark:bg-gray-900
          border border-gray-300 dark:border-gray-600
          ${!disabled ? 'rounded-b-lg' : 'rounded-lg'}
          ${disabled ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed' : ''}
          ${error && touched ? 'border-red-500 dark:border-red-400' : ''}
          focus-within:border-blue-500 dark:focus-within:border-blue-400
        `}
        style={{ direction: 'ltr', textAlign: 'left' }}
        onBlur={onBlur}
      >
        <div className="p-4 space-y-2" style={{ direction: 'ltr', textAlign: 'left' }}>
          {content.blocks && content.blocks.map((block, index) => renderBlock(block, index))}
        </div>
      </div>

      {/* Help text */}
      {fieldSchema.help && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {fieldSchema.help}
        </p>
      )}

      {/* Error message */}
      {error && touched && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Image Upload Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Insert Image</h3>
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
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Link</h3>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLinkInsert}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

RichTextInput.displayName = 'RichTextInput';