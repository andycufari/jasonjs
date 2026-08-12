'use client';

import React, { useState, useEffect, useRef } from 'react';
import IconWrapper from './IconWrapper';

// Default stats when none provided
const defaultStats = [
  {
    value: 10000,
    suffix: "+",
    label: "Users",
    icon: "👥",
    description: "Happy customers worldwide"
  },
  {
    value: 500,
    suffix: "+",
    label: "Projects",
    icon: "📦",
    description: "Successfully delivered"
  },
  {
    value: 99,
    suffix: "%",
    label: "Satisfaction",
    icon: "⭐",
    description: "Customer satisfaction rate"
  },
  {
    value: 24,
    suffix: "/7",
    label: "Support",
    icon: "💬",
    description: "Always here to help"
  }
];

// Format large numbers
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'K';
  return num.toString();
};

export default function StatsSection({
  title = "Trusted by Thousands",
  subtitle = "Numbers that speak for themselves.",
  stats = [],
  columns = 4,
  variant = "default",
  animate = true,
  className = "",
  ...domProps
}) {
  const [animatedValues, setAnimatedValues] = useState({});
  const [hasAnimated, setHasAnimated] = useState(false);
  const sectionRef = useRef(null);

  const displayStats = stats.length > 0 ? stats : defaultStats;

  const variantStyles = {
    default: {
      section: "bg-background",
      title: "text-foreground",
      subtitle: "text-muted-foreground",
      value: "text-primary",
      suffix: "text-primary",
      label: "text-foreground",
      description: "text-muted-foreground",
      icon: "text-primary"
    },
    cards: {
      section: "bg-muted/30",
      title: "text-foreground",
      subtitle: "text-muted-foreground",
      card: "bg-card border border-border rounded-2xl p-6",
      value: "text-primary",
      suffix: "text-primary",
      label: "text-card-foreground",
      description: "text-muted-foreground",
      icon: "text-primary"
    },
    minimal: {
      section: "bg-background",
      title: "text-foreground",
      subtitle: "text-muted-foreground",
      value: "text-foreground",
      suffix: "text-muted-foreground",
      label: "text-foreground",
      description: "text-muted-foreground",
      icon: "text-muted-foreground"
    }
  };

  const styles = variantStyles[variant] || variantStyles.default;

  const columnClasses = {
    2: "grid-cols-2",
    3: "grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4"
  };

  // Animate numbers when section comes into view
  useEffect(() => {
    if (!animate || hasAnimated) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Set final values immediately
      const finalValues = {};
      displayStats.forEach((stat, index) => {
        finalValues[index] = stat.value;
      });
      setAnimatedValues(finalValues);
      setHasAnimated(true);
      return;
    }

    const animateNumbers = () => {
      displayStats.forEach((stat, index) => {
        let start = 0;
        const end = stat.value;
        const duration = 2000;
        const startTime = performance.now();

        const animate = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Easing function for smooth animation
          const easeOutQuart = 1 - Math.pow(1 - progress, 4);
          const current = Math.floor(easeOutQuart * end);

          setAnimatedValues(prev => ({
            ...prev,
            [index]: current
          }));

          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };

        requestAnimationFrame(animate);
      });
      setHasAnimated(true);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          animateNumbers();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [animate, hasAnimated, displayStats]);

  // If no animation, just show final values
  useEffect(() => {
    if (!animate) {
      const finalValues = {};
      displayStats.forEach((stat, index) => {
        finalValues[index] = stat.value;
      });
      setAnimatedValues(finalValues);
    }
  }, [animate, displayStats]);

  return (
    <section
      ref={sectionRef}
      className={`py-20 ${styles.section} ${className}`}
      {...domProps}
    >
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

        {/* Stats Grid */}
        <div className={`grid ${columnClasses[columns] || columnClasses[4]} gap-8`}>
          {displayStats.map((stat, index) => (
            <div
              key={index}
              className={`text-center ${styles.card || ''}`}
            >
              {/* Icon */}
              {stat.icon && (
                <div className={`text-5xl mb-4 ${styles.icon}`}>
                  <IconWrapper icon={stat.icon} size="xl" />
                </div>
              )}

              {/* Value */}
              <div className="mb-2">
                {stat.prefix && (
                  <span className={`text-3xl md:text-4xl font-bold ${styles.suffix}`}>
                    {stat.prefix}
                  </span>
                )}
                <span className={`text-4xl md:text-5xl font-bold ${styles.value}`}>
                  {formatNumber(animatedValues[index] ?? stat.value)}
                </span>
                {stat.suffix && (
                  <span className={`text-3xl md:text-4xl font-bold ${styles.suffix}`}>
                    {stat.suffix}
                  </span>
                )}
              </div>

              {/* Label */}
              <div className={`text-xl font-semibold mb-2 ${styles.label}`}>
                {stat.label}
              </div>

              {/* Description */}
              {stat.description && (
                <div className={`text-sm ${styles.description}`}>
                  {stat.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

StatsSection.displayName = 'StatsSection';
