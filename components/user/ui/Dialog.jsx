// components/directory/ui/Dialog.jsx
'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export function Dialog({ open, onOpenChange, children }) {
  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    
    if (open) {
      window.addEventListener('keydown', handleEsc);
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          
          {/* Dialog Container - for centering */}
          <motion.div 
            className="relative w-full max-h-[90vh] overflow-y-auto px-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ 
              duration: 0.3,
              ease: [0.16, 1, 0.3, 1]
            }}
          >
            {/* Dialog Content */}
            <div className="mx-auto w-full sm:max-w-lg bg-black/60 dark:bg-zinc-900 rounded-xl shadow-xl">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

Dialog.Header = function DialogHeader({ children, className = "" }) {
  return (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>
      {children}
    </div>
  );
};

Dialog.Title = function DialogTitle({ children, className = "" }) {
  return (
    <h2 className={`text-2xl font-semibold leading-none tracking-tight ${className}`}>
      {children}
    </h2>
  );
};

Dialog.Description = function DialogDescription({ children, className = "" }) {
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      {children}
    </p>
  );
};

Dialog.Content = function DialogContent({ children, className = "" }) {
  return (
    <div className={`px-6 pb-6 ${className}`}>
      {children}
    </div>
  );
};

Dialog.Footer = function DialogFooter({ children, className = "" }) {
  return (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-6 pb-6 ${className}`}>
      {children}
    </div>
  );
};

Dialog.Close = function DialogClose({ className = "", ...props }) {
  return (
    <button
      className={`absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background 
                 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 
                 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none 
                 data-[state=open]:bg-accent data-[state=open]:text-muted-foreground ${className}`}
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  );
};