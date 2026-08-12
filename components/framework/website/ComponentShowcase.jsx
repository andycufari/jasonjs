'use client';

import React, { useState } from 'react';
import Hero from './Hero';
import TestimonialSection from './TestimonialSection';
import StatsSection from './StatsSection';
import FeatureGrid from './FeatureGrid';
import Navbar from './Navbar';
import Footer from './Footer';
import CodeBlock from './CodeBlock';
import DocsGrid from './DocsGrid';
import Retro80sEffects from './Retro80sEffects';

export default function ComponentShowcase({ className = "" }) {
  const [selectedComponent, setSelectedComponent] = useState('Hero');

  const components = [
    {
      name: 'Hero',
      description: 'Main hero section with call-to-action buttons',
      category: 'Landing',
      component: Hero,
      props: {
        headline: "🚀 Component Showcase",
        subheadline: "Explore all available components with live examples and JSON configurations.",
        ctaText: "Try It Now",
        ctaUrl: "#",
        secondaryCta: "Learn More", 
        secondaryUrl: "#",
        sectionClasses: "py-20 bg-gradient-to-br from-gray-900 via-purple-900/50 to-gray-900 text-cyan-300",
        headlineClasses: "text-4xl md:text-6xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-yellow-400",
        subheadlineClasses: "text-xl text-cyan-200 mb-8 max-w-4xl mx-auto",
        ctaClasses: "inline-flex items-center px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-semibold rounded-xl hover:from-cyan-400 hover:to-purple-500 transition-all duration-200",
        secondaryCtaClasses: "inline-flex items-center px-8 py-4 border-2 border-yellow-400 text-yellow-400 font-semibold rounded-xl hover:bg-yellow-400 hover:text-black transition-all duration-200"
      }
    },
    {
      name: 'Navbar',
      description: 'Navigation bar with logo and menu items',
      category: 'Navigation',
      component: Navbar,
      props: {
        logo: "JasonJS",
        menuItems: [
          { label: "Home", href: "/" },
          { label: "Docs", href: "/docs" },
          { label: "Components", href: "/components" }
        ],
        ctaText: "Get Started",
        ctaUrl: "/docs/getting-started"
      }
    },
    {
      name: 'Footer',
      description: 'Footer with links and social media',
      category: 'Navigation',
      component: Footer,
      props: {
        companyName: "JasonJS Framework",
        description: "The AI-powered MVP factory for instant application creation.",
        links: [
          { label: "Documentation", href: "/docs" },
          { label: "Components", href: "/components" },
          { label: "GitHub", href: "https://github.com" }
        ],
        socialLinks: [
          { platform: "github", url: "https://github.com" },
          { platform: "twitter", url: "https://twitter.com" }
        ]
      }
    },
    {
      name: 'FeatureGrid',
      description: 'Grid layout showcasing key features',
      category: 'Content',
      component: FeatureGrid,
      props: {
        title: "🎯 Key Features",
        subtitle: "Everything you need to build amazing applications",
        features: [
          {
            icon: "⚡",
            title: "Lightning Fast",
            description: "Build applications in minutes, not hours"
          },
          {
            icon: "🎨", 
            title: "Beautiful Design",
            description: "Modern components with cyberpunk aesthetics"
          },
          {
            icon: "🔧",
            title: "Easy to Use",
            description: "Simple JSON configuration, no complex code"
          }
        ]
      }
    },
    {
      name: 'StatsSection',
      description: 'Display impressive numbers and metrics',
      category: 'Content',
      component: StatsSection,
      props: {
        title: "📊 Impressive Numbers",
        subtitle: "See what our framework can achieve",
        stats: [
          { number: "10x", label: "Faster Development" },
          { number: "500+", label: "Components Available" },
          { number: "99.9%", label: "Uptime Guaranteed" },
          { number: "24/7", label: "Support Available" }
        ]
      }
    },
    {
      name: 'TestimonialSection',
      description: 'Customer testimonials and reviews',
      category: 'Content', 
      component: TestimonialSection,
      props: {
        title: "💬 What Developers Say",
        subtitle: "Real feedback from our amazing community",
        testimonials: [
          {
            quote: "JasonJS changed how I build applications. So fast and intuitive!",
            author: "Jane Doe",
            title: "Senior Developer",
            avatar: "👩‍💻"
          },
          {
            quote: "The component system is incredible. I can prototype ideas in minutes.",
            author: "John Smith", 
            title: "Product Manager",
            avatar: "👨‍💼"
          }
        ]
      }
    },
    {
      name: 'DocsGrid',
      description: 'Documentation links and resources grid',
      category: 'Documentation',
      component: DocsGrid,
      props: {
        title: "📚 Documentation Hub",
        subtitle: "Everything you need to get started and master JasonJS"
      }
    },
    {
      name: 'CodeBlock',
      description: 'Syntax highlighted code display',
      category: 'Documentation',
      component: CodeBlock,
      props: {
        code: `{
  "name": "hello-world",
  "title": "My First Page",
  "components": [
    {
      "component": "div",
      "attributes": {
        "className": "text-center p-8"
      },
      "innerHTML": "Hello, JasonJS! 🚀"
    }
  ]
}`,
        language: "json",
        className: "mb-6"
      }
    },
    {
      name: 'Retro80sEffects',
      description: 'Cyberpunk 80s visual effects and animations',
      category: 'Effects',
      component: Retro80sEffects,
      props: {}
    }
  ];

  const categories = [...new Set(components.map(comp => comp.category))];

  const selectedComponentData = components.find(comp => comp.name === selectedComponent);

  const generateComponentJSON = (comp) => {
    return JSON.stringify({
      component: `@framework/simple-landing/${comp.name}`,
      attributes: comp.props
    }, null, 2);
  };

  return (
    <div className={`min-h-screen bg-gray-900 ${className}`}>
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-80 h-screen sticky top-0 overflow-y-auto bg-gray-900/50 backdrop-blur-sm border-r border-gray-700">
          <div className="p-6">
            <h2 className="text-xl font-bold text-cyan-400 mb-6">🧩 Components</h2>
            
            {categories.map(category => (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <ul className="space-y-2">
                  {components
                    .filter(comp => comp.category === category)
                    .map(comp => (
                      <li key={comp.name}>
                        <button
                          onClick={() => setSelectedComponent(comp.name)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                            selectedComponent === comp.name
                              ? 'bg-cyan-500/20 text-cyan-300 border-l-2 border-cyan-400'
                              : 'text-gray-300 hover:text-cyan-300 hover:bg-gray-800/50'
                          }`}
                        >
                          {comp.name}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="max-w-6xl mx-auto p-8">
            {selectedComponentData && (
              <>
                {/* Component Header */}
                <div className="mb-8">
                  <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 mb-4">
                    {selectedComponentData.name}
                  </h1>
                  <p className="text-xl text-gray-300 mb-6">
                    {selectedComponentData.description}
                  </p>
                  <div className="inline-flex items-center px-3 py-1 bg-cyan-500/20 text-cyan-300 text-sm rounded-full">
                    {selectedComponentData.category}
                  </div>
                </div>

                {/* Live Preview */}
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-cyan-300 mb-4">🔥 Live Preview</h2>
                  <div className="border border-gray-700 rounded-xl overflow-hidden">
                    <div className="bg-gray-800/50 px-4 py-2 border-b border-gray-700">
                      <span className="text-gray-400 text-sm">Preview</span>
                    </div>
                    <div className="bg-gray-900">
                      <selectedComponentData.component {...selectedComponentData.props} />
                    </div>
                  </div>
                </div>

                {/* JSON Configuration */}
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-cyan-300 mb-4">📝 JSON Configuration</h2>
                  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <CodeBlock
                      code={generateComponentJSON(selectedComponentData)}
                      language="json"
                      className="mb-0"
                    />
                  </div>
                </div>

                {/* Usage Instructions */}
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                  <h3 className="text-xl font-bold text-cyan-400 mb-4">💡 How to Use</h3>
                  <div className="space-y-4 text-gray-300">
                    <p>
                      1. Copy the JSON configuration above
                    </p>
                    <p>
                      2. Add it to your page's <code className="bg-gray-700 px-2 py-1 rounded text-cyan-300">components</code> array
                    </p>
                    <p>
                      3. Customize the <code className="bg-gray-700 px-2 py-1 rounded text-cyan-300">attributes</code> to match your needs
                    </p>
                    <p>
                      4. Save and refresh your page to see the component in action! 🚀
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

ComponentShowcase.displayName = 'ComponentShowcase';