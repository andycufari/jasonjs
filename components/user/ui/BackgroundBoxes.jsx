// components/landing/backgrounds/BackgroundBoxes.jsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';

const BackgroundBoxes = ({ image, children }) => {
  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden">
      {image && (
        <img
          src={image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
      )}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1)_0%,transparent_100%)]" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default BackgroundBoxes;
