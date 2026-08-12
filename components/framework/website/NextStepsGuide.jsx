'use client';

import React from 'react';

export default function NextStepsGuide({
  className = "",
  sectionClasses = "py-16 bg-gradient-to-b from-gray-800 to-gray-900",
  containerClasses = "container mx-auto px-6",
  contentClasses = "max-w-4xl mx-auto",
  cardClasses = "bg-gradient-to-br from-indigo-950/50 to-purple-950/50 p-8 rounded-2xl border border-indigo-500/20 backdrop-blur-sm",
  ...domProps
}) {
  const nextSteps = [
    "Create your first page in sites/yoursite.com/pages/",
    "Explore the component ecosystem",
    "Configure layouts and themes", 
    "Connect to databases",
    "Deploy your application"
  ];

  return (
    <section className={`${sectionClasses} ${className}`} {...domProps}>
      <div className={containerClasses}>
        <div className={contentClasses}>
          <div className={cardClasses}>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400 mb-4 flex items-center">
              <span className="text-3xl mr-3">🎯</span>
              What's Next?
            </h2>
            <ul className="text-gray-300 space-y-4 mb-8">
              {nextSteps.map((step, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-cyan-400 mr-3 text-xl">•</span>
                  <span className="text-lg">{step}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://github.com/cm64-studio/jasonjs-framework"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-semibold rounded-xl hover:from-cyan-400 hover:to-purple-500 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105"
              >
                <span className="mr-2">🔗</span>
                View on GitHub
              </a>
              <a
                href="/about"
                className="inline-flex items-center justify-center px-6 py-3 border-2 border-cyan-400 text-cyan-400 font-semibold rounded-xl hover:bg-cyan-400 hover:text-black transition-all duration-200 backdrop-blur-sm"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

NextStepsGuide.displayName = 'NextStepsGuide';