// studio/core/databases/transformers/notionReverse.js

const inferPropertyType = (value, key) => {
  // Special cases first
  if (key === 'Title' || key === 'Name') return 'title';
  if (key === 'Date' || key.endsWith('Date')) return 'date';
  
  if (value === null || value === undefined) return null;
  
  if (Array.isArray(value)) {
    if (value.length === 0) return 'multi_select';
    if (typeof value[0] === 'string') return 'multi_select';
    if (typeof value[0] === 'object' && value[0].id) return 'relation';
    return 'multi_select';
  }

  switch (typeof value) {
    case 'string':
      if (value.match(/^https?:\/\//)) return 'url';
      if (value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'email';
      return 'rich_text';
    case 'number':
      return 'number';
    case 'boolean':
      return 'checkbox';
    case 'object':
      if (value instanceof Date) return 'date';
      return null;
    default:
      return null;
  }
};

const transformValueToNotion = (value, type, relationConfig = null) => {
  // Return null for empty strings, null or undefined values
  if (value === null || value === undefined || value === '') return null;

  switch (type) {
    case 'title':
      return {
        title: [
          {
            type: 'text',
            text: { content: String(value) }
          }
        ]
      };

    case 'rich_text':
      return {
        rich_text: [
          {
            type: 'text',
            text: { content: String(value) }
          }
        ]
      };

    case 'number':
      return { number: Number(value) };

    case 'url':
      return { url: value };

    case 'email':
      return { email: value };

    case 'checkbox':
      return { checkbox: Boolean(value) };

    case 'date': {
      let dateValue = value;
      if (typeof value === 'string') {
        // Try to parse the string as a date
        dateValue = new Date(value);
      }
      return {
        date: {
          start: dateValue instanceof Date ? 
            dateValue.toISOString().split('T')[0] : // Just the date part
            String(value)
        }
      };
    }

    case 'multi_select':
      if (!Array.isArray(value)) value = [value];
      return {
        multi_select: value.map(item => ({
          name: String(item)
        }))
      };

    case 'select':
      // For select fields, only create property if value is not empty
      if (value === '') return null;
      return {
        select: { name: String(value) }
      };

      case 'relation': {
        // Always make value an array for consistent processing
        if (!Array.isArray(value)) value = [value];
        
        // Debug the relation field conversion
        console.log("Processing relation field with values:", value);
        
        return {
          relation: value.map(item => {
            // If item is an object with an id field, use that
            if (item && typeof item === 'object' && 'id' in item) {
              console.log(`Using object id: ${item.id}`);
              return { id: String(item.id) };
            }
            
            // Check if item is a valid UUID
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (typeof item === 'string' && uuidPattern.test(item)) {
              console.log(`Using UUID: ${item}`);
              return { id: item };
            }
            
            // For non-UUID values, log a warning
            console.warn(`Relation received non-UUID value: ${item}. This may cause an error.`);
            return { id: String(item) };
          })
        };
      }

    default:
      return null;
  }
};

export const transformToNotionProperties = (data, schema = null) => {
  const properties = {};

  // If we have a schema, use it to transform the data according to the schema
  if (schema) {
    Object.entries(data).forEach(([key, value]) => {
      // Skip special fields that are handled differently
      if (['id', 'createdAt', 'updatedAt', 'cover', 'icon'].includes(key)) return;

      // Warn if field is not in schema
      if (!schema[key]) {
        console.warn(`Field "${key}" is not defined in the Notion schema and will be ignored.`);
        return;
      }

      // Handle both simple string type and complex object type schemas
      let notionType, relationConfig;
      if (typeof schema[key] === 'string') {
        notionType = schema[key];
      } else if (typeof schema[key] === 'object') {
        // For relationship fields
        if (schema[key].type === 'simple' || schema[key].type === 'multiple') {
          notionType = 'relation';
          relationConfig = schema[key];
        } else {
          notionType = schema[key].type;
        }
      }

      // Map common type names to Notion types (case-insensitive)
      // Normalize to lowercase first, then map to official Notion property types
      const mappedType = notionType.toLowerCase();
      const notionMappedType = {
        'text': 'rich_text',
        'string': 'rich_text',
        'rich_text': 'rich_text',
        'number': 'number',
        'date': 'date',
        'checkbox': 'checkbox',
        'select': 'select',
        'multiselect': 'multi_select',
        'multi_select': 'multi_select',
        'relation': 'relation',
        'url': 'url',
        'email': 'email',
        'title': 'title'
      }[mappedType] || mappedType;

      const transformedValue = transformValueToNotion(value, notionMappedType, relationConfig);
      if (transformedValue) {
        properties[key] = transformedValue;
      }
    });
  } else {
    // Original behavior when no schema is provided
    // Handle Title field first if it exists
    if (data.Title) {
      properties.Title = transformValueToNotion(data.Title, 'title');
    }

    // Handle all other fields
    Object.entries(data).forEach(([key, value]) => {
      // Skip already processed Title and special fields
      if (key === 'Title' || ['id', 'createdAt', 'updatedAt', 'cover', 'icon'].includes(key)) return;

      const type = inferPropertyType(value, key);
      if (type) {
        const transformedValue = transformValueToNotion(value, type);
        if (transformedValue) {
          properties[key] = transformedValue;
        }
      }
    });
  }

  return properties;
};
  
  // Special handler for page updates
  export const prepareNotionUpdate = (data, schema = null) => {
    const update = {
      properties: transformToNotionProperties(data, schema)
    };
  
    // Handle cover if present
    if (data.cover) {
      update.cover = {
        type: 'external',
        external: { url: data.cover }
      };
    }
  
    // Handle icon if present
    if (data.icon) {
      if (data.icon.length <= 2) {
        update.icon = { type: 'emoji', emoji: data.icon };
      } else {
        update.icon = {
          type: 'external',
          external: { url: data.icon }
        };
      }
    }
  
    return update;
  };