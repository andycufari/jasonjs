// components/framework/ui/Button.jsx
'use client';
import React from 'react';
import { motion } from 'framer-motion';

const Button = ({ 
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  onClick,
  type = 'button',
  ...props 
}) => {
  // Base classes that work with theme variables
  const baseClasses = 'inline-flex items-center justify-center font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 relative overflow-hidden';
  
  // Size variants
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm rounded-theme-sm',
    md: 'px-6 py-3 text-base rounded-theme',
    lg: 'px-8 py-4 text-lg rounded-theme-lg',
    xl: 'px-10 py-5 text-xl rounded-theme-lg'
  };

  // Variant classes using CSS variables
  const variantClasses = {
    primary: 'bg-primary hover:bg-primary text-white focus:ring-primary shadow-theme hover:shadow-theme-lg',
    secondary: 'bg-secondary hover:bg-secondary text-white focus:ring-secondary shadow-theme hover:shadow-theme-lg',
    accent: 'bg-accent hover:bg-accent text-white focus:ring-accent shadow-theme hover:shadow-theme-lg',
    outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white focus:ring-primary',
    ghost: 'text-primary hover:bg-hover focus:ring-primary',
    success: 'bg-success hover:bg-success text-white focus:ring-success shadow-theme',
    warning: 'bg-warning hover:bg-warning text-white focus:ring-warning shadow-theme',
    error: 'bg-error hover:bg-error text-white focus:ring-error shadow-theme'
  };

  // Disabled state
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  // Loading state
  const loadingClasses = loading ? 'cursor-wait' : '';

  // Combine all classes
  const buttonClasses = `
    ${baseClasses}
    ${sizeClasses[size] || sizeClasses.md}
    ${variantClasses[variant] || variantClasses.primary}
    ${disabledClasses}
    ${loadingClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // Animation variants
  const buttonVariants = {
    hover: { scale: disabled || loading ? 1 : 1.02 },
    tap: { scale: disabled || loading ? 1 : 0.98 }
  };

  const handleClick = (e) => {
    if (disabled || loading) return;
    onClick?.(e);
  };

  return (
    <motion.button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      variants={buttonVariants}
      whileHover="hover"
      whileTap="tap"
      {...props}
    >
      {/* Loading spinner */}
      {loading && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      )}

      {/* Button content */}
      <motion.span 
        className={`flex items-center gap-2 ${loading ? 'opacity-0' : 'opacity-100'}`}
        animate={{ opacity: loading ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.span>

      {/* Shimmer effect for non-outline variants */}
      {!disabled && !loading && !['outline', 'ghost'].includes(variant) && (
        <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
      )}
    </motion.button>
  );
};

Button.displayName = 'Button';

export default Button;