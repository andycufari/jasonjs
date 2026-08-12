// PhoneInput.jsx - International phone number input with validation
'use client';

import React from 'react';
import PhoneNumberInput from 'react-phone-number-input/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Phone } from 'lucide-react';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import { formatPhoneNumber } from '../utils/formatting';
import { useFormBuilderLanguage } from '../i18n/useFormBuilderLanguage';

/**
 * International phone input component
 */
export default function PhoneInput({
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
  language = null, // Optional language override
  ...props
}) {
  // i18n hook
  const { t, section } = useFormBuilderLanguage(language);
  const phoneTranslations = section('phoneInput');

  const {
    label,
    placeholder = t('phoneInput.placeholder'),
    help,
    required = false,
    defaultCountry = 'AR',
    showIcon = true,
    format = 'international' // 'international', 'national', 'e164'
  } = fieldSchema;

  const inputId = id || name;
  const showError = error && touched;
  const isDisabled = disabled || fieldSchema.readOnly;

  const handleChange = (newValue) => {
    if (onChange) {
      onChange(newValue || '');
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

  // Get formatted display value
  const getDisplayValue = () => {
    if (!value) return '';
    
    try {
      const phoneNumber = parsePhoneNumber(value);
      if (!phoneNumber) return value;
      
      switch (format) {
        case 'national':
          return phoneNumber.formatNational();
        case 'e164':
          return phoneNumber.format('E.164');
        case 'international':
        default:
          return phoneNumber.formatInternational();
      }
    } catch (error) {
      return value;
    }
  };

  // Get validation status
  const getValidationInfo = () => {
    if (!value) return null;
    
    try {
      const isValid = isValidPhoneNumber(value);
      const phoneNumber = parsePhoneNumber(value);
      
      return {
        isValid,
        country: phoneNumber?.country,
        nationalNumber: phoneNumber?.nationalNumber,
        type: phoneNumber?.getType()
      };
    } catch (error) {
      return { isValid: false };
    }
  };

  const validationInfo = getValidationInfo();

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {showLabel && label && (
        <Label htmlFor={inputId} className="flex items-center gap-1">
          {showIcon && <Phone className="h-4 w-4" />}
          {label}
          {required && (
            <span className="text-red-500 text-sm">*</span>
          )}
        </Label>
      )}

      {/* Phone Input Container */}
      <div className="relative">
        <PhoneNumberInput
          id={inputId}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          defaultCountry={defaultCountry}
          placeholder={placeholder}
          disabled={isDisabled}
          className={`
            w-full px-3 py-2 border rounded-md text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${showError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}
          `}
          aria-invalid={showError}
          aria-describedby={
            showError ? `${inputId}-error` : 
            help ? `${inputId}-help` : undefined
          }
          {...props}
        />
        
        {/* Validation indicator */}
        {value && validationInfo && !showError && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {validationInfo.isValid ? (
              <div className="w-2 h-2 bg-green-500 rounded-full" title={t('phoneInput.validNumber')} />
            ) : (
              <div className="w-2 h-2 bg-red-500 rounded-full" title={t('phoneInput.invalidNumber')} />
            )}
          </div>
        )}
      </div>

      {/* Phone info display */}
      {value && validationInfo?.isValid && !showError && (
        <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded">
          <div className="flex items-center justify-between">
            <span>
              {validationInfo.country && (
                <span className="font-medium">
                  {getCountryName(validationInfo.country, phoneTranslations.countryNames)}
                </span>
              )}
            </span>
            <span className="text-green-600">
              ✓ {t('phoneInput.validNumber')}
            </span>
          </div>
          {format !== 'international' && (
            <div className="mt-1 text-gray-500">
              Formato internacional: {formatPhoneNumber(value)}
            </div>
          )}
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
          className="text-gray-500 text-sm"
        >
          {help}
        </div>
      )}
    </div>
  );
}

/**
 * Get country name from country code
 */
function getCountryName(countryCode, countryNames = {}) {
  return countryNames[countryCode] || countryCode;
}