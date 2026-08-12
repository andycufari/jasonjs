// ../security/sanitize.js

const escapeHtml = (unsafe) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const sanitizeValue = (value, fieldName, schema) => {
    if (typeof value === 'string') {
      // Skip HTML escaping for fields that store structured/raw text content
      const fieldType = schema && fieldName && schema[fieldName]?.type;
      if (fieldType === 'rich_text' || fieldType === 'textarea' || fieldType === 'code') {
        return value;
      }
      return escapeHtml(value);
    }
    if (Array.isArray(value)) {
      return value.map((v, index) => {
        // If the field is an array in the schema, check the items schema
        const itemSchema = schema && fieldName && schema[fieldName]?.items;
        return sanitizeValue(v, null, itemSchema || schema);
      });
    }
    if (typeof value === 'object' && value !== null) {
      // Serialize Date objects as ISO strings so components can use new Date() directly
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value.toISOString();
      }
      return sanitizeObject(value, schema);
    }
    return value;
  };

  const sanitizeObject = (obj, schema) => {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if this object is within an array field
      // If so, schema is already the correct nested schema from the array handling
      sanitized[key] = sanitizeValue(value, key, schema);
    }
    return sanitized;
  };
  
  const decodeHtmlEntities = (str) => {
    // Only decode safe HTML entities, keep dangerous ones escaped
    return str
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      // Keep &lt; and &gt; encoded for security (prevent XSS)
      // .replace(/&lt;/g, "<")  // DON'T decode - security risk
      // .replace(/&gt;/g, ">")  // DON'T decode - security risk
  };

  const decodeValue = (value) => {
    if (typeof value === 'string') {
      return decodeHtmlEntities(value);
    }
    if (Array.isArray(value)) {
      return value.map(decodeValue);
    }
    if (typeof value === 'object' && value !== null) {
      return decodeObject(value);
    }
    return value;
  };

  const decodeObject = (obj) => {
    const decoded = {};
    for (const [key, value] of Object.entries(obj)) {
      decoded[key] = decodeValue(value);
    }
    return decoded;
  };

  export const sanitizeData = (data, schema = null) => {
    return sanitizeValue(data, null, schema);
  };

  export const decodeSafeEntities = (data) => {
    return decodeValue(data);
  };