"use client"

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NavBar = ({ props, theme }) => {
  const { logo, links, cta, config } = props;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const pathname = usePathname();

  // Estilos específicos para el navbar retro
  const styles = {
    navbar: {
      width: '100%',
      backgroundColor: '#00005A', // Color más oscuro
      borderBottom: '1px solid #AAAAFF',
      zIndex: 100,
      position: config?.position || 'relative'
    },
    innerContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.35rem 1.5rem',
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto'
    },
    linkContainer: {
      display: 'flex',
      alignItems: 'center'
    },
    link: {
      color: '#ffffff',
      padding: '0.25rem 0.75rem',
      fontFamily: '"Courier New", monospace',
      fontSize: '0.9rem',
      position: 'relative',
      cursor: 'pointer',
      transition: 'background-color 0.15s',
      textDecoration: 'none',
      borderRight: '1px solid rgba(255,255,255,0.15)'
    },
    activeLink: {
      backgroundColor: '#FFFFFF',
      color: '#00005A',
      fontWeight: 'bold'
    },
    linkHover: {
      backgroundColor: '#0000BB'
    },
    logo: {
      color: '#FFFFFF',
      fontFamily: '"Courier New", monospace',
      fontWeight: 'bold',
      fontSize: '1.1rem',
      display: 'flex',
      alignItems: 'center',
      textDecoration: 'none',
      letterSpacing: '1px'
    },
    cta: {
      backgroundColor: '#AA0000', // Rojo oscuro para el botón CTA
      color: '#ffffff',
      fontFamily: '"Courier New", monospace',
      padding: '0.25rem 0.75rem',
      border: 'none',
      position: 'relative',
      cursor: 'pointer',
      textDecoration: 'none',
      display: 'inline-block',
      fontWeight: 'bold'
    },
    ctaShadow: {
      position: 'absolute',
      top: '2px',
      left: '2px',
      width: '100%',
      height: '100%',
      backgroundColor: '#550000',
      zIndex: '-1'
    },
    mobileButton: {
      background: 'none',
      border: 'none',
      color: '#ffffff',
      fontSize: '1.5rem',
      cursor: 'pointer',
      display: 'none',
      padding: '0.25rem'
    },
    mobileMenu: {
      display: 'none',
      flexDirection: 'column',
      backgroundColor: '#00005A',
      width: '100%',
      position: 'absolute',
      top: '100%',
      left: 0,
      zIndex: 99,
      borderTop: '1px solid rgba(170,170,255,0.3)',
      boxShadow: '0 4px 6px rgba(0,0,0,0.5)'
    },
    mobileLink: {
      color: '#ffffff',
      padding: '0.75rem 1rem',
      fontFamily: '"Courier New", monospace',
      borderBottom: '1px solid rgba(255,255,255,0.15)',
      textDecoration: 'none'
    },
    mobileCta: {
      backgroundColor: '#AA0000',
      color: '#ffffff',
      fontFamily: '"Courier New", monospace',
      padding: '0.75rem 1rem',
      textAlign: 'center',
      margin: '0.5rem',
      position: 'relative',
      textDecoration: 'none',
      display: 'block',
      fontWeight: 'bold'
    }
  };

  // Verificar si un enlace está activo
  const isActive = (href) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // Manejar hover en enlaces de escritorio
  const handleMouseEnter = (index) => {
    setActiveItem(index);
  };

  const handleMouseLeave = () => {
    setActiveItem(null);
  };

  // Manejar la apertura/cierre del menú móvil
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  useEffect(() => {
    // Agregar media query para el menú móvil
    const handleResize = () => {
      const mobileButton = document.getElementById('mobile-menu-button');
      const linkContainer = document.getElementById('desktop-links');
      const mobileMenu = document.getElementById('mobile-menu');

      if (window.innerWidth < 768) {
        if (mobileButton) mobileButton.style.display = 'block';
        if (linkContainer) linkContainer.style.display = 'none';
        if (mobileMenu && mobileMenuOpen) mobileMenu.style.display = 'flex';
      } else {
        if (mobileButton) mobileButton.style.display = 'none';
        if (linkContainer) linkContainer.style.display = 'flex';
        if (mobileMenu) mobileMenu.style.display = 'none';
      }
    };

    // Inicializar y agregar el listener
    handleResize();
    window.addEventListener('resize', handleResize);

    // Limpiar el listener al desmontar
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen]);

  return (
    <nav style={styles.navbar}>
      <div style={styles.innerContainer}>
        {/* Logo */}
        <div>
          {logo && logo.href ? (
            <Link href={logo.href}>
              <span style={styles.logo}>
                {logo.src ? (
                  <Image 
                    src={logo.src} 
                    alt={logo.alt || 'Logo'} 
                    width={config?.logoWidth || 32} 
                    height={config?.logoHeight || 32} 
                    style={{ marginRight: '0.5rem' }}
                  />
                ) : null}
                {logo.text || 'CAT-OS'}
              </span>
            </Link>
          ) : (
            <span style={styles.logo}>
              {logo?.text || 'CAT-OS'}
            </span>
          )}
        </div>

        {/* Desktop Links - estilo menú DOS */}
        <div id="desktop-links" style={styles.linkContainer}>
          {links.map((link, index) => (
            <Link 
              key={index} 
              href={link.href}
              style={{
                ...styles.link,
                ...(isActive(link.href) ? styles.activeLink : {}),
                ...(activeItem === index && !isActive(link.href) ? styles.linkHover : {})
              }}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={handleMouseLeave}
            >
              {link.label}
            </Link>
          ))}

          {/* CTA button */}
          {cta && (
            <Link href={cta.href} style={{ position: 'relative', marginLeft: '0.5rem' }}>
              <span style={styles.cta}>
                {cta.label}
                <span style={styles.ctaShadow}></span>
              </span>
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          id="mobile-menu-button"
          style={styles.mobileButton}
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? 'X' : '≡'}
        </button>
      </div>

      {/* Mobile menu */}
      <div 
        id="mobile-menu" 
        style={{
          ...styles.mobileMenu,
          display: mobileMenuOpen ? 'flex' : 'none'
        }}
      >
        {links.map((link, index) => (
          <Link 
            key={index}
            href={link.href} 
            style={{
              ...styles.mobileLink,
              ...(isActive(link.href) ? { backgroundColor: '#0000BB', borderLeft: '4px solid #FFFFFF' } : {})
            }}
            onClick={() => setMobileMenuOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        
        {cta && (
          <Link 
            href={cta.href}
            style={styles.mobileCta}
            onClick={() => setMobileMenuOpen(false)}
          >
            {cta.label}
          </Link>
        )}
      </div>
    </nav>
  );
};

export default NavBar;