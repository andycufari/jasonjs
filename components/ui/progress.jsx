import React from 'react';

const Progress = React.forwardRef(({
  className = '',
  value = 0,
  max = 100,
  indicatorClassName = '',
  ...props
}, ref) => {
  // Ensure value is within bounds
  const normalizedValue = Math.min(Math.max(0, value), max);
  const percentage = (normalizedValue / max) * 100;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={normalizedValue}
      className={`
        relative h-2 w-full overflow-hidden rounded-full bg-gray-200
        ${className}
      `.trim()}
      {...props}
    >
      <div
        className={`
          h-full bg-blue-600 transition-all duration-300 ease-in-out
          ${indicatorClassName}
        `.trim()}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
});

Progress.displayName = 'Progress';

export { Progress };
