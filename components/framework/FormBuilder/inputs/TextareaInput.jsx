// TextareaInput.jsx - Enhanced textarea with auto-resize and character counter
'use client';

import React, { useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { useFormBuilderLanguage } from '../i18n/useFormBuilderLanguage';

/**
 * Enhanced textarea input component with auto-resize
 */
export default function TextareaInput({
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
  language = null, // Accept language prop from FormBuilder
  ...props
}) {
  const textareaRef = useRef(null);

  // i18n hook for translations
  const { t } = useFormBuilderLanguage(language);

  const {
    label,
    placeholder,
    help,
    required = false,
    maxLength,
    minLength,
    rows = 4,
    autoResize = true,
    showCounter = true
  } = fieldSchema;

  const inputId = id || name;
  const showError = error && touched;
  const isDisabled = disabled || fieldSchema.readOnly;


  // Auto-resize functionality
  useEffect(() => {
    if (autoResize && textareaRef.current) {
      const textarea = textareaRef.current;
      
      const adjustHeight = () => {
        textarea.style.height = 'auto';
        const newHeight = Math.max(
          textarea.scrollHeight,
          parseInt(rows) * 24 // Minimum height based on rows
        );
        textarea.style.height = `${newHeight}px`;
      };
      
      adjustHeight();
      
      // Adjust height on value change
      const observer = new ResizeObserver(adjustHeight);
      observer.observe(textarea);
      
      return () => observer.disconnect();
    }
  }, [value, autoResize, rows]);

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

  const characterCount = value ? value.length : 0;
  const isNearLimit = maxLength && characterCount > maxLength * 0.8;
  const isOverLimit = maxLength && characterCount > maxLength;

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

      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        id={inputId}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={isDisabled}
        rows={autoResize ? undefined : rows}
        minLength={minLength}
        maxLength={maxLength}
        className={`${showError ? 'border-red-500 focus:border-red-500' : ''} ${
          autoResize ? 'resize-none overflow-hidden' : ''
        }`}
        style={autoResize ? { minHeight: `${rows * 24}px` } : undefined}
        aria-invalid={showError}
        aria-describedby={
          showError ? `${inputId}-error` : 
          help ? `${inputId}-help` : undefined
        }
        {...props}
      />

      {/* Character counter and metadata */}
      <div className="flex justify-between items-center text-xs">
        {/* Word/character count */}
        <div className="text-muted-foreground">
          {value && typeof value === 'string' && (
            <>
              <span>{value.trim().split(/\s+/).filter(Boolean).length} {t('textareaInput.words')}</span>
              {showCounter && maxLength && (
                <span className="ml-2">•</span>
              )}
            </>
          )}
        </div>

        {/* Character counter */}
        {showCounter && maxLength && (
          <div className={`font-medium ${
            isOverLimit ? 'text-red-500' :
            isNearLimit ? 'text-amber-500' :
            'text-muted-foreground'
          }`}>
            {characterCount}/{maxLength}
          </div>
        )}
      </div>

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