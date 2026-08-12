// core/render/seo-validator.js
// Validation utilities for SEO structured data and sitemap generation

/**
 * Validates structured data against schema.org requirements
 * @param {Object} data - Structured data object
 * @param {string} type - Schema type (Article, Product, etc.)
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateStructuredData(data, type = null) {
  const errors = [];
  const warnings = [];

  // Detect type from data if not provided
  const schemaType = type || data['@type'] || data.type;

  if (!schemaType) {
    errors.push('Missing @type or type field');
    return { valid: false, errors, warnings };
  }

  // Common required fields for all types
  if (!data['@context'] && !data.context) {
    warnings.push('Missing @context - should be "https://schema.org"');
  }

  // Type-specific validation
  switch (schemaType) {
    case 'Article':
    case 'BlogPosting':
      validateArticle(data, errors, warnings);
      break;

    case 'Product':
      validateProduct(data, errors, warnings);
      break;

    case 'FAQ':
    case 'FAQPage':
      validateFAQ(data, errors, warnings);
      break;

    case 'Event':
      validateEvent(data, errors, warnings);
      break;

    case 'LocalBusiness':
      validateLocalBusiness(data, errors, warnings);
      break;

    case 'Organization':
      validateOrganization(data, errors, warnings);
      break;

    case 'WebPage':
    case 'CollectionPage':
      validateWebPage(data, errors, warnings);
      break;

    default:
      warnings.push(`Unknown schema type: ${schemaType}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates Article/BlogPosting structured data
 */
function validateArticle(data, errors, warnings) {
  // Required fields
  if (!data.headline && !data.name) {
    errors.push('Article missing headline or name');
  }

  if (!data.author) {
    errors.push('Article missing author');
  } else if (typeof data.author === 'string') {
    warnings.push('Author should be an object with @type: Person, not a string');
  } else if (data.author['@type'] !== 'Person') {
    warnings.push('Author should have @type: Person');
  }

  if (!data.publisher) {
    warnings.push('Article missing publisher');
  } else if (typeof data.publisher === 'string') {
    warnings.push('Publisher should be an object with @type: Organization');
  }

  if (!data.datePublished) {
    warnings.push('Article missing datePublished');
  } else if (!isValidISODate(data.datePublished)) {
    warnings.push('datePublished should be ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)');
  }

  if (data.dateModified && !isValidISODate(data.dateModified)) {
    warnings.push('dateModified should be ISO 8601 format');
  }

  if (!data.image) {
    warnings.push('Article missing image (recommended for rich results)');
  }

  if (!data.description) {
    warnings.push('Article missing description');
  }

  // GEO-specific recommendations
  if (!data.wordCount) {
    warnings.push('Missing wordCount (recommended for AI engines)');
  }

  if (!data.inLanguage) {
    warnings.push('Missing inLanguage (recommended for multilingual sites)');
  }
}

/**
 * Validates Product structured data
 */
function validateProduct(data, errors, warnings) {
  if (!data.name) {
    errors.push('Product missing name');
  }

  if (!data.description) {
    warnings.push('Product missing description');
  }

  if (!data.image) {
    warnings.push('Product missing image');
  }

  if (!data.offers) {
    warnings.push('Product missing offers (price information)');
  } else {
    if (!data.offers.price && data.offers.price !== 0) {
      warnings.push('Product offer missing price');
    }
    if (!data.offers.priceCurrency) {
      warnings.push('Product offer missing priceCurrency');
    }
    if (!data.offers.availability) {
      warnings.push('Product offer missing availability');
    }
  }

  if (data.aggregateRating) {
    if (!data.aggregateRating.ratingValue) {
      warnings.push('aggregateRating missing ratingValue');
    }
    if (!data.aggregateRating.reviewCount) {
      warnings.push('aggregateRating missing reviewCount');
    }
  }
}

/**
 * Validates FAQ structured data
 */
function validateFAQ(data, errors, warnings) {
  if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
    if (!data.mainEntity || !Array.isArray(data.mainEntity) || data.mainEntity.length === 0) {
      errors.push('FAQ missing questions/mainEntity array');
      return;
    }
  }

  const questions = data.questions || data.mainEntity || [];
  questions.forEach((q, index) => {
    if (!q.question && !q.name) {
      errors.push(`FAQ question ${index + 1} missing question/name`);
    }
    if (!q.answer && !q.acceptedAnswer) {
      errors.push(`FAQ question ${index + 1} missing answer/acceptedAnswer`);
    }
  });
}

/**
 * Validates Event structured data
 */
function validateEvent(data, errors, warnings) {
  if (!data.name) {
    errors.push('Event missing name');
  }

  if (!data.startDate) {
    errors.push('Event missing startDate');
  } else if (!isValidISODate(data.startDate)) {
    warnings.push('Event startDate should be ISO 8601 format');
  }

  if (!data.location) {
    errors.push('Event missing location');
  } else if (typeof data.location === 'string') {
    warnings.push('Event location should be a Place object with address');
  }
}

/**
 * Validates LocalBusiness structured data
 */
function validateLocalBusiness(data, errors, warnings) {
  if (!data.name) {
    errors.push('LocalBusiness missing name');
  }

  if (!data.address) {
    errors.push('LocalBusiness missing address');
  }

  if (!data.telephone && !data.phone) {
    warnings.push('LocalBusiness missing telephone/phone');
  }

  if (!data.geo) {
    warnings.push('LocalBusiness missing geo coordinates (recommended for maps)');
  }
}

/**
 * Validates Organization structured data
 */
function validateOrganization(data, errors, warnings) {
  if (!data.name) {
    errors.push('Organization missing name');
  }

  if (!data.url) {
    warnings.push('Organization missing url');
  }

  if (!data.logo) {
    warnings.push('Organization missing logo (recommended for branding)');
  }
}

/**
 * Validates WebPage/CollectionPage structured data
 */
function validateWebPage(data, errors, warnings) {
  if (!data.name && !data.headline) {
    warnings.push('WebPage missing name/headline');
  }

  if (!data.description) {
    warnings.push('WebPage missing description');
  }

  if (data['@type'] === 'CollectionPage' && !data.numberOfItems) {
    warnings.push('CollectionPage missing numberOfItems');
  }
}

/**
 * Validates ISO 8601 date format
 */
function isValidISODate(dateString) {
  if (!dateString) return false;

  // Check for ISO 8601 format with timezone
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!isoRegex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validates sitemap entries
 * @param {Array} entries - Array of sitemap entry objects
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateSitemap(entries) {
  const errors = [];
  const warnings = [];
  const urls = new Set();

  if (!Array.isArray(entries)) {
    errors.push('Sitemap entries must be an array');
    return { valid: false, errors, warnings };
  }

  if (entries.length === 0) {
    warnings.push('Sitemap is empty');
  }

  entries.forEach((entry, index) => {
    // Required fields
    if (!entry.url) {
      errors.push(`Entry ${index + 1} missing url`);
      return;
    }

    // Check for duplicates
    if (urls.has(entry.url)) {
      warnings.push(`Duplicate URL: ${entry.url}`);
    }
    urls.add(entry.url);

    // Validate URL format
    if (!isValidUrl(entry.url)) {
      errors.push(`Entry ${index + 1} has invalid URL: ${entry.url}`);
    }

    // Check for protected pages (security check)
    if (isProtectedRoute(entry.url)) {
      errors.push(`SECURITY: Protected route in sitemap: ${entry.url}`);
    }

    // Validate lastModified
    if (!entry.lastModified) {
      warnings.push(`Entry ${entry.url} missing lastModified`);
    } else if (!(entry.lastModified instanceof Date) && !isValidISODate(entry.lastModified)) {
      warnings.push(`Entry ${entry.url} has invalid lastModified date`);
    }

    // Validate priority
    if (entry.priority !== undefined) {
      if (typeof entry.priority !== 'number' || entry.priority < 0 || entry.priority > 1) {
        warnings.push(`Entry ${entry.url} has invalid priority (should be 0-1)`);
      }
    }

    // Validate changeFrequency
    const validFrequencies = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
    if (entry.changeFrequency && !validFrequencies.includes(entry.changeFrequency)) {
      warnings.push(`Entry ${entry.url} has invalid changeFrequency`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      total: entries.length,
      unique: urls.size
    }
  };
}

/**
 * Validates URL format
 */
function isValidUrl(url) {
  if (!url) return false;

  // Relative URLs are valid
  if (url.startsWith('/')) {
    return true;
  }

  // Absolute URLs must be valid
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if URL is a protected route
 * Routes that should never appear in sitemap
 */
function isProtectedRoute(url) {
  const protectedPatterns = [
    '/admin',
    '/backoffice',
    '/dashboard',
    '/settings',
    '/api/',
    '/auth/',
    '/_next',
    '/private'
  ];

  return protectedPatterns.some(pattern => url.toLowerCase().includes(pattern));
}

/**
 * Validates page JSON for SEO completeness
 * @param {Object} pageJson - Page configuration JSON
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[], recommendations: string[] }
 */
export function validatePageSEO(pageJson) {
  const errors = [];
  const warnings = [];
  const recommendations = [];

  // Check meta tags
  if (!pageJson.meta) {
    warnings.push('Page missing meta object');
  } else {
    if (!pageJson.meta.title) {
      errors.push('Page missing meta.title');
    } else if (pageJson.meta.title.length > 60) {
      warnings.push('meta.title too long (recommended: 50-60 characters)');
    }

    if (!pageJson.meta.description) {
      errors.push('Page missing meta.description');
    } else if (pageJson.meta.description.length > 160) {
      warnings.push('meta.description too long (recommended: 150-160 characters)');
    } else if (pageJson.meta.description.length < 50) {
      warnings.push('meta.description too short (recommended: 150-160 characters)');
    }
  }

  // Check structured data
  if (!pageJson.seo) {
    recommendations.push('Consider adding structured data (seo field) for better AI engine visibility');
  } else {
    if (Array.isArray(pageJson.seo)) {
      pageJson.seo.forEach((item, index) => {
        const result = validateStructuredData(item);
        errors.push(...result.errors.map(e => `seo[${index}]: ${e}`));
        warnings.push(...result.warnings.map(w => `seo[${index}]: ${w}`));
      });
    } else {
      const result = validateStructuredData(pageJson.seo);
      errors.push(...result.errors.map(e => `seo: ${e}`));
      warnings.push(...result.warnings.map(w => `seo: ${w}`));
    }
  }

  // Check for auth protection in public pages
  if (pageJson.auth === true && !pageJson.sitemap?.hidden) {
    warnings.push('Auth-protected page should have sitemap.hidden = true');
  }

  if (pageJson.roles && pageJson.roles.length > 0 && !pageJson.sitemap?.hidden) {
    warnings.push('Role-protected page should have sitemap.hidden = true');
  }

  // Check dynamic content SEO
  if (pageJson.fetch_data && !pageJson.seo) {
    recommendations.push('Dynamic page with fetch_data should include seo configuration with template variables');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    recommendations
  };
}

/**
 * Validates llms.txt content
 * @param {string} content - llms.txt content
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateLlmsTxt(content) {
  const errors = [];
  const warnings = [];

  if (!content || typeof content !== 'string') {
    errors.push('llms.txt content is empty or invalid');
    return { valid: false, errors, warnings };
  }

  // Check for required sections
  if (!content.includes('## About')) {
    warnings.push('Missing "## About" section');
  }

  if (!content.includes('## Pages') && !content.includes('## Public Pages')) {
    warnings.push('Missing pages section');
  }

  if (!content.includes('## Structured Data')) {
    warnings.push('Missing "## Structured Data" section');
  }

  // Check for URLs
  const urlMatches = content.match(/https?:\/\/[^\s]+/g);
  if (!urlMatches || urlMatches.length === 0) {
    errors.push('No URLs found in llms.txt');
  }

  // Check content length
  if (content.length < 200) {
    warnings.push('llms.txt content seems too short (< 200 characters)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      length: content.length,
      urlCount: urlMatches ? urlMatches.length : 0,
      sections: (content.match(/^## /gm) || []).length
    }
  };
}
