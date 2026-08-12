// components/landing/backgrounds/BackgroundBeamsWithCollision.jsx
'use client';

import React from 'react';

const BackgroundBeamsWithCollision = ({ image, children }) => {
  return (
    <div className="relative w-full h-full bg-neutral-950">
      {image && (
        <img
          src={image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
      )}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_100%)]" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default BackgroundBeamsWithCollision;