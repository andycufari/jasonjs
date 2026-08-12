'use client';

import React from 'react';
import Link from 'next/link';

// Default features when none provided
const defaultFeatures = [
  "Fast Development",
  "Easy to Use",
  "Fully Customizable",
  "Well Documented"
];

// Default code example
const defaultCodeExample = {
  title: "page.json",
  code: `{
  "component": "Hero",
  "attributes": {
    "headline": "Your Title",
    "ctaText": "Get Started"
  }
}`
};

export default function Hero({
  headline = "Build Something Amazing",
  subheadline = "The fastest way to launch your next project. Simple, powerful, and ready to scale.",
  ctaText = "Get Started",
  ctaUrl = "/docs",
  secondaryCta = "Learn More",
  secondaryUrl = "#features",
  features = [],
  codeExample,
  showCodeExample = true,
  variant = "default",
  className = "",
  ...domProps
}) {
  const displayFeatures = features.length > 0 ? features : defaultFeatures;
  const displayCodeExample = codeExample || defaultCodeExample;

  const variantStyles = {
    default: {
      section: "bg-background",
      headline: "text-foreground",
      subheadline: "text-muted-foreground",
      featureText: "text-muted-foreground",
      featureDot: "bg-primary",
      primaryBtn: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondaryBtn: "border-border text-foreground hover:bg-muted",
      codeBlock: "bg-card border border-border",
      codeText: "text-primary",
      codeTitle: "text-muted-foreground",
      fallbackGradient: "bg-gradient-to-br from-primary to-secondary text-primary-foreground"
    },
    gradient: {
      section: "bg-gradient-to-br from-primary/5 via-background to-secondary/5",
      headline: "text-foreground",
      subheadline: "text-muted-foreground",
      featureText: "text-muted-foreground",
      featureDot: "bg-primary",
      primaryBtn: "bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90",
      secondaryBtn: "border-primary/30 text-foreground hover:bg-primary/10",
      codeBlock: "bg-card border border-border",
      codeText: "text-primary",
      codeTitle: "text-muted-foreground",
      fallbackGradient: "bg-gradient-to-br from-primary to-secondary text-primary-foreground"
    },
    minimal: {
      section: "bg-background",
      headline: "text-foreground",
      subheadline: "text-muted-foreground",
      featureText: "text-muted-foreground",
      featureDot: "bg-foreground",
      primaryBtn: "bg-foreground text-background hover:bg-foreground/90",
      secondaryBtn: "border-border text-foreground hover:bg-muted",
      codeBlock: "bg-muted border border-border",
      codeText: "text-foreground",
      codeTitle: "text-muted-foreground",
      fallbackGradient: "bg-muted text-foreground"
    }
  };

  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <section
      className={`py-20 min-h-[80vh] flex items-center ${styles.section} ${className}`}
      {...domProps}
    >
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column - Hero Content */}
          <div className="text-left">
            <h1 className={`text-5xl md:text-6xl font-bold mb-6 leading-tight ${styles.headline}`}>
              {headline}
            </h1>

            <p className={`text-xl mb-8 leading-relaxed max-w-xl ${styles.subheadline}`}>
              {subheadline}
            </p>

            {/* Feature List */}
            {displayFeatures.length > 0 && (
              <div className="mb-8">
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  {displayFeatures.map((feature, index) => (
                    <div
                      key={index}
                      className={`flex items-center text-sm ${styles.featureText}`}
                    >
                      <span className={`w-2 h-2 rounded-full mr-3 ${styles.featureDot}`}></span>
                      {typeof feature === 'string' ? feature : feature.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-start">
              <Link
                href={ctaUrl}
                className={`inline-flex items-center justify-center px-8 py-4 font-semibold rounded-xl transition-all shadow-lg ${styles.primaryBtn}`}
              >
                {ctaText}
                <span className="ml-2">→</span>
              </Link>

              {secondaryCta && secondaryUrl && (
                <Link
                  href={secondaryUrl}
                  className={`inline-flex items-center justify-center px-8 py-4 border-2 font-semibold rounded-xl transition-all ${styles.secondaryBtn}`}
                >
                  {secondaryCta}
                </Link>
              )}
            </div>
          </div>

          {/* Right Column - Code Example or Visual */}
          <div className="hidden lg:block">
            {showCodeExample && displayCodeExample ? (
              <div className={`rounded-2xl p-6 shadow-xl ${styles.codeBlock}`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-destructive rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className={`ml-4 text-sm ${styles.codeTitle}`}>
                    {displayCodeExample.title}
                  </span>
                </div>
                <pre className={`text-sm leading-relaxed overflow-x-auto ${styles.codeText}`}>
                  <code>{displayCodeExample.code}</code>
                </pre>
              </div>
            ) : (
              <div className={`rounded-2xl p-8 shadow-xl ${styles.fallbackGradient}`}>
                <div className="text-center">
                  <div className="text-4xl mb-4">🚀</div>
                  <h3 className="text-xl font-semibold mb-2">Ready to Build</h3>
                  <p className="opacity-90">
                    Start creating your next project today. Fast, simple, and powerful.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

Hero.displayName = 'Hero';
