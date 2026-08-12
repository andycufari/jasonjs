// components/landing/backgrounds/AuroraBackground.jsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';

const AuroraBackground = ({ image, children }) => {
  return (
    <div className="relative w-full h-full">
      {image && (
        <img
          src={image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-75" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default AuroraBackground;