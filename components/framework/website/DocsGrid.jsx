'use client';

import React from 'react';

export default function DocsGrid({
  title = "📚 Documentation Sections",
  subtitle = "Explore comprehensive guides for every aspect of the framework",
  sections = [],
  className = "",
  sectionClasses = "py-20 bg-gradient-to-b from-gray-900 to-black",
  titleClasses = "text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 mb-6",
  subtitleClasses = "text-xl text-gray-300 max-w-3xl mx-auto mb-16",
  containerClasses = "container mx-auto px-6 max-w-7xl",
  cardClasses = "bg-gray-800/60 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 hover:border-cyan-500/50 transition-all duration-300 hover:transform hover:scale-105 group",
  ...domProps
}) {
  const defaultSections = [
    {
      title: "🚀 Getting Started",
      description: "Jump into the fun world of JasonJS!",
      icon: "⚡",
      links: [
        { title: "Getting Started Guide", url: "/docs/getting-started", file: "GETTING_STARTED" },
        { title: "Cool Examples", url: "/docs/examples", file: "EXAMPLES" },
        { title: "80s Jason Theme", url: "/jason-80s" }
      ]
    },
    {
      title: "🧩 Component Packages",
      description: "WordPress-style component system",
      icon: "📦",
      links: [
        { title: "Component Packages Guide", url: "/docs/component-packages", file: "COMPONENT_PACKAGES" },
        { title: "Plugin Development", url: "/docs/plugin-development", file: "PLUGIN_DEVELOPMENT" },
        { title: "Plugin Manager", url: "/docs/plugin-manager", file: "PLUGIN_MANAGER" }
      ]
    },
    {
      title: "🗄️ Database System",
      description: "Powerful, intuitive database with unified API",
      icon: "💾",
      links: [
        { title: "Database Overview", url: "/docs/database", file: "DATABASE" },
        { title: "Database API", url: "/docs/database-api", file: "DATABASE_API" },
        { title: "Database Components", url: "/docs/database-components", file: "DATABASE_COMPONENTS" },
        { title: "Database Examples", url: "/docs/database-examples", file: "DATABASE_EXAMPLES" }
      ]
    },
    {
      title: "🔐 Authentication",
      description: "Complete authentication system",
      icon: "🛡️",
      links: [
        { title: "Auth System Overview", url: "/docs/auth-system", file: "AUTH_SYSTEM_OVERVIEW" },
        { title: "Authentication Guide", url: "/docs/authentication", file: "AUTHENTICATION" },
        { title: "Auth Components", url: "/docs/auth-components", file: "AUTH_COMPONENTS" },
        { title: "Auth API", url: "/docs/auth", file: "AUTH" }
      ]
    },
    {
      title: "🎨 Design & Best Practices",
      description: "Level up your development game!",
      icon: "🎭",
      links: [
        { title: "Best Practices Guide", url: "/docs/best-practices", file: "BEST_PRACTICES" },
        { title: "Design System Guide", url: "/docs/design-system", file: "DESIGN_SYSTEM_GUIDE" }
      ]
    },
    {
      title: "🔌 Plugins",
      description: "Extend framework functionality",
      icon: "🔧",
      links: [
        { title: "Plugins Overview", url: "/docs/plugins", file: "PLUGINS" },
        { title: "Plugin Development", url: "/docs/plugin-development", file: "PLUGIN_DEVELOPMENT" },
        { title: "Plugin Manager", url: "/docs/plugin-manager", file: "PLUGIN_MANAGER" }
      ]
    }
  ];

  const sectionsToShow = sections.length > 0 ? sections : defaultSections;

  return (
    <section className={`${sectionClasses} ${className} relative overflow-hidden`} {...domProps}>
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5 animate-pulse"></div>
        <div className="absolute top-1/4 left-1/3 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-pink-400/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '3s'}}></div>
      </div>

      <div className={`${containerClasses} relative z-10`}>
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className={titleClasses}>
            {title}
          </h2>
          <p className={subtitleClasses}>
            {subtitle}
          </p>
        </div>

        {/* Sections Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sectionsToShow.map((section, index) => (
            <div 
              key={index}
              className={cardClasses}
            >
              {/* Section Icon & Title */}
              <div className="text-center mb-6">
                <div className="text-4xl mb-4 group-hover:animate-bounce">
                  {section.icon}
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {section.title}
                </h3>
                <p className="text-gray-300 leading-relaxed mb-6">
                  {section.description}
                </p>
              </div>

              {/* Links */}
              {section.links && section.links.length > 0 && (
                <div className="space-y-3">
                  {section.links.map((link, linkIndex) => (
                    <a
                      key={linkIndex}
                      href={link.url}
                      className="block p-3 bg-gray-700/40 hover:bg-gray-700/60 rounded-lg transition-all duration-200 group/link"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-cyan-300 group-hover/link:text-cyan-200">
                          {link.title}
                        </span>
                        <span className="text-cyan-500 transform group-hover/link:translate-x-1 transition-transform">
                          →
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {/* Coming Soon Badge */}
              {(!section.links || section.links.length === 0) && (
                <div className="text-center">
                  <span className="inline-block px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg text-yellow-300 text-sm border border-yellow-400/30">
                    📝 Coming Soon
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="text-center mt-16">
          <div className="inline-block p-6 bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-cyan-400/30 hover:border-cyan-400/60 transition-all duration-300">
            <p className="text-cyan-300 text-lg mb-4">
              🤖 Need help? Our AI assistant is here to guide you!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://github.com/cm64-studio/jasonjs-framework/discussions"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-lg text-cyan-300 text-sm border border-cyan-400/30 hover:border-cyan-400/60 transition-all duration-200"
              >
                💬 Discussions
              </a>
              <a
                href="https://github.com/cm64-studio/jasonjs-framework/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-pink-500/20 to-yellow-500/20 rounded-lg text-pink-300 text-sm border border-pink-400/30 hover:border-pink-400/60 transition-all duration-200"
              >
                🐛 Issues
              </a>
              <a
                href="https://discord.gg/jasonjs"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-lg text-purple-300 text-sm border border-purple-400/30 hover:border-purple-400/60 transition-all duration-200"
              >
                💬 Discord
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

DocsGrid.displayName = 'DocsGrid';