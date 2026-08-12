import React from 'react';
import { getComponent } from '../sites/files.js';
import { createLogger } from '../utils/logger.js';
import { logBundlingError } from '../services/componentErrorLogger.js';

const logger = createLogger('Components');

const HTML_TAGS = new Set([
  // Basic HTML elements
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'button', 'input', 'form', 'label', 'select', 'option', 'textarea',
  'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'caption', 'colgroup', 'col',
  'a', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'nav', 'header', 'footer', 'main', 'section', 'article', 'aside',
  'pre', 'code', 'blockquote', 'hr', 'br',
  'strong', 'em', 'b', 'i', 'u', 'small', 'mark', 'del', 'ins', 'sub', 'sup',
  'img', 'video', 'audio', 'source', 'track', 'canvas', 'iframe',
  'details', 'summary', 'dialog', 'figure', 'figcaption',
  // SVG elements
  'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
  'ellipse', 'g', 'text', 'tspan', 'defs', 'linearGradient',
  'radialGradient', 'stop', 'clipPath', 'mask', 'pattern',
  'image', 'use', 'symbol', 'marker', 'foreignObject'
]);

// Error component factory
const ErrorComponent = (componentName, errorMessage = null) => {
  const isDev = process.env.NODE_ENV === 'development';
  const ErrorDisplay = () => (
    <div className="p-4 bg-red-50 text-red-600 rounded-md">
      <p className="font-semibold">Error loading component: {componentName}</p>
      {isDev && errorMessage && (
        <p className="mt-1 text-sm text-red-500">{errorMessage}</p>
      )}
    </div>
  );
  ErrorDisplay.displayName = `Error_${componentName}`;
  return ErrorDisplay;
};

// Helper to load a component from a specific path
const loadTrustedComponent = async (componentName, componentPath, context = {}) => {
  try {
    // load trusted component from components/user/ or components/framework/
    const component = await import(`../../components/${componentPath}`);

    return component.default;

  } catch (error) {
    logger.error(`Failed to load component: ${componentName}`, error);

    // Log to database so tenant devs can see the error
    if (context.siteId && context.domain) {
      await logBundlingError(componentName, error, {
        domain: context.domain,
        siteId: context.siteId
      });
    }

    return ErrorComponent(componentName, error.message);
  }
};

const loadAddonComponent = async (componentName, componentPath, context = {}) => {
  try {
    // Addon components are in /addons/{addon-name}/components/{ComponentName}
    // componentPath is expected as {addon-name}/{ComponentName}
    const [addonName, componentFile] = componentPath.split('/');
    const component = await import(`../../addons/${addonName}/components/${componentFile}`);
    return component.default;

  } catch (error) {
    logger.error(`Failed to load addon component: ${componentName}`, error);

    // Log to database so tenant devs can see the error
    if (context.siteId && context.domain) {
      await logBundlingError(componentName, error, {
        domain: context.domain,
        siteId: context.siteId
      });
    }

    return ErrorComponent(componentName, error.message);
  }
};

// Alias for backwards compatibility
const loadPluginComponent = loadAddonComponent;

export const getComponents = async function(page, isDev = false) {
  const siteId = page.site_id;
  // Get domain, using DEFAULT_DOMAIN for localhost development
  let domain = page.domain || page.site_domain;
  if (!domain || page.host?.includes('localhost')) {
    domain = process.env.DEFAULT_DOMAIN || page.host;
  }
  // Use isDev parameter passed from renderPage (detected from URL/Redis cache)
  const componentRegistry = {};

  // Context object for error logging (only logs in dev mode)
  const errorContext = { domain, siteId, isDev };

  // Log dev mode status for component loading
  if (isDev) {
    logger.info(`Loading components in DEV MODE (cache bypassed)`, { domain });
  }



  // Process components from the page structure
  const processComponent = (component) => {
    if (typeof component === 'object' && component !== null) {
      if (component.component && typeof component.component === 'string') {
        const name = component.component;
        // Only skip pure lowercase HTML tags (e.g., "footer", "header", "nav")
        // PascalCase names like "Footer", "Header" are user components
        if (name === name.toLowerCase() && HTML_TAGS.has(name)) {
          return null;
        }
        return name;
      }
    }
    return null;
  };

  // Get components from page structure
  const components = page.components || [];
  const neededComponents = new Set();

  const addComponent = (item) => {
    if (Array.isArray(item)) {
      item.forEach(addComponent);
    } else if (typeof item === 'string') {
      // Handle string shorthand: "./Catalog" or "MyComponent"
      const name = item.trim();
      if (name.length > 0 && !(name === name.toLowerCase() && HTML_TAGS.has(name))) {
        neededComponents.add(name);
      }
    } else if (typeof item === 'object' && item !== null) {
      const componentName = processComponent(item);

      // Only add valid component names (not null, undefined, or empty)
      if (componentName && componentName.trim().length > 0) {
        neededComponents.add(componentName);
      }

      if (Array.isArray(item.components)) {
        item.components.forEach(addComponent);
      }
    }
  };

  addComponent(components);


  // Add included components from page configuration @todo: for backward compatibility, remove this in the future
  if (page.include_components) {

    for (const [componentName, componentPath] of Object.entries(page.include_components)) {
      if (componentName && componentName.length > 0) {
        // Handle different component types with same logic as @ components
        const [prefix, ...pathParts] = componentPath.split('/');

        if (prefix === 'addons' || prefix === 'plugins') {
          // addons/addonName/ComponentName → addons/addonName/ComponentName
          // plugins is deprecated but still supported for backwards compatibility
          componentRegistry[componentName] = await loadAddonComponent(componentName, `${pathParts.join('/')}`, errorContext);
        } else if (prefix === 'framework') {
          // framework/ComponentName → framework components
          componentRegistry[componentName] = await loadTrustedComponent(componentName, `framework/${pathParts.join('/')}`, errorContext);
        } else if (prefix === 'system') {
          // system/ComponentName → components/system/ComponentName
          componentRegistry[componentName] = await loadTrustedComponent(componentName, `system/${pathParts.join('/')}`, errorContext);
        } else {
          // Fallback to user directory for user/ComponentName or any other prefix
          componentRegistry[componentName] = await loadTrustedComponent(componentName, `user/${componentPath}`, errorContext);
        }
      }
    }
  }

  // Load each component
  for (const componentName of neededComponents) {
    try {

      // Skip if already processed
      if (componentRegistry[componentName]) {
        continue;
      }

      // Skip HTML tags - but only if the component name is lowercase
      // PascalCase names like "Footer" are user components, not HTML <footer> tags
      if (componentName === componentName.toLowerCase() && HTML_TAGS.has(componentName.toLowerCase())) {
        continue;
      }

      // Strip ./ prefix if present (unnecessary for user components)
      // Site components don't need the ./ prefix
      let cleanComponentName = componentName;
      if (componentName.startsWith('./')) {
        cleanComponentName = componentName.substring(2);
        logger.debug(`Stripped ./ prefix from component name: ${componentName} → ${cleanComponentName}`);
      }

      // Load local component if starts with @
      if (cleanComponentName.startsWith('@')) {
        const localPath = cleanComponentName.substring(1); // Remove @
        const [prefix, ...pathParts] = localPath.split('/');

        // Handle different component types
        if (prefix === 'addons' || prefix === 'plugins') {
          // @addons/addonName/ComponentName → addons/addonName/ComponentName
          // @plugins is deprecated but still supported for backwards compatibility
          componentRegistry[componentName] = await loadAddonComponent(cleanComponentName, `${pathParts.join('/')}`, errorContext);
        } else if (prefix === 'framework') {
          // @framework/ComponentName → framework components
          componentRegistry[componentName] = await loadTrustedComponent(cleanComponentName, `framework/${pathParts.join('/')}`, errorContext);
        } else if (prefix === 'system') {
          // @system/ComponentName → components/system/ComponentName
          componentRegistry[componentName] = await loadTrustedComponent(cleanComponentName, `system/${pathParts.join('/')}`, errorContext);
        } else {
          // Fallback to user directory for @user/ComponentName or any other prefix
          componentRegistry[componentName] = await loadTrustedComponent(cleanComponentName, `user/${pathParts.join('/')}`, errorContext);
        }
        continue;
      }else{
        // Check if this is a known system component first
        const systemComponents = [
          'SessionStatus', 'AuthForm', 'SignupForm', 'SignInButton', 'SignOutButton',
          'SignUpButton', 'UserButton', 'UserProfile', 'UserWidget', 'AuthGuard',
          'ProtectedContent', 'DataCard', 'DataForm', 'DataTable'
        ];

        if (systemComponents.includes(cleanComponentName)) {
          logger.debug(`Loading system component: ${cleanComponentName}`);
          // Try to load as system component
          try {
            componentRegistry[componentName] = await loadTrustedComponent(cleanComponentName, `system/auth/${cleanComponentName}`, errorContext);
          } catch (authError) {
            // If not in auth directory, try root system directory
            try {
              componentRegistry[componentName] = await loadTrustedComponent(cleanComponentName, `system/${cleanComponentName}`, errorContext);
            } catch (systemError) {
              logger.error(`Failed to load system component: ${cleanComponentName}`, systemError);
              componentRegistry[componentName] = ErrorComponent(cleanComponentName);
            }
          }
        } else {
          // Site component (no @ prefix): resolved by the unified file system.
          // Local mode imports sites/{domain}/components/{name}.jsx natively;
          // adapter mode delegates to the CM64 addon's runtime loader.
          const Component = await getComponent(domain, cleanComponentName);

          if (Component) {
            componentRegistry[componentName] = Component;
          } else {
            logger.error(`No component code found: ${cleanComponentName}`);

            // Log to database so tenant devs can see the error
            if (errorContext.siteId && errorContext.domain) {
              await logBundlingError(cleanComponentName, new Error(`Component "${cleanComponentName}" not found. Check the component name and ensure it exists.`), {
                domain: errorContext.domain,
                siteId: errorContext.siteId
              });
            }

            componentRegistry[componentName] = ErrorComponent(cleanComponentName);
          }
        }
      }

    } catch (error) {
      logger.error(`Error processing component: ${componentName}`, error);

      // Log to database so tenant devs can see the error
      if (errorContext.siteId && errorContext.domain) {
        await logBundlingError(componentName, error, {
          domain: errorContext.domain,
          siteId: errorContext.siteId
        });
      }

      componentRegistry[componentName] = ErrorComponent(componentName);
    }
  }

  return componentRegistry;
};
