// components/framework/ui/Card.jsx
'use client';
import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ 
  children,
  variant = 'default',
  size = 'md',
  hover = true,
  className = '',
  onClick,
  ...props 
}) => {
  // Base classes using theme variables
  const baseClasses = 'bg-surface border border-base transition-all duration-200';
  
  // Size variants
  const sizeClasses = {
    sm: 'p-4 rounded-theme-sm',
    md: 'p-6 rounded-theme',
    lg: 'p-8 rounded-theme-lg',
    xl: 'p-10 rounded-theme-lg'
  };

  // Variant classes
  const variantClasses = {
    default: 'shadow-theme',
    elevated: 'shadow-theme-lg',
    outlined: 'border-2 border-base shadow-none',
    primary: 'bg-primary text-white border-primary shadow-theme',
    secondary: 'bg-secondary text-white border-secondary shadow-theme',
    success: 'bg-success text-white border-success shadow-theme',
    warning: 'bg-warning text-white border-warning shadow-theme',
    error: 'bg-error text-white border-error shadow-theme'
  };

  // Hover effects
  const hoverClasses = hover ? 'hover:shadow-theme-lg hover:border-primary/50 hover:-translate-y-1' : '';

  // Interactive state
  const interactiveClasses = onClick ? 'cursor-pointer' : '';

  // Combine all classes
  const cardClasses = `
    ${baseClasses}
    ${sizeClasses[size] || sizeClasses.md}
    ${variantClasses[variant] || variantClasses.default}
    ${hoverClasses}
    ${interactiveClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // Animation variants
  const cardVariants = {
    hover: { 
      scale: hover ? 1.02 : 1,
      y: hover ? -4 : 0
    },
    tap: { 
      scale: onClick ? 0.98 : 1 
    }
  };

  const CardComponent = onClick ? motion.div : motion.div;

  return (
    <CardComponent
      className={cardClasses}
      onClick={onClick}
      variants={cardVariants}
      whileHover={hover ? "hover" : undefined}
      whileTap={onClick ? "tap" : undefined}
      layout
      {...props}
    >
      {children}
    </CardComponent>
  );
};

// Card sub-components for better composition
const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
);

const CardTitle = ({ children, className = '', as: Component = 'h3', ...props }) => (
  <Component className={`font-heading font-semibold text-lg text-text mb-2 ${className}`} {...props}>
    {children}
  </Component>
);

const CardDescription = ({ children, className = '', ...props }) => (
  <p className={`text-textSecondary ${className}`} {...props}>
    {children}
  </p>
);

const CardContent = ({ children, className = '', ...props }) => (
  <div className={`${className}`} {...props}>
    {children}
  </div>
);

const CardFooter = ({ children, className = '', ...props }) => (
  <div className={`mt-4 pt-4 border-t border-borderLight ${className}`} {...props}>
    {children}
  </div>
);

// Attach sub-components
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;

Card.displayName = 'Card';

export default Card;