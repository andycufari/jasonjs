'use client';

import React from 'react';
import CodeBlock from './CodeBlock';

export default function ComponentTypesGuide({
  className = "",
  sectionClasses = "py-16 bg-gray-900",
  containerClasses = "container mx-auto px-6",
  contentClasses = "max-w-4xl mx-auto",
  gridClasses = "grid md:grid-cols-2 gap-6",
  cardClasses = "bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl border border-gray-700 hover:border-cyan-500/50 transition-all duration-300",
  ...domProps
}) {
  const componentTypes = [
    {
      title: "HTML Elements",
      description: "Use any HTML element directly:",
      code: '"component": "div"',
      gradient: "from-blue-500/20 to-cyan-500/20",
      border: "border-blue-500/30"
    },
    {
      title: "Framework Components", 
      description: "Built-in components with @ prefix:",
      code: '"@framework/Hero"',
      gradient: "from-purple-500/20 to-pink-500/20",
      border: "border-purple-500/30"
    },
    {
      title: "User Components",
      description: "Custom components from user directory:",
      code: '"@user/MyComponent"',
      gradient: "from-green-500/20 to-emerald-500/20",
      border: "border-green-500/30"
    },
    {
      title: "Plugin Components",
      description: "Components from installed plugins:",
      code: '"@plugins/ecommerce/Shop"',
      gradient: "from-yellow-500/20 to-orange-500/20",
      border: "border-yellow-500/30"
    }
  ];

  return (
    <section className={`${sectionClasses} ${className}`} {...domProps}>
      <div className={containerClasses}>
        <div className={contentClasses}>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 mb-8">
            Component Types
          </h2>
          <div className={gridClasses}>
            {componentTypes.map((type, index) => (
              <div key={index} className={`${cardClasses} bg-gradient-to-br ${type.gradient} border ${type.border}`}>
                <h3 className="text-xl font-bold text-white mb-3">
                  {type.title}
                </h3>
                <p className="text-gray-300 mb-4">
                  {type.description}
                </p>
                <CodeBlock
                  code={type.code}
                  showCopy={false}
                  codeClasses="bg-gray-900/80 text-cyan-300 p-3 rounded font-mono text-sm"
                  containerClasses="mb-0"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

ComponentTypesGuide.displayName = 'ComponentTypesGuide';