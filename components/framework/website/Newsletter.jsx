'use client';

import React, { useState } from 'react';
import { useApp } from '@/core/hooks/useApp';

export default function Newsletter({
  title = "Subscribe to our newsletter",
  subtitle = "Get the latest updates and news delivered to your inbox",
  placeholder = "Enter your email",
  buttonText = "Subscribe",
  newsletterDatabase = "newsletter",
  variant = "default",
  size = "default",
  className = "",
  ...domProps
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const app = useApp();

  const variantStyles = {
    default: {
      container: "bg-card border border-border",
      title: "text-card-foreground",
      subtitle: "text-muted-foreground",
      input: "bg-background border-input text-foreground",
      button: "bg-primary text-primary-foreground hover:bg-primary/90"
    },
    gradient: {
      container: "bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20",
      title: "text-primary",
      subtitle: "text-muted-foreground",
      input: "bg-background/80 border-primary/30 text-foreground",
      button: "bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90"
    },
    dark: {
      container: "bg-card border border-border",
      title: "text-card-foreground",
      subtitle: "text-muted-foreground",
      input: "bg-muted border-border text-foreground",
      button: "bg-foreground text-background hover:bg-foreground/90"
    },
    minimal: {
      container: "bg-transparent border-b border-border",
      title: "text-foreground",
      subtitle: "text-muted-foreground",
      input: "bg-muted border-border text-foreground",
      button: "bg-foreground text-background hover:bg-foreground/90"
    }
  };

  const sizeStyles = {
    small: {
      container: "p-4",
      title: "text-lg font-semibold mb-1",
      subtitle: "text-sm mb-3",
      input: "px-3 py-2 text-sm",
      button: "px-4 py-2 text-sm"
    },
    default: {
      container: "p-6",
      title: "text-xl font-semibold mb-2",
      subtitle: "text-sm mb-4",
      input: "px-4 py-2",
      button: "px-6 py-2"
    },
    large: {
      container: "p-8",
      title: "text-2xl font-bold mb-3",
      subtitle: "text-base mb-6",
      input: "px-5 py-3 text-lg",
      button: "px-8 py-3 text-lg"
    }
  };

  const styles = variantStyles[variant] || variantStyles.default;
  const sizes = sizeStyles[size] || sizeStyles.default;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      app.ui.toast('Please enter a valid email address', { type: 'error' });
      return;
    }

    setLoading(true);

    try {
      // Use the app database to save newsletter subscription
      await app.db.use(newsletterDatabase).add({
        email: email,
        subscribedAt: new Date().toISOString(),
        source: 'newsletter-widget'
      });

      // Show success message
      app.ui.toast('Successfully subscribed to newsletter!', { type: 'success' });

      // Clear the input
      setEmail('');
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      app.ui.toast('Failed to subscribe. Please try again.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`${styles.container} ${sizes.container} rounded-lg ${className}`}
      {...domProps}
    >
      {/* Title */}
      <h3 className={`${styles.title} ${sizes.title}`}>
        {title}
      </h3>

      {/* Subtitle */}
      {subtitle && (
        <p className={`${styles.subtitle} ${sizes.subtitle}`}>
          {subtitle}
        </p>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          className={`flex-1 ${styles.input} ${sizes.input} rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary transition-colors disabled:opacity-50`}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className={`${styles.button} ${sizes.button} rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? 'Subscribing...' : buttonText}
        </button>
      </form>
    </div>
  );
}

Newsletter.displayName = 'Newsletter';