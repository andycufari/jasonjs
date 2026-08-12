'use client';

import React, { useState } from 'react';

export default function CodeBlock({
  code = "",
  language = "json",
  title = "",
  showCopy = true,
  className = "",
  codeClasses = "bg-gray-900 text-gray-300 p-6 rounded-xl overflow-x-auto",
  titleClasses = "text-lg font-semibold text-cyan-300 mb-3 flex items-center justify-between",
  containerClasses = "mb-6",
  preClasses = "text-sm font-mono whitespace-pre",
  ...domProps
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={`${containerClasses} ${className}`} {...domProps}>
      {title && (
        <div className={titleClasses}>
          <span>{title}</span>
          {showCopy && (
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg border border-cyan-400/30 transition-all duration-200"
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          )}
        </div>
      )}
      <div className={codeClasses}>
        <pre className={preClasses}>
          {code}
        </pre>
      </div>
    </div>
  );
}

CodeBlock.displayName = 'CodeBlock';