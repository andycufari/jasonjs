// TextInput.jsx - Enhanced text input component
'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

/**
 * Enhanced text input component
 */
export default function TextInput({
  id,
  name,
  value = '',
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
  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log(`TextInput [${name}]:`, { value, type: fieldSchema.type, label: fieldSchema.label });
  }
  const {
    label,
    placeholder,
    help,
    required = false,
    maxLength,
    minLength,
    pattern,
    type = 'text',
    autoComplete,
    autoFocus = false,
    readOnly = false
  } = fieldSchema;

  const inputId = id || name;
  const showError = error && touched;
  const isDisabled = disabled || readOnly;


  const handleChange = (e) => {
    const newValue = e.target.value;
    
    // Enforce maxLength if specified
    if (maxLength && newValue.length > maxLength) {
      return;
    }
    
    if (onChange) {
      onChange(newValue);
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

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {showLabel && label && (
        <Label htmlFor={inputId} className="flex items-center gap-1">
          {label}
          {required && (
            <span className="text-red-500 text-sm">*</span>
          )}
        </Label>
      )}

      {/* Input */}
      <Input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={isDisabled}
        readOnly={readOnly}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        pattern={pattern}
        minLength={minLength}
        maxLength={maxLength}
        className={showError ? 'border-red-500 focus:border-red-500' : ''}
        aria-invalid={showError}
        aria-describedby={
          showError ? `${inputId}-error` : 
          help ? `${inputId}-help` : undefined
        }
        {...props}
      />

      {/* Character counter */}
      {maxLength && (
        <div className="text-xs text-muted-foreground text-right">
          {value.length}/{maxLength}
        </div>
      )}

      {/* Error message */}
      {showError && (
        <div 
          id={`${inputId}-error`}
          className="text-red-500 text-sm flex items-center gap-1"
          role="alert"
        >
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Help text */}
      {help && !showError && (
        <div
          id={`${inputId}-help`}
          className="text-muted-foreground text-sm"
        >
          {help}
        </div>
      )}
    </div>
  );
}