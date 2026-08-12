'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, CalendarDays } from 'lucide-react';

/**
 * DateInput Component - Simple and beautiful native date picker
 */
export default function DateInput({
  id,
  name,
  value = '',
  onChange,
  onBlur,
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
    placeholder,
    help,
    required = false,
    type = 'date', // 'date', 'datetime-local', 'time'
    min,
    max
  } = fieldSchema;

  const inputId = id || name;
  const showError = error && touched;

  // Format value for HTML input
  const getInputValue = () => {
    if (!value) return '';

    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';

      switch (type) {
        case 'datetime-local':
          // Format: YYYY-MM-DDTHH:MM
          return date.toISOString().slice(0, 16);
        case 'time':
          // Format: HH:MM
          return date.toTimeString().slice(0, 5);
        case 'date':
        default:
          // Format: YYYY-MM-DD
          return date.toISOString().slice(0, 10);
      }
    } catch {
      return '';
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value;

    if (!newValue) {
      onChange('');
      return;
    }

    try {
      // Convert to ISO string for consistent storage
      const date = new Date(newValue);
      if (!isNaN(date.getTime())) {
        onChange(date.toISOString());
      } else {
        onChange(newValue);
      }
    } catch {
      onChange(newValue);
    }
  };

  // Get icon based on type
  const getIcon = () => {
    switch (type) {
      case 'time':
        return Clock;
      case 'datetime-local':
        return CalendarDays;
      default:
        return Calendar;
    }
  };

  const Icon = getIcon();

  // Get placeholder
  const getPlaceholder = () => {
    if (placeholder) return placeholder;

    switch (type) {
      case 'time':
        return 'Select time';
      case 'datetime-local':
        return 'Select date and time';
      default:
        return 'Select date';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {showLabel && label && (
        <Label htmlFor={inputId} className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-500" />
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>
      )}

      {/* Date Input */}
      <div className="relative">
        <Input
          id={inputId}
          name={name}
          type={type}
          value={getInputValue()}
          onChange={handleChange}
          onBlur={onBlur}
          placeholder={getPlaceholder()}
          disabled={disabled}
          min={min}
          max={max}
          className={`${showError ? 'border-red-500' : ''} [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
          aria-invalid={showError}
          aria-describedby={showError ? `${inputId}-error` : help ? `${inputId}-help` : undefined}
          {...props}
        />
      </div>

      {/* Error message */}
      {showError && (
        <p id={`${inputId}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Help text */}
      {help && !showError && (
        <p id={`${inputId}-help`} className="text-sm text-gray-500">
          {help}
        </p>
      )}
    </div>
  );
}