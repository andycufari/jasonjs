'use client';

import React, { useState } from 'react';
import IconWrapper from './IconWrapper';

// Default features when none provided
const defaultFeatures = [
  {
    icon: "🚀",
    title: "Fast Setup",
    description: "Get started in minutes with zero configuration required."
  },
  {
    icon: "⚡",
    title: "Lightning Fast",
    description: "Optimized for performance out of the box."
  },
  {
    icon: "🎨",
    title: "Fully Customizable",
    description: "Tailor every aspect to match your brand and needs."
  },
  {
    icon: "📱",
    title: "Responsive Design",
    description: "Looks great on all devices, from mobile to desktop."
  },
  {
    icon: "🔒",
    title: "Secure by Default",
    description: "Built with security best practices from the ground up."
  },
  {
    icon: "📚",
    title: "Well Documented",
    description: "Comprehensive documentation to help you every step of the way."
  }
];

export default function FeatureGrid({
  title = "Everything You Need",
  subtitle = "Complete development environment with powerful features.",
  features = [],
  columns = 3,
  variant = "default",
  showExpandable = true,
  className = "",
  ...domProps
}) {
  const [expandedFeature, setExpandedFeature] = useState(null);

  const displayFeatures = features.length > 0 ? features : defaultFeatures;

  const toggleFeature = (index) => {
    setExpandedFeature(expandedFeature === index ? null : index);
  };

  const variantStyles = {
    default: {
      section: "bg-background",
      title: "text-foreground",
      subtitle: "text-muted-foreground",
      card: "bg-card border border-border hover:border-primary/50",
      cardTitle: "text-card-foreground",
      cardDescription: "text-muted-foreground",
      expandButton: "text-primary hover:text-primary/80",
      detailDot: "bg-primary",
      detailText: "text-muted-foreground",
      expandedRing: "ring-2 ring-primary"
    },
    gradient: {
      section: "bg-gradient-to-br from-primary/5 via-background to-secondary/5",
      title: "text-foreground",
      subtitle: "text-muted-foreground",
      card: "bg-card/80 backdrop-blur border border-primary/20 hover:border-primary/40",
      cardTitle: "text-card-foreground",
      cardDescription: "text-muted-foreground",
      expandButton: "text-primary hover:text-primary/80",
      detailDot: "bg-primary",
      detailText: "text-muted-foreground",
      expandedRing: "ring-2 ring-primary"
    },
    minimal: {
      section: "bg-background",
      title: "text-foreground",
      subtitle: "text-muted-foreground",
      card: "bg-transparent border-b border-border hover:bg-muted/50",
      cardTitle: "text-foreground",
      cardDescription: "text-muted-foreground",
      expandButton: "text-foreground hover:text-foreground/80",
      detailDot: "bg-foreground",
      detailText: "text-muted-foreground",
      expandedRing: "bg-muted/50"
    }
  };

  const styles = variantStyles[variant] || variantStyles.default;

  const columnClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
  };

  return (
    <section className={`py-20 ${styles.section} ${className}`} {...domProps}>
      <div className="container mx-auto px-6 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className={`text-4xl md:text-5xl font-bold mb-6 ${styles.title}`}>
            {title}
          </h2>
          <p className={`text-xl max-w-3xl mx-auto ${styles.subtitle}`}>
            {subtitle}
          </p>
        </div>

        {/* Features Grid */}
        <div className={`grid ${columnClasses[columns] || columnClasses[3]} gap-8`}>
          {displayFeatures.map((feature, index) => (
            <div
              key={index}
              className={`rounded-2xl p-8 transition-all duration-300 ${styles.card} ${expandedFeature === index ? styles.expandedRing : ''}`}
            >
              {/* Feature Icon & Title */}
              <div className="text-center mb-6">
                <div className="text-4xl mb-4">
                  {feature.icon && (
                    <IconWrapper icon={feature.icon} size="xl" />
                  )}
                </div>
                <h3 className={`text-xl font-semibold mb-3 ${styles.cardTitle}`}>
                  {feature.title}
                </h3>
                <p className={`leading-relaxed ${styles.cardDescription}`}>
                  {feature.description}
                </p>
              </div>

              {/* Feature Details (Expandable) */}
              {showExpandable && feature.details && feature.details.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleFeature(index)}
                    className={`w-full flex items-center justify-between text-sm font-medium transition-colors ${styles.expandButton}`}
                  >
                    <span>Learn more</span>
                    <span className={`transform transition-transform ${expandedFeature === index ? 'rotate-180' : ''}`}>
                      ↓
                    </span>
                  </button>

                  {expandedFeature === index && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <ul className="space-y-2">
                        {feature.details.map((detail, detailIndex) => (
                          <li
                            key={detailIndex}
                            className={`flex items-start text-sm ${styles.detailText}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0 ${styles.detailDot}`}></span>
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

FeatureGrid.displayName = 'FeatureGrid';
