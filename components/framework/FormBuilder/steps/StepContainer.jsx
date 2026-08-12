// StepContainer.jsx - Container for individual form steps
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Animation variants for Typeform-style transitions
 */
const variants = {
  // Slide up animation (Typeform default)
  slideUp: {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -40 }
  },
  // Slide horizontal
  slideHorizontal: {
    initial: (direction) => ({ opacity: 0, x: direction > 0 ? 100 : -100 }),
    animate: { opacity: 1, x: 0 },
    exit: (direction) => ({ opacity: 0, x: direction > 0 ? -100 : 100 })
  },
  // Fade only
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  // Scale + fade
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 }
  },
  // None (instant)
  none: {
    initial: {},
    animate: {},
    exit: {}
  }
};

/**
 * StepContainer - Animated container for form step content
 *
 * Layout:
 * [Image (optional)]
 * [Title]
 * [Subtitle]
 * [Fields]
 * [Navigation]
 */
export default function StepContainer({
  step,
  stepIndex,
  direction = 1,
  animation = 'slideUp',
  children,
  className = '',
  theme = {}
}) {
  const {
    titleClass = 'text-2xl md:text-3xl font-bold text-gray-900 dark:text-white',
    subtitleClass = 'text-base md:text-lg text-gray-600 dark:text-gray-400 mt-2',
    imageClass = 'w-full max-w-md mx-auto rounded-lg shadow-lg',
    containerClass = '',
    contentClass = ''
  } = theme;

  const variant = variants[animation] || variants.slideUp;
  const isCustomDirection = animation === 'slideHorizontal';

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={stepIndex}
        custom={isCustomDirection ? direction : undefined}
        initial={isCustomDirection ? variant.initial(direction) : variant.initial}
        animate={variant.animate}
        exit={isCustomDirection ? variant.exit(direction) : variant.exit}
        transition={{
          duration: animation === 'none' ? 0 : 0.4,
          ease: [0.25, 0.46, 0.45, 0.94] // Smooth easing
        }}
        className={`w-full ${containerClass} ${className}`}
      >
        <div className={`flex flex-col items-center text-center ${contentClass}`}>
          {/* Image */}
          {step?.image && (
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              {typeof step.image === 'string' ? (
                <img
                  src={step.image}
                  alt={step.title || `Step ${stepIndex + 1}`}
                  className={step.imageClass || imageClass}
                />
              ) : (
                // Support for React component as image
                step.image
              )}
            </motion.div>
          )}

          {/* Title */}
          {step?.title && (
            <motion.h2
              className={step.titleClass || titleClass}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              {step.title}
            </motion.h2>
          )}

          {/* Subtitle */}
          {step?.subtitle && (
            <motion.p
              className={step.subtitleClass || subtitleClass}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              {step.subtitle}
            </motion.p>
          )}

          {/* Fields container */}
          <motion.div
            className="w-full mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

StepContainer.displayName = 'StepContainer';

/**
 * Export animation variant names for documentation
 */
export const ANIMATION_VARIANTS = Object.keys(variants);
