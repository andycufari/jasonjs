'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useApp } from '@/core/hooks/useApp';

export default function Footer({
  logo,
  logoText = "JasonJS",
  logoHref = "/",
  copyright,
  companyName = "JasonJS Framework",
  year = new Date().getFullYear(),
  links = [],
  linkGroups = [],
  socialLinks = [],
  showNewsletter = false,
  newsletterTitle = "Subscribe to our newsletter",
  newsletterSubtitle = "Get the latest updates delivered to your inbox",
  newsletterPlaceholder = "Enter your email",
  newsletterDatabase = "newsletter",
  newsletterVariant = "default",
  variant = "default",
  layout = "default",
  showBadges = false,
  badges = [],
  className = "",
  ...domProps
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const app = useApp();

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      app.ui.toast('Please enter a valid email address', { type: 'error' });
      return;
    }

    setLoading(true);

    try {
      await app.db.use(newsletterDatabase).add({
        email: email,
        subscribedAt: new Date().toISOString(),
        source: 'footer-newsletter'
      });

      app.ui.toast('Successfully subscribed to newsletter!', { type: 'success' });
      setEmail('');
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      app.ui.toast('Failed to subscribe. Please try again.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };
  // Default link groups when none provided
  const defaultLinkGroups = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "#features" },
        { name: "Pricing", href: "#pricing" },
        { name: "Documentation", href: "/docs" }
      ]
    },
    {
      title: "Company",
      links: [
        { name: "About", href: "/about" },
        { name: "Blog", href: "/blog" },
        { name: "Contact", href: "/contact" }
      ]
    }
  ];

  // Default social links when none provided
  const defaultSocialLinks = [
    { name: "Twitter", href: "#", icon: "𝕏" },
    { name: "GitHub", href: "#", icon: "⌨" },
    { name: "LinkedIn", href: "#", icon: "in" }
  ];

  const variantStyles = {
    default: {
      footer: "bg-background border-t border-border",
      text: "text-muted-foreground",
      heading: "text-foreground font-semibold mb-4",
      link: "text-muted-foreground hover:text-primary transition-colors",
      socialIcon: "text-muted-foreground hover:text-primary",
      input: "bg-background border-input text-foreground",
      button: "bg-primary text-primary-foreground hover:bg-primary/90"
    },
    gradient: {
      footer: "bg-gradient-to-b from-primary/5 to-secondary/5 border-t border-primary/20",
      text: "text-muted-foreground",
      heading: "text-primary font-semibold mb-4",
      link: "text-muted-foreground hover:text-primary transition-colors",
      socialIcon: "text-primary hover:text-secondary",
      input: "bg-background border-primary/30 text-foreground",
      button: "bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90"
    },
    dark: {
      footer: "bg-card border-t border-border",
      text: "text-muted-foreground",
      heading: "text-card-foreground font-semibold mb-4",
      link: "text-muted-foreground hover:text-card-foreground transition-colors",
      socialIcon: "text-muted-foreground hover:text-card-foreground",
      input: "bg-muted border-border text-foreground",
      button: "bg-foreground text-background hover:bg-foreground/90"
    },
    minimal: {
      footer: "bg-transparent border-t border-border",
      text: "text-muted-foreground",
      heading: "text-foreground font-semibold mb-4",
      link: "text-muted-foreground hover:text-foreground transition-colors",
      socialIcon: "text-muted-foreground hover:text-foreground",
      input: "bg-muted border-border text-foreground",
      button: "bg-foreground text-background hover:bg-foreground/90"
    }
  };

  const styles = variantStyles[variant] || variantStyles.default;

  const defaultBadges = [
    // { text: "Next.js", gradient: "from-cyan-500/20 to-purple-500/20", border: "border-cyan-400/30", color: "text-cyan-300" },
    // { text: "React", gradient: "from-purple-500/20 to-pink-500/20", border: "border-purple-400/30", color: "text-purple-300" },
    // { text: "JSON-driven", gradient: "from-pink-500/20 to-yellow-500/20", border: "border-pink-400/30", color: "text-pink-300" },
    // { text: "Open Source", gradient: "from-yellow-500/20 to-cyan-500/20", border: "border-yellow-400/30", color: "text-yellow-300" }
  ];

  const displayBadges = badges.length > 0 ? badges : defaultBadges;
  const displayLinkGroups = linkGroups.length > 0 ? linkGroups : defaultLinkGroups;
  const displaySocialLinks = socialLinks.length > 0 ? socialLinks : defaultSocialLinks;
  const copyrightText = copyright || `© ${year} ${companyName}. All rights reserved.`;

  const renderDefaultLayout = () => (
    <div className="container mx-auto px-4 py-8">
      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
        {/* Brand column */}
        <div className="col-span-1">
          <Link href={logoHref} className="inline-flex items-center space-x-2 mb-4">
            {logo && (
              typeof logo === 'string' ? (
                <Image src={logo} alt={logoText} width={32} height={32} className="h-8 w-auto" />
              ) : (
                logo
              )
            )}
            {logoText && <span className={styles.heading}>{logoText}</span>}
          </Link>
          <p className={`${styles.text} text-sm max-w-xs`}>
            {copyright || `Building the future of web development with JSON-driven architecture.`}
          </p>
        </div>

        {/* Link groups */}
        {displayLinkGroups.map((group, index) => (
          <div key={index}>
            <h3 className={styles.heading}>{group.title}</h3>
            <ul className="space-y-2">
              {group.links.map((link, linkIndex) => (
                <li key={linkIndex}>
                  <Link href={link.href} className={`${styles.link} text-sm block`}>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Newsletter */}
        {showNewsletter && (
          <div>
            <h3 className={styles.heading}>{newsletterTitle}</h3>
            <p className={`${styles.text} text-sm mb-4`}>
              {newsletterSubtitle}
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={newsletterPlaceholder}
                disabled={loading}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border ${styles.input} focus:outline-none focus:ring-2 focus:ring-primary transition-colors disabled:opacity-50`}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 text-sm rounded-lg font-medium ${styles.button} transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap`}
              >
                {loading ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div className="pt-8 border-t border-border">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Copyright */}
          <p className={`${styles.text} text-sm`}>{copyrightText}</p>

          {/* Social links */}
          {displaySocialLinks.length > 0 && (
            <div className="flex gap-4">
              {displaySocialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${styles.socialIcon} transition-all hover:scale-110`}
                  title={social.name}
                >
                  {social.icon || social.name}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Tech badges */}
        {showBadges && displayBadges.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {displayBadges.map((badge, index) => (
              <span
                key={index}
                className={`px-3 py-1 rounded-full text-xs border ${badge.gradient ? `bg-gradient-to-r ${badge.gradient} ${badge.border} ${badge.color}` : 'bg-muted text-muted-foreground border-border'}`}
              >
                {badge.text}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCenteredLayout = () => (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center space-y-8">
        {/* Logo */}
        {(logo || logoText) && (
          <Link href={logoHref} className="inline-flex items-center justify-center space-x-2">
            {logo && (
              typeof logo === 'string' ? (
                <Image src={logo} alt={logoText} width={40} height={40} className="h-10 w-auto" />
              ) : (
                logo
              )
            )}
            {logoText && <span className={`${styles.heading} text-xl`}>{logoText}</span>}
          </Link>
        )}

        {/* Links */}
        {links.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-6">
            {links.map((link, index) => (
              <Link
                key={index}
                href={link.href}
                target={link.target}
                rel={link.target === "_blank" ? "noopener noreferrer" : undefined}
                className={styles.link}
              >
                {link.name}
              </Link>
            ))}
          </nav>
        )}

        {/* Social links */}
        {displaySocialLinks.length > 0 && (
          <div className="flex justify-center gap-6">
            {displaySocialLinks.map((social, index) => (
              <a
                key={index}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.socialIcon} transition-all hover:scale-110 text-xl`}
                title={social.name}
              >
                {social.icon || social.name}
              </a>
            ))}
          </div>
        )}

        {/* Copyright */}
        <p className={`${styles.text} text-sm`}>{copyrightText}</p>
      </div>
    </div>
  );

  return (
    <footer className={`${styles.footer} ${className}`} {...domProps}>
      {layout === 'centered' ? renderCenteredLayout() : renderDefaultLayout()}
    </footer>
  );
}

Footer.displayName = 'Footer';