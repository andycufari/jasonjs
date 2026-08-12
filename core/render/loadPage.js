// core/render/loadPage.js - Loads and assembles the page definition (settings + page JSON) for a request
import { headers } from 'next/headers';
import { getAllSettings, getPage, getSite, getDeployVersion, getAllDatabases, getFileSystem } from '../sites/files.js';
import { resolveSite } from '../sites/resolve';
import { processDevModeParams } from '../utils/devModeCache.js';
import { getClientIp } from '../utils/getClientIp.js';

const LANGUAGE_KEYS = ['label', 'text', 'title', 'alt', 'src', 'description', 'href', 'preamble', 'message', 'placeholder', 'buttonText', 'errorMessage', 'tooltip', 'help'];
const rtlLanguages = ['ar', 'he', 'fa', 'ur'];

// Keys within schema fields that should be translated
const SCHEMA_TRANSLATABLE_KEYS = ['label', 'placeholder', 'description', 'help', 'tooltip', 'errorMessage'];

function isRTL(language) {
    return rtlLanguages.includes(language);
}

function selectLanguageWithFallback(value, languageSelected, fallbackChain = ['en']) {
    if (typeof value !== 'object' || value === null) return value;
    
    if (languageSelected in value) return value[languageSelected];
    
    for (let fallbackLang of fallbackChain) {
        if (fallbackLang in value) return value[fallbackLang];
    }
    
    return Object.values(value)[0]; // Last resort: return any available translation
}

function selectJsonLanguage(json, languageSelected, fallbackChain) {
    if (Array.isArray(json)) {
        return json.map(item => selectJsonLanguage(item, languageSelected, fallbackChain));
    }
    if (typeof json === 'object' && json !== null) {
        return Object.fromEntries(
            Object.entries(json).map(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    if (LANGUAGE_KEYS.includes(key) || (languageSelected in value && Object.keys(value).every(k => k.length === 2))) {
                        return [key, selectLanguageWithFallback(value, languageSelected, fallbackChain)];
                    }
                    return [key, selectJsonLanguage(value, languageSelected, fallbackChain)];
                }
                return [key, value];
            })
        );
    }
    return json;
}

/**
 * Process translatable fields within database schema definitions
 * This handles i18n labels like { "es": "Nombre", "en": "Name" } within schema fields
 */
function processSchemaLanguage(schemas, languageSelected, fallbackChain) {
    if (!schemas || typeof schemas !== 'object') return schemas;

    const processed = {};

    for (const [schemaKey, schemaValue] of Object.entries(schemas)) {
        if (typeof schemaValue === 'object' && schemaValue !== null) {
            // Check if this is a database config with a schema property
            if (schemaValue.schema && typeof schemaValue.schema === 'object') {
                processed[schemaKey] = {
                    ...schemaValue,
                    schema: processSchemaFields(schemaValue.schema, languageSelected, fallbackChain)
                };
            } else {
                // Direct schema object (field definitions)
                processed[schemaKey] = processSchemaFields(schemaValue, languageSelected, fallbackChain);
            }
        } else {
            processed[schemaKey] = schemaValue;
        }
    }

    return processed;
}

/**
 * Process individual schema fields to translate label, placeholder, etc.
 */
function processSchemaFields(fields, languageSelected, fallbackChain) {
    if (!fields || typeof fields !== 'object') return fields;

    const processed = {};

    for (const [fieldName, fieldDef] of Object.entries(fields)) {
        if (typeof fieldDef === 'object' && fieldDef !== null) {
            const processedField = { ...fieldDef };

            // Process each translatable key in the field definition
            for (const transKey of SCHEMA_TRANSLATABLE_KEYS) {
                if (processedField[transKey] && typeof processedField[transKey] === 'object') {
                    // Check if it looks like a language object (keys are 2-char language codes)
                    const keys = Object.keys(processedField[transKey]);
                    if (keys.length > 0 && keys.every(k => k.length === 2)) {
                        processedField[transKey] = selectLanguageWithFallback(
                            processedField[transKey],
                            languageSelected,
                            fallbackChain
                        );
                    }
                }
            }

            // Also process options array for select fields
            if (Array.isArray(processedField.options)) {
                processedField.options = processedField.options.map(option => {
                    if (typeof option === 'object' && option !== null) {
                        const processedOption = { ...option };
                        if (processedOption.label && typeof processedOption.label === 'object') {
                            const keys = Object.keys(processedOption.label);
                            if (keys.length > 0 && keys.every(k => k.length === 2)) {
                                processedOption.label = selectLanguageWithFallback(
                                    processedOption.label,
                                    languageSelected,
                                    fallbackChain
                                );
                            }
                        }
                        return processedOption;
                    }
                    return option;
                });
            }

            processed[fieldName] = processedField;
        } else {
            processed[fieldName] = fieldDef;
        }
    }

    return processed;
}

function replaceAssetsUrl(json) {
    if (Array.isArray(json)) {
        return json.map(replaceAssetsUrl);
    }
    if (typeof json === 'object' && json !== null) {
        const publicUrl = process.env.SS_PUBLIC_URL || '';
        return Object.fromEntries(
            Object.entries(json).map(([key, value]) => [
                key,
                typeof value === 'string'
                    ? value.replace("SS_PUBLIC_URL", publicUrl)
                    : replaceAssetsUrl(value)
            ])
        );
    }
    return json;
}

function processIncludeComponents(json) {
    const includeComponents = {};
  
    function processComponent(component) {
      if (typeof component === 'object' && component !== null) {
        if (component.component && typeof component.component === 'string' && component.component.startsWith('@')) {
          const [, path] = component.component.split('@');
          const componentName = path.split('/').pop();
          includeComponents[componentName] = path;
          component.component = componentName;
        }
        
        if (Array.isArray(component.components)) {
          component.components = component.components.map(processComponent);
        }
      }
      return component;
    }
  
    function traverse(obj) {
      if (Array.isArray(obj)) {
        return obj.map(traverse);
      } else if (typeof obj === 'object' && obj !== null) {
        const newObj = {};
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'components' && Array.isArray(value)) {
            newObj[key] = value.map(processComponent);
          } else {
            newObj[key] = traverse(value);
          }
        }
        return newObj;
      }
      return obj;
    }
  
    const processedJson = traverse(json);
  
    if (Object.keys(includeComponents).length > 0) {
      processedJson.include_components = {
        ...(processedJson.include_components || {}),
        ...includeComponents
      };
    }
  
    return processedJson;
}

export async function loadPageDefinition({ params = { slug: [] }, searchParams = {} }) {
    // Await params and searchParams as required by Next.js 15
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    const { slug } = resolvedParams;

    // Get headers for IP detection and language
    const headersList = await headers();

    // Get host and IP for dev mode
    const { host } = await resolveSite();
    const clientIp = getClientIp(headersList);

    // Process dev mode using cache-based system (works across all server instances)
    const devModeResult = await processDevModeParams(host, clientIp, resolvedSearchParams);
    const isDev = devModeResult.isDev;

    // Enhanced dev mode logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔧 [DevMode] Status: ${isDev ? '✅ ACTIVE' : '❌ INACTIVE'}`, {
        action: devModeResult.action,
        host,
        clientIp: clientIp || 'unknown',
        devParam: resolvedSearchParams.dev,
        cParam: resolvedSearchParams.c,
      });
    }

    const specificVersion = resolvedSearchParams.v || null;
    const testComponent = resolvedSearchParams.c || null;
    const acceptLanguage = headersList.get('accept-language') || "en";
    const forcedLanguage = resolvedSearchParams.lang;
    const language = forcedLanguage || acceptLanguage.split(',')[0].substring(0, 2);
    const fallbackChain = ['en']; // You can customize this based on your needs

    if (!host) {
        throw new Error('Host not found');
    }

    // Get site using unified file system
    const site = await getSite(host);
    if (!site) {
        // Return a special site not found page configuration instead of throwing error
        return {
            meta: {
                title: "Site Not Found - 404",
                description: "The requested site could not be found on this server.",
                lang: language
            },
            type: 'site-not-found',
            host: host,
            language: language,
            isRTL: isRTL(language),
            components: [
                {
                    component: "div",
                    attributes: {
                        className: "min-h-screen flex items-center justify-center bg-gray-50"
                    },
                    components: [
                        {
                            component: "div",
                            attributes: {
                                className: "max-w-md mx-auto text-center"
                            },
                            components: [
                                {
                                    component: "h1",
                                    attributes: {
                                        className: "text-6xl font-bold text-gray-900 mb-4"
                                    },
                                    innerHTML: "404"
                                },
                                {
                                    component: "h2",
                                    attributes: {
                                        className: "text-2xl font-semibold text-gray-700 mb-4"
                                    },
                                    innerHTML: "Site Not Found"
                                },
                                {
                                    component: "p",
                                    attributes: {
                                        className: "text-gray-600 mb-6"
                                    },
                                    innerHTML: `The site for host "${host}" could not be found on this server.`
                                },
                                {
                                    component: "p",
                                    attributes: {
                                        className: "text-sm text-gray-500"
                                    },
                                    innerHTML: "Please check the URL and try again, or contact the site administrator."
                                }
                            ]
                        }
                    ]
                }
            ]
        };
    }

    try {
        let versionInfo = null;
        if (!isDev && getFileSystem().hasAdapter()) {
            // Enhanced version resolution with domain-build mapping
            if (specificVersion) {
                // Explicit version parameter takes highest priority
                versionInfo = await getDeployVersion(site._id, specificVersion);
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[Version] Using explicit version: ${specificVersion} for domain: ${host}`);
                }
            } else if (site.domainBuilds && site.domainBuilds[host]) {
                // Check domain-specific build mapping
                const domainBuild = site.domainBuilds[host];
                if (domainBuild === 'development') {
                    // Special keyword for development mode - no version, use live files
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`[Version] Using development mode for domain: ${host}`);
                    }
                } else {
                    // Use specific deploy version mapped to this domain
                    versionInfo = await getDeployVersion(site._id, domainBuild);
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`[Version] Using domain-mapped version: ${domainBuild} for domain: ${host}`);
                    }
                }
            } else if (site.productionDeployId) {
                // Fallback to production deploy
                versionInfo = await getDeployVersion(site._id, site.productionDeployId);
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[Version] Using production version: ${site.productionDeployId} for domain: ${host}`);
                }
            } else {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[Version] No version specified, using development mode for domain: ${host}`);
                }
            }
        }

        // Use unified file system for all data loading
        const settings = await getAllSettings(host, versionInfo);

        // Get all database configurations (merged from databases/*.json + settings/database.json)
        // Priority: databases/*.json (new format) > settings/database.json (legacy)
        const databases = await getAllDatabases(host, versionInfo);

        // Process database schemas for database access
        let databaseSchemas = {};
        for (const [databaseId, databaseSettings] of Object.entries(databases)) {
            // Extract only what's needed for joins: schema + collection name (safe for server-side)
            databaseSchemas[databaseId] = {
                schema: databaseSettings.schema || {},
                collection: databaseSettings.collection,
                config: {
                    collection: databaseSettings.config?.collection
                }
            };
        }
 

        let page;
        if (testComponent != null) {
            page = await getTestComponentPage(host, testComponent);
        } else {
            const slugPath = Array.isArray(slug) ? slug.join('/') : (slug || '');
            const pagePath = slugPath || '/';
            page = await getPage(host, pagePath, settings, versionInfo);
        }

        if (!page) {
            // For auth pages, return null instead of throwing error
            // Auth pages will handle their own defaults
            if (slug && slug.includes('auth')) {
                return null;
            }

            // Return a themed 404 page instead of throwing an error
            // This preserves the site context for styling
            const slugPath = Array.isArray(slug) ? '/' + slug.join('/') : '/';
            return {
                meta: {
                    title: "Page Not Found - 404",
                    description: "The requested page could not be found.",
                    lang: language
                },
                type: 'page-not-found',
                host: host,
                language: language,
                isRTL: isRTL(language),
                site_id: typeof site._id === 'string' ? site._id : site._id.toString(),
                site: site,
                domain: host,
                isDev,
                requestedPath: slugPath,
                // Include settings for theming
                ...settings,
                // 404 page components - will be rendered with site theme
                components: []
            };
        }

        // Check if this is an HTML page
        if (page.type === 'html') {
            return page; // Return HTML page object as-is
        }

        if (page.error) {
            throw new Error(page.error);
        }

        if (typeof page !== 'object' || page === null) {
            console.error("Invalid JSON received:", page);
            return { error: `Invalid page structure`, components: [] };
        }

        // Use layout if it exists
        if(page.layout && settings.layout) {
            page = useLayout(page, settings.layout);
        }

       

        const scripts = { ...settings.scripts, ...page.scripts };

        // Deep merge meta: settings/meta.json provides defaults, page.meta overrides
        const mergedMeta = { ...settings.meta, ...page.meta };

        const mergedJson = {
            host: headersList.get('host'),
            ...settings,
            ...page,
            // Deep-merged meta so settings/meta.json values aren't lost when page has meta
            meta: mergedMeta,
            // Override settings.database with merged databases from getAllDatabases()
            // This ensures databases/*.json takes priority over settings/database.json
            database: databases,
            site_id: typeof site._id === 'string' ? site._id : site._id.toString(),
            site: site, // Add site object so page.site.primary_domain is available
            domain: host, // Use the actual current host/domain (e.g., example.com)
            isDev,
            version: versionInfo ? versionInfo.id : null,
            scripts: scripts || null,
            databaseSchemas: databaseSchemas || {},
        };

        // Process all parameters
        const allParams = {
            ...resolvedParams,
            ...resolvedSearchParams,
        };

        //console.log("All params", allParams);

        // First process the parameters
        let processedJson;
        if(page.params) {
            processedJson = processParamsInJson(mergedJson, page.params);
        } else {
            processedJson = mergedJson;
        }

        // Process {{site.*}} placeholders (name, description, image, primary_domain, settings.*, etc.)
        processedJson = processSiteInJson(processedJson, site);

        // Then continue with your existing processing
        // IMPORTANT: Only apply language selection to specific parts, NOT to settings/databaseSchemas
        const protectedKeys = ['settings', 'databaseSchemas', 'database'];
        const protectedData = {};
        
        // Extract protected data before language processing
        protectedKeys.forEach(key => {
            if (processedJson[key]) {
                protectedData[key] = processedJson[key];
                delete processedJson[key];
            }
        });
        
        // Apply language selection only to non-protected content
        processedJson = selectJsonLanguage(processedJson, language, fallbackChain);

        // Restore protected data after language processing
        Object.assign(processedJson, protectedData);

        // Process i18n labels within database schemas (label, placeholder, description, help, etc.)
        if (processedJson.databaseSchemas) {
            processedJson.databaseSchemas = processSchemaLanguage(processedJson.databaseSchemas, language, fallbackChain);
        }
        if (processedJson.database) {
            processedJson.database = processSchemaLanguage(processedJson.database, language, fallbackChain);
        }
        if (processedJson.settings?.database) {
            processedJson.settings.database = processSchemaLanguage(processedJson.settings.database, language, fallbackChain);
        }

        processedJson = replaceAssetsUrl(processedJson);
        processedJson = processIncludeComponents(processedJson);
        

        processedJson.language = language;
        processedJson.isRTL = isRTL(language);

        if (processedJson.meta) {
            processedJson.meta.lang = language;
        }

        return processedJson;
    } catch (error) {
        console.error("Error fetching JSON:", error);
        return getErrorJson(language);
    }
}

function getErrorJson(language, errorMessage = 'An error occurred while loading this page.') {
    return {
        meta: {
            title: "Error",
            description: errorMessage,
            lang: language
        },
        type: 'page-error',
        language: language,
        errorMessage: errorMessage,
        components: []
    };
}

function useLayout(page, layouts) {
    if (!page.layout || !layouts || !layouts[page.layout]) {
        console.warn('No applicable layout, returning original page');
        return page; // No applicable layout, return the original page
    }

    const layout = layouts[page.layout];
    
    // Deep clone the layout to avoid modifying the original
    const result = JSON.parse(JSON.stringify(layout));

    // Function to recursively search and replace @@PageComponents@@
    function replacePageComponents(components) {
        for (let i = 0; i < components.length; i++) {
            // Check if it's the placeholder (can be string or object)
            if (components[i] === '@@PageComponents@@' || 
                (typeof components[i] === 'object' && components[i].component === '@@PageComponents@@')) {
                // Replace the placeholder with the page components
                components.splice(i, 1, ...page.components);
                return true; // Replacement done
            } else if (typeof components[i] === 'object' && components[i].components) {
                // Recursively search in nested components
                if (replacePageComponents(components[i].components)) {
                    return true; // Replacement done in a nested level
                }
            }
        }
        return false; // No replacement done at this level
    }

    // Replace @@PageComponents@@ in the layout
    if (!replacePageComponents(result.components)) {
        console.warn('Layout does not contain @@PageComponents@@ placeholder. Page content may be lost.');
    }

    // Merge other properties from the page into the result
    for (const key in page) {
        if (key !== 'components' && key !== 'layout') {
            result[key] = page[key];
        }
    }
    
    return result;
}

async function getTestComponentPage(domain, testComponent) {
    // Import the unified file system at the top level would be better,
    // but for now we'll use dynamic import to avoid circular dependency
    const { getFile } = await import('../sites/files.js');
    
    const componentContent = await getFile(domain, 'component', testComponent);
    if (!componentContent) throw new Error('Component not found');
    
    console.log("Test component content loaded");

    let testInputData = {};
    try {
        const match = componentContent.match(/(?:export\s+)?const\s+testInputData\s*=\s*({[\s\S]*?});/);
        if (match && match[1]) {
            testInputData = new Function(`return ${match[1]}`)();
        }
    } catch (error) {
        console.error('Error parsing testInputData:', error);
        return {
            components: [{
                component: "div",
                attributes: {
                    class: "text-red-500",
                },
                innerHtml: "TestInputData not found or invalid"
            }]
        };
    }

    const page = JSON.parse(JSON.stringify({
        components: [{
            component: testComponent,
            attributes: testInputData || {}
        }]
    }));

    return page;
}

// Add this function to your existing code
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function replaceParamsInString(str, params, shouldEscape = true) {
    if (typeof str !== 'string') return str;

    return str.replace(/\{\{params\.([^}]+)\}\}/g, (match, param) => {
        const value = params[param];
        if (value === undefined) return match; // Keep original if param not found

        // Handle arrays (like slug)
        if (Array.isArray(value)) {
            return shouldEscape ? escapeHtml(value.join('/')) : value.join('/');
        }

        // Convert to string and escape if needed
        const strValue = String(value);
        return shouldEscape ? escapeHtml(strValue) : strValue;
    });
}

/**
 * Replace {{site.*}} placeholders with site data
 * Supports: name, description, image, primary_domain
 */
function replaceSiteInString(str, site, shouldEscape = true) {
    if (typeof str !== 'string' || !site) return str;

    return str.replace(/\{\{site\.([^}]+)\}\}/g, (match, path) => {
        // Support nested paths like site.settings.seo.title
        const value = path.split('.').reduce((obj, key) => obj?.[key], site);

        if (value === undefined || value === null) return ''; // Remove unresolved templates

        // Handle objects/arrays - stringify them
        if (typeof value === 'object') {
            return shouldEscape ? escapeHtml(JSON.stringify(value)) : JSON.stringify(value);
        }

        const strValue = String(value);
        return shouldEscape ? escapeHtml(strValue) : strValue;
    });
}

function processParamsInJson(json, params) {
    if (Array.isArray(json)) {
        return json.map(item => processParamsInJson(item, params));
    }

    if (typeof json === 'object' && json !== null) {
        const processed = {};

        for (const [key, value] of Object.entries(json)) {
            // Special handling for specific attribute types that shouldn't be escaped
            const shouldEscape = !['href', 'src', 'route'].includes(key);

            if (typeof value === 'string') {
                processed[key] = replaceParamsInString(value, params, shouldEscape);
            } else if (typeof value === 'object' && value !== null) {
                processed[key] = processParamsInJson(value, params);
            } else {
                processed[key] = value;
            }
        }

        return processed;
    }

    return json;
}

/**
 * Process {{site.*}} placeholders in JSON
 * Available fields: name, description, image, primary_domain, settings.*, startupMetadata.*
 */
function processSiteInJson(json, site) {
    if (!site) return json;

    if (Array.isArray(json)) {
        return json.map(item => processSiteInJson(item, site));
    }

    if (typeof json === 'object' && json !== null) {
        const processed = {};

        for (const [key, value] of Object.entries(json)) {
            const shouldEscape = !['href', 'src', 'route', 'image'].includes(key);

            if (typeof value === 'string') {
                processed[key] = replaceSiteInString(value, site, shouldEscape);
            } else if (typeof value === 'object' && value !== null) {
                processed[key] = processSiteInJson(value, site);
            } else {
                processed[key] = value;
            }
        }

        return processed;
    }

    return json;
}