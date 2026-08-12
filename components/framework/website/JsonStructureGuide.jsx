'use client';

import React from 'react';
import CodeBlock from './CodeBlock';

export default function JsonStructureGuide({
  className = "",
  sectionClasses = "py-16 bg-gray-800/50",
  containerClasses = "container mx-auto px-6",
  contentClasses = "max-w-4xl mx-auto",
  ...domProps
}) {
  const pageStructureCode = `{
  "layout": "main",
  "meta": {
    "title": "My Page",
    "description": "Page description"
  },
  "components": [
    {
      "component": "div",
      "attributes": {
        "className": "container mx-auto p-8"
      },
      "components": [
        {
          "component": "h1",
          "components": ["Hello World!"]
        }
      ]
    }
  ]
}`;

  return (
    <section className={`${sectionClasses} ${className}`} {...domProps}>
      <div className={containerClasses}>
        <div className={contentClasses}>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 mb-8">
            JSON Page Structure
          </h2>
          <p className="text-xl text-gray-300 mb-6">
            Every page in JasonJS Framework is defined using a simple JSON structure:
          </p>
          <CodeBlock
            title="Basic Page Structure"
            code={pageStructureCode}
            language="json"
          />
        </div>
      </div>
    </section>
  );
}

JsonStructureGuide.displayName = 'JsonStructureGuide';