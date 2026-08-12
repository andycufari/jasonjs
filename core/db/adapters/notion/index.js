// studio/core/databases/notion/index.js
import { Client } from '@notionhq/client';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { transformNotionData } from './transformers/notion';
import { transformToNotionProperties, prepareNotionUpdate } from './transformers/notionReverse';
import { warmImageCache } from './warmImageCache';

// Make sure we're always revalidating frequently during development
export const revalidate = 1; // Always use 1 second for now

// Add this utility at the top
const decodeHTMLEntities = (obj) => {
  const HTML_ENTITIES = {
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    '&#039;': "'",
    '&apos;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&#x2019;': "'",
    '&#x2018;': "'",
    '&#x201C;': '"',
    '&#x201D;': '"',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&deg;': '°',
    '&plusmn;': '±',
    '&para;': '¶',
    '&sect;': '§',
    '&euro;': '€',
    '&pound;': '£',
    '&cent;': '¢',
    '&micro;': 'µ'
  };

  const decode = (text) => {
    if (typeof text !== 'string') return text;
    return text.replace(/&[#\w]+;/g, match => HTML_ENTITIES[match] || match);
  };

  const processValue = (value) => {
    if (typeof value === 'string') return decode(value);
    if (Array.isArray(value)) return value.map(processValue);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, processValue(v)])
      );
    }
    return value;
  };

  return processValue(obj);
};

function getNotionClient(apiKey) {
  return new Client({ auth: apiKey });
}

const getCachedPageData = unstable_cache(
  async (pageId, apiKey) => {
    try {
      const notion = getNotionClient(apiKey);
      const response = await notion.blocks.children.list({
        block_id: pageId,
        page_size: 100,
      });
      
      // Fetch any child blocks for list items, toggles, etc.
      const blocks = response.results;
      
      // Process blocks to fetch their children if they have any
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (block.has_children) {
          const childBlocks = await notion.blocks.children.list({
            block_id: block.id,
            page_size: 100,
          });
          
          // Recursively fetch children of children for nested lists
          const processedChildren = await Promise.all(
            childBlocks.results.map(async (childBlock) => {
              if (childBlock.has_children) {
                const nestedChildren = await notion.blocks.children.list({
                  block_id: childBlock.id,
                  page_size: 100,
                });
                childBlock.children = nestedChildren.results;
              }
              return childBlock;
            })
          );
          
          blocks[i].children = processedChildren;
        }
      }
      
      return blocks;
    } catch (error) {
      console.error('Error fetching page blocks:', error);
      return [];
    }
  },
  ['notion-page-blocks'],
  { revalidate }
);


function processDateOperators(query) {
  if (!query || typeof query !== 'object') return query;

  const processValue = (value) => {
    if (typeof value !== 'string') return value;

    // Match patterns like {{-2 days}}, {{-1 week}}, {{-3 months}}
    const dateMatch = value.match(/{{(-?\d+)\s+(day|days|week|weeks|month|months)}}/);
    if (dateMatch) {
      const [_, amount, unit] = dateMatch;
      const now = new Date();

      switch (unit) {
        case 'day':
        case 'days':
          now.setDate(now.getDate() + parseInt(amount));
          break;
        case 'week':
        case 'weeks':
          now.setDate(now.getDate() + (parseInt(amount) * 7));
          break;
        case 'month':
        case 'months':
          now.setMonth(now.getMonth() + parseInt(amount));
          break;
      }

      return now.toISOString();
    }

    return value;
  };

  // Deep clone and process the query
  return Object.keys(query).reduce((acc, key) => {
    const value = query[key];

    if (Array.isArray(value)) {
      acc[key] = value.map(item => processDateOperators(item));
    } else if (typeof value === 'object' && value !== null) {
      acc[key] = processDateOperators(value);
    } else {
      acc[key] = processValue(value);
    }

    return acc;
  }, Array.isArray(query) ? [] : {});
}


const getCachedQueryResults = unstable_cache(
  async (databaseId, filter, sorts, apiKey) => {
    try {
      const notion = getNotionClient(apiKey);
      const response = await notion.databases.query({
        database_id: databaseId,
        filter: filter && Object.keys(filter).length > 0 ? filter : undefined,
        sorts: sorts && sorts.length > 0 ? sorts : undefined,
      });
      return response.results;
    } catch (error) {
      console.error('Error fetching query results:', error);
      return [];
    }
  },
  ['notion-query-results'],
  { revalidate }
);

// Add these utility functions at the top after imports
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

const transformSimpleQuery = (query, schema) => {
  // If query is already in Notion format (has filter/sorts properties), return as is
  if (query.filter || query.sorts) {
    return query;
  }

  const notionQuery = {};
  const filter = { and: [] };
  const sorts = [];

  // Handle special query parameters (system params that should not be treated as filters)
  const specialParams = [
    'fetch_type', 'fetchType', 'order_by', 'order_type', 'limit',
    'database', 'id', 'operation', 'api_key', 'database_id',
    'page_size', 'start_cursor', 'type', 'filters',
    'sort', 'sorts', // Sort params should not be treated as filters
    'single', 'findOne' // Single record flags
  ];

  // Handle fetch_type (supports both snake_case and camelCase)
  if (query.fetch_type || query.fetchType) {
    notionQuery.fetchType = query.fetch_type || query.fetchType;
  }

  // Handle ordering - supports multiple formats
  if (query.order_by) {
    sorts.push({
      property: query.order_by,
      direction: (query.order_type || 'asc').toLowerCase()
    });
  }
  // Handle sort object format: { property: "Field", direction: "descending" }
  if (query.sort && typeof query.sort === 'object') {
    sorts.push(query.sort);
  }
  // Handle sorts array format
  if (query.sorts && Array.isArray(query.sorts)) {
    sorts.push(...query.sorts);
  }

  // Handle limit
  if (query.limit) {
    notionQuery.page_size = parseInt(query.limit);
  }

  // Process all other fields as filters
  Object.entries(query).forEach(([key, value]) => {
    if (specialParams.includes(key)) return;

    // Skip undefined, null, or empty string values
    if (value === undefined || value === null || value === '') return;

    // Get field type from schema if available
    let fieldType = schema?.[key];
    if (typeof fieldType === 'object') {
      fieldType = fieldType.type;
    }

    let condition;
    
    // Handle different value types
    if (Array.isArray(value)) {
      if (fieldType === 'relation' || (typeof fieldType === 'object' && fieldType.type === 'relation')) {
        condition = {
          or: value.map(v => ({
            property: key,
            relation: {
              contains: v
            }
          }))
        };
      } else {
        condition = {
          or: value.map(v => ({
            property: key,
            [fieldType?.toLowerCase() || inferPropertyType(v, key)]: {
              equals: v
            }
          }))
        };
      }
    } else if (typeof value === 'object' && value !== null) {
      // Handle special operators like gt, lt, contains, etc.
      const operators = {
        gt: 'greater_than',
        gte: 'greater_than_or_equal_to',
        lt: 'less_than',
        lte: 'less_than_or_equal_to',
        contains: 'contains',
        starts_with: 'starts_with',
        ends_with: 'ends_with',
        not: 'does_not_equal'
      };

      const op = Object.keys(value)[0];
      const val = value[op];

      if (fieldType === 'relation' || (typeof fieldType === 'object' && fieldType.type === 'relation')) {
        condition = {
          property: key,
          relation: {
            contains: val
          }
        };
      } else {
        condition = {
          property: key,
          [fieldType?.toLowerCase() || inferPropertyType(val, key)]: {
            [operators[op] || op]: val
          }
        };
      }
    } else {
      // Special handling for relation fields
      if (fieldType === 'relation' || (typeof fieldType === 'object' && fieldType.type === 'relation')) {
        condition = {
          property: key,
          relation: {
            contains: value
          }
        };
      } else {
        condition = {
          property: key,
          [fieldType?.toLowerCase() || inferPropertyType(value, key)]: {
            equals: value
          }
        };
      }
    }

    // Only push valid conditions (must have at least one property type defined)
    if (condition && typeof condition === 'object') {
      // Check if the condition has a valid structure
      const hasValidProperty = Object.keys(condition).some(k => {
        if (k === 'property') return false; // 'property' alone is not enough
        if (k === 'or' || k === 'and') return true; // Nested conditions are valid
        return condition[k] && typeof condition[k] === 'object'; // Has a property type with value
      });

      if (hasValidProperty) {
        filter.and.push(condition);
      } else {
        console.warn(`Skipping invalid filter condition for key "${key}":`, condition);
      }
    }
  });

  // Only add filter if there are conditions
  if (filter.and.length > 0) {
    notionQuery.filter = filter.and.length === 1 ? filter.and[0] : filter;
  }

  // Add sorts if any
  if (sorts.length > 0) {
    notionQuery.sorts = sorts;
  }

  return notionQuery;
};

export const fetchData = cache(async (query, databaseConfig) => {
  let finalQuery = {};

  // Handle nested query object (legacy format with type: "notion" and nested query)
  // Example: { type: "notion", database: "...", query: { filter: {...}, sorts: [...] } }
  if (query.query && typeof query.query === 'object') {
    query = query.query;
  }

  // Handle filters field (from pageData.js normalization)
  // Example: { type: "notion", database: "blog", filters: { and: [...], sorts: [...] } }
  if (query.filters && typeof query.filters === 'object' && !query.filter && !query.sorts) {
    const { and, or, sorts, filter, fetchType, fetch_type, sort, single, findOne, ...otherFilters } = query.filters;

    // Extract fetchType if present (supports both formats)
    if (fetchType || fetch_type) {
      query.fetchType = fetchType || fetch_type;
    }

    // If filters has a nested 'filter' property (from query.query.filter structure)
    if (filter) {
      query.filter = filter;
    }
    // If filters has 'and' or 'or', that's the actual filter structure
    else if (and || or) {
      query.filter = and ? { and } : { or };
    }
    // Otherwise, if there are other filters (simple key-value format like { Published: true })
    // Transform them using schema
    else if (Object.keys(otherFilters).length > 0) {
      // These are simple filters that need transformation
      // Mark them for transformation by NOT setting query.filter yet
      // Instead, merge them back to query for transformSimpleQuery to handle
      // But exclude any sort-related fields that might have leaked through
      const { sort: extraSort, sorts: extraSorts, ...actualFilters } = otherFilters;
      if (extraSort && !sort) {
        query.sorts = [extraSort];
      }
      if (extraSorts && !sorts) {
        query.sorts = extraSorts;
      }
      if (Object.keys(actualFilters).length > 0) {
        Object.assign(query, actualFilters);
      }
    }

    // Extract sorts if present (supports both 'sorts' array and 'sort' object)
    if (sorts) {
      query.sorts = sorts;
    } else if (sort) {
      // Convert single sort object to array format
      query.sorts = [sort];
    }

    // Remove the filters field since we've extracted its content
    delete query.filters;
  }

  // If query already has filter/sorts (legacy format), use it directly
  if (query.filter || query.sorts) {
    // Legacy format - already in proper Notion API format, just add database_id
    // But still need to process date operators like {{-3 days}}
    const processedFilter = query.filter ? processDateOperators(query.filter) : query.filter;

    // Extract fetchType if present (before building finalQuery)
    const fetchType = query.fetchType;

    // Build finalQuery with only valid Notion API fields
    finalQuery = {
      database_id: databaseConfig.database_id,
      filter: processedFilter
    };

    // Add sorts if present
    if (query.sorts) {
      finalQuery.sorts = query.sorts;
    }

    // Add fetchType for internal processing (not sent to Notion API)
    if (fetchType) {
      finalQuery.fetchType = fetchType;
    }
  } else if (query.and || query.or) {
    // Handle direct and/or operators
    const { sorts, ...filterParts } = query;

    finalQuery = {
      database_id: databaseConfig.database_id,
      filter: processDateOperators(filterParts)
    };

    if (sorts) {
      finalQuery.sorts = sorts;
    }
  } else {
    // Transform simple query to Notion format
    const processedQuery = transformSimpleQuery(query, databaseConfig.schema);

    // Process date operators
    finalQuery = {
      database_id: databaseConfig.database_id,
      ...processedQuery,
      filter: processedQuery.filter ? processDateOperators(processedQuery.filter) : processedQuery.filter
    };
  }

  if (finalQuery.fetchType === 'page') {
    try {
      const notion = getNotionClient(databaseConfig.api_key);

      // Build clean query for Notion API (exclude internal fields)
      // For page queries, we only need the first result
      const notionQuery = {
        database_id: finalQuery.database_id,
        page_size: 1  // Optimize: only fetch one result for page queries
      };
      if (finalQuery.filter) notionQuery.filter = finalQuery.filter;
      if (finalQuery.sorts) notionQuery.sorts = finalQuery.sorts;

      const response = await notion.databases.query(notionQuery);
      const results = response.results;

      if (results.length > 0) {
        const page = results[0];
        const blocks = await getCachedPageData(page.id, databaseConfig.api_key);

        // Warm the proxy image cache while the presigned S3 signatures are
        // still fresh (seconds old). This makes the on-disk cache the source of
        // truth for the bytes, so the 1h signature expiry can't blank an image
        // for a later visitor. Awaited so the very first render is already warm.
        await warmImageCache(blocks, page);

        const data = { page, blocks };

        const transformed = transformNotionData(data, 'page');
        return decodeHTMLEntities(transformed);
      }
      return null;
    } catch (error) {
      console.error('Error in page query:', error);
      throw error;
    }
  }

  // Handle regular database queries
  try {
    const notion = getNotionClient(databaseConfig.api_key);

    // Build clean query for Notion API (exclude internal fields like fetchType)
    const notionQuery = {
      database_id: finalQuery.database_id
    };
    if (finalQuery.filter) notionQuery.filter = finalQuery.filter;
    if (finalQuery.sorts) notionQuery.sorts = finalQuery.sorts;
    if (finalQuery.page_size) notionQuery.page_size = finalQuery.page_size;

    const response = await notion.databases.query(notionQuery);
    const results = response.results;

    const transformed = transformNotionData(results, 'query');
    return decodeHTMLEntities(transformed);
  } catch (error) {
    console.error('Error in database query:', error);
    console.error('Failed query was:', JSON.stringify(finalQuery, null, 2));
    throw error;
  }
});

// Add this helper function
const createRelatedRecords = async (parentData, relationships, databaseConfig) => {
  const results = [];
  
  for (const [relationKey, relationConfig] of Object.entries(relationships)) {
    const childRecords = parentData[relationKey];
    if (!childRecords || !Array.isArray(childRecords)) continue;

    // Process each child record
    for (const childData of childRecords) {
      // Add parent relation if configured
      const processedChild = { ...childData };
      if (relationConfig.fields.parent) {
        const parentField = relationConfig.fields.parent.source;
        const parentValue = parentData[parentField];
        
        // We need to get the parent UUID instead of just the parent value
        // First check if we already have the UUID (parent ID)
        if (parentData.id) {
          // If we already have the parent ID, use it
          processedChild.parent = parentData.id;
        } else {
          // Otherwise, we need to fetch the parent record to get its ID
          const parentQuery = {
            filter: {
              property: parentField,
              title: {
                equals: parentValue
              }
            }
          };
          
          console.log(`Fetching parent record with ${parentField}=${parentValue} to get UUID`);
          
          // Fetch the parent record
          const parentRecords = await fetchData(parentQuery, databaseConfig);
          console.log("Found parent records:", parentRecords ? parentRecords.length : 0);
          
          if (parentRecords && parentRecords.length > 0) {
            // Use the parent ID as the parent relation value
            processedChild.parent = parentRecords[0].id;
            console.log("Using parent ID:", parentRecords[0].id);
          } else {
            // If parent not found, skip this child or use a placeholder (this should be rare)
            console.warn(`Parent record with ${parentField}=${parentValue} not found. Unable to set parent relation properly.`);
            // Skip this child since we can't properly set the parent relation
            continue;
          }
        }
      }

      // Create child record with its own schema derived from relationship config
      const childSchema = {
        ...databaseConfig.schema,
        ...relationConfig.fields
      };

      const childConfig = {
        api_key: databaseConfig.api_key, // Inherit API key
        database_id: databaseConfig.database_id, // Child is in the same DB
        schema: {
          ...relationConfig.fields, // Use the schema defined for the child type in the parent's config
          // Define the primary key for the child
          primary_key: relationConfig.fields.primary_key || databaseConfig.schema.primary_key, // Keep primary key logic
          // Ensure the parent relation field name ('parent') is defined in the child's schema (relationConfig.fields)
          // If not explicitly defined, we assume it should be 'Relation'
          parent: relationConfig.fields.parent || 'Relation'
        }
      };

      try {
        const result = await createData(processedChild, childConfig);
        results.push(result);
      } catch (error) {
        console.error(`Error creating child record:`, error);
        throw error;
      }
    }
  }
  
  return results;
};

export const createData = async (data, databaseConfig) => {
  const notion = getNotionClient(databaseConfig.api_key);
  //console.log("Database config: ", databaseConfig);
  //console.log("Data: ", data);
  
  try {
    // Separate children data from main record
    const regularData = { ...data };
    const childrenToCreate = [];

    // Extract children data based on schema
    if (databaseConfig.schema) {
      const relationField = Object.entries(databaseConfig.schema)
        .find(([field, type]) => typeof type === 'string' && type.toLowerCase() === 'relation')?.[0];
      
      // If we have a parent ID in the data and a relation field in the schema
      if (data.parent && relationField) {
        // Use the relation field name from your schema instead of "parent"
        data[relationField] = data.parent;
        delete data.parent; // Remove the generic "parent" field
      }
    }

    // Check for primary key if defined in schema
    if (databaseConfig.schema?.primary_key) {
      const primaryKey = databaseConfig.schema.primary_key;
      const primaryValue = regularData[primaryKey];
      
      if (primaryValue) {
        // Search for existing record with this primary key
        const existingRecord = await fetchData({
          [primaryKey]: primaryValue
        }, databaseConfig);

        if (existingRecord && existingRecord.length > 0) {
          console.log(`Record with ${primaryKey}=${primaryValue} already exists. Updating instead of creating.`);
          const parentId = existingRecord[0].id; // Get the actual parent UUID
          const updatedRecord = await updateData(parentId, regularData, databaseConfig);
          
          // Create children for existing record
          if (childrenToCreate.length > 0) {
            console.log("Creating/updating child records for existing parent ID:", parentId);
            for (const { field, config, data: childrenData } of childrenToCreate) {
              for (const childData of childrenData) {
                // Find the relation field in the child schema
                const relationField = Object.keys(config.schema).find(k => 
                  config.schema[k].toLowerCase() === 'relation' || 
                  (typeof config.schema[k] === 'object' && config.schema[k].type === 'relation')
                );
                
                if (relationField) {
                  console.log(`Setting relation field "${relationField}" for child to parent ID: ${parentId}`);
                  childData[relationField] = parentId; // Use the relation field name from schema
                } else {
                  console.warn("No relation field found in child schema. Available fields:", Object.keys(config.schema));
                  continue; // Skip this child record
                }
                
                // Create child with its schema
                console.log("Using child schema:", config.schema);
                const childConfig = {
                  api_key: databaseConfig.api_key,
                  database_id: databaseConfig.database_id,
                  schema: config.schema
                };
                
                try {
                  console.log("Creating child with data:", JSON.stringify(childData));
                  await createData(childData, childConfig);
                } catch (error) {
                  console.error("Error creating child record:", error);
                  // Continue with other children
                }
              }
            }
          }
          
          return updatedRecord;
        }
      }
    }
    
    // Create main record
    const properties = transformToNotionProperties(regularData, databaseConfig.schema);

    const response = await notion.pages.create({
      parent: { database_id: databaseConfig.database_id },
      properties
    });

    // Get the UUID of the newly created parent
    const parentId = response.id;

    // Create children records if any
    if (childrenToCreate.length > 0) {
      for (const { field, config, data: childrenData } of childrenToCreate) {
        for (const childData of childrenData) {
          // Set up parent relation using the UUID
          const childRecord = {
            ...childData,
            parent: parentId // Use the UUID of the parent, not the primary key value
          };

          // Create child with its schema
          // Construct childConfig using ONLY the child's schema definition from the parent config
          const childConfig = {
            api_key: databaseConfig.api_key, // Inherit API key
            database_id: databaseConfig.database_id, // Child is in the same DB
            schema: {
              ...config.schema, // Use the schema defined for the child type in the parent's config
              // Define the primary key for the child
              primary_key: config.schema.primary_key || databaseConfig.schema.primary_key, // Keep primary key logic
              // Ensure the parent relation field name ('parent') is defined in the child's schema (config.schema)
              // If not explicitly defined, we assume it should be 'Relation'
              parent: config.schema.parent || 'Relation' 
            }
          };

          // Check if child already exists by its primary key
          if (childConfig.schema.primary_key) {
            const childPrimaryKey = childConfig.schema.primary_key;
            const childPrimaryValue = childData[childPrimaryKey];
            
            if (childPrimaryValue) {
              // Get field type from schema for proper filter construction
              const primaryKeyType = childConfig.schema[childPrimaryKey] || 'title';
              const propertyType = typeof primaryKeyType === 'string' ? primaryKeyType.toLowerCase() : 'title';
              
              // Only filter by the primary key without relation to avoid UUID issues
              const query = {
                filter: {
                  property: childPrimaryKey,
                  [propertyType]: {
                    equals: childPrimaryValue
                  }
                }
              };
              
              const existingChild = await fetchData(query, childConfig);

              // If we find a matching record, check if it's the right one by examining its parent field
              if (existingChild && existingChild.length > 0) {
                // Check if the parent matches (this is a client-side check)
                const matchingChildren = existingChild.filter(child => 
                  child.parent === parentId || 
                  (Array.isArray(child.parent) && child.parent.includes(parentId))
                );
                
                if (matchingChildren.length > 0) {
                  console.log(`Child record with ${childPrimaryKey}=${childPrimaryValue} already exists. Updating instead of creating.`);
                  await updateData(matchingChildren[0].id, childRecord, childConfig);
                  continue; // Skip creation
                }
              }
            }
          }

          await createData(childRecord, childConfig);
        }
      }
    }
    
    // Pass 'create' type to handle single page response
    return transformNotionData(response, 'create');
  } catch (error) {
    console.error('Error in createData:', error.message);
    throw error;
  }
};

export const updateData = async (updateConfig, databaseConfig) => {
  try {
    // Extract pageId and data from updateConfig (matches Database class call pattern)
    const pageId = updateConfig.id;
    const data = updateConfig.data;
    const config = databaseConfig;

    const notion = new Client({ auth: config.api_key });
     // Extract children data for processing after main update
     const childrenToProcess = {};
     if (config.schema) {
       Object.entries(config.schema).forEach(([field, fieldConfig]) => {
         if (typeof fieldConfig === 'object' && fieldConfig.type === 'children' && data[field]) {
           childrenToProcess[field] = {
             config: fieldConfig,
             data: data[field]
           };
           // Remove from main update data
           delete data[field];
         }
       });
     }

    // Handle special operations
    if (data.operation) {
      const { operation, field, value } = data;

      // First get current page
      const page = await notion.pages.retrieve({ page_id: pageId });
      const currentProperty = page.properties[field];

      let updatedValue;

      switch (operation) {
        case 'increment':
          updatedValue = {
            number: (currentProperty?.number || 0) + value
          };
          break;

        case 'append':
          const currentValues = currentProperty?.multi_select || currentProperty?.relation || [];
          updatedValue = {
            [currentProperty?.type]: [
              ...currentValues,
              typeof value === 'string' ? { name: value } : value
            ]
          };
          break;

        case 'remove':
          const values = currentProperty?.multi_select || currentProperty?.relation || [];
          updatedValue = {
            [currentProperty?.type]: values.filter(v =>
              v.name !== value && v.id !== value
            )
          };
          break;

        case 'toggle':
          updatedValue = {
            checkbox: !currentProperty?.checkbox
          };
          break;

        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      const response = await notion.pages.update({
        page_id: pageId,
        properties: {
          [field]: updatedValue
        }
      });
      return transformNotionData(response, 'update');
    }

    // Regular update - convert simplified data to Notion format using schema
    const properties = transformToNotionProperties(data, config.schema);
    const response = await notion.pages.update({
      page_id: pageId,
      properties
    });

    // Process children after main update succeeds
    if (Object.keys(childrenToProcess).length > 0) {
      for (const [field, { config: childConfig, data: childrenData }] of Object.entries(childrenToProcess)) {
        for (const childData of childrenData) {
          // Set up relation field using the parent_key
          const relationField = Object.keys(childConfig.schema).find(k =>
            childConfig.schema[k].toLowerCase() === 'relation' ||
            (typeof childConfig.schema[k] === 'object' && childConfig.schema[k].type === 'relation')
          );

          if (relationField) {
            childData[relationField] = pageId;
          } else {
            console.error(`No relation field found in child schema. Available fields:`, Object.keys(childConfig.schema));
          }

          // Create child with proper schema
          try {
            const childDatabaseConfig = {
              api_key: config.api_key,
              database_id: config.database_id,
              schema: childConfig.schema
            };

            await createData(childData, childDatabaseConfig);
          } catch (childError) {
            console.error(`Error creating child record:`, childError);
            // Continue processing other children even if one fails
          }
        }
      }
    }
    
    return transformNotionData(response, 'update');
  } catch (error) {
    console.error('Error in updateData:', error);
    throw error;
  }
};

export const deleteData = async (pageId, databaseConfig) => {
  const notion = getNotionClient(databaseConfig.api_key);
  const response = await notion.pages.update({
    page_id: pageId,
    archived: true,
  });
  return response;
};