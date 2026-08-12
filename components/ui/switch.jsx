import React from 'react';

const Switch = React.forwardRef(({ 
  className = '', 
  checked = false, 
  onCheckedChange, 
  disabled = false,
  checkOnClassName = '',
  checkOffClassName = '',
  ...props 
}, ref) => {
  const handleChange = (e) => {
    if (onCheckedChange && !disabled) {
      onCheckedChange(e.target.checked);
    }
  };

  return (
    <label 
      className={`
        inline-flex items-center cursor-pointer
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `.trim()}
    >
      <div className="relative">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
        <div 
          className={`
            w-11 h-6 rounded-full transition-colors duration-200 ease-in-out
            ${checked 
              ? (checkOnClassName || 'bg-blue-600')
              : (checkOffClassName || 'bg-gray-300')
            }
            ${disabled ? 'opacity-50' : ''}
            border border-gray-400
          `.trim()}
        >
          <div 
            className={`
              absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-lg
              transform transition-transform duration-200 ease-in-out
              ${checked ? 'translate-x-5' : 'translate-x-0'}
              border border-gray-200
            `.trim()}
          />
        </div>
      </div>
    </label>
  );
});

Switch.displayName = 'Switch';

export { Switch };