import React from 'react';

/**
 * Simple loading spinner for inline use
 * Use when you need a small loading indicator
 */
export default function LoadingSpinner({ 
  size = "md", 
  className = "" 
}) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  };

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div className={`animate-spin rounded-full border-b-2 border-primary ${sizeClasses[size]}`}></div>
    </div>
  );
}

LoadingSpinner.displayName = 'LoadingSpinner';
LoadingSpinner.isFrameworkComponent = true;