// components/landing/backgrounds/BackgroundBeams.jsx
'use client';

import React from 'react';

const BackgroundBeams = ({ image, children }) => {
  return (
    <div className="relative w-full h-full bg-neutral-950">
      {image && (
        <img
          src={image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
      )}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default BackgroundBeams;