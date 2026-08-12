// core/render/seo.js
// Automatic SEO extraction from JSON components

import { processTemplates, extractArrayValues, processTemplatesWithItem } from './templates.js';

/**
 * Schema type shortcuts - map simple names to full schema.org types
 * Users can use "Product" instead of full schema definition
 */
const SCHEMA_TYPE_MAP = {
  // Content Types
  'article': 'Article',
  'blogpost': 'BlogPosting',
  'blog': 'BlogPosting',
  'newsarticle': 'NewsArticle',
  'news': 'NewsArticle',
  'webpage': 'WebPage',
  'page': 'WebPage',

  // Commerce
  'product': 'Product',
  'offer': 'Offer',
  'service': 'Service',

  // Organization & People
  'organization': 'Organization',
  'company': 'Organization',
  'person': 'Person',
  'localbusiness': 'LocalBusiness',
  'business': 'LocalBusiness',

  // Events
  'event': 'Event',

  // FAQ & How-To
  'faq': 'FAQPage',
  'faqpage': 'FAQPage',
  'howto': 'HowTo',

  // Reviews & Ratings
  'review': 'Review',
  'rating': 'AggregateRating',

  // Media
  'video': 'VideoObject',
  'image': 'ImageObject',
  'audio': 'AudioObject',

  // Places
  'place': 'Place',
  'restaurant': 'Restaurant',
  'hotel': 'Hotel',

  // Software & Apps
  'software': 'SoftwareApplication',
  'app': 'SoftwareApplication',
  'webapp': 'WebApplication',

  // Breadcrumbs & Navigation
  'breadcrumb': 'BreadcrumbList',
  'breadcrumbs': 'BreadcrumbList',

  // Course & Education
  'course': 'Course',

  // Job & Career
  'job': 'JobPosting',
  'jobposting': 'JobPosting',

  // Recipe
  'recipe': 'Recipe'
};

/**
 * Normalize schema type - handles shortcuts and case-insensitive matching
 */
function normalizeSchemaType(type) {
  if (!type) return 'WebPage';
  const lowerType = type.toLowerCase().replace(/[^a-z]/g, '');
  return SCHEMA_TYPE_MAP[lowerType] || type; // Return original if not in map
}

/**
 * Extracts SEO-relevant data from JSON component structure
 * Focuses on component props: title, subtitle, description, label, link, href
 * Handles internationalization with language-specific content
 * Supports template strings like {{posts.title}} for dynamic data
 *
 * SEO can be defined as:
 * - Object: { title, description, iterate, structuredData }
 * - Array: [{ type: "Product", ... }, { type: "FAQPage", ... }] for explicit structured data
 */
export function extractSEOFromJSON(json, options = {}) {
  const { language = 'en', fetchData = {} } = options;

  // Process templates in JSON first
  const processedJson = processTemplates(json, fetchData);

  // Extract array values for multiple SEO elements
  const arrayValues = extractArrayValues(json, fetchData);

  const seoData = {
    title: null,
    subtitle: null,
    description: null,
    keywords: [],
    links: [],
    labels: [],
    images: [],
    structuredData: [],
    // Array values for multiple elements
    arrayTitles: arrayValues.title || [],
    arraySubtitles: arrayValues.subtitle || [],
    arrayDescriptions: arrayValues.description || [],
    arrayLabels: arrayValues.label || []
  };

  // Check if SEO is defined as array (explicit structured data mode)
  if (Array.isArray(json.seo)) {
    const arraySEOResults = processArraySEO(json.seo, fetchData, language);

    // Use first item with title/description for main page SEO
    const mainSEO = arraySEOResults.find(item => item.title || item.description);
    if (mainSEO) {
      seoData.title = mainSEO.title || seoData.title;
      seoData.description = mainSEO.description || seoData.description;
      if (mainSEO.image) {
        seoData.images.push({ src: mainSEO.image, alt: mainSEO.title || '' });
      }
    }

    // Collect all structured data
    arraySEOResults.forEach(item => {
      if (item.structuredData) {
        seoData.structuredData.push(item.structuredData);
      }
      if (item.keywords && item.keywords.length > 0) {
        seoData.keywords.push(...item.keywords);
      }
    });

    // Skip regular SEO processing since we have explicit array
    // But still extract from components for additional data
  }

  // Helper to extract value with i18n support
  function extractValue(value, lang = language) {
    if (!value) return null;
    
    // If it's an object with language keys
    if (typeof value === 'object' && !Array.isArray(value)) {
      return value[lang] || value['en'] || value[Object.keys(value)[0]] || null;
    }
    
    // If it's a simple string/value
    return value;
  }

  // Recursive function to traverse JSON structure
  function traverse(obj, depth = 0) {
    if (!obj || typeof obj !== 'object') return;
    
    // Handle arrays
    if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item, depth));
      return;
    }

    // Extract component attributes and props
    const { component, attributes = {}, props = {}, components } = obj;
    
    // Merge attributes and props for extraction
    // Handle nested props structure: attributes.props
    const nestedProps = attributes.props || {};
    const allProps = { ...attributes, ...props, ...nestedProps };
    
    // Extract title (highest priority first found)
    if (allProps.title && !seoData.title) {
      seoData.title = extractValue(allProps.title);
    }
    
    // Extract subtitle
    if (allProps.subtitle && !seoData.subtitle) {
      seoData.subtitle = extractValue(allProps.subtitle);
    }
    
    // Extract description
    if (allProps.description && !seoData.description) {
      seoData.description = extractValue(allProps.description);
    }
    
    // Extract labels
    if (allProps.label) {
      const labelValue = extractValue(allProps.label);
      if (labelValue) {
        seoData.labels.push({
          text: labelValue,
          component: component,
          depth
        });
      }
    }
    
    // Extract links
    if (allProps.href || allProps.link) {
      const href = extractValue(allProps.href || allProps.link);
      const label = extractValue(allProps.label) || extractValue(allProps.text) || '';
      
      if (href) {
        seoData.links.push({
          href,
          text: label,
          rel: allProps.rel || 'external',
          component: component
        });
      }
    }
    
    // Extract keywords
    if (allProps.keywords) {
      const keywordsValue = extractValue(allProps.keywords);
      if (keywordsValue) {
        const keywords = Array.isArray(keywordsValue) 
          ? keywordsValue 
          : keywordsValue.split(',').map(k => k.trim());
        seoData.keywords.push(...keywords);
      }
    }
    
    // Extract images
    if (allProps.src || allProps.image) {
      const src = extractValue(allProps.src || allProps.image);
      const alt = extractValue(allProps.alt) || '';
      const title = extractValue(allProps.title) || '';
      
      if (src) {
        seoData.images.push({
          src,
          alt,
          title,
          component: component
        });
      }
    }
    
    // Extract structured data
    if (allProps.structuredData) {
      seoData.structuredData.push(allProps.structuredData);
    }

    // Continue traversing nested components
    if (components) {
      traverse(components, depth + 1);
    }
  }

  // Handle page-level SEO first (from page.seo)
  // Skip if we already processed array SEO above
  if (processedJson.seo && !Array.isArray(json.seo)) {
    const pageSEO = processedJson.seo;

    // Check for iterative SEO configuration
    if (pageSEO.iterate) {
      // Use original json.seo (unprocessed templates) for iterative processing
      const iterativeResults = processIterativeSEO(json.seo, fetchData);
      if (iterativeResults && iterativeResults.length > 0) {
        // Use the first item's data for main SEO, and collect all structured data
        const firstItem = iterativeResults[0];
        
        // Always set main SEO from first item when using iteration
        seoData.title = firstItem.title || seoData.title;
        seoData.description = firstItem.description || seoData.description;
        
        // Add all structured data from iterations
        iterativeResults.forEach(item => {
          if (item.structuredData) {
            seoData.structuredData.push(item.structuredData);
          }
          if (item.keywords && item.keywords.length > 0) {
            seoData.keywords.push(...item.keywords);
          }
        });
        
        // Store all titles and descriptions for array processing
        seoData.arrayTitles.push(...iterativeResults.map(item => item.title).filter(t => t));
        seoData.arrayDescriptions.push(...iterativeResults.map(item => item.description).filter(d => d));
        
        // Continue with regular processing (will be skipped since we have title/description)
      }
    }
    
    if (pageSEO.title && !seoData.title) {
      seoData.title = extractValue(pageSEO.title);
    }
    if (pageSEO.subtitle && !seoData.subtitle) {
      seoData.subtitle = extractValue(pageSEO.subtitle);
    }
    if (pageSEO.description && !seoData.description) {
      seoData.description = extractValue(pageSEO.description);
    }
    
    // Handle array-based SEO from page level
    Object.keys(pageSEO).forEach(key => {
      const value = pageSEO[key];
      const originalValue = json.seo?.[key];
      
      // Check if original was a template that resolved to array
      if (typeof originalValue === 'string' && originalValue.includes('{{')) {
        const resolved = resolvePath(originalValue.replace(/\{\{([^}]+)\}\}/g, '$1').trim(), fetchData);
        if (Array.isArray(resolved)) {
          switch (key) {
            case 'titles':
            case 'title':
              seoData.arrayTitles.push(...resolved.filter(v => v != null));
              break;
            case 'subtitles':
            case 'subtitle':
              seoData.arraySubtitles.push(...resolved.filter(v => v != null));
              break;
            case 'descriptions':
            case 'description':
              seoData.arrayDescriptions.push(...resolved.filter(v => v != null));
              break;
            case 'labels':
            case 'label':
              seoData.arrayLabels.push(...resolved.filter(v => v != null));
              break;
          }
        }
      }
    });
  }

  // Start traversal of components
  if (processedJson.components) {
    traverse(processedJson.components);
  } else {
    traverse(processedJson);
  }
  
  // Helper function to resolve template paths (needed for page-level SEO)
  function resolvePath(path, data) {
    const parts = path.split('.');
    let current = data;
    
    for (const part of parts) {
      if (part === '*') {
        if (!Array.isArray(current)) return null;
        const remainingPath = parts.slice(parts.indexOf(part) + 1).join('.');
        if (remainingPath) {
          return current.map(item => resolvePath(remainingPath, item)).filter(v => v != null);
        }
        return current;
      }
      
      if (current == null || typeof current !== 'object') return null;
      current = current[part];
    }
    
    return current;
  }

  // Clean up data and add intelligent keywords
  seoData.keywords = [...new Set(seoData.keywords)]; // Remove duplicates
  
  // If no explicit keywords, generate from content
  if (seoData.keywords.length === 0) {
    const autoKeywords = [];
    
    // Extract keywords from titles
    if (seoData.title) {
      autoKeywords.push(...extractKeywordsFromText(seoData.title));
    }
    seoData.arrayTitles.forEach(title => {
      if (title) autoKeywords.push(...extractKeywordsFromText(title));
    });
    
    // Extract from labels
    seoData.labels.forEach(label => {
      if (label.text) autoKeywords.push(...extractKeywordsFromText(label.text));
    });
    seoData.arrayLabels.forEach(label => {
      if (label) autoKeywords.push(...extractKeywordsFromText(label));
    });
    
    // Add unique auto-generated keywords
    seoData.keywords.push(...[...new Set(autoKeywords)].slice(0, 10)); // Limit to 10
  }
  
  return seoData;
}

/**
 * Processes iterative SEO configurations to generate multiple SEO entries
 * Supports "iterate" key to loop through database arrays
 */
export function processIterativeSEO(seoConfig, fetchData = {}) {
  if (!seoConfig.iterate || !fetchData[seoConfig.iterate]) {
    return null;
  }

  const itemsArray = fetchData[seoConfig.iterate];
  if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
    return null;
  }

  const iterativeSEOResults = [];

  for (const item of itemsArray) {
    // Process templates with item context
    const processedConfig = processTemplatesWithItem(seoConfig, item, fetchData);
    
    // Extract basic SEO data for this item
    const itemSEO = {
      title: processedConfig.title || null,
      description: processedConfig.description || null,
      image: processedConfig.image || processedConfig.src || null,
      keywords: [],
      structuredData: null
    };

    // Process structured data if provided
    if (processedConfig.structuredData) {
      const structuredData = { ...processedConfig.structuredData };
      
      // Auto-detect schema type and add required context
      if (!structuredData['@context']) {
        structuredData['@context'] = 'https://schema.org';
      }
      
      // Auto-detect schema type based on content
      if (!structuredData['@type']) {
        structuredData['@type'] = detectSchemaType(item);
      }
      
      itemSEO.structuredData = structuredData;
    } else {
      // Auto-generate structured data if not provided
      itemSEO.structuredData = generateAutoStructuredData(item, itemSEO);
    }

    // Extract keywords from title and description
    if (itemSEO.title) {
      itemSEO.keywords.push(...extractKeywordsFromText(itemSEO.title));
    }
    if (itemSEO.description) {
      itemSEO.keywords.push(...extractKeywordsFromText(itemSEO.description));
    }

    iterativeSEOResults.push(itemSEO);
  }

  return iterativeSEOResults;
}

/**
 * Processes SEO array format for explicit structured data definitions
 * Each item in the array becomes a separate JSON-LD script
 *
 * Supported formats:
 * - { type: "Product", name: "...", price: 29.99 }
 * - { type: "FAQPage", questions: [...] }
 * - { type: "WebPage", title: "...", description: "..." }
 * - { "@type": "Product", ... } (full schema.org format)
 *
 * @param {Array} seoArray - Array of SEO items
 * @param {Object} fetchData - Data from fetch_data for template processing
 * @param {string} language - Current language for i18n
 * @returns {Array} Processed SEO results with structured data
 */
export function processArraySEO(seoArray, fetchData = {}, language = 'en') {
  if (!Array.isArray(seoArray) || seoArray.length === 0) {
    return [];
  }

  const results = [];

  for (const seoItem of seoArray) {
    // Process templates in the item
    const processed = processTemplates(seoItem, fetchData);

    // Extract basic SEO info
    const itemResult = {
      title: processed.title || processed.name || processed.headline || null,
      description: processed.description || processed.excerpt || null,
      image: processed.image || processed.src || processed.thumbnail || null,
      keywords: [],
      structuredData: null
    };

    // Extract keywords if provided
    if (processed.keywords) {
      const kw = Array.isArray(processed.keywords)
        ? processed.keywords
        : processed.keywords.split(',').map(k => k.trim());
      itemResult.keywords.push(...kw);
    }

    // Build structured data
    const schemaType = normalizeSchemaType(processed.type || processed['@type']);
    const structuredData = buildStructuredData(schemaType, processed, language);

    if (structuredData) {
      itemResult.structuredData = structuredData;
    }

    results.push(itemResult);
  }

  return results;
}

/**
 * Builds structured data object based on schema type and provided data
 * Handles special types like FAQPage, Product, etc.
 */
function buildStructuredData(schemaType, data, language = 'en') {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': schemaType
  };

  // Remove internal keys that shouldn't be in structured data
  const internalKeys = ['type', 'keywords'];

  // Handle special schema types with specific structures
  switch (schemaType) {
    case 'FAQPage':
      return buildFAQSchema(data);

    case 'HowTo':
      return buildHowToSchema(data);

    case 'BreadcrumbList':
      return buildBreadcrumbSchema(data);

    case 'Product':
      return buildProductSchema(data);

    case 'Event':
      return buildEventSchema(data);

    case 'LocalBusiness':
    case 'Restaurant':
    case 'Hotel':
      return buildLocalBusinessSchema(schemaType, data);

    case 'JobPosting':
      return buildJobPostingSchema(data);

    case 'Course':
      return buildCourseSchema(data);

    case 'Recipe':
      return buildRecipeSchema(data);

    case 'VideoObject':
      return buildVideoSchema(data);

    case 'SoftwareApplication':
    case 'WebApplication':
      return buildSoftwareSchema(schemaType, data);

    case 'Review':
      return buildReviewSchema(data);

    case 'AggregateRating':
      return buildAggregateRatingSchema(data);

    default:
      // Generic schema - copy all non-internal properties
      for (const [key, value] of Object.entries(data)) {
        if (!internalKeys.includes(key) && !key.startsWith('@') && value !== undefined && value !== null) {
          // Map common property names to schema.org equivalents
          const schemaKey = mapPropertyToSchema(key);
          structuredData[schemaKey] = value;
        }
      }

      // Copy existing @ properties
      if (data['@type']) structuredData['@type'] = data['@type'];
      if (data['@id']) structuredData['@id'] = data['@id'];

      return structuredData;
  }
}

/**
 * Maps common property names to schema.org property names
 */
function mapPropertyToSchema(key) {
  const propertyMap = {
    'title': 'name',
    'desc': 'description',
    'img': 'image',
    'src': 'image',
    'thumbnail': 'image',
    'author_name': 'author',
    'published_at': 'datePublished',
    'created_at': 'dateCreated',
    'updated_at': 'dateModified',
    'start_date': 'startDate',
    'end_date': 'endDate',
    'event_date': 'startDate'
  };
  return propertyMap[key] || key;
}

/**
 * Build FAQ Page schema
 * Input: { type: "FAQPage", questions: [{ question: "...", answer: "..." }] }
 */
function buildFAQSchema(data) {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': []
  };

  const questions = data.questions || data.faqs || data.items || [];
  for (const q of questions) {
    faqSchema.mainEntity.push({
      '@type': 'Question',
      'name': q.question || q.q || q.title,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': q.answer || q.a || q.content || q.text
      }
    });
  }

  return faqSchema;
}

/**
 * Build HowTo schema
 * Input: { type: "HowTo", name: "...", steps: [{ name: "...", text: "..." }] }
 */
function buildHowToSchema(data) {
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    'name': data.name || data.title,
    'description': data.description,
    'step': []
  };

  const steps = data.steps || data.instructions || [];
  steps.forEach((step, index) => {
    howToSchema.step.push({
      '@type': 'HowToStep',
      'position': index + 1,
      'name': step.name || step.title || `Step ${index + 1}`,
      'text': step.text || step.description || step.content
    });
  });

  if (data.totalTime) howToSchema.totalTime = data.totalTime;
  if (data.image) howToSchema.image = data.image;

  return howToSchema;
}

/**
 * Build Breadcrumb schema
 * Input: { type: "Breadcrumb", items: [{ name: "Home", url: "/" }] }
 */
function buildBreadcrumbSchema(data) {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': []
  };

  const items = data.items || data.breadcrumbs || [];
  items.forEach((item, index) => {
    breadcrumbSchema.itemListElement.push({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name || item.title || item.label,
      'item': item.url || item.href || item.link
    });
  });

  return breadcrumbSchema;
}

/**
 * Build Product schema
 * Input: { type: "Product", name: "...", price: 29.99, currency: "USD" }
 */
function buildProductSchema(data) {
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': data.name || data.title
  };

  if (data.description) productSchema.description = data.description;
  if (data.image) productSchema.image = data.image;
  if (data.sku) productSchema.sku = data.sku;
  if (data.brand) {
    productSchema.brand = {
      '@type': 'Brand',
      'name': typeof data.brand === 'string' ? data.brand : data.brand.name
    };
  }

  // Offers
  if (data.price !== undefined) {
    productSchema.offers = {
      '@type': 'Offer',
      'price': data.price,
      'priceCurrency': data.currency || 'USD',
      'availability': data.availability || (data.inStock !== false ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock')
    };
    if (data.url) productSchema.offers.url = data.url;
  }

  // Aggregate Rating
  if (data.rating || data.reviewCount) {
    productSchema.aggregateRating = {
      '@type': 'AggregateRating',
      'ratingValue': data.rating || data.ratingValue,
      'reviewCount': data.reviewCount || data.ratingCount
    };
  }

  return productSchema;
}

/**
 * Build Event schema
 */
function buildEventSchema(data) {
  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    'name': data.name || data.title
  };

  if (data.description) eventSchema.description = data.description;
  if (data.startDate || data.start_date || data.date) {
    eventSchema.startDate = data.startDate || data.start_date || data.date;
  }
  if (data.endDate || data.end_date) {
    eventSchema.endDate = data.endDate || data.end_date;
  }
  if (data.location) {
    eventSchema.location = typeof data.location === 'string'
      ? { '@type': 'Place', 'name': data.location }
      : data.location;
  }
  if (data.image) eventSchema.image = data.image;
  if (data.url) eventSchema.url = data.url;

  // Organizer
  if (data.organizer) {
    eventSchema.organizer = typeof data.organizer === 'string'
      ? { '@type': 'Organization', 'name': data.organizer }
      : data.organizer;
  }

  // Offers/Tickets
  if (data.price !== undefined || data.offers) {
    eventSchema.offers = data.offers || {
      '@type': 'Offer',
      'price': data.price,
      'priceCurrency': data.currency || 'USD',
      'url': data.ticketUrl || data.url
    };
  }

  return eventSchema;
}

/**
 * Build LocalBusiness schema
 */
function buildLocalBusinessSchema(schemaType, data) {
  const businessSchema = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    'name': data.name || data.title
  };

  if (data.description) businessSchema.description = data.description;
  if (data.image) businessSchema.image = data.image;
  if (data.telephone || data.phone) businessSchema.telephone = data.telephone || data.phone;
  if (data.email) businessSchema.email = data.email;
  if (data.url) businessSchema.url = data.url;

  // Address
  if (data.address) {
    businessSchema.address = typeof data.address === 'string'
      ? { '@type': 'PostalAddress', 'streetAddress': data.address }
      : { '@type': 'PostalAddress', ...data.address };
  }

  // Geo coordinates
  if (data.latitude && data.longitude) {
    businessSchema.geo = {
      '@type': 'GeoCoordinates',
      'latitude': data.latitude,
      'longitude': data.longitude
    };
  }

  // Opening hours
  if (data.openingHours) businessSchema.openingHours = data.openingHours;

  // Price range
  if (data.priceRange) businessSchema.priceRange = data.priceRange;

  return businessSchema;
}

/**
 * Build JobPosting schema
 */
function buildJobPostingSchema(data) {
  const jobSchema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    'title': data.title || data.name,
    'description': data.description
  };

  if (data.datePosted) jobSchema.datePosted = data.datePosted;
  if (data.validThrough) jobSchema.validThrough = data.validThrough;
  if (data.employmentType) jobSchema.employmentType = data.employmentType;

  // Hiring organization
  if (data.company || data.hiringOrganization) {
    const org = data.hiringOrganization || data.company;
    jobSchema.hiringOrganization = typeof org === 'string'
      ? { '@type': 'Organization', 'name': org }
      : { '@type': 'Organization', ...org };
  }

  // Location
  if (data.location) {
    jobSchema.jobLocation = typeof data.location === 'string'
      ? { '@type': 'Place', 'address': data.location }
      : data.location;
  }

  // Salary
  if (data.salary || data.baseSalary) {
    jobSchema.baseSalary = {
      '@type': 'MonetaryAmount',
      'currency': data.currency || 'USD',
      'value': {
        '@type': 'QuantitativeValue',
        'value': data.salary || data.baseSalary,
        'unitText': data.salaryUnit || 'YEAR'
      }
    };
  }

  return jobSchema;
}

/**
 * Build Course schema
 */
function buildCourseSchema(data) {
  const courseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    'name': data.name || data.title
  };

  if (data.description) courseSchema.description = data.description;
  if (data.provider) {
    courseSchema.provider = typeof data.provider === 'string'
      ? { '@type': 'Organization', 'name': data.provider }
      : data.provider;
  }
  if (data.url) courseSchema.url = data.url;
  if (data.image) courseSchema.image = data.image;

  return courseSchema;
}

/**
 * Build Recipe schema
 */
function buildRecipeSchema(data) {
  const recipeSchema = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    'name': data.name || data.title
  };

  if (data.description) recipeSchema.description = data.description;
  if (data.image) recipeSchema.image = data.image;
  if (data.author) {
    recipeSchema.author = typeof data.author === 'string'
      ? { '@type': 'Person', 'name': data.author }
      : data.author;
  }
  if (data.prepTime) recipeSchema.prepTime = data.prepTime;
  if (data.cookTime) recipeSchema.cookTime = data.cookTime;
  if (data.totalTime) recipeSchema.totalTime = data.totalTime;
  if (data.recipeYield || data.yield) recipeSchema.recipeYield = data.recipeYield || data.yield;
  if (data.recipeCategory || data.category) recipeSchema.recipeCategory = data.recipeCategory || data.category;
  if (data.recipeCuisine || data.cuisine) recipeSchema.recipeCuisine = data.recipeCuisine || data.cuisine;

  // Ingredients
  if (data.ingredients || data.recipeIngredient) {
    recipeSchema.recipeIngredient = data.ingredients || data.recipeIngredient;
  }

  // Instructions
  if (data.instructions || data.recipeInstructions) {
    const instructions = data.instructions || data.recipeInstructions;
    recipeSchema.recipeInstructions = Array.isArray(instructions)
      ? instructions.map(i => typeof i === 'string' ? { '@type': 'HowToStep', 'text': i } : i)
      : instructions;
  }

  // Nutrition
  if (data.nutrition) {
    recipeSchema.nutrition = {
      '@type': 'NutritionInformation',
      ...data.nutrition
    };
  }

  return recipeSchema;
}

/**
 * Build VideoObject schema
 */
function buildVideoSchema(data) {
  const videoSchema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    'name': data.name || data.title
  };

  if (data.description) videoSchema.description = data.description;
  if (data.thumbnailUrl || data.thumbnail || data.image) {
    videoSchema.thumbnailUrl = data.thumbnailUrl || data.thumbnail || data.image;
  }
  if (data.uploadDate) videoSchema.uploadDate = data.uploadDate;
  if (data.duration) videoSchema.duration = data.duration;
  if (data.contentUrl || data.url) videoSchema.contentUrl = data.contentUrl || data.url;
  if (data.embedUrl) videoSchema.embedUrl = data.embedUrl;

  return videoSchema;
}

/**
 * Build SoftwareApplication schema
 */
function buildSoftwareSchema(schemaType, data) {
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    'name': data.name || data.title
  };

  if (data.description) softwareSchema.description = data.description;
  if (data.applicationCategory) softwareSchema.applicationCategory = data.applicationCategory;
  if (data.operatingSystem) softwareSchema.operatingSystem = data.operatingSystem;
  if (data.url) softwareSchema.url = data.url;
  if (data.image) softwareSchema.image = data.image;

  // Offers
  if (data.price !== undefined) {
    softwareSchema.offers = {
      '@type': 'Offer',
      'price': data.price,
      'priceCurrency': data.currency || 'USD'
    };
  }

  // Rating
  if (data.rating || data.reviewCount) {
    softwareSchema.aggregateRating = {
      '@type': 'AggregateRating',
      'ratingValue': data.rating,
      'reviewCount': data.reviewCount
    };
  }

  return softwareSchema;
}

/**
 * Build Review schema
 */
function buildReviewSchema(data) {
  const reviewSchema = {
    '@context': 'https://schema.org',
    '@type': 'Review'
  };

  if (data.name || data.title) reviewSchema.name = data.name || data.title;
  if (data.reviewBody || data.body || data.content) {
    reviewSchema.reviewBody = data.reviewBody || data.body || data.content;
  }
  if (data.author) {
    reviewSchema.author = typeof data.author === 'string'
      ? { '@type': 'Person', 'name': data.author }
      : data.author;
  }
  if (data.datePublished) reviewSchema.datePublished = data.datePublished;

  // Rating
  if (data.rating || data.ratingValue) {
    reviewSchema.reviewRating = {
      '@type': 'Rating',
      'ratingValue': data.rating || data.ratingValue,
      'bestRating': data.bestRating || 5,
      'worstRating': data.worstRating || 1
    };
  }

  // Item reviewed
  if (data.itemReviewed) {
    reviewSchema.itemReviewed = data.itemReviewed;
  }

  return reviewSchema;
}

/**
 * Build AggregateRating schema
 */
function buildAggregateRatingSchema(data) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateRating',
    'ratingValue': data.ratingValue || data.rating,
    'reviewCount': data.reviewCount || data.count,
    'bestRating': data.bestRating || 5,
    'worstRating': data.worstRating || 1
  };
}

/**
 * Auto-detects schema.org type based on item properties
 */
function detectSchemaType(item) {
  // Check for common blog/article properties
  if (item.title || item.headline || item.published_at || item.datePublished || item.content || item.body) {
    return 'BlogPosting';
  }
  
  // Check for product properties
  if (item.price || item.sku || item.product_id || item.in_stock !== undefined) {
    return 'Product';
  }
  
  // Check for event properties
  if (item.startDate || item.event_date || item.start_time || item.location) {
    return 'Event';
  }
  
  // Check for person properties
  if (item.firstName || item.lastName || item.email || item.jobTitle) {
    return 'Person';
  }
  
  // Check for organization properties
  if (item.organizationName || item.company || item.website) {
    return 'Organization';
  }
  
  // Default to Article for general content
  return 'Article';
}

/**
 * Auto-generates structured data based on item properties
 */
function generateAutoStructuredData(item, seoData) {
  const schemaType = detectSchemaType(item);
  
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': schemaType
  };
  
  // Common properties
  if (seoData.title) {
    structuredData.headline = seoData.title;
    structuredData.name = seoData.title;
  }
  
  if (seoData.description) {
    structuredData.description = seoData.description;
  }
  
  if (seoData.image) {
    structuredData.image = {
      '@type': 'ImageObject',
      url: seoData.image
    };
  }
  
  // Type-specific properties
  switch (schemaType) {
    case 'BlogPosting':
    case 'Article':
      if (item.published_at || item.datePublished) {
        structuredData.datePublished = item.published_at || item.datePublished;
      }
      if (item.author || item.author_name) {
        structuredData.author = {
          '@type': 'Person',
          name: typeof item.author === 'string' ? item.author : (item.author?.name || item.author_name)
        };
      }
      break;
      
    case 'Product':
      if (item.price) {
        structuredData.offers = {
          '@type': 'Offer',
          price: item.price,
          priceCurrency: item.currency || 'USD',
          availability: item.in_stock ? 'InStock' : 'OutOfStock'
        };
      }
      if (item.brand) {
        structuredData.brand = {
          '@type': 'Brand',
          name: item.brand
        };
      }
      break;
      
    case 'Event':
      if (item.startDate || item.event_date || item.start_time) {
        structuredData.startDate = item.startDate || item.event_date || item.start_time;
      }
      if (item.location) {
        structuredData.location = {
          '@type': 'Place',
          name: item.location
        };
      }
      break;
  }
  
  return structuredData;
}

// Helper function to extract keywords from text
function extractKeywordsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  
  // Simple keyword extraction - split by common delimiters and filter
  const stopWords = ['el', 'la', 'de', 'del', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'as', 'are', 'was', 'be', 'been', 'is', 'it', 'we', 'you', 'they', 'this', 'that'];
  
  return text
    .toLowerCase()
    .split(/[\s,.:;!?()[\]{}"'-]+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .filter(word => /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+$/.test(word)) // Only letters
    .slice(0, 5); // Limit per text
}

/**
 * Generates SEO-friendly meta tags from extracted data
 * Creates proper HTML meta tags for search engines
 */
export function generateSEOHTML(seoData, pageData = {}) {
  // Meta tags (title, description, OG, twitter) are handled by Next.js generateMetadata in metadata.js
  // This function now only returns empty string to avoid duplicate meta tags in <body>
  return '';
}

/**
 * Generates rich structured data scripts (JSON-LD)
 */
export function generateStructuredData(seoData, pageData = {}) {
  const scripts = [];
  
  // Add page-level structured data (including from iterations)
  if (seoData.structuredData.length > 0) {
    seoData.structuredData.forEach(data => {
      scripts.push(
        `<script type="application/ld+json">${JSON.stringify(data, null, 2)}</script>`
      );
    });
    
    // If we have iterative structured data, skip generating automatic structured data
    // as the iterative data is more specific and accurate
    if (seoData.structuredData.some(data => data['@type'] && data['@type'] !== 'WebPage' && data['@type'] !== 'CollectionPage' && data['@type'] !== 'Organization')) {
      // Still generate Organization structured data
      if (pageData.siteName) {
        const organizationData = {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": pageData.siteName,
          "url": pageData.url ? pageData.url.split('/').slice(0, 3).join('/') : ''
        };
        
        scripts.push(
          `<script type="application/ld+json">${JSON.stringify(organizationData, null, 2)}</script>`
        );
      }
      
      return scripts.join('\n');
    }
  }
  
  // Generate Article structured data if we have multiple titles/descriptions (blog posts)
  if (seoData.arrayTitles.length > 0 || seoData.arrayDescriptions.length > 0) {
    seoData.arrayTitles.forEach((title, index) => {
      if (title) {
        const articleData = {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": title,
          "description": seoData.arrayDescriptions[index] || seoData.description,
          "author": {
            "@type": "Organization",
            "name": pageData.siteName || "Website"
          },
          "publisher": {
            "@type": "Organization", 
            "name": pageData.siteName || "Website"
          },
          "url": pageData.url,
          "keywords": seoData.keywords.join(', ')
        };
        
        // Add image if available
        if (seoData.images[index]) {
          articleData.image = {
            "@type": "ImageObject",
            "url": seoData.images[index].src,
            "description": seoData.images[index].alt
          };
        }
        
        scripts.push(
          `<script type="application/ld+json">${JSON.stringify(articleData, null, 2)}</script>`
        );
      }
    });
  } else {
    // Generate basic WebPage/Article structured data
    const hasMultipleContent = seoData.arrayTitles.length > 0 || seoData.arrayDescriptions.length > 0;
    const schemaType = hasMultipleContent ? "CollectionPage" : "WebPage";
    
    const webPageData = {
      "@context": "https://schema.org",
      "@type": schemaType,
      "name": seoData.title,
      "headline": seoData.title,
      "description": seoData.description,
      "url": pageData.url || '',
      "keywords": seoData.keywords.join(', '),
      "inLanguage": pageData.language || "en"
    };
    
    // Add main image
    if (seoData.images.length > 0) {
      webPageData.image = {
        "@type": "ImageObject",
        "url": seoData.images[0].src,
        "description": seoData.images[0].alt || seoData.title
      };
    }
    
    // Add breadcrumb if we have links
    if (seoData.links.length > 0) {
      webPageData.breadcrumb = {
        "@type": "BreadcrumbList",
        "itemListElement": seoData.links.map((link, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": link.text,
          "item": link.href
        }))
      };
    }
    
    scripts.push(
      `<script type="application/ld+json">${JSON.stringify(webPageData, null, 2)}</script>`
    );
  }
  
  // Generate Organization structured data
  if (pageData.siteName) {
    const organizationData = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": pageData.siteName,
      "url": pageData.url ? pageData.url.split('/').slice(0, 3).join('/') : ''
    };
    
    scripts.push(
      `<script type="application/ld+json">${JSON.stringify(organizationData, null, 2)}</script>`
    );
  }
  
  return scripts.join('\n');
}

/**
 * HTML escape utility
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}