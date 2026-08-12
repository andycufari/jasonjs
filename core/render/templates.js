// core/render/templates.js
// Template processing for dynamic SEO from fetched data

/**
 * Processes templates with item context for iteration
 * Used when iterating over arrays to generate multiple SEO entries
 */
export function processTemplatesWithItem(obj, item, fetchData = {}) {
  // Create combined context with item taking precedence
  const contextData = { ...fetchData, item };
  return processTemplates(obj, contextData);
}

/**
 * Processes template strings like {{posts.title}} with fetched data
 * Automatically handles arrays vs single items
 */
export function processTemplates(obj, fetchData = {}) {
  // Handle strings with templates FIRST (before the object check)
  if (typeof obj === 'string') {
    return replaceTemplate(obj, fetchData);
  }
  
  if (!obj || typeof obj !== 'object') return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => processTemplates(item, fetchData));
  }
  
  // Handle objects recursively
  const processed = {};
  for (const [key, value] of Object.entries(obj)) {
    processed[key] = processTemplates(value, fetchData);
  }
  
  return processed;
}

/**
 * Replaces template strings like {{posts.title}} with actual data
 * Supports fallback syntax: {{item.excerpt || item.description}}
 */
function replaceTemplate(template, fetchData) {
  if (typeof template !== 'string') return template;

  // If the entire string is a single {{...}} template, return the raw value
  // This allows passing arrays/objects as props without stringifying
  const exactMatch = template.match(/^\{\{([^}]+)\}\}$/);
  if (exactMatch) {
    const trimmedPath = exactMatch[1].trim();

    // Handle fallback syntax with ||
    if (trimmedPath.includes('||')) {
      const paths = trimmedPath.split('||').map(p => p.trim());
      for (const fallbackPath of paths) {
        const value = resolvePath(fallbackPath, fetchData);
        if (value != null && value !== '') {
          return value;
        }
      }
      return '';
    }

    const value = resolvePath(trimmedPath, fetchData);
    return value != null ? value : '';
  }

  // For mixed text + templates (e.g. "Hello {{name}}"), stringify for concatenation
  const templateRegex = /\{\{([^}]+)\}\}/g;

  return template.replace(templateRegex, (match, path) => {
    const trimmedPath = path.trim();

    // Handle fallback syntax with ||
    if (trimmedPath.includes('||')) {
      const paths = trimmedPath.split('||').map(p => p.trim());
      for (const fallbackPath of paths) {
        const value = resolvePath(fallbackPath, fetchData);
        if (value != null && value !== '') {
          if (Array.isArray(value)) {
            return value.length > 0 ? String(value[0]) : '';
          }
          return String(value);
        }
      }
      return '';
    }

    // Regular path resolution
    const value = resolvePath(trimmedPath, fetchData);

    // If it's an array, return the first item for single value context
    // The array extraction will handle multiple values separately
    if (Array.isArray(value)) {
      return value.length > 0 ? String(value[0]) : '';
    }

    return value != null ? String(value) : '';
  });
}

/**
 * Parses path with bracket notation support
 * Converts "listing[0].title" to ["listing", "0", "title"]
 */
function parsePath(path) {
  // Replace bracket notation with dot notation
  // "listing[0].title" -> "listing.0.title"
  const normalized = path.replace(/\[(\w+)\]/g, '.$1');
  return normalized.split('.').filter(part => part !== '');
}

/**
 * Resolves dot notation paths like 'posts.title' or 'posts.*.name'
 * Also supports bracket notation like 'listing[0].title'
 */
function resolvePath(path, data) {
  const parts = parsePath(path);
  let current = data;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (part === '*') {
      // Wildcard: collect property from all array items
      if (!Array.isArray(current)) return null;
      
      const remainingPath = parts.slice(i + 1).join('.');
      if (remainingPath) {
        return current.map(item => resolvePath(remainingPath, item)).filter(v => v != null);
      } else {
        return current;
      }
    }
    
    if (current == null || typeof current !== 'object') return null;
    
    // If current is an array and we're trying to access a property (not index)
    // automatically extract that property from all items
    if (Array.isArray(current) && isNaN(parseInt(part))) {
      const remainingPath = parts.slice(i).join('.');
      return current.map(item => resolvePath(remainingPath, item)).filter(v => v != null);
    }
    
    current = current[part];
  }
  
  return current;
}

/**
 * Extracts array values for SEO from template results
 * {{posts.title}} where posts is array -> returns array of titles
 */
export function extractArrayValues(obj, fetchData = {}) {
  const results = {};
  
  function extract(value, key) {
    if (typeof value !== 'string') return;
    
    const templateRegex = /\{\{([^}]+)\}\}/g;
    let match;
    
    while ((match = templateRegex.exec(value)) !== null) {
      const path = match[1].trim();
      const resolvedValue = resolvePath(path, fetchData);
      
      if (Array.isArray(resolvedValue)) {
        if (!results[key]) results[key] = [];
        results[key].push(...resolvedValue.filter(v => v != null));
      }
    }
  }
  
  // Recursively extract from object
  function traverse(obj, prefix = '') {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item, prefix));
      return;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        extract(value, key);
      } else if (typeof value === 'object') {
        traverse(value, fullKey);
      }
    }
  }
  
  traverse(obj);
  return results;
}

/**
 * Example usage:
 * 
 * const fetchData = {
 *   posts: [
 *     { title: "Post 1", excerpt: "Post 1 excerpt", author: { name: "John" } },
 *     { title: "Post 2", description: "Post 2 description", author: { name: "Jane" } }
 *   ],
 *   user: { name: "Admin" }
 * };
 * 
 * processTemplates("{{posts.title}}", fetchData) 
 * // Returns: "Post 1, Post 2"
 * 
 * processTemplates("{{posts.*.title}}", fetchData)
 * // Returns: "Post 1, Post 2"
 * 
 * processTemplatesWithItem("{{item.excerpt || item.description}}", fetchData.posts[0], fetchData)
 * // Returns: "Post 1 excerpt"
 * 
 * processTemplatesWithItem("{{item.excerpt || item.description}}", fetchData.posts[1], fetchData)
 * // Returns: "Post 2 description"
 * 
 * extractArrayValues({ title: "{{posts.title}}" }, fetchData)
 * // Returns: { title: ["Post 1", "Post 2"] }
 */