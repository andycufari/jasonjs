'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, children, className = '' }) {
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  // Get the current theme class from the page root elements
  const rootElement = document.documentElement;
  const bodyElement = document.body;
  const themeClass = rootElement.className.includes('theme-dark') || 
                    bodyElement.className.includes('theme-dark') ||
                    rootElement.classList.contains('dark') ||
                    bodyElement.classList.contains('dark') ? 'theme-dark' : '';

  const modalContent = (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm ${themeClass}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl bg-card text-card-foreground border border-border ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  // Use React Portal to render at document.body level to inherit theme properly
  return createPortal(modalContent, document.body);
}

Modal.displayName = 'Modal';
Modal.isSystemComponent = true;