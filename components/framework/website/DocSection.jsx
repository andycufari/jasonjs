'use client';

import React from 'react';

export default function DocSection({
  title = "Documentation Section",
  subtitle = "",
  children,
  id,
  className = "",
  sectionClasses = "py-16 bg-gray-900",
  containerClasses = "container mx-auto px-6",
  titleClasses = "text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 mb-8",
  subtitleClasses = "text-xl text-gray-300 mb-12",
  contentClasses = "max-w-4xl mx-auto",
  ...domProps
}) {
  return (
    <section 
      id={id}
      className={`${sectionClasses} ${className}`} 
      {...domProps}
    >
      <div className={containerClasses}>
        <div className={contentClasses}>
          {title && (
            <h2 className={titleClasses}>
              {title}
            </h2>
          )}
          {subtitle && (
            <p className={subtitleClasses}>
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

DocSection.displayName = 'DocSection';