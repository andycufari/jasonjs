'use client';

import React, { useState, useEffect } from 'react';
import CodeBlock from './CodeBlock';

export default function MarkdownRenderer({
  markdownFile,
  className = "",
  sectionClasses = "py-16 bg-gray-900",
  containerClasses = "container mx-auto px-6 max-w-4xl",
  contentClasses = "prose prose-invert prose-cyan max-w-none",
  loadingClasses = "text-center py-20",
  errorClasses = "text-center py-20 text-red-400",
  ...domProps
}) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!markdownFile) return;

    async function loadMarkdown() {
      try {
        setLoading(true);
        // Try to fetch from API endpoint that reads markdown files
        const response = await fetch(`/api/docs/${markdownFile}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${markdownFile}`);
        }
        const text = await response.text();
        setContent(text);
        setError(null);
      } catch (err) {
        console.error('Error loading markdown:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadMarkdown();
  }, [markdownFile]);

  // Enhanced markdown to JSX parser with better formatting
  const parseInlineMarkdown = (text) => {
    if (!text) return text;
    
    // Handle bold text **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-cyan-300">$1</strong>');
    
    // Handle italic text *text*
    text = text.replace(/\*(.*?)\*/g, '<em class="italic text-cyan-400">$1</em>');
    
    // Handle inline code `code`
    text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-800 text-cyan-300 px-2 py-1 rounded text-sm font-mono">$1</code>');
    
    // Handle links [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-cyan-400 hover:text-cyan-300 underline" target="_blank" rel="noopener noreferrer">$1</a>');
    
    return text;
  };

  const createTextElement = (text, key, className = "") => {
    const processedText = parseInlineMarkdown(text);
    return (
      <span 
        key={key} 
        className={className}
        dangerouslySetInnerHTML={{ __html: processedText }}
      />
    );
  };

  const parseMarkdown = (markdown) => {
    if (!markdown) return null;

    const lines = markdown.split('\n');
    const elements = [];
    let currentCodeBlock = null;
    let currentCodeLang = '';
    let currentList = null;
    let currentListType = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle code blocks
      if (line.startsWith('```')) {
        // Close any open lists first
        if (currentList) {
          elements.push(
            <ul key={`list-${i}`} className={currentListType === 'ordered' ? 'list-decimal ml-6 mb-4 space-y-1' : 'list-disc ml-6 mb-4 space-y-1'}>
              {currentList}
            </ul>
          );
          currentList = null;
          currentListType = null;
        }

        if (currentCodeBlock === null) {
          // Start code block
          currentCodeLang = line.replace('```', '').trim();
          currentCodeBlock = [];
        } else {
          // End code block
          elements.push(
            <CodeBlock
              key={`code-${i}`}
              code={currentCodeBlock.join('\n')}
              language={currentCodeLang}
              className="mb-6"
            />
          );
          currentCodeBlock = null;
          currentCodeLang = '';
        }
        continue;
      }

      // If inside code block, collect lines
      if (currentCodeBlock !== null) {
        currentCodeBlock.push(line);
        continue;
      }

      // Handle headers with better margins
      if (line.startsWith('# ')) {
        // Close any open lists first
        if (currentList) {
          elements.push(
            <ul key={`list-${i}`} className={currentListType === 'ordered' ? 'list-decimal ml-6 mb-6 space-y-1' : 'list-disc ml-6 mb-6 space-y-1'}>
              {currentList}
            </ul>
          );
          currentList = null;
          currentListType = null;
        }
        
        elements.push(
          <h1 key={`h1-${i}`} className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 mb-4 mt-8 first:mt-0">
            {createTextElement(line.replace('# ', ''), `h1-text-${i}`)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        // Close any open lists first
        if (currentList) {
          elements.push(
            <ul key={`list-${i}`} className={currentListType === 'ordered' ? 'list-decimal ml-6 mb-6 space-y-1' : 'list-disc ml-6 mb-6 space-y-1'}>
              {currentList}
            </ul>
          );
          currentList = null;
          currentListType = null;
        }
        
        elements.push(
          <h2 key={`h2-${i}`} className="text-3xl font-bold text-cyan-300 mb-3 mt-6">
            {createTextElement(line.replace('## ', ''), `h2-text-${i}`)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        // Close any open lists first
        if (currentList) {
          elements.push(
            <ul key={`list-${i}`} className={currentListType === 'ordered' ? 'list-decimal ml-6 mb-6 space-y-1' : 'list-disc ml-6 mb-6 space-y-1'}>
              {currentList}
            </ul>
          );
          currentList = null;
          currentListType = null;
        }
        
        elements.push(
          <h3 key={`h3-${i}`} className="text-2xl font-bold text-cyan-400 mb-2 mt-4">
            {createTextElement(line.replace('### ', ''), `h3-text-${i}`)}
          </h3>
        );
      } else if (line.startsWith('#### ')) {
        // Close any open lists first
        if (currentList) {
          elements.push(
            <ul key={`list-${i}`} className={currentListType === 'ordered' ? 'list-decimal ml-6 mb-6 space-y-1' : 'list-disc ml-6 mb-6 space-y-1'}>
              {currentList}
            </ul>
          );
          currentList = null;
          currentListType = null;
        }
        
        elements.push(
          <h4 key={`h4-${i}`} className="text-xl font-bold text-cyan-500 mb-2 mt-3">
            {createTextElement(line.replace('#### ', ''), `h4-text-${i}`)}
          </h4>
        );
      }
      // Handle list items
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!currentList) {
          currentList = [];
          currentListType = 'unordered';
        }
        
        currentList.push(
          <li key={`li-${i}`} className="text-gray-300">
            {createTextElement(line.replace(/^[*-] /, ''), `li-text-${i}`)}
          </li>
        );
      }
      // Handle numbered lists
      else if (line.match(/^\d+\. /)) {
        if (!currentList) {
          currentList = [];
          currentListType = 'ordered';
        }
        
        currentList.push(
          <li key={`oli-${i}`} className="text-gray-300">
            {createTextElement(line.replace(/^\d+\. /, ''), `oli-text-${i}`)}
          </li>
        );
      }
      // Handle paragraphs
      else if (line.trim() && !line.startsWith('#')) {
        // Close any open lists first
        if (currentList) {
          elements.push(
            <ul key={`list-${i}`} className={currentListType === 'ordered' ? 'list-decimal ml-6 mb-4 space-y-1' : 'list-disc ml-6 mb-4 space-y-1'}>
              {currentList}
            </ul>
          );
          currentList = null;
          currentListType = null;
        }
        
        elements.push(
          <p key={`p-${i}`} className="text-gray-300 mb-4 leading-relaxed">
            {createTextElement(line, `p-text-${i}`)}
          </p>
        );
      }
      // Handle empty lines
      else if (line.trim() === '') {
        // Close any open lists on empty line
        if (currentList) {
          elements.push(
            <ul key={`list-${i}`} className={currentListType === 'ordered' ? 'list-decimal ml-6 mb-6 space-y-1' : 'list-disc ml-6 mb-6 space-y-1'}>
              {currentList}
            </ul>
          );
          currentList = null;
          currentListType = null;
        }
        
        // Only add break if previous element wasn't already a break
        if (elements.length > 0 && elements[elements.length - 1].type !== 'br') {
          elements.push(<div key={`space-${i}`} className="h-2" />);
        }
      }
    }

    // Close any remaining open lists
    if (currentList) {
      elements.push(
        <ul key={`list-final`} className={currentListType === 'ordered' ? 'list-decimal ml-6 mb-4 space-y-1' : 'list-disc ml-6 mb-4 space-y-1'}>
          {currentList}
        </ul>
      );
    }

    return elements;
  };

  if (loading) {
    return (
      <section className={`${sectionClasses} ${className}`} {...domProps}>
        <div className={containerClasses}>
          <div className={loadingClasses}>
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
            <p className="text-cyan-300 mt-4">Loading documentation...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={`${sectionClasses} ${className}`} {...domProps}>
        <div className={containerClasses}>
          <div className={errorClasses}>
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-cyan-400 mb-6">📄 Documentation Coming Soon</h2>
              <p className="text-xl mb-4 text-gray-300">
                We're working on the <span className="text-cyan-300 font-semibold">{markdownFile}</span> documentation.
              </p>
              <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl p-6 border border-gray-700 mb-8">
                <p className="text-gray-300 mb-4">
                  <strong>For developers:</strong> You can contribute by creating this documentation file:
                </p>
                <code className="text-cyan-300 bg-gray-900 px-3 py-1 rounded text-sm">
                  ./docs/{markdownFile.replace(/-/g, '_').toUpperCase()}.md
                </code>
              </div>
              <div className="space-y-3">
                <a
                  href="/docs"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-semibold rounded-xl hover:from-cyan-400 hover:to-purple-500 transition-all duration-200"
                >
                  ← Back to Documentation
                </a>
                <a
                  href="https://github.com/cm64-studio/jasonjs-framework/tree/main/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 ml-4 border-2 border-cyan-400 text-cyan-400 font-semibold rounded-xl hover:bg-cyan-400 hover:text-black transition-all duration-200"
                >
                  📝 Contribute Docs
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`${sectionClasses} ${className}`} {...domProps}>
      <div className={containerClasses}>
        <div className={contentClasses}>
          {parseMarkdown(content)}
        </div>
      </div>
    </section>
  );
}

MarkdownRenderer.displayName = 'MarkdownRenderer';