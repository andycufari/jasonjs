// core/render/sitemap.js
import { getFilesByClass } from '../sites/files.js';
import jasonConfig from '../../jason.config';
import { loadPageDefinition } from '../render/loadPage';
import Database from '../db';

/**
 * Validates if a page should be included in public sitemap
 * @param {Object} pageJson - Parsed page JSON configuration
 * @returns {boolean} - true if page is public, false if protected
 */
function isPagePublic(pageJson) {
  // Exclude if auth required
  if (pageJson.auth === true) return false;

  // Exclude if specific roles required
  if (pageJson.roles && Array.isArray(pageJson.roles) && pageJson.roles.length > 0) return false;

  // Exclude if explicitly hidden from sitemap
  if (pageJson.sitemap?.hidden === true) return false;

  return true;
}

export async function generateSitemapAndRss(siteId, baseUrl = null) {
  try {
    // Fetch global settings
    const globalSettings = await loadPageDefinition({});
    const siteMeta = globalSettings.meta || {};
    
    // Fetch all pages via the unified file system (local sites/ or adapter)
    const pages = await getFilesByClass(siteId, 'page');
    let entries = [];
    
    // Process static pages first
    for (const page of pages) {
      try {
        const pageJson = JSON.parse(page.content);

        // SECURITY: Skip protected pages from sitemap
        if (!isPagePublic(pageJson)) {
          continue;
        }
        
        const url = generateUrlFromPage(page.name, pageJson);
        
        if (url) {
          entries.push({
            url,
            lastModified: new Date(page.updatedAt || Date.now()),
            changeFrequency: 'daily',
            priority: 1.0,
            title: pageJson.meta?.title || siteMeta.title || '',
            description: pageJson.meta?.description || siteMeta.description || '',
          });
        }
        
        // Process dynamic content from database
        if (pageJson.sitemap?.dynamic ||
            pageJson.fetch_data && ['aprende/sobre/contenido', 'talleres/de/contenido', 'proyectos/vista', 'prensa/nota'].includes(page.name)) {
          const dynamicEntries = await generateDynamicEntries(siteId, page.name, pageJson, baseUrl, globalSettings);
          if (dynamicEntries.length > 0) {
            entries = entries.concat(dynamicEntries);
          }
        }
      } catch (error) {
        console.error(`Error processing page ${page.name}:`, error);
        continue;
      }
    }
    
    // Add site network to sitemap
    entries.push({
      url: '/site-network',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
      title: jasonConfig.network.title,
      description: jasonConfig.network.description,
    });
    
    console.log(`[sitemap] Total entries: ${entries.length}`);
    return { entries, siteMeta };
  } catch (error) {
    console.error(`Error generating sitemap:`, error);
    return { entries: [], siteMeta: {} };
  }
}

function generateUrlFromPage(pageName, pageJson) {
  if (pageName === 'index') {
    return '/';
  }

  // Skip pages that are hidden from sitemap
  if (pageJson.sitemap && pageJson.sitemap.hidden) {
    return null;
  }

  // Skip dynamic template pages (contain :param placeholders)
  // These are expanded via generateDynamicEntries on their parent page
  if (pageName.includes(':')) {
    return null;
  }

  return `/${pageName}`;
}

async function generateDynamicEntries(siteId, pageName, pageJson, baseUrl, globalSettings) {
  const entries = [];
  
  try {
    // Early return if required fields are missing
    if (!pageJson.fetch_data) {
      console.log(`Missing fetch_data config for ${pageName}`);
      return entries;
    }
    
    // fetch_data supports two formats:
    // 1. Flat: { database: "x", query: {...} }
    // 2. Named key: { "news": { database: "x", query: {...} } }
    let fetchData = pageJson.fetch_data || {};
    let database = fetchData.database;
    let query = fetchData.query || fetchData.filters;

    // If no direct database field, look for the first named key
    if (!database) {
      const keys = Object.keys(fetchData).filter(k => k !== 'type');
      if (keys.length > 0) {
        const firstEntry = fetchData[keys[0]];
        if (firstEntry && typeof firstEntry === 'object' && firstEntry.database) {
          database = firstEntry.database;
          query = firstEntry.query || firstEntry.filters;
        }
      }
    }

    const { urlPattern, query: sitemapQuery, overrideQuery = null } = pageJson.sitemap || {};

    if (!database) {
      console.warn(`Missing database configuration for ${pageName}`);
      return entries;
    }
    
    // For pages that only specify database but not explicit sitemap query config,
    // we can still generate dynamic URLs based on the route pattern and database results
    let effectiveUrlPattern = urlPattern;
    let effectiveParams = {};
    
    // If no explicit urlPattern is provided, try to infer it from the route pattern or page name
    if (!effectiveUrlPattern) {
      if (pageName === 'proyectos/vista') {
        effectiveUrlPattern = '/proyectos/:slug';
        effectiveParams = { ":slug": "Slug" };
      } else if (pageName === 'aprende/sobre/contenido') {
        effectiveUrlPattern = '/aprende/sobre/:category/:slug';
        effectiveParams = { ":category": "Category", ":slug": "Slug" };
      } else if (pageName === 'talleres/de/contenido') {
        effectiveUrlPattern = '/talleres/de/:category/:slug';
        effectiveParams = { ":category": "Category", ":slug": "Slug" };
      } else if (pageName === 'prensa/nota') {
        effectiveUrlPattern = '/prensa/:slug';
        effectiveParams = { ":slug": "Slug" };
      }
    }
    
    if (!effectiveUrlPattern) {
      console.warn(`No URL pattern found for ${pageName}`);
      return entries;
    }
    
    // Use the sitemap query params if provided, otherwise use our inferred defaults
    const paramMapping = (sitemapQuery && sitemapQuery.params) || effectiveParams;
    
    if (!paramMapping || Object.keys(paramMapping).length === 0) {
      console.warn(`[sitemap] No parameter mapping found for ${pageName}`);
      return entries;
    }

    // Fetch database items
    const effectiveQuery = overrideQuery || query;
    // Extract domain from baseUrl for env var resolution (e.g. [[env.NOTION_API_TOKEN]])
    const domain = baseUrl ? baseUrl.replace(/^https?:\/\//, '') : '';
    // siteId is required by the JasonDB connector (per-tenant collection
    // naming: {siteId}_{collection}). Without it getCollectionName() throws.
    // Notion-backed databases ignore it, so passing it always is safe.
    const siteId = globalSettings.site_id || globalSettings.site?._id || null;
    const items = await fetchDatabaseItems(
      database,
      effectiveQuery,
      globalSettings.database,
      domain,
      siteId
    );
    
    if (!items || items.length === 0) {
      // fetchDatabaseItems already logged the specific failure mode (DB not
      // found / fetch failed / 0 items matched filter), so don't re-log here.
      return entries;
    }

    for (const item of items) {
      try {
        const urlParams = {};
        let dynamicUrl = effectiveUrlPattern;
        
        // Extract parameters for URL
        for (const [param, property] of Object.entries(paramMapping)) {
          const value = getPropertyValue(item, property);
          
          if (value) {
            urlParams[param] = value;
            // Replace the parameter placeholder with its value
            dynamicUrl = dynamicUrl.replace(param, encodeURIComponent(value));
          } else {
            // Single warn line per missing field — keys list bloats logs
            // when many items share the same schema gap.
            console.warn(`[sitemap] Missing "${property}" on item for ${pageName} (available keys: ${Object.keys(item).slice(0, 8).join(', ')})`);
            continue;
          }
        }
        
        // If all parameters are valid, create the entry
        if (Object.keys(urlParams).length === Object.keys(paramMapping).length) {
          const lastModified = item.updatedAt || item.last_edited_time 
            ? new Date(item.updatedAt || item.last_edited_time) 
            : new Date();
          
          const entry = {
            url: dynamicUrl,
            lastModified: lastModified,
            changeFrequency: 'weekly',
            priority: 0.8,
            title: item.Title || '',
            description: item.Description || '',
          };
          
          // Add title if available from sitemapQuery
          if (sitemapQuery && sitemapQuery.title) {
            entry.title = getPropertyValue(item, sitemapQuery.title) || entry.title;
          }
          
          // Add description if available from sitemapQuery
          if (sitemapQuery && sitemapQuery.description) {
            entry.description = getPropertyValue(item, sitemapQuery.description) || entry.description;
          }
          
          entries.push(entry);
        }
      } catch (error) {
        console.error(`[sitemap] Error processing item for ${pageName}:`, error);
        continue;
      }
    }

    return entries;
  } catch (error) {
    console.error(`Error generating dynamic entries for ${pageName}:`, error);
    return entries;
  }
}

async function fetchDatabaseItems(databaseID, query, databaseConfig, domain, siteId = null) {
  try {
    if (!databaseConfig) {
      console.error(`[sitemap] No database configuration provided for "${databaseID}"`);
      return [];
    }

    // Surface the most common silent failure: the requested database isn't
    // registered in databases/*.json (or settings/database.json). Without
    // this, database.select() just sets selectedDatabase=null and the fetch
    // returns an empty error result that downstream silently treats as "0
    // items," leaving builders to wonder why their JasonDB sitemap is empty.
    if (typeof databaseConfig === 'object' && !databaseConfig[databaseID]) {
      console.error(
        `[sitemap] Database "${databaseID}" not found in site config. ` +
        `Available: [${Object.keys(databaseConfig).join(', ') || 'none'}]. ` +
        `Add a databases/${databaseID}.json (or entry in settings/database.json) ` +
        `to expose it to the sitemap generator.`
      );
      return [];
    }

    // siteId is mandatory for JasonDB (per-tenant collection naming —
    // {siteId}_{collection}). Without it getCollectionName() throws
    // 'Site identifier is required'. Notion ignores the field, so passing
    // it always is safe.
    //
    // Not setting serverSideAccess: owner-level read filtering should still
    // apply. Sitemap = public content; if a database has security.read.level
    // === 'owner' those rows shouldn't be in the public sitemap anyway.
    const database = new Database(databaseConfig, {}, { domain, siteId });
    database.select(databaseID);

    // Normalize query into the format Database.fetch() expects: { filters: {...} }
    // Pages may use Notion raw format { filter: {...} } or JasonJS format { Published: true }
    let fetchConfig = query || {};
    if (!fetchConfig.filters && !fetchConfig.filter) {
      // Flat filters object (e.g. { Published: true }) — wrap it
      if (Object.keys(fetchConfig).length > 0 && !fetchConfig.database && !fetchConfig.sort) {
        fetchConfig = { filters: fetchConfig };
      }
    } else if (fetchConfig.filter && !fetchConfig.filters) {
      // Notion raw format — normalize to JasonJS
      fetchConfig = { filters: fetchConfig.filter, sorts: fetchConfig.sorts };
    }

    console.log(`[sitemap] Fetching "${databaseID}" with config:`, JSON.stringify(fetchConfig));

    const result = await database.fetch(fetchConfig);

    // Surface fetch errors instead of treating them as "0 items".
    if (result && typeof result === 'object' && result.success === false) {
      console.error(
        `[sitemap] Database fetch failed for "${databaseID}": ${result.error || 'unknown error'}`
      );
      return [];
    }

    // Unwrap common wire shapes: { success, data: [...] }, { results: [...] }, or bare array
    let items = result;
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      if (Array.isArray(result.data)) {
        items = result.data;
      } else if (Array.isArray(result.results)) {
        items = result.results;
      }
    }

    if (!Array.isArray(items)) {
      console.error(
        `[sitemap] Database "${databaseID}" returned a non-array result. Got:`,
        typeof items,
        items && typeof items === 'object' ? Object.keys(items) : items
      );
      return [];
    }

    if (items.length === 0) {
      console.warn(
        `[sitemap] Database "${databaseID}" returned 0 items for filter ${JSON.stringify(fetchConfig.filters || {})}. ` +
        `Verify the filter matches existing records (check status fields, casing, schema field names).`
      );
    } else {
      console.log(`[sitemap] Got ${items.length} items from "${databaseID}"`);
    }

    return items;
  } catch (error) {
    console.error(`[sitemap] Error fetching items for "${databaseID}":`, error);
    return [];
  }
}

function getPropertyValue(item, propertyPath) {
  if (!item || !propertyPath) return null;
  
  // For direct property access (no dots)
  if (!propertyPath.includes('.')) {
    // Direct access to properties at the root level first
    if (typeof item[propertyPath] !== 'undefined') {
      const value = item[propertyPath];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
    }
    
    // Try accessing Notion-style properties
    if (item.properties && typeof item.properties[propertyPath] !== 'undefined') {
      const prop = item.properties[propertyPath];
      return extractNotionPropertyValue(prop);
    }
    
    // If we couldn't find it at the root level or in properties,
    // try accessing it directly from the item object
    return extractNotionPropertyValue(item[propertyPath]);
  }
  
  // Handle dot notation for path traversal
  const parts = propertyPath.split('.');
  let value = item;
  
  for (const part of parts) {
    if (!value) return null;
    
    if (typeof value === 'object' && part in value) {
      value = value[part];
    } else if (value.properties && value.properties[part]) {
      value = value.properties[part];
    } else {
      return null;
    }
  }
  
  // Handle different types after traversal
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  return extractNotionPropertyValue(value);
}

function extractNotionPropertyValue(prop) {
  if (!prop) return null;
  
  // Handle different Notion property types
  
  // String/Text values
  if (typeof prop === 'string') {
    return prop;
  }
  
  // Plain number/boolean values
  if (typeof prop === 'number' || typeof prop === 'boolean') {
    return String(prop);
  }
  
  // Title property
  if (prop.title && Array.isArray(prop.title) && prop.title.length > 0) {
    return prop.title[0]?.plain_text || prop.title[0]?.text?.content || null;
  }
  
  // Rich text property
  if (prop.rich_text && Array.isArray(prop.rich_text) && prop.rich_text.length > 0) {
    return prop.rich_text[0]?.plain_text || prop.rich_text[0]?.text?.content || null;
  }
  
  // Select property
  if (prop.select && prop.select.name) {
    return prop.select.name;
  }
  
  // URL property
  if (prop.url) {
    return prop.url;
  }
  
  // Checkbox property
  if (typeof prop.checkbox !== 'undefined') {
    return prop.checkbox ? 'true' : 'false';
  }
  
  // Number property
  if (typeof prop.number !== 'undefined') {
    return String(prop.number);
  }
  
  // Multi-select property
  if (prop.multi_select && Array.isArray(prop.multi_select) && prop.multi_select.length > 0) {
    return prop.multi_select.map(item => item.name).join(',');
  }
  
  // Date property
  if (prop.date && prop.date.start) {
    return prop.date.start;
  }
  
  // Rollup property
  if (prop.rollup && prop.rollup.array && Array.isArray(prop.rollup.array) && prop.rollup.array.length > 0) {
    const firstRollupItem = prop.rollup.array[0];
    return extractNotionPropertyValue(firstRollupItem);
  }
  
  return null;
}

export function generateSitemapXml(entries) {
  // Ensure we have clean, valid entries
  const validEntries = entries.filter(entry => entry && entry.url);
  
  const xmlEntries = validEntries.map(entry => {
    // Ensure date is a proper Date object
    const lastModified = entry.lastModified instanceof Date 
      ? entry.lastModified 
      : new Date(entry.lastModified || Date.now());
      
    return `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <lastmod>${lastModified.toISOString()}</lastmod>
    <changefreq>${entry.changeFrequency || 'weekly'}</changefreq>
    <priority>${entry.priority || 0.5}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>`;
}

export function generateRssXml(entries, baseUrl, siteMeta) {
  // Filter out invalid entries and those without titles (most important for RSS)
  const validEntries = entries.filter(entry => 
    entry && 
    entry.url && 
    entry.title && 
    entry.title.trim() !== ''
  );
  
  const rssItems = validEntries.map(entry => {
    // Ensure full URL
    const fullUrl = entry.url.startsWith('http') ? entry.url : `${baseUrl}${entry.url}`;
    // Ensure date is a proper Date object
    const lastModified = entry.lastModified instanceof Date 
      ? entry.lastModified 
      : new Date(entry.lastModified || Date.now());
      
    return `  <item>
    <title><![CDATA[${entry.title || ''}]]></title>
    <link>${escapeXml(fullUrl)}</link>
    <description><![CDATA[${entry.description || ''}]]></description>
    <pubDate>${lastModified.toUTCString()}</pubDate>
    <guid isPermaLink="true">${escapeXml(fullUrl)}</guid>
  </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteMeta.title || 'Your Website Title'}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${siteMeta.description || 'Your website description'}</description>
    <language>${siteMeta.lang || 'en-us'}</language>
    <atom:link href="${escapeXml(baseUrl)}/rss.xml" rel="self" type="application/rss+xml" />
${rssItems}
  </channel>
</rss>`;
}

// Helper function to escape XML special characters
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}