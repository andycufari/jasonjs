'use client';

import React from 'react';

// Default testimonials when none provided
const defaultTestimonials = [
  {
    name: "Sarah Johnson",
    role: "Product Manager",
    avatar: "👩‍💼",
    content: "This product has completely transformed how our team works. The ease of use is remarkable.",
    rating: 5
  },
  {
    name: "Michael Chen",
    role: "Software Engineer",
    avatar: "👨‍💻",
    content: "I was skeptical at first, but after trying it out I'm completely sold. Highly recommended!",
    rating: 5
  },
  {
    name: "Emily Davis",
    role: "Startup Founder",
    avatar: "👩‍🚀",
    content: "The best investment we've made for our business. Support is excellent and features are top-notch.",
    rating: 5
  }
];

// Star rating component
const StarRating = ({ rating = 5, className = "" }) => {
  return (
    <div className={`flex gap-1 ${className}`}>
      {[...Array(5)].map((_, i) => (
        <span key={i} className={i < rating ? "text-yellow-500" : "text-muted-foreground/30"}>
          ★
        </span>
      ))}
    </div>
  );
};

export default function TestimonialSection({
  title = "What People Are Saying",
  subtitle = "Don't just take our word for it - hear from our satisfied customers.",
  testimonials = [],
  columns = 3,
  variant = "default",
  showRatings = true,
  className = "",
  ...domProps
}) {
  const displayTestimonials = testimonials.length > 0 ? testimonials : defaultTestimonials;

  const variantStyles = {
    default: {
      section: "bg-background",
      title: "text-foreground",
      subtitle: "text-muted-foreground",
      card: "bg-card border border-border",
      quote: "text-card-foreground",
      name: "text-foreground font-semibold",
      role: "text-muted-foreground",
      avatar: "bg-primary text-primary-foreground"
    },
    cards: {
      section: "bg-muted/30",
      title: "text-foreground",
      subtitle: "text-muted-foreground",
      card: "bg-card border border-border shadow-lg",
      quote: "text-card-foreground",
      name: "text-foreground font-semibold",
      role: "text-muted-foreground",
      avatar: "bg-primary text-primary-foreground"
    },
    minimal: {
      section: "bg-background",
      title: "text-foreground",
      subtitle: "text-muted-foreground",
      card: "bg-transparent border-l-4 border-primary pl-6",
      quote: "text-foreground italic",
      name: "text-foreground font-semibold",
      role: "text-muted-foreground",
      avatar: "bg-muted text-muted-foreground"
    }
  };

  const styles = variantStyles[variant] || variantStyles.default;

  const columnClasses = {
    1: "grid-cols-1 max-w-2xl mx-auto",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
  };

  // Helper to render avatar
  const renderAvatar = (testimonial) => {
    const avatarContent = testimonial.avatar || testimonial.name?.charAt(0) || "?";

    // Check if it's an image URL
    if (typeof avatarContent === 'string' && (avatarContent.startsWith('/') || avatarContent.startsWith('http'))) {
      return (
        <img
          src={avatarContent}
          alt={testimonial.name}
          className="w-12 h-12 rounded-full object-cover"
        />
      );
    }

    // Emoji or initials
    return (
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${styles.avatar}`}>
        {avatarContent}
      </div>
    );
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

        {/* Testimonials Grid */}
        <div className={`grid ${columnClasses[columns] || columnClasses[3]} gap-8`}>
          {displayTestimonials.map((testimonial, index) => (
            <div
              key={index}
              className={`rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] ${styles.card}`}
            >
              {/* Rating */}
              {showRatings && testimonial.rating && (
                <StarRating rating={testimonial.rating} className="mb-4" />
              )}

              {/* Quote */}
              <blockquote className={`mb-6 leading-relaxed ${styles.quote}`}>
                "{testimonial.content}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-4">
                {renderAvatar(testimonial)}
                <div>
                  <div className={styles.name}>{testimonial.name}</div>
                  <div className={`text-sm ${styles.role}`}>{testimonial.role}</div>
                  {testimonial.company && (
                    <div className={`text-sm ${styles.role}`}>{testimonial.company}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

TestimonialSection.displayName = 'TestimonialSection';
