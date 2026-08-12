// components/Button.jsx
'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from "@/lib/utils";

const Button = ({ 
  href, 
  type = 'default', 
  size = 'md',
  bgColor = 'bg-primary', 
  textColor = 'text-white', 
  children, 
  className = '', 
  ...props 
}) => {
  const baseStyles = 'rounded-md font-semibold transition duration-200';

  const typeStyles = {
    default: 'hover:opacity-80',
    outline: 'border border-current bg-transparent',
    ghost: 'bg-transparent hover:bg-opacity-10',
    sketch: 'border border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0)]',
    gradient: 'bg-gradient-to-r hover:opacity-90',
    shimmer: 'animate-shimmer bg-[linear-gradient(110deg,#000103,45%,#1e2631,55%,#000103)] bg-[length:200%_100%] border border-slate-800',
    figma: 'shadow-[0_0_0_3px_#000000_inset] bg-transparent border border-white dark:border-white dark:text-white text-black rounded-lg font-bold transform hover:-translate-y-1 transition duration-400',
    spotify:'px-12 py-4 rounded-full font-bold text-white tracking-widest uppercase transform hover:scale-105 hover:bg-[#21e065] transition-colors duration-200'
  };

  const sizeStyles = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl',
    '2xl': 'px-10 py-5 text-2xl',
  };

  const buttonStyles = `${baseStyles} ${typeStyles[type]} ${sizeStyles[size]} ${bgColor} ${textColor} ${className}`;

  if (href) {
    return (
      <Link href={href} className={buttonStyles} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cn(buttonStyles, className)} {...props}>
      {children}
    </button>
  );
};

export default Button;