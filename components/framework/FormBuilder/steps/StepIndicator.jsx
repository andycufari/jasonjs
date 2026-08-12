// StepIndicator.jsx - Progress indicator for step-by-step forms
'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * StepIndicator - Visual progress indicator for multi-step forms
 *
 * Variants:
 * - dots: Simple dot indicators (default, Typeform-style)
 * - progress: Progress bar
 * - numbers: Numbered steps
 * - none: No indicator
 */
export default function StepIndicator({
  currentStep,
  totalSteps,
  variant = 'dots',
  className = '',
  theme = {}
}) {
  const {
    activeColor = 'bg-primary',
    inactiveColor = 'bg-gray-300 dark:bg-gray-600',
    completedColor = 'bg-primary',
    textColor = 'text-gray-600 dark:text-gray-400'
  } = theme;

  if (variant === 'none' || totalSteps <= 1) {
    return null;
  }

  // Dots variant (Typeform-style)
  if (variant === 'dots') {
    return (
      <div className={`flex items-center justify-center gap-2 ${className}`}>
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <motion.div
              key={stepNumber}
              className={`
                rounded-full transition-all duration-300
                ${isActive
                  ? `w-8 h-2 ${activeColor}`
                  : isCompleted
                    ? `w-2 h-2 ${completedColor}`
                    : `w-2 h-2 ${inactiveColor}`
                }
              `}
              initial={false}
              animate={{
                scale: isActive ? 1 : 0.9,
                opacity: isActive ? 1 : isCompleted ? 0.8 : 0.5
              }}
              transition={{ duration: 0.2 }}
            />
          );
        })}
      </div>
    );
  }

  // Progress bar variant
  if (variant === 'progress') {
    const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;

    return (
      <div className={`w-full ${className}`}>
        <div className={`h-1 w-full rounded-full ${inactiveColor}`}>
          <motion.div
            className={`h-full rounded-full ${activeColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <div className={`mt-2 text-sm text-center ${textColor}`}>
          {currentStep} / {totalSteps}
        </div>
      </div>
    );
  }

  // Numbers variant
  if (variant === 'numbers') {
    return (
      <div className={`flex items-center justify-center gap-1 ${className}`}>
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <React.Fragment key={stepNumber}>
              <motion.div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  transition-colors duration-300
                  ${isActive
                    ? `${activeColor} text-white`
                    : isCompleted
                      ? `${completedColor} text-white`
                      : `${inactiveColor} ${textColor}`
                  }
                `}
                initial={false}
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stepNumber
                )}
              </motion.div>
              {index < totalSteps - 1 && (
                <div
                  className={`
                    w-8 h-0.5 transition-colors duration-300
                    ${isCompleted ? completedColor : inactiveColor}
                  `}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return null;
}

StepIndicator.displayName = 'StepIndicator';
