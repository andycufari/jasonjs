'use client';

import React from 'react';
import CodeBlock from './CodeBlock';

export default function QuickStartGuide({
  className = "",
  sectionClasses = "py-16 bg-gray-900",
  containerClasses = "container mx-auto px-6",
  gridClasses = "grid md:grid-cols-2 gap-8 mb-16",
  cardClasses = "bg-gradient-to-br from-blue-950/50 to-indigo-950/50 p-8 rounded-2xl border border-blue-500/20 backdrop-blur-sm",
  ...domProps
}) {
  return (
    <section className={`${sectionClasses} ${className}`} {...domProps}>
      <div className={containerClasses}>
        <div className="max-w-4xl mx-auto">
          <div className={gridClasses}>
            <div className={cardClasses}>
              <h2 className="text-2xl font-bold text-cyan-300 mb-4 flex items-center">
                <span className="text-3xl mr-3">🚀</span>
                Quick Start
              </h2>
              <p className="text-gray-300 mb-6">
                Get up and running with JasonJS Framework in minutes.
              </p>
              <CodeBlock
                title="Installation & Development"
                code="# Clone the repository
git clone https://github.com/cm64-studio/jasonjs-framework
cd jasonjs-framework

# Install dependencies  
npm install

# Start development server (runs on localhost:3000)
npm run dev

# For standalone mode (local JSON files)
npm run dev:standalone"
                language="bash"
                codeClasses="bg-gray-800 text-green-400 p-4 rounded-lg text-sm font-mono"
              />
            </div>

            <div className={cardClasses}>
              <h2 className="text-2xl font-bold text-cyan-300 mb-4 flex items-center">
                <span className="text-3xl mr-3">📖</span>
                Core Concepts
              </h2>
              <ul className="text-gray-300 space-y-3">
                <li className="flex items-center">
                  <span className="text-cyan-400 mr-3">📄</span>
                  JSON-driven pages & components
                </li>
                <li className="flex items-center">
                  <span className="text-cyan-400 mr-3">📦</span>
                  WordPress-style component packages
                </li>
                <li className="flex items-center">
                  <span className="text-cyan-400 mr-3">🎨</span>
                  Dynamic layout & theme system
                </li>
                <li className="flex items-center">
                  <span className="text-cyan-400 mr-3">💾</span>
                  Unified database API (MongoDB, Notion, etc.)
                </li>
                <li className="flex items-center">
                  <span className="text-cyan-400 mr-3">🤖</span>
                  AI-friendly component architecture
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

QuickStartGuide.displayName = 'QuickStartGuide';