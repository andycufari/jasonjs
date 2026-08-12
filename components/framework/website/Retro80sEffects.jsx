'use client';

import React from 'react';

export default function Retro80sEffects({ children, className = "", ...props }) {
  return (
    <div className={`relative ${className}`} {...props}>
      {/* Retro scan lines effect */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-10">
        <div className="h-full w-full bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent animate-pulse"></div>
      </div>
      
      {/* CRT vignette effect */}
      <div 
        className="absolute inset-0 pointer-events-none z-20 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 70%, rgba(0, 0, 0, 0.3) 100%)'
        }}
      ></div>
      
      {children}
    </div>
  );
}

Retro80sEffects.displayName = 'Retro80sEffects';