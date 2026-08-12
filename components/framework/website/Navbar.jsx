'use client';

import React, { useState } from 'react';
import UserWidget from '@/components/framework/auth/UserWidget';
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar({
  logo,
  logoText = "JasonJS",
  logoHref = "/",
  navigation = [],
  showAuth = true,
  profileMode = "modal", // "modal" | "redirect"
  loginHref = "/auth/signin",
  signupHref = "/auth/signup",
  profileHref = "/profile",
  afterSignOutUrl = "/",
  variant = "default",
  position = "sticky",
  transparent = false,
  className = "",
  showUserProfile,
  ...domProps
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null);

  // Default navigation when none provided
  const defaultNavigation = [
    { name: "Home", href: "/" },
    { name: "Features", href: "#features" },
    { name: "Pricing", href: "#pricing" },
    { name: "Contact", href: "#contact" }
  ];

  const nav = navigation.length > 0 ? navigation : defaultNavigation;

  const variantStyles = {
    default: {
      header: "bg-background border-b border-border",
      logo: "text-xl font-bold text-foreground",
      link: "text-muted-foreground hover:text-primary transition-colors",
      button: "text-muted-foreground hover:text-primary",
      mobile: "bg-background border-t border-border"
    },
    gradient: {
      header: "bg-gradient-to-r from-primary to-secondary text-primary-foreground",
      logo: "text-xl font-bold text-primary-foreground",
      link: "text-primary-foreground/90 hover:text-primary-foreground transition-colors",
      button: "text-primary-foreground/90 hover:text-primary-foreground",
      mobile: "bg-gradient-to-r from-primary to-secondary text-primary-foreground border-t border-primary-foreground/10"
    },
    glass: {
      header: "bg-background/80 backdrop-blur-md border-b border-border/50",
      logo: "text-xl font-bold text-foreground",
      link: "text-muted-foreground hover:text-primary transition-colors",
      button: "text-muted-foreground hover:text-primary",
      mobile: "bg-background/95 backdrop-blur-md border-t border-border/50"
    }
  };

  const styles = variantStyles[variant] || variantStyles.default;

  const positionClasses = {
    sticky: "sticky top-0 z-50",
    fixed: "fixed top-0 left-0 right-0 z-50",
    relative: "relative",
    static: ""
  };

  const toggleSubmenu = (index) => {
    setOpenSubmenu(openSubmenu === index ? null : index);
  };

  const renderNavItem = (item, index, isMobile = false) => {
    const hasSubmenu = item.submenu && item.submenu.length > 0;

    if (hasSubmenu) {
      return (
        <div key={index} className={isMobile ? "w-full" : "relative group"}>
          <button
            onClick={() => isMobile && toggleSubmenu(index)}
            className={`${styles.link} ${isMobile ? 'w-full text-left px-4 py-2' : 'flex items-center space-x-1'}`}
          >
            <span>{item.name}</span>
            <svg
              className={`w-4 h-4 transition-transform ${openSubmenu === index && isMobile ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Desktop Submenu */}
          {!isMobile && (
            <div className="absolute left-0 mt-2 w-48 bg-popover text-popover-foreground rounded-md shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="py-2">
                {item.submenu.map((subitem, subindex) => (
                  <Link
                    key={subindex}
                    href={subitem.href}
                    className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {subitem.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Mobile Submenu */}
          {isMobile && openSubmenu === index && (
            <div className="pl-4 py-2 space-y-1">
              {item.submenu.map((subitem, subindex) => (
                <Link
                  key={subindex}
                  href={subitem.href}
                  className="block px-4 py-2 text-sm text-muted-foreground hover:text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {subitem.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={index}
        href={item.href}
        target={item.target}
        rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
        className={`${styles.link} ${isMobile ? 'block px-4 py-2' : ''}`}
        onClick={() => isMobile && setMobileMenuOpen(false)}
      >
        {item.name}
      </Link>
    );
  };

  const renderAuthButtons = (isMobile = false) => {
    if (!showAuth) return null;

    return (
      <div className={isMobile ? "w-full px-4 py-2" : ""}>
        <UserWidget
          options={{
            mode: profileMode,
            profileUrl: profileHref,
            signInUrl: loginHref,
            signUpUrl: signupHref,
            afterSignOutUrl: afterSignOutUrl,
            showSignUp: true
          }}
        />
      </div>
    );
  };

  return (
    <header
      className={`${positionClasses[position]} ${transparent ? 'bg-transparent' : styles.header} ${className}`}
      {...domProps}
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href={logoHref} className={`${styles.logo} flex items-center space-x-2`}>
              {logo && (
                typeof logo === 'string' ? (
                  <Image src={logo} alt={logoText} width={32} height={32} className="h-8 w-auto" />
                ) : (
                  logo
                )
              )}
              {logoText && <span>{logoText}</span>}
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {nav.map((item, index) => renderNavItem(item, index, false))}
            {renderAuthButtons(false)}
          </nav>

          {/* Mobile menu button */}
          <button
            className={`md:hidden ${styles.button}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className={`md:hidden ${styles.mobile}`}>
          <nav className="py-4 space-y-2">
            {nav.map((item, index) => renderNavItem(item, index, true))}
            {renderAuthButtons(true)}
          </nav>
        </div>
      )}
    </header>
  );
}

Navbar.displayName = 'Navbar';