// components/ButtonEffect.jsx

'use client';

import React, { useEffect, useRef } from 'react';

const ButtonEffect = ({ children, type }) => {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (type === 'cosmic') {
      const button = buttonRef.current;
      const handleMouseMove = (e) => {
        const { left, top } = button.getBoundingClientRect();
        const x = e.clientX - left;
        const y = e.clientY - top;
        button.style.setProperty('--x', `${x}px`);
        button.style.setProperty('--y', `${y}px`);
      };
      button.addEventListener('mousemove', handleMouseMove);
      return () => button.removeEventListener('mousemove', handleMouseMove);
    }
  }, [type]);

  const effectStyles = {
    shimmer: 'animate-shimmer',
    cosmic: 'before:content-[""] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-100%] before:hover:translate-x-[100%] before:transition-transform before:duration-1000 before:ease-out'
  };

  return (
    <span ref={buttonRef} className={`${effectStyles[type] || ''} block`}>
      {children}
    </span>
  );
};

export default ButtonEffect;