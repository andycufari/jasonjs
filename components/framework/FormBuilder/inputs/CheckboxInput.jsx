// CheckboxInput.jsx - Enhanced checkbox input component
'use client';

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

/**
 * Enhanced checkbox input component
 */
export default function CheckboxInput({
  id,
  name,
  value = false,
  onChange,
  onBlur,
  onFocus,
  fieldSchema = {},
  error = null,
  touched = false,
  disabled = false,
  className = '',
  showLabel = true,
  ...props
}) {
  const {
    label,
    checkboxLabel, // Specific label for the checkbox (different from field label)
    help,
    required = false,
    variant = 'default', // 'default', 'card', 'switch'
    size = 'default', // 'sm', 'default', 'lg'
    color = 'blue' // 'blue', 'green', 'red', etc.
  } = fieldSchema;

  const inputId = id || name;
  const showError = error && touched;
  const isDisabled = disabled || fieldSchema.readOnly;
  const isChecked = Boolean(value);

  const handleChange = (checked) => {
    if (onChange) {
      onChange(checked);
    }
  };

  const handleBlur = (e) => {
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleFocus = (e) => {
    if (onFocus) {
      onFocus(e);
    }
  };

  // Get checkbox size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-3 w-3';
      case 'lg':
        return 'h-6 w-6';
      default:
        return 'h-4 w-4';
    }
  };

  // Get color classes
  const getColorClasses = () => {
    const baseClasses = 'border-2 focus:ring-2 focus:ring-offset-2';
    
    switch (color) {
      case 'green':
        return `${baseClasses} border-green-300 text-green-600 focus:border-green-500 focus:ring-green-500`;
      case 'red':
        return `${baseClasses} border-red-300 text-red-600 focus:border-red-500 focus:ring-red-500`;
      case 'yellow':
        return `${baseClasses} border-yellow-300 text-yellow-600 focus:border-yellow-500 focus:ring-yellow-500`;
      case 'purple':
        return `${baseClasses} border-purple-300 text-purple-600 focus:border-purple-500 focus:ring-purple-500`;
      default:
        return `${baseClasses} border-blue-300 text-blue-600 focus:border-blue-500 focus:ring-blue-500`;
    }
  };

  if (variant === 'card') {
    // Card variant - checkbox styled as a card
    return (
      <div className={`space-y-2 ${className}`}>
        {/* Main Label */}
        {showLabel && label && (
          <Label className="flex items-center gap-1 font-medium">
            {label}
            {required && (
              <span className="text-red-500 text-sm">*</span>
            )}
          </Label>
        )}

        {/* Card Checkbox */}
        <div
          className={`
            relative p-4 border-2 rounded-lg cursor-pointer transition-all
            ${isChecked 
              ? `bg-${color}-50 border-${color}-500` 
              : 'bg-white border-gray-200 hover:border-gray-300'
            }
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${showError ? 'border-red-500' : ''}
          `}
          onClick={() => !isDisabled && handleChange(!isChecked)}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              id={inputId}
              name={name}
              checked={isChecked}
              onCheckedChange={handleChange}
              onBlur={handleBlur}
              onFocus={handleFocus}
              disabled={isDisabled}
              className={`${getSizeClasses()} ${getColorClasses()}`}
              aria-invalid={showError}
              {...props}
            />
            
            <div className="flex-1">
              <Label 
                htmlFor={inputId}
                className="cursor-pointer font-medium"
              >
                {checkboxLabel || label}
              </Label>
              {help && (
                <p className="text-sm text-gray-600 mt-1">
                  {help}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {showError && (
          <div className="text-red-500 text-sm flex items-center gap-1">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Main Label (only if a separate checkboxLabel is provided) */}
      {showLabel && label && checkboxLabel && label !== checkboxLabel && (
        <Label className="flex items-center gap-1 font-medium">
          {label}
          {required && (
            <span className="text-red-500 text-sm">*</span>
          )}
        </Label>
      )}

      {/* Checkbox with Label */}
      <div className="flex items-start gap-3">
        <Checkbox
          id={inputId}
          name={name}
          checked={isChecked}
          onCheckedChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          disabled={isDisabled}
          className={`
            ${getSizeClasses()} ${getColorClasses()}
            ${showError ? 'border-red-500' : ''}
          `}
          aria-invalid={showError}
          aria-describedby={
            showError ? `${inputId}-error` : 
            help ? `${inputId}-help` : undefined
          }
          {...props}
        />
        
        <div className="flex-1">
          <Label 
            htmlFor={inputId}
            className={`cursor-pointer ${size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : ''}`}
          >
            {checkboxLabel || label}
            {required && !label && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </Label>
          
          {/* Help text */}
          {help && !showError && (
            <div 
              id={`${inputId}-help`}
              className={`text-gray-500 mt-1 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
            >
              {help}
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {showError && (
        <div 
          id={`${inputId}-error`}
          className="text-red-500 text-sm flex items-center gap-1 ml-7"
          role="alert"
        >
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}