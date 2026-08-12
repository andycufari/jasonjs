'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

const getStorageKey = () => {
  if (typeof window === 'undefined') return 'ss_access_validated';
  const domain = window.location.hostname;
  return `ss_access_validated_${domain}`;
};

const SimpleLock = ({ 
  children, 
  config = {
    backgroundColor: 'bg-background',
    textColor: 'text-text',
    logo: null,
    buttonClasses: 'bg-primary border border-white text-white hover:bg-primary/90',
    title: '🔒 This page is Private, enter password',
    api: '/api/validate_access'
  }
}) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check validation on mount
    const key = getStorageKey();
    const storedData = localStorage.getItem(key);
    
    if (storedData) {
      try {
        const { expiration, validated } = JSON.parse(storedData);
        const now = new Date().getTime();
        
        if (validated && now < expiration) {
          setIsUnlocked(true);
        } else {
          // Clear expired validation
          localStorage.removeItem(key);
        }
      } catch (err) {
        console.error('Error parsing stored validation:', err);
        localStorage.removeItem(key);
      }
    }
  }, []); // Empty dependency array for mount only

  const storeValidation = () => {
    try {
      const key = getStorageKey();
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7); // 7 days from now
      
      const validationData = {
        validated: true,
        expiration: expirationDate.getTime(),
        domain: window.location.hostname,
        timestamp: new Date().getTime()
      };

      localStorage.setItem(key, JSON.stringify(validationData));
    } catch (err) {
      console.error('Error storing validation:', err);
    }
  };

  const logoConfig = config.logo ? {
    src: '',
    height: 64,
    alt: 'Logo',
    ...config.logo
  } : null;

  const api = config.api || '/api/validate_access';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          action: 'validate'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Network response was not ok');
      }

      if (data.validated || data.success) {
        storeValidation();
        setIsUnlocked(true);
      } else {
        setError('Invalid password. Please try again.');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className={`min-h-screen ${config.backgroundColor} ${config.textColor} flex items-center justify-center`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 space-y-8"
      >
        {logoConfig && logoConfig.src && (
          <div className="flex justify-center">
            <Image
              src={logoConfig.src}
              alt={logoConfig.alt}
              height={logoConfig.height}
              width={logoConfig.height * 2}
              className="object-contain"
            />
          </div>
        )}

        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-semibold text-center mb-6"
        >
          {config.title}
        </motion.h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <motion.input
              whileFocus={{ scale: 1.02 }}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-2 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-500 text-sm text-center"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isLoading || !password}
            className={`w-full py-2 rounded-lg transition-all duration-200 ${config.buttonClasses} 
              ${(isLoading || !password) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mx-auto"
              />
            ) : (
              'Access'
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default SimpleLock;
