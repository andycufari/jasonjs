// formatting.js - Data formatting utilities for FormBuilder
import { parsePhoneNumber, formatPhoneNumberIntl } from 'libphonenumber-js';

/**
 * Format phone number for display
 * @param {string} value - Phone number value
 * @param {string} country - Country code (default: AR)
 * @returns {string} Formatted phone number
 */
export function formatPhoneNumber(value, country = 'AR') {
  if (!value) return '';
  
  try {
    const phoneNumber = parsePhoneNumber(value, country);
    return phoneNumber ? phoneNumber.formatInternational() : value;
  } catch (error) {
    // If parsing fails, return original value
    return value;
  }
}

/**
 * Format phone number for storage (E.164 format)
 * @param {string} value - Phone number value
 * @param {string} country - Country code (default: AR)
 * @returns {string} E.164 formatted phone number
 */
export function normalizePhoneNumber(value, country = 'AR') {
  if (!value) return '';
  
  try {
    const phoneNumber = parsePhoneNumber(value, country);
    return phoneNumber ? phoneNumber.format('E.164') : value;
  } catch (error) {
    // If parsing fails, clean and return
    return value.replace(/\D/g, '');
  }
}

/**
 * Format currency value
 * @param {number} value - Numeric value
 * @param {string} currency - Currency code (default: ARS)
 * @param {string} locale - Locale (default: es-AR)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value, currency = 'ARS', locale = 'es-AR') {
  if (value === null || value === undefined || isNaN(value)) return '';
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(value);
  } catch (error) {
    return `${currency} ${value}`;
  }
}

/**
 * Format percentage
 * @param {number} value - Numeric value (0-1 or 0-100)
 * @param {boolean} isDecimal - True if value is 0-1, false if 0-100
 * @returns {string} Formatted percentage
 */
export function formatPercentage(value, isDecimal = false) {
  if (value === null || value === undefined || isNaN(value)) return '';
  
  const displayValue = isDecimal ? value * 100 : value;
  return `${displayValue.toFixed(1)}%`;
}

/**
 * Format date for display
 * @param {Date|string} value - Date value
 * @param {string} locale - Locale (default: es-AR)
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(value, locale = 'es-AR', options = {}) {
  if (!value) return '';
  
  const date = value instanceof Date ? value : new Date(value);
  
  if (isNaN(date.getTime())) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };
  
  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
  } catch (error) {
    return date.toLocaleDateString();
  }
}

/**
 * Format date and time
 * @param {Date|string} value - Date value
 * @param {string} locale - Locale (default: es-AR)
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(value, locale = 'es-AR') {
  return formatDate(value, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Human readable size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Capitalize first letter of each word
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalizeWords(str) {
  if (!str) return '';
  
  return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Generate slug from string
 * @param {string} str - String to convert to slug
 * @returns {string} URL-friendly slug
 */
export function generateSlug(str) {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format array as comma-separated list
 * @param {Array} arr - Array to format
 * @param {string} conjunction - Conjunction word (default: 'y')
 * @returns {string} Formatted list
 */
export function formatList(arr, conjunction = 'y') {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} ${conjunction} ${arr[1]}`;
  
  const lastItem = arr[arr.length - 1];
  const otherItems = arr.slice(0, -1);
  
  return `${otherItems.join(', ')} ${conjunction} ${lastItem}`;
}

/**
 * Parse and format coordinates
 * @param {Object|string} value - Coordinates object or string
 * @returns {Object|null} Normalized coordinates { lat, lng }
 */
export function parseCoordinates(value) {
  if (!value) return null;
  
  // If it's already an object with lat/lng
  if (typeof value === 'object' && value.lat !== undefined && value.lng !== undefined) {
    return {
      lat: parseFloat(value.lat),
      lng: parseFloat(value.lng)
    };
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    // Try parsing "lat,lng" format
    const parts = value.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  }
  
  return null;
}

/**
 * Format coordinates for display
 * @param {Object} coordinates - { lat, lng }
 * @param {number} precision - Decimal places (default: 6)
 * @returns {string} Formatted coordinates
 */
export function formatCoordinates(coordinates, precision = 6) {
  if (!coordinates || !coordinates.lat || !coordinates.lng) return '';
  
  const lat = parseFloat(coordinates.lat).toFixed(precision);
  const lng = parseFloat(coordinates.lng).toFixed(precision);
  
  return `${lat}, ${lng}`;
}

/**
 * Clean and normalize text input
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
export function cleanText(text) {
  if (!text) return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n'); // Remove empty lines
}

/**
 * Decode HTML entities in text
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
export function decodeHtmlEntities(text) {
  if (typeof text !== 'string') return text;
  
  // Create a temporary element to decode HTML entities
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }
  
  // Fallback for server-side rendering
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Format options array for select inputs
 * @param {Array} options - Raw options array
 * @param {string} valueKey - Key for value (default: 'value')
 * @param {string} labelKey - Key for label (default: 'label')
 * @returns {Array} Formatted options
 */
export function formatSelectOptions(options, valueKey = 'value', labelKey = 'label') {
  if (!Array.isArray(options)) return [];
  
  return options.map(option => {
    if (typeof option === 'string') {
      return { value: option, label: decodeHtmlEntities(option) };
    }
    
    if (typeof option === 'object') {
      const label = option[labelKey] || option.label || option.name || option.title;
      return {
        value: option[valueKey] || option.value || option.id,
        label: decodeHtmlEntities(label)
      };
    }
    
    return { value: option, label: decodeHtmlEntities(String(option)) };
  });
}

/**
 * Format address based on locale and format preferences
 * @param {Object} addressComponents - Structured address components
 * @param {Object} options - Formatting options
 * @returns {string} Formatted address string
 */
export function formatAddressByLocale(addressComponents, options = {}) {
  if (!addressComponents) return '';
  
  const {
    format = 'default', // 'default', 'us', 'eu', 'ar'
    locale = 'es-AR',
    includeCountry = false
  } = options;
  
  const {
    house_number = '',
    road = '',
    suburb = '',
    city = '',
    state = '',
    postcode = '',
    country = ''
  } = addressComponents;
  
  const parts = [];
  
  switch (format) {
    case 'us':
      // US format: "123 Main St, Suburb, City, State 12345"
      if (house_number && road) {
        parts.push(`${house_number} ${road}`);
      } else if (road) {
        parts.push(road);
      }
      if (suburb) parts.push(suburb);
      if (city) parts.push(city);
      if (state && postcode) {
        parts.push(`${state} ${postcode}`);
      } else if (state) {
        parts.push(state);
      } else if (postcode) {
        parts.push(postcode);
      }
      break;
      
    case 'eu':
      // European format: "Main St 123, 12345 City, State"
      if (road && house_number) {
        parts.push(`${road} ${house_number}`);
      } else if (road) {
        parts.push(road);
      }
      if (postcode && city) {
        parts.push(`${postcode} ${city}`);
      } else if (city) {
        parts.push(city);
      }
      if (state) parts.push(state);
      break;
      
    case 'ar':
      // Argentina format: "Av. Corrientes 1234, Balvanera, CABA, C1043AAR"
      if (road && house_number) {
        parts.push(`${road} ${house_number}`);
      } else if (road) {
        parts.push(road);
      }
      if (suburb) parts.push(suburb);
      if (city) parts.push(city);
      if (postcode) parts.push(postcode);
      break;
      
    default:
      // Default format based on locale
      if (locale.startsWith('en-US')) {
        return formatAddressByLocale(addressComponents, { ...options, format: 'us' });
      } else if (locale.startsWith('es') || locale.includes('AR')) {
        return formatAddressByLocale(addressComponents, { ...options, format: 'ar' });
      } else {
        return formatAddressByLocale(addressComponents, { ...options, format: 'eu' });
      }
  }
  
  if (includeCountry && country) {
    parts.push(country);
  }
  
  return parts.filter(Boolean).join(', ');
}

/**
 * Convert location object to different field types
 * @param {Object} locationData - Location object with lat, lng, address
 * @param {string} fieldType - Target field type ('object', 'geopoint', 'array')
 * @returns {*} Converted location data
 */
export function convertLocationFieldType(locationData, fieldType = 'object') {
  if (!locationData || (!locationData.lat && !locationData.lng)) {
    return null;
  }
  
  const lat = parseFloat(locationData.lat);
  const lng = parseFloat(locationData.lng);
  
  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }
  
  switch (fieldType) {
    case 'geopoint':
    case 'array':
      // GeoJSON format: [longitude, latitude] (note the order!)
      return [lng, lat];
      
    case 'coordinates':
      // Simple coordinates array: [latitude, longitude]
      return [lat, lng];
      
    case 'string':
      // String format: "lat,lng"
      return `${lat},${lng}`;
      
    case 'object':
    default:
      // Full object with address
      return {
        lat,
        lng,
        address: locationData.address || ''
      };
  }
}

/**
 * Parse location data from different field types
 * @param {*} value - Location value in various formats
 * @returns {Object|null} Normalized location object { lat, lng, address? }
 */
export function parseLocationFieldType(value) {
  if (!value) return null;
  
  // Already an object with lat/lng
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (value.lat !== undefined && value.lng !== undefined) {
      return {
        lat: parseFloat(value.lat),
        lng: parseFloat(value.lng),
        address: value.address || ''
      };
    }
  }
  
  // Array format
  if (Array.isArray(value) && value.length >= 2) {
    const [first, second] = value;
    
    // Check if it's GeoJSON format [lng, lat] by checking typical ranges
    // Longitude is typically -180 to 180, latitude is -90 to 90
    // If first value is outside lat range but within lng range, assume GeoJSON
    if (Math.abs(first) > 90 && Math.abs(first) <= 180 && Math.abs(second) <= 90) {
      // GeoJSON format: [longitude, latitude]
      return {
        lat: parseFloat(second),
        lng: parseFloat(first),
        address: ''
      };
    } else {
      // Standard format: [latitude, longitude]
      return {
        lat: parseFloat(first),
        lng: parseFloat(second),
        address: ''
      };
    }
  }
  
  // String format
  if (typeof value === 'string') {
    const coords = parseCoordinates(value);
    if (coords) {
      return {
        ...coords,
        address: ''
      };
    }
  }
  
  return null;
}