'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * PriceInput Component - Simple text input with currency symbol and basic validation
 */
export default function PriceInput({
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
    symbol = '$',
    allowDecimals = true,
    thousandsSeparator = ',', // ',' or '.' for thousands
    decimalSeparator = '.'    // '.' or ',' for decimals
  } = fieldSchema;

  const inputId = id || name;
  const showError = error && touched;

  const formatNumber = (num) => {
    if (num === '' || num === undefined || num === null) return '';

    const numStr = num.toString();
    const parts = numStr.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

    if (parts.length > 1 && allowDecimals) {
      return integerPart + decimalSeparator + parts[1];
    }

    return integerPart;
  };

  const parseFormattedNumber = (formatted) => {
    if (!formatted) return '';

    // Remove thousands separators and replace decimal separator with '.'
    let cleaned = formatted
      .replace(new RegExp('\\' + thousandsSeparator, 'g'), '')
      .replace(new RegExp('\\' + decimalSeparator, 'g'), '.');

    // Remove everything except numbers, decimal point, and minus sign
    cleaned = cleaned.replace(/[^0-9.-]/g, '');

    return cleaned;
  };

  const handleChange = (e) => {
    const inputValue = e.target.value;

    // Allow empty input
    if (inputValue === '') {
      onChange('');
      return;
    }

    // Parse the formatted input
    let cleaned = parseFormattedNumber(inputValue);

    // Handle decimal places
    if (!allowDecimals) {
      cleaned = cleaned.replace(/\./g, '');
    } else {
      // Allow only one decimal point
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('');
      }
    }

    // Store the raw numeric value
    onChange(cleaned);
  };

  const handleBlur = (e) => {
    // Convert to number on blur if it's a valid number
    if (value !== '' && value !== undefined) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        onChange(numValue);
      }
    }

    if (onBlur) {
      onBlur(e);
    }
  };

  // Display value - format with thousands separators
  const displayValue = formatNumber(value);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {showLabel && label && (
        <Label htmlFor={inputId}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      {/* Input with currency symbol */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
          {symbol}
        </span>
        <Input
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder || (allowDecimals ? '0.00' : '0')}
          disabled={disabled}
          className={`pl-8 ${showError ? 'border-red-500' : ''}`}
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