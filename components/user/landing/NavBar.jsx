"use client"

// studio/components/landing/NavBar.jsx
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Button from './Button';

const NavBar = ({ props, theme }) => {
  const { logo, links, cta, config = {} } = props;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Add scroll effect if navbar is absolute positioned
  useEffect(() => {
    if (config?.position && config.position.includes('absolute')) {
      const handleScroll = () => {
        setScrolled(window.scrollY > 20);
      };
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [config?.position]);

  const bgClass = config.background === 'transparent' 
    ? scrolled ? 'bg-background/95 backdrop-blur-sm' : '' 
    : 'bg-background';
    
  const linksAlignClass = {
    'center': 'justify-center',
    'left': 'justify-start',
    'right': 'justify-end'
  }[config.linksAlign || 'center'];

  const borderClass = config.border ? 'border-b border-secondary/20' : '';
  
  const paddingX = config.paddingX || 'px-10';
  const paddingY = config.paddingY || 'py-4';
  const paddingClass = `${paddingX} ${paddingY}`;
  const positionClass = config.position || 'absolute top-0 left-0 right-0 z-50';

  // Calculate logo dimensions
  const logoWidth = config.logoWidth || 144;
  const logoHeight = config.logoHeight || 32;
  const logoAspectRatio = logoWidth / logoHeight;

  // Determine the constraining dimension
  const maxLogoHeight = parseInt(config.maxLogoHeight || '64px');
  const calculatedHeight = Math.min(logoHeight, maxLogoHeight);
  const calculatedWidth = calculatedHeight * logoAspectRatio;

  // Check if a link is active
  const isActive = (href) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className={`${bgClass} ${borderClass} ${positionClass} transition-all duration-300`}>
      <div className={`container mx-auto ${paddingClass}`}>
        {/* Main navbar container */}
        <div className="flex items-center justify-between w-full">
          {/* Logo */}
          <div className="flex-shrink-0">
            {logo && logo.src && (
              <div style={{ height: `${calculatedHeight}px`, maxWidth: '100%' }}>
                <Image 
                  src={logo.src} 
                  alt={logo.alt} 
                  width={logoWidth}
                  height={logoHeight}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }} 
                />
              </div>
            )}

            {logo && !logo.src && logo.text && (
              <div className="text-xl md:text-2xl font-bold">
                {logo.href && <Link href={logo.href}>{logo.text}</Link>}
                {!logo.href && logo.text}
              </div>
            )}
          </div>

          {/* Desktop links and CTA - centered within their container */}
          <div className="hidden md:flex md:items-center md:justify-center md:flex-1 px-4">
            <div className={`flex ${linksAlignClass} gap-6`}>
              {links.map((link, index) => (
                <Link 
                  key={index} 
                  href={link.href} 
                  className={`relative text-sm font-medium transition-colors duration-200 px-1 py-2
                    ${isActive(link.href) 
                      ? 'text-primary font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary' 
                      : 'text-text hover:text-primary'
                    }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Mobile menu button */}
          <button 
            type="button"
            className="md:hidden flex items-center p-2 rounded-md hover:bg-secondary/10 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg 
              className="h-6 w-6 text-text" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} 
              />
            </svg>
          </button>
          
          {/* CTA button (desktop) */}
          {cta && (
            <div className="hidden md:block">
              <Link href={cta.href} passHref>
                <Button
                  as="a"
                  type={cta.type || 'default'}
                  className={`${cta.bgColor || 'bg-white'} ${cta.textColor || 'text-black'} transition-transform hover:scale-105`}
                >
                  {cta.label}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile links and CTA - toggle with useState */}
        <div className={`md:hidden mt-4 border-t pt-4 border-secondary/20 overflow-hidden transition-all duration-300 ${mobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
          <div className="flex flex-col space-y-4">
            {links.map((link, index) => (
              <Link 
                key={index} 
                href={link.href} 
                className={`py-2 px-1 transition-colors duration-200 ${isActive(link.href) ? 'text-primary font-semibold border-l-2 border-primary pl-2' : 'text-text'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            
            {cta && (
              <div className="mt-2 py-2">
                <Link 
                  href={cta.href} 
                  passHref
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button
                    as="a"
                    type={cta.type || 'default'}
                    className={`w-full text-center ${cta.bgColor || 'bg-white'} ${cta.textColor || 'text-black'}`}
                  >
                    {cta.label}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;