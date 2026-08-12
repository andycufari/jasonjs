// components/framework/ui/Input.jsx
'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Input = ({ 
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  onFocus,
  onBlur,
  required = false,
  disabled = false,
  error,
  success,
  size = 'md',
  className = '',
  ...props 
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(!!value);

  // Base classes using theme variables
  const baseClasses = 'w-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0';
  
  // Size variants
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm rounded-theme-sm',
    md: 'px-4 py-3 text-base rounded-theme',
    lg: 'px-5 py-4 text-lg rounded-theme-lg'
  };

  // State-based styling using CSS variables
  const getStateClasses = () => {
    if (error) {
      return 'border-error focus:border-error focus:ring-error bg-surface text-error placeholder-error/60';
    }
    if (success) {
      return 'border-success focus:border-success focus:ring-success bg-surface text-text placeholder-textMuted';
    }
    if (isFocused) {
      return 'border-primary focus:border-primary focus:ring-primary bg-surface text-text placeholder-textMuted';
    }
    if (hasValue) {
      return 'border-accent bg-surface text-text placeholder-textMuted';
    }
    return 'border-base hover:border-primary bg-surface text-text placeholder-textMuted';
  };

  // Disabled state
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed bg-hover' : '';

  // Combine all classes
  const inputClasses = `
    ${baseClasses}
    ${sizeClasses[size] || sizeClasses.md}
    ${getStateClasses()}
    ${disabledClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  const handleChange = (e) => {
    const newValue = e.target.value;
    setHasValue(!!newValue);
    onChange?.(e);
  };

  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  // Animation variants
  const focusVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 }
  };

  const labelVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.8 },
    visible: { opacity: 1, y: 0, scale: 1 }
  };

  return (
    <div className="relative">
      {/* Glow effect on focus */}
      <AnimatePresence>
        {isFocused && !disabled && (
          <motion.div
            className="absolute inset-0 bg-primary/10 rounded-theme blur-sm"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Input field */}
      <motion.input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        className={inputClasses}
        whileFocus={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        {...props}
      />

      {/* Floating label */}
      <AnimatePresence>
        {label && (isFocused || hasValue) && (
          <motion.label
            className={`absolute -top-2 left-3 px-2 text-xs rounded ${
              error ? 'bg-error text-white' :
              success ? 'bg-success text-white' :
              'bg-primary text-white'
            }`}
            variants={labelVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
          >
            {label}
            {required && <span className="text-error">*</span>}
          </motion.label>
        )}
      </AnimatePresence>

      {/* Success/Error indicator */}
      <AnimatePresence>
        {(success || error) && hasValue && !isFocused && (
          <motion.div
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className={`w-2 h-2 rounded-full ${
              error ? 'bg-error' : 'bg-success'
            }`} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error/Success message */}
      <AnimatePresence>
        {(error || success) && (
          <motion.p 
            className={`mt-1 text-sm ${error ? 'text-error' : 'text-success'}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {error || success}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

Input.displayName = 'Input';

export default Input;