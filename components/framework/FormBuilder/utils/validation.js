// validation.js - FormBuilder validation utilities
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import { translate } from '../i18n/useFormBuilderLanguage';

/**
 * Validate a field value against its schema definition
 * @param {string} fieldName - Field name for error messages
 * @param {any} value - Field value to validate
 * @param {Object} fieldSchema - Schema definition for the field
 * @param {string} lang - Optional language override
 * @returns {string|null} Error message or null if valid
 */
export function validateField(fieldName, value, fieldSchema, lang = null) {
  if (!fieldSchema) return null;

  const displayName = fieldSchema.label || fieldName;

  // Required validation
  if (fieldSchema.required && (!value || value.toString().trim() === '')) {
    return translate('validation.required', { field: displayName }, lang);
  }

  // Skip further validation if value is empty and not required
  if (!value || value.toString().trim() === '') {
    return null;
  }

  // String-specific validations
  if (typeof value === 'string') {
    // Length validation
    if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
      return translate('validation.minLength', {
        field: displayName,
        min: fieldSchema.minLength
      }, lang);
    }
    if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
      return translate('validation.maxLength', {
        field: displayName,
        max: fieldSchema.maxLength
      }, lang);
    }

    // Pattern validation
    if (fieldSchema.pattern) {
      const regex = new RegExp(fieldSchema.pattern);
      if (!regex.test(value)) {
        return fieldSchema.patternMessage || translate('validation.invalidFormat', {
          field: displayName
        }, lang);
      }
    }
  }

  // Type-specific validation
  switch (fieldSchema.type) {
    case 'email':
      return validateEmail(value, displayName, lang);

    case 'phone':
    case 'tel':
      return validatePhone(value, displayName, lang);

    case 'url':
      return validateUrl(value, displayName, lang);

    case 'number':
    case 'price':
      return validateNumber(value, fieldSchema, displayName, lang);

    case 'date':
    case 'datetime-local':
    case 'time':
      return validateDate(value, fieldSchema, displayName, lang);

    case 'geopoint':
      return validateGeopoint(value, displayName, lang);

    case 'relation':
      return validateRelation(value, fieldSchema, displayName, lang);
  }

  // Custom validation function
  if (fieldSchema.validate && typeof fieldSchema.validate === 'function') {
    try {
      const customResult = fieldSchema.validate(value, fieldSchema);
      if (customResult !== true) {
        return customResult || translate('validation.invalid', { field: displayName }, lang);
      }
    } catch (error) {
      return translate('validation.validationError', { field: displayName }, lang);
    }
  }

  // Built-in validation shortcuts
  if (fieldSchema.validation) {
    switch (fieldSchema.validation) {
      case 'phone':
        return validatePhone(value, displayName, lang);
      case 'email':
        return validateEmail(value, displayName, lang);
      case 'url':
        return validateUrl(value, displayName, lang);
    }
  }

  return null;
}

/**
 * Validate email address
 */
export function validateEmail(value, displayName = 'Email', lang = null) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return translate('validation.invalidEmail', { field: displayName }, lang);
  }
  return null;
}

/**
 * Validate phone number using libphonenumber-js
 */
export function validatePhone(value, displayName = 'Phone', lang = null) {
  try {
    // Remove all non-digit characters for basic check
    const cleaned = value.replace(/\D/g, '');

    // Basic length check
    if (cleaned.length < 10) {
      return translate('validation.phoneTooShort', { field: displayName }, lang);
    }

    // Try to validate with libphonenumber-js
    if (!isValidPhoneNumber(value)) {
      return translate('validation.invalidPhone', { field: displayName }, lang);
    }

    return null;
  } catch (error) {
    // Fallback validation for edge cases
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length < 10 || cleaned.length > 15) {
      return translate('validation.phoneLength', { field: displayName }, lang);
    }
    return null;
  }
}

/**
 * Validate URL
 */
export function validateUrl(value, displayName = 'URL', lang = null) {
  try {
    new URL(value);
    return null;
  } catch (error) {
    return translate('validation.invalidUrl', { field: displayName }, lang);
  }
}

/**
 * Validate number with min/max constraints
 */
export function validateNumber(value, fieldSchema, displayName = 'Number', lang = null) {
  const numValue = parseFloat(value);

  if (isNaN(numValue)) {
    return translate('validation.invalidNumber', { field: displayName }, lang);
  }

  if (fieldSchema.min !== undefined && numValue < fieldSchema.min) {
    return translate('validation.minNumber', {
      field: displayName,
      min: fieldSchema.min
    }, lang);
  }

  if (fieldSchema.max !== undefined && numValue > fieldSchema.max) {
    return translate('validation.maxNumber', {
      field: displayName,
      max: fieldSchema.max
    }, lang);
  }

  return null;
}

/**
 * Validate date/time with min/max constraints
 */
export function validateDate(value, fieldSchema, displayName = 'Date', lang = null) {
  if (!value) return null;

  let date;

  try {
    // Handle both ISO strings and Date objects
    date = new Date(value);

    if (isNaN(date.getTime())) {
      return translate('validation.invalidDate', { field: displayName }, lang);
    }
  } catch (error) {
    return translate('validation.invalidDate', { field: displayName }, lang);
  }

  // Min date validation
  if (fieldSchema.min) {
    const minDate = new Date(fieldSchema.min);
    if (!isNaN(minDate.getTime()) && date < minDate) {
      return translate('validation.dateAfter', {
        field: displayName,
        date: minDate.toLocaleDateString()
      }, lang);
    }
  }

  // Max date validation
  if (fieldSchema.max) {
    const maxDate = new Date(fieldSchema.max);
    if (!isNaN(maxDate.getTime()) && date > maxDate) {
      return translate('validation.dateBefore', {
        field: displayName,
        date: maxDate.toLocaleDateString()
      }, lang);
    }
  }

  return null;
}

/**
 * Validate geopoint (coordinates)
 */
export function validateGeopoint(value, displayName = 'Location', lang = null) {
  if (!value || typeof value !== 'object') {
    return translate('validation.locationRequired', { field: displayName }, lang);
  }

  const { lat, lng } = value;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return translate('validation.invalidCoordinates', { field: displayName }, lang);
  }

  if (lat < -90 || lat > 90) {
    return translate('validation.invalidLatitude', {}, lang);
  }

  if (lng < -180 || lng > 180) {
    return translate('validation.invalidLongitude', {}, lang);
  }

  return null;
}

/**
 * Validate relation field
 */
export function validateRelation(value, fieldSchema, displayName = 'Field', lang = null) {
  if (!value) {
    return fieldSchema.required ? translate('validation.required', { field: displayName }, lang) : null;
  }

  // For single relations, value should be a string (ID)
  if (!fieldSchema.multiple && typeof value !== 'string') {
    return translate('validation.invalidRelation', { field: displayName }, lang);
  }

  // For multiple relations, value should be an array
  if (fieldSchema.multiple && !Array.isArray(value)) {
    return translate('validation.invalidRelationMultiple', { field: displayName }, lang);
  }

  return null;
}

/**
 * Format phone number for display
 */
export function formatPhone(value, country = 'AR') {
  try {
    const phoneNumber = parsePhoneNumber(value, country);
    return phoneNumber.formatInternational();
  } catch (error) {
    return value;
  }
}

/**
 * Validate entire form
 */
export function validateForm(formData, schema, fieldsToShow, lang = null) {
  const errors = {};

  fieldsToShow.forEach(fieldName => {
    const fieldSchema = schema[fieldName];
    const error = validateField(fieldName, formData[fieldName], fieldSchema, lang);
    if (error) {
      errors[fieldName] = error;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}