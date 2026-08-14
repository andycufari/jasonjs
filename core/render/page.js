// studio/core/render/index.js

import React from 'react';
import JasonCraftThisJSON from './jason';
import { getComponents } from './componentRegistry';
import { getPageData } from './pageData';
import { getTheme } from '../render/getTheme';
import { getScripts } from '../render/getScripts';
import { getFile } from '@/core/sites/files';
import ClientErrorBoundary from '@/components/system/ClientErrorBoundary';
import { authMiddleware, authorizeUser } from '@/core/auth/middleware';
import { processFonts } from './metadata';
import { extractSEOFromJSON, generateSEOHTML, generateStructuredData } from './seo';
import { headers } from 'next/headers';
import { createLogger } from '../utils/logger';
import { resolveSite, defaultDomain } from '../sites/resolve';
import { getClientIp } from '../utils/getClientIp';
import { runWithRequestContext } from '../utils/requestContext.js';
import { trackVisit } from '../services/tracking/auto-track-visit';

const logger = createLogger('Render');

const USER_CSS_MAX_BYTES = 100 * 1024;

function sanitizeUserGlobalCss(raw, domain) {
  if (!raw || typeof raw !== 'string') return null;
  if (raw.length > USER_CSS_MAX_BYTES) {
    logger.warn(
      `[${domain}] css/global.css exceeds ${USER_CSS_MAX_BYTES} bytes (got ${raw.length}) — skipping injection`
    );
    return null;
  }
  const stripped = raw.replace(/@import\s+[^;]*;/gi, '');
  if (stripped !== raw) {
    logger.warn(`[${domain}] css/global.css contained @import — stripped on load for security`);
  }
  return stripped.trim() || null;
}

// Helper to check if host is a private IP
function isPrivateIP(host) {
  const ip = host.split(':')[0];
  const patterns = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./
  ];
  return patterns.some(pattern => pattern.test(ip));
}

export async function renderPage(args) {
    // Resolve host once and bind it to the request's AsyncLocalStorage so every
    // logger call inside this render (Database, Components, services, etc.)
    // automatically tags @host without threading it through every function.
    const headersList = await headers();
    const boundHost =
        headersList.get('x-forwarded-host') ||
        headersList.get('host') ||
        'unknown';
    return runWithRequestContext({ host: boundHost }, () => _renderPageImpl(args));
}

async function _renderPageImpl({ params, searchParams }) {
    // Check if this is from a private IP (health check)
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
    const shouldLog = !isPrivateIP(host);

    // Get domain early for theme CSS and other uses
    const { host: domain } = await resolveSite();

    // 0. AUTH: Check for existing session first (needed for data fetching with security)
    // We need to get auth before fetching data because security filtering needs the session
    // Use cached session to avoid duplicate auth calls between metadata and renderPage
    const { getCachedUser } = await import('../auth/sessionCache');

    let authenticatedUser = null;
    try {
        // Get cached session (shared with generateMetadata)
        // Note: isDev will be determined from page data, so we can't pass it yet
        authenticatedUser = await getCachedUser(null, false);
    } catch (error) {
        // If auth check fails, continue without user (public pages will still work)
        // This is expected behavior for public pages
    }

    // 1. PAGE: Get page configuration and data (cached) - now WITH authenticated user
    const pageDataResult = await getPageData({ params, searchParams }, { authenticatedUser });

    if (!pageDataResult) {
        return null;
    }

    let { page, dataContext, isDev } = pageDataResult;

    // TIER 1 ANALYTICS: server-side, cookieless page-view tracking.
    // Fire-and-forget — do NOT await. Analytics must never block rendering.
    //
    // Only track requests that resolved to a REAL page (or a real HTML doc).
    // We intentionally do NOT track page-not-found / site-not-found / page-error
    // because those are dominated by vulnerability scanners probing for PHP/CMS
    // installs (`/install/step1.php`, `/wp-admin/`, `/template/default/...`, etc.)
    // and tracking them floods the analytics collection and broken-links report
    // with garbage events that have nothing to do with real visitors.
    //
    // Assets (/_next/*, /public/*, images, fonts, CSS) never reach renderPage —
    // Next.js serves them through dedicated routes — so restricting tracking to
    // "resolved pages only" does not lose any legitimate traffic.
    //
    // Important: pass `domain` (resolved via resolveSite() above), NOT the
    // raw `host` header value. `host` can be "localhost:3000" which getSite()
    // cannot resolve; `domain` has already been normalized (port stripped,
    // localhost substituted with DEFAULT_DOMAIN).
    const isRealPage = page && (
        page.type === 'html' ||
        (page.type !== 'page-not-found' &&
         page.type !== 'site-not-found' &&
         page.type !== 'page-error')
    );

    if (shouldLog && isRealPage) {
        try {
            const resolvedParamsForTracking = await params;
            const clientIp = getClientIp(headersList);
            const slugPath = Array.isArray(resolvedParamsForTracking?.slug)
                ? resolvedParamsForTracking.slug.join('/')
                : (resolvedParamsForTracking?.slug || '');
            const pagePath = '/' + slugPath;
            const pageType = page?.type === 'html' ? 'html' : 'page';
            trackVisit({ host: domain, pagePath, headersList, clientIp, pageType });
        } catch (err) {
            console.error('[renderPage] Failed to dispatch trackVisit:', err.message);
        }
    }

    // Await searchParams for Next.js 15 compatibility
    const resolvedSearchParams = await searchParams;

    // Check if this is an HTML page
    if (page && page.type === 'html') {
        return page.content; // Return raw HTML
    }

    // Check if this is a site not found error
    if (page && page.type === 'site-not-found') {
        // Return JSX for 404 page (Next.js pages must return JSX)
        return (
            <>
                <style dangerouslySetInnerHTML={{
                    __html: `
                        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
                        .error-404-container {
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background-color: #f9fafb;
                        }
                        .error-404-content {
                            max-width: 28rem;
                            margin: 0 auto;
                            text-align: center;
                        }
                        .error-404-title {
                            font-size: 3.75rem;
                            line-height: 1;
                            font-weight: 700;
                            color: #111827;
                            margin-bottom: 1rem;
                        }
                        .error-404-subtitle {
                            font-size: 1.5rem;
                            line-height: 2rem;
                            font-weight: 600;
                            color: #374151;
                            margin-bottom: 1rem;
                        }
                        .error-404-message {
                            color: #4b5563;
                            margin-bottom: 1.5rem;
                        }
                        .error-404-help {
                            font-size: 0.875rem;
                            line-height: 1.25rem;
                            color: #6b7280;
                        }
                    `
                }} />
                <div className="error-404-container">
                    <div className="error-404-content">
                        <h1 className="error-404-title">404</h1>
                        <h2 className="error-404-subtitle">Site Not Found</h2>
                        <p className="error-404-message">
                            The site for host "{page.host}" could not be found on this server.
                        </p>
                        <p className="error-404-help">
                            Please check the URL and try again, or contact the site administrator.
                        </p>
                    </div>
                </div>
            </>
        );
    }

    // Check if this is a page not found error (site exists, but page doesn't)
    if (page && page.type === 'page-not-found') {
        // Get theme for styling the error page
        const { mergedTheme, themeStyles } = getTheme(page.theme, { shouldLog });
        const { fontFaces, preloadLinks, stylesheetLinks } = processFonts(page.fonts || {}, isDev);

        return (
            <>
                {/* Font preloads */}
                {preloadLinks.map((link, index) => (
                    <link
                        key={`preload-${index}`}
                        rel={link.attributes.rel}
                        href={link.attributes.href}
                        as={link.attributes.as}
                        crossOrigin={link.attributes.crossOrigin}
                    />
                ))}
                {stylesheetLinks.map((link, index) => (
                    <link
                        key={`stylesheet-${index}`}
                        rel={link.attributes.rel}
                        href={link.attributes.href}
                        crossOrigin={link.attributes.crossOrigin}
                    />
                ))}
                <style dangerouslySetInnerHTML={{
                    __html: `
                        ${fontFaces}
                        ${themeStyles}
                        body {
                            margin: 0;
                            padding: 0;
                            font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif);
                            background-color: var(--color-background, #f9fafb);
                            color: var(--color-text, #111827);
                        }
                        .error-404-container {
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background-color: var(--color-background, #f9fafb);
                        }
                        .error-404-content {
                            max-width: 28rem;
                            margin: 0 auto;
                            text-align: center;
                            padding: 2rem;
                        }
                        .error-404-title {
                            font-size: 6rem;
                            line-height: 1;
                            font-weight: 700;
                            color: var(--color-text, #111827);
                            margin-bottom: 0.5rem;
                        }
                        .error-404-subtitle {
                            font-size: 1.5rem;
                            line-height: 2rem;
                            font-weight: 600;
                            color: var(--color-text, #111827);
                            margin-bottom: 1rem;
                        }
                        .error-404-message {
                            color: var(--color-textMuted, #6b7280);
                            margin-bottom: 2rem;
                            font-size: 1rem;
                            line-height: 1.5;
                        }
                        .error-404-link {
                            display: inline-block;
                            padding: 0.75rem 1.5rem;
                            background-color: var(--color-primary, #3b82f6);
                            color: white;
                            text-decoration: none;
                            border-radius: var(--radius-base, 0.5rem);
                            font-weight: 500;
                            transition: opacity 0.2s;
                        }
                        .error-404-link:hover {
                            opacity: 0.9;
                        }
                        .error-404-path {
                            font-family: monospace;
                            background-color: var(--color-surface, rgba(0,0,0,0.05));
                            color: var(--color-text, #111827);
                            padding: 0.125rem 0.5rem;
                            border-radius: var(--radius-sm, 0.25rem);
                            font-size: 0.875rem;
                            border: 1px solid var(--color-border, #e2e8f0);
                        }
                    `
                }} />
                <div className={`theme-${mergedTheme.defaultColorScheme} error-404-container`}>
                    <div className="error-404-content">
                        <h1 className="error-404-title">404</h1>
                        <h2 className="error-404-subtitle">Page Not Found</h2>
                        <p className="error-404-message">
                            The page <span className="error-404-path">{page.requestedPath}</span> could not be found on this site.
                        </p>
                        <a href="/" className="error-404-link">
                            Go to Homepage
                        </a>
                    </div>
                </div>
            </>
        );
    }

    // Check if this is a general error page
    if (page && page.type === 'page-error') {
        return (
            <>
                <style dangerouslySetInnerHTML={{
                    __html: `
                        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
                        .error-container {
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background-color: #fef2f2;
                        }
                        .error-content {
                            max-width: 28rem;
                            margin: 0 auto;
                            text-align: center;
                            padding: 2rem;
                        }
                        .error-icon {
                            font-size: 3rem;
                            margin-bottom: 1rem;
                        }
                        .error-title {
                            font-size: 1.5rem;
                            font-weight: 600;
                            color: #991b1b;
                            margin-bottom: 1rem;
                        }
                        .error-message {
                            color: #b91c1c;
                            margin-bottom: 2rem;
                        }
                        .error-link {
                            display: inline-block;
                            padding: 0.75rem 1.5rem;
                            background-color: #dc2626;
                            color: white;
                            text-decoration: none;
                            border-radius: 0.5rem;
                            font-weight: 500;
                        }
                    `
                }} />
                <div className="error-container">
                    <div className="error-content">
                        <div className="error-icon">⚠️</div>
                        <h1 className="error-title">Something went wrong</h1>
                        <p className="error-message">{page.errorMessage}</p>
                        <a href="/" className="error-link">
                            Go to Homepage
                        </a>
                    </div>
                </div>
            </>
        );
    }

    // 2. AUTH: Enforce authentication and authorization if required by page
    // (authenticatedUser was already fetched above before data loading)
    try {
        // Only enforce authentication if page.auth === true
        if (page.auth === true) {
            // If no user found and auth is required, authMiddleware will throw
            if (!authenticatedUser) {
                // Build current URL for callback after login
                const resolvedParams = await params;
                const slug = resolvedParams?.slug || [];
                const currentPath = '/' + slug.join('/');

                // Create a mock request object with current URL
                const mockRequest = {
                    url: currentPath
                };

                authenticatedUser = await authMiddleware(page, { request: mockRequest });
            }

            // Check for role-based authorization (support both 'role' and 'roles')
            const requiredRoles = page.roles || page.role;
            if (requiredRoles) {
                await authorizeUser(authenticatedUser, requiredRoles, page);
            }
        }
    } catch (error) {
        if (error.digest?.includes('NEXT_REDIRECT') || error.message === 'NEXT_REDIRECT') {
            throw error;
        }
        logger.error('Authentication error in render pipeline', error);
        throw error;
    }

    // 3. DATA: Already fetched and processed by getPageData (cached)
    // dataContext and page.meta templates are already resolved

    const combinedParams = {
        ...page.params,
        ...resolvedSearchParams
    };

    // 4. COMPONENTS: Load component registry
    // Pass domain from the site information for database queries
    page.domain = page.site?.primary_domain || page.domain;
    // Use isDev from pageDataResult (already detected from URL/Redis cache)
    const componentRegistry = await getComponents(page, isDev);

    // 5. SEO: Process scripts, fonts, and external CSS
    const scripts = getScripts(page.scripts || {});

    // Debug: Log fonts configuration in dev mode
    if (isDev && shouldLog) {
        console.log('[FONTS DEBUG] page.fonts:', JSON.stringify(page.fonts, null, 2));
    }

    const { fontFaces, preloadLinks, stylesheetLinks } = processFonts(page.fonts || {}, isDev);

    // Debug: Log generated font links
    if (isDev && shouldLog) {
        console.log('[FONTS DEBUG] Generated font links:', stylesheetLinks?.length || 0);
        if (stylesheetLinks && stylesheetLinks.length > 0) {
            stylesheetLinks.forEach((link, i) => {
                console.log(`[FONTS DEBUG] Link ${i + 1}:`, link.attributes?.href);
            });
        }
    }
    
    // Process include_css array for external CSS files
    // Proxy external URLs to bypass CSP restrictions
    const cssLinks = (page.include_css || []).map((cssUrl, index) => {
        const href = cssUrl.startsWith('https://')
            ? `/api/proxy?url=${encodeURIComponent(cssUrl)}`
            : cssUrl;
        return (
            <link
                key={`external-css-${index}`}
                rel="stylesheet"
                href={href}
                crossOrigin="anonymous"
            />
        );
    });
    
    // 6. THEME: Process theme styles
    const { mergedTheme, themeStyles } = getTheme(page.theme, { shouldLog });

    // 6b. USER CSS: Read optional css/global.css for this site (sanitized)
    let userGlobalCss = null;
    try {
        const rawUserCss = await getFile(domain, 'css', 'global');
        userGlobalCss = sanitizeUserGlobalCss(rawUserCss, domain);
    } catch (err) {
        logger.warn(`[${domain}] Failed to load css/global.css: ${err.message}`);
    }

    // 7. JASON: Prepare context and JSON structure
    // Import auth context creator
    const { createAuthContext } = await import('../auth');

    // Flatten database schemas for jcontext (extract only schema, not config)
    const flattenedSchemas = {};
    if (page.databaseSchemas) {
        Object.entries(page.databaseSchemas).forEach(([key, value]) => {
            // Extract only the schema object, removing the wrapper
            flattenedSchemas[key] = value.schema || value;
        });
    }

    // Construct full URL for jcontext
    const pathname = `/${params?.slug?.join('/') || ''}`;
    const protocol = domain.includes('localhost') ? 'http' : 'https';
    const fullUrl = `${protocol}://${domain}${pathname}`;

    // Get language from search params or page configuration
    const language = resolvedSearchParams?.lang || page.lang || 'en';

    // Extract mobile config from settings
    // Note: bridgeSecret IS passed to client - this is safe because:
    // 1. The Expo app only loads the specific JasonJS site (controlled URL)
    // 2. The secret is used for mutual authentication between WebView and native
    // 3. The native app controls what origin can access the bridge
    const mobileConfig = page.mobile ? {
        enabled: page.mobile.enabled ?? true,
        autoInit: page.mobile.autoInit ?? true,
        bridgeSecret: page.mobile.bridgeSecret || '',
        permissions: page.mobile.permissions || {},
        fallbacks: page.mobile.fallbacks || {}
    } : null;

    // Check if billing is configured for this site
    // This prevents components from making unnecessary API calls
    const billingEnabled = !!(page.billing?.provider);

    const jcontext = {
        fetch_data: dataContext,
        hasDatabaseAccess: !!page.database,
        params: combinedParams,
        theme: mergedTheme,
        user: authenticatedUser,
        auth: createAuthContext(authenticatedUser, page.auth_config || {}),
        domain: domain,
        siteId: page.site_id || null,
        pathname: pathname,
        url: fullUrl,
        language: language,
        databaseSchemas: flattenedSchemas,
        isDev: isDev, // Expose dev mode flag to components
        mobile: mobileConfig, // Mobile bridge configuration
        billingEnabled: billingEnabled // Whether billing is configured for this site
    };


    // Normalize components: convert string shorthand to object format
    // e.g. "./Catalog" → { component: "./Catalog" }
    const normalizeComponents = (items) => {
      if (!Array.isArray(items)) return items;
      return items.map(item => {
        if (typeof item === 'string') {
          return { component: item };
        }
        if (item && Array.isArray(item.components)) {
          return { ...item, components: normalizeComponents(item.components) };
        }
        return item;
      });
    };

    let jasonJson = {
      components: normalizeComponents(page.components),
      seo: page.seo // Keep original SEO for array extraction
    };

    // 8. SEO: Handle SEO configuration
    let seoHTML = '';
    let structuredDataScripts = '';
    
    // Check if SEO is explicitly disabled
    if (page.seo !== false) {
      // Prepare page data for SEO
      const domain = page.domain || page.site?.primary_domain || defaultDomain() || 'localhost:3000';
      const siteName = page.site?.name || page.site?.title || domain.split('.')[0] || 'Website';
      
      const pageDataForSEO = {
        url: `https://${domain}${params?.slug ? `/${params.slug.join('/')}` : ''}`,
        language,
        siteName: siteName,
        domain: domain
      };
      
      // Priority order for SEO data:
      // 1. Explicit page.meta (highest priority)
      // 2. Page.title and page.description 
      // 3. Automatic extraction from components (fallback)
      
      let finalSEOData = {
        title: page.meta?.title || page.title || null,
        description: page.meta?.description || page.description || null,
        keywords: [],
        links: [],
        labels: [],
        images: [],
        structuredData: [],
        arrayTitles: [],
        arraySubtitles: [],
        arrayDescriptions: [],
        arrayLabels: []
      };
      
      // Extract automatic SEO data
      const extractedSEO = extractSEOFromJSON(jasonJson, { 
        language, 
        fetchData: dataContext 
      });
      
      // Inject explicit og:image from page.meta into images array (highest priority)
      const metaImage = page.meta?.ogImage || page.meta?.image;
      const explicitImages = metaImage
        ? [{ src: metaImage, alt: page.meta?.ogImageAlt || page.meta?.title || '' }]
        : [];

      // Merge extracted data with page data (page meta takes priority for title/description)
      finalSEOData = {
        title: finalSEOData.title || extractedSEO.title,
        description: finalSEOData.description || extractedSEO.description,
        keywords: extractedSEO.keywords, // Always use extracted keywords
        links: extractedSEO.links,
        labels: extractedSEO.labels,
        images: [...explicitImages, ...extractedSEO.images],
        structuredData: extractedSEO.structuredData,
        // Always use array data from extraction (for blog posts, etc.)
        arrayTitles: extractedSEO.arrayTitles,
        arraySubtitles: extractedSEO.arraySubtitles,
        arrayDescriptions: extractedSEO.arrayDescriptions,
        arrayLabels: extractedSEO.arrayLabels
      };
      
      // Generate SEO HTML and structured data
      seoHTML = generateSEOHTML(finalSEOData, pageDataForSEO);
      structuredDataScripts = generateStructuredData(finalSEOData, pageDataForSEO);
    }
    
    // 9. RENDER: Assemble final JSX
    const WrappedContent = (
        <>
          {/* Mobile config injection for client-side bridge */}
          {mobileConfig && (
            <script
              dangerouslySetInnerHTML={{
                __html: `window.__JASONJS_MOBILE_CONFIG__=${JSON.stringify(mobileConfig)};`
              }}
            />
          )}

          {/* Billing enabled flag - prevents unnecessary API calls when billing not configured */}
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__JASONJS_BILLING_ENABLED__=${JSON.stringify(billingEnabled)};`
            }}
          />

          {/* SEO meta tags in head */}
          <div dangerouslySetInnerHTML={{ __html: seoHTML }} />
          
          {/* SEO structured data */}
          <div dangerouslySetInnerHTML={{ __html: structuredDataScripts }} />
          
          {/* Scripts first */}
          {scripts}
          
          {/* Preload links for fonts */}
          {preloadLinks.map((link, index) => (
            <link
              key={`preload-${index}`}
              rel={link.attributes.rel}
              href={link.attributes.href}
              as={link.attributes.as}
              crossOrigin={link.attributes.crossOrigin}
            />
          ))}
          
          {/* Stylesheet links for fonts */}
          {stylesheetLinks.map((link, index) => (
            <link
              key={`stylesheet-${index}`}
              rel={link.attributes.rel}
              href={link.attributes.href}
              crossOrigin={link.attributes.crossOrigin}
            />
          ))}
          
          {/* External CSS files from include_css */}
          {cssLinks}

          {/* Theme styles inlined from SSR */}
          <style dangerouslySetInnerHTML={{ __html: `${fontFaces}\n${themeStyles}` }} />

          {/* User CSS: css/global.css — loaded after theme so it can override */}
          {userGlobalCss && (
            <style
              data-jason-css="global"
              dangerouslySetInnerHTML={{ __html: userGlobalCss }}
            />
          )}

          <div className={`theme-${mergedTheme.defaultColorScheme}`}>
            <ClientErrorBoundary>
              <JasonCraftThisJSON
                json={jasonJson}
                jcontext={jcontext}
                jcomponents={componentRegistry}
              />
            </ClientErrorBoundary>
          </div>
        </>
    );

    return WrappedContent;
}
