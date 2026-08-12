'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export default function DocsSidebar({ className = "" }) {
  const pathname = usePathname();
  
  const docsSections = [
    {
      title: "Getting Started",
      items: [
        { title: "🚀 Getting Started", href: "/docs/getting-started", file: "GETTING_STARTED" },
        { title: "📦 Examples", href: "/docs/examples", file: "EXAMPLES" },
        { title: "✨ Best Practices", href: "/docs/best-practices", file: "BEST_PRACTICES" }
      ]
    },
    {
      title: "Components",
      items: [
        { title: "📋 Component Packages", href: "/docs/component-packages", file: "COMPONENT_PACKAGES" },
        { title: "🎨 Design System", href: "/docs/design-system-guide", file: "DESIGN_SYSTEM_GUIDE" }
      ]
    },
    {
      title: "Authentication",
      items: [
        { title: "🔐 Auth Overview", href: "/docs/auth-system-overview", file: "AUTH_SYSTEM_OVERVIEW" },
        { title: "🔑 Authentication", href: "/docs/authentication", file: "AUTHENTICATION" },
        { title: "🧩 Auth Components", href: "/docs/auth-components", file: "AUTH_COMPONENTS" },
        { title: "📚 Auth Guide", href: "/docs/auth", file: "AUTH" }
      ]
    },
    {
      title: "Database",
      items: [
        { title: "🗄️ Database", href: "/docs/database", file: "DATABASE" },
        { title: "🔌 Database API", href: "/docs/database-api", file: "DATABASE_API" },
        { title: "🧩 DB Components", href: "/docs/database-components", file: "DATABASE_COMPONENTS" },
        { title: "📋 DB Examples", href: "/docs/database-examples", file: "DATABASE_EXAMPLES" }
      ]
    },
    {
      title: "Plugins",
      items: [
        { title: "🔌 Plugins", href: "/docs/plugins", file: "PLUGINS" },
        { title: "⚙️ Plugin Manager", href: "/docs/plugin-manager", file: "PLUGIN_MANAGER" },
        { title: "🛠️ Plugin Development", href: "/docs/plugin-development", file: "PLUGIN_DEVELOPMENT" }
      ]
    }
  ];

  const isActive = (href) => {
    return pathname === href;
  };

  return (
    <aside className={`bg-gray-900/50 backdrop-blur-sm border-r border-gray-700 ${className}`}>
      <div className="p-6">
        <h2 className="text-xl font-bold text-cyan-400 mb-6">📚 Documentation</h2>
        <nav className="space-y-6">
          {docsSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <a
                      href={item.href}
                      className={`block px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                        isActive(item.href)
                          ? 'bg-cyan-500/20 text-cyan-300 border-l-2 border-cyan-400'
                          : 'text-gray-300 hover:text-cyan-300 hover:bg-gray-800/50'
                      }`}
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        
        {/* Quick Links */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Quick Links
          </h3>
          <ul className="space-y-2">
            <li>
              <a
                href="/"
                className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-cyan-300 hover:bg-gray-800/50 transition-all duration-200"
              >
                🏠 Home
              </a>
            </li>
            <li>
              <a
                href="/components"
                className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-cyan-300 hover:bg-gray-800/50 transition-all duration-200"
              >
                🧩 Components
              </a>
            </li>
            <li>
              <a
                href="/jason-80s"
                className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-cyan-300 hover:bg-gray-800/50 transition-all duration-200"
              >
                🔪 Jason 80s
              </a>
            </li>
            <li>
              <a
                href="https://github.com/cm64-studio/jasonjs-framework"
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-cyan-300 hover:bg-gray-800/50 transition-all duration-200"
              >
                💻 GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}

DocsSidebar.displayName = 'DocsSidebar';