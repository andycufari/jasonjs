'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// Create context for loading progress
const LoadingProgressContext = createContext(null);

/**
 * LoadingProgressProvider - Unified loading indicator for dynamic components
 *
 * Provides a global top-border progress bar that shows when components are loading.
 * Features:
 * - 200ms delay before showing (fast loads show nothing)
 * - Indeterminate progress animation
 * - Uses site's primary color
 * - Automatically tracks multiple loading components
 */
export default function LoadingProgressProvider({ children }) {
  const [loadingCount, setLoadingCount] = useState(0);
  const [showBar, setShowBar] = useState(false);
  const timerRef = useRef(null);

  // Register a component as loading
  const register = useCallback(() => {
    setLoadingCount(c => c + 1);
  }, []);

  // Unregister a component when done loading
  const unregister = useCallback(() => {
    setLoadingCount(c => Math.max(0, c - 1));
  }, []);

  // Handle delay logic for showing the progress bar
  useEffect(() => {
    if (loadingCount > 0) {
      // Start timer to show bar after delay
      timerRef.current = setTimeout(() => {
        setShowBar(true);
      }, 150); // 150ms delay - fast loads won't show the bar
    } else {
      // Clear timer and hide bar when nothing is loading
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setShowBar(false);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [loadingCount]);

  const contextValue = {
    register,
    unregister,
    isLoading: loadingCount > 0
  };

  return (
    <LoadingProgressContext.Provider value={contextValue}>
      {/* Progress bar - fixed at top of viewport */}
      {showBar && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] h-[3px] overflow-hidden"
          style={{ backgroundColor: 'hsl(var(--primary, 220 90% 56%) / 0.15)' }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Loading content"
        >
          {/* Animated progress indicator */}
          <div
            className="h-full w-1/3 animate-progress-indeterminate"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary, 220 90% 56%)) 50%, transparent 100%)'
            }}
          />
        </div>
      )}
      {children}
    </LoadingProgressContext.Provider>
  );
}

/**
 * Hook to register/unregister components with the loading progress system
 *
 * @returns {{ register: () => void, unregister: () => void, isLoading: boolean }}
 */
export function useLoadingProgress() {
  const context = useContext(LoadingProgressContext);

  if (!context) {
    // Fallback for components outside provider (e.g., during SSR or testing)
    return {
      register: () => {},
      unregister: () => {},
      isLoading: false
    };
  }

  return context;
}
