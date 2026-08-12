import { cache } from 'react';
import jasonConfig from '../../jason.config';
import { headers } from 'next/headers';
import { getPageData } from './pageData';
import { createLogger } from '../utils/logger';
import { runWithRequestContext } from '../utils/requestContext.js';

const logger = createLogger('Metadata');

// Create a hash key for memoization
function fontConfigHash(fonts) {
  if (!fonts || (Array.isArray(fonts) && fonts.length === 0)) {
    return 'empty';
  }
  return JSON.stringify(fonts);
}

export async function generateMetadata(params) {
  // Bind host into AsyncLocalStorage so any logger call during metadata
  // generation tags @host. Mirrors the wrapper around renderPage.
  const headersList = await headers();
  const boundHost =
    headersList.get('x-forwarded-host') ||
    headersList.get('host') ||
    'unknown';
  const proto = headersList.get('x-forwarded-proto') || 'https';
  return runWithRequestContext(
    { host: boundHost },
    () => _generateMetadataImpl(params, { host: boundHost, proto })
  );
}

async function _generateMetadataImpl(params, { host, proto }) {
  try {
    const resolvedParams = await params.params;
    const firstSegment = resolvedParams.slug?.[0];
    const lastSegment = resolvedParams.slug?.[resolvedParams.slug.length - 1];

    if (
      firstSegment === '_next' ||
      firstSegment === 'static' ||
      resolvedParams.slug?.includes('chunks') ||
      /\.(js|css|map|json|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot)$/i.test(lastSegment)
    ) {
      return null;
    }

    // Get authenticated user for consistent caching with renderPage
    // Use cached session to avoid duplicate auth calls
    let authenticatedUser = null;
    try {
      const { getCachedUser } = await import('../auth/sessionCache');
      authenticatedUser = await getCachedUser(null);
    } catch (error) {
      // Metadata generation can continue without auth
    }

    // Use cached page data fetching (shared with renderPage)
    const result = await getPageData(params, { authenticatedUser });

    // Build the actual page URL for og:url / canonical fallback. Without this,
    // every article page would advertise the homepage URL to social previewers.
    const pathname = '/' + (resolvedParams.slug?.join('/') || '');
    const origin = host && host !== 'unknown' ? `${proto}://${host}` : '';
    const pageUrl = origin ? `${origin}${pathname}` : '';

    if (!result || !result.page) {
      return {
        title: 'JasonJS',
        description: 'Built with JasonJS Framework',
        ...(origin && { metadataBase: new URL(origin) }),
      };
    }

    return getMetadata(result.page, result.dataContext, result.isDev, { pageUrl, origin });
  } catch (error) {
    return {
      title: 'JasonJS',
      description: 'Built with JasonJS Framework'
    };
  }
}

// Walk page.components (recursively) and return the first `attributes.fields`
// mapping found, plus a component-level `defaultImage` to use when the record
// has no image. Components like @addons/notion-blog/Article declare field
// names the user configured, and may also declare a fallback image via
// `attributes.display.defaultImage` for articles without a cover.
function findComponentFieldMapping(components) {
  const empty = { title: null, description: null, image: null, author: null, date: null, language: null, defaultImage: null };
  if (!Array.isArray(components)) return empty;

  let foundFields = null;
  let foundDefaultImage = null;

  const stack = [...components];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node || typeof node !== 'object') continue;

    if (!foundFields) {
      const fields = node.attributes?.fields;
      if (fields && typeof fields === 'object') {
        foundFields = {
          title: fields.title || null,
          description: fields.description || null,
          image: fields.image || null,
          author: fields.author || null,
          date: fields.date || null,
          language: fields.language || null,
        };
      }
    }

    if (!foundDefaultImage) {
      const candidate = node.attributes?.display?.defaultImage || node.attributes?.defaultImage;
      if (candidate && typeof candidate === 'string') {
        foundDefaultImage = candidate.trim() || null;
      }
    }

    if (foundFields && foundDefaultImage) break;

    if (Array.isArray(node.components)) {
      stack.push(...node.components);
    }
  }

  return {
    ...(foundFields || { title: null, description: null, image: null, author: null, date: null, language: null }),
    defaultImage: foundDefaultImage,
  };
}

// Pick the record from dataContext most likely to represent the current article.
// Prefers the first entry that has a resolvable title field; falls back to the
// first non-array object (legacy behavior).
function pickArticleRecord(dataContext, componentFields) {
  const entries = Object.entries(dataContext);
  let fallback = null;

  for (const [, data] of entries) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
    if (Object.keys(data).length === 0) continue;

    if (!fallback) fallback = data;

    const title = readField(data, componentFields.title, ['Title', 'title', 'Name', 'name']);
    if (title) return data;
  }

  return fallback;
}

// Read a field from a record, preferring a user-configured name over defaults.
function readField(record, preferredKey, fallbackKeys) {
  if (preferredKey && record[preferredKey] != null && record[preferredKey] !== '') {
    return record[preferredKey];
  }
  for (const key of fallbackKeys) {
    if (record[key] != null && record[key] !== '') {
      return record[key];
    }
  }
  return null;
}

// Normalize an image value to a string URL. Notion "files" fields with multiple
// files come back as an array; some transformers return { url } objects; empty
// strings should be discarded so we fall through to the site-wide og:image.
function normalizeImageValue(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = normalizeImageValue(item);
      if (url) return url;
    }
    return null;
  }
  if (typeof value === 'object') {
    return normalizeImageValue(value.url || value.src || value.href);
  }
  return null;
}

function getMetadata(page, dataContext = {}, isDevArg = false, requestUrl = {}) {
  const { pageUrl = '', origin = '' } = requestUrl;
  // get meta from page
  const meta = page.meta || {};

  // fonts
  const fonts = page.fonts || {};

  // Process fonts with dev mode awareness
  const isDev = isDevArg || page.isDev || false;
  const { fontFaces, preloadLinks, stylesheetLinks } = processFonts(fonts, isDev);

  const defaultTitle = jasonConfig.defaultTitle;
  const defaultDescription = jasonConfig.defaultDescription;

  // For dynamic pages (articles, posts), extract metadata from fetched data
  // This allows article titles/descriptions to override the page-level defaults.
  //
  // Field lookup priority:
  //   1. Field name declared by a page component (attributes.fields.{title,image,...})
  //   2. Common conventions (Title, Name, cover, Image, ...)
  //
  // We walk page.components to find a field mapping because addons like
  // @addons/notion-blog/Article declare `fields: { image: "Image", date: "Created Date" }`
  // and the record key in Notion can be anything the user configured.
  let dynamicTitle = null;
  let dynamicDescription = null;
  let dynamicImage = null;
  let dynamicAuthor = null;
  let dynamicDate = null;
  let dynamicLanguage = null;
  let dynamicType = null;

  const componentFields = findComponentFieldMapping(page.components);

  if (dataContext && Object.keys(dataContext).length > 0) {
    // Prefer a record that looks like an article (has a title-ish field).
    // Falls back to the first non-array object if nothing matches — keeps
    // the previous behavior for pages that fetch a non-article single record.
    const record = pickArticleRecord(dataContext, componentFields);

    if (record) {
      dynamicTitle = readField(record, componentFields.title, ['Title', 'title', 'Name', 'name']);
      dynamicDescription = readField(record, componentFields.description, ['Description', 'description', 'Summary', 'summary']);
      dynamicImage = normalizeImageValue(
        readField(record, componentFields.image, ['cover', 'Image', 'image'])
      );
      dynamicAuthor = readField(record, componentFields.author, ['Author', 'author']);
      dynamicDate = readField(record, componentFields.date, ['Date', 'date', 'publishedAt']);
      dynamicLanguage = readField(record, componentFields.language, ['Language', 'language']);
      dynamicType = 'article';

      if (isDev) {
        logger.debug('Extracted dynamic metadata from dataContext', {
          title: dynamicTitle,
          hasImage: !!dynamicImage,
          image: dynamicImage,
          fieldsUsed: componentFields,
        });
      }
    }
  }

  // Support both root title field and meta.title (root title takes precedence for simplicity)
  // Dynamic data (fetched article) takes highest priority
  const pageTitle = dynamicTitle || page.title || meta.title || defaultTitle;
  const pageDescription = dynamicDescription || meta.description || defaultDescription;

  // Handle favicon from either meta.favIcon or meta.favicon
  // Fallback to default-favicon.ico in assets folder (not /favicon.ico to avoid Next.js auto-serving)
  const faviconUrl = meta.favIcon || meta.favicon || '/assets/default-favicon.ico';

  // Parse ogopengraph array format if it exists
  let ogData = {};
  if (meta.ogopengraph && Array.isArray(meta.ogopengraph)) {
    meta.ogopengraph.forEach(item => {
      const key = item.property?.replace('og:', '');
      if (key && item.content) {
        ogData[key] = item.content;
      }
    });
  }

  // Resolve OG image priority:
  //   1. Image on the fetched record (article cover)
  //   2. Component-level `display.defaultImage` (per-list/per-article fallback)
  //   3. Page-level og settings
  //   4. Site-level meta image
  const ogImage = dynamicImage || componentFields.defaultImage || ogData.image || meta.ogImage || meta.image || '';

  // Build twitter metadata from meta.twitter object or individual fields
  const twitterConfig = meta.twitter || {};
  const twitterCard = twitterConfig.card || (ogImage ? 'summary_large_image' : 'summary');
  const twitterImage = twitterConfig.image || ogImage;

  // Resolve locale and type — dynamic content can override
  const ogLocale = dynamicLanguage || meta.lang || page.language || 'en';
  const ogType = dynamicType || ogData.type || meta.ogType || 'website';

  return {
    title: pageTitle,
    description: pageDescription,
    ...(dynamicAuthor && { authors: [{ name: dynamicAuthor }] }),
    openGraph: {
      title: dynamicTitle || ogData.title || meta.ogTitle || pageTitle,
      description: dynamicDescription || ogData.description || meta.ogDescription || pageDescription,
      url: ogData.url || meta.ogUrl || pageUrl,
      siteName: ogData.site_name || meta.ogSiteName || '',
      images: ogImage ? [
        {
          url: ogImage,
          width: meta.ogImageWidth || 1200,
          height: meta.ogImageHeight || 630,
        },
      ] : [],
      locale: ogLocale,
      type: ogType,
      ...(dynamicDate && { publishedTime: new Date(dynamicDate).toISOString() }),
    },
    twitter: {
      card: twitterCard,
      ...(twitterConfig.site && { site: twitterConfig.site }),
      ...(twitterConfig.creator && { creator: twitterConfig.creator }),
      title: twitterConfig.title || dynamicTitle || meta.ogTitle || pageTitle,
      description: twitterConfig.description || dynamicDescription || meta.ogDescription || pageDescription,
      ...(twitterImage && { images: [twitterImage] }),
    },
    robots: meta.robots || 'index,follow',
    ...(origin && { metadataBase: new URL(origin) }),
    alternates: { canonical: meta.canonical || pageUrl || undefined },
    ...(meta.keywords && {
      keywords: Array.isArray(meta.keywords) ? meta.keywords.join(', ') : meta.keywords,
    }),
    icons: {
      icon: faviconUrl,
      shortcut: faviconUrl,
      apple: faviconUrl,
    },
    // Pass-through: any unknown meta keys become <meta name="key" content="value"> tags
    other: {
      // og:* custom overrides
      ...(meta.ogCustom && Object.fromEntries(
        Object.entries(meta.ogCustom).map(([key, value]) => [`og:${key}`, value])
      )),
      // Any key in meta that isn't handled above gets passed through directly
      // e.g. "google-site-verification": "xxx" → <meta name="google-site-verification" content="xxx">
      ...Object.fromEntries(
        Object.entries(meta).filter(([key]) => ![
          'title', 'description', 'ogTitle', 'ogDescription', 'ogUrl', 'ogSiteName',
          'ogImage', 'image', 'ogImageWidth', 'ogImageHeight', 'ogType', 'ogopengraph',
          'ogCustom', 'twitter', 'robots', 'canonical', 'keywords', 'favIcon', 'favicon',
          'fonts', 'lang', 'verification', 'customMeta',
        ].includes(key))
      ),
    },
    header: [
      { tag: 'link', attributes: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' } },
      { tag: 'link', attributes: { rel: 'preconnect', href: 'https://fonts.cdnfonts.com', crossOrigin: 'anonymous' } },
      ...preloadLinks,
      { tag: 'style', children: fontFaces },
      ...stylesheetLinks,
    ],
    ...(meta.verification && { verification: meta.verification }),
    ...(meta.customMeta && Object.entries(meta.customMeta).reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {})),
  };
}

// Memoized font processing to avoid regenerating CSS on every render
const processFontsInternal = cache((fontsKey, fonts) => {
  logger.debug('Processing fonts', { configHash: fontsKey });

  // Ensure fonts is an array and filter out invalid entries
  const rawArray = Array.isArray(fonts) ? fonts : Object.values(fonts || {});
  const fontsArray = rawArray.filter(font => {
    // Validate font has required properties
    if (!font || typeof font !== 'object') return false;
    if (!font.name || typeof font.name !== 'string') {
      logger.warn('Invalid font entry: missing or invalid name', { font });
      return false;
    }
    return true;
  });

  // Generate font faces
  const fontFamilyDeclarations = fontsArray.map(font => `
    .font-${font.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')} {
      font-family: '${font.name}', sans-serif;
    }
  `).join('\n');

  const fontFaces = `
    ${generateFontFaces(fontsArray)}
    ${fontFamilyDeclarations}
  `;

  // Generate preload links (only for fonts with valid src)
  const preloadLinks = fontsArray
    .filter(font => font.src && typeof font.src === 'string')
    .map(font => ({
      tag: 'link',
      attributes: {
        rel: 'preload',
        href: font.src,
        as: 'style',
        crossOrigin: 'anonymous',
      }
    }));

  // Generate stylesheet links (only for fonts with valid src)
  const stylesheetLinks = fontsArray
    .filter(font => font.src && typeof font.src === 'string')
    .map(font => ({
      tag: 'link',
      attributes: {
        rel: 'stylesheet',
        href: font.src,
        crossOrigin: 'anonymous',
      }
    }));

  return {
    fontFaces,
    preloadLinks,
    stylesheetLinks
  };
});

/**
 * Process fonts with optional dev mode bypass
 * @param {Object|Array} fonts - Font configuration
 * @param {boolean} isDev - Development mode flag (bypasses cache when true)
 */
export function processFonts(fonts, isDev = false) {
  // In dev mode, use timestamp in cache key to bypass cache
  const fontsKey = isDev ? `${fontConfigHash(fonts)}_${Date.now()}` : fontConfigHash(fonts);
  return processFontsInternal(fontsKey, fonts);
}

function generateFontFaces(fonts) {
  // Ensure fonts is iterable
  let fontsArray = [];

  if (Array.isArray(fonts)) {
    fontsArray = fonts;
  } else if (typeof fonts === 'object' && fonts !== null) {
    fontsArray = Object.entries(fonts).map(([key, value]) => ({
      name: value.name || key,
      src: value.src
    }));
  } else if (typeof fonts === 'string') {
    // Handle single font string input
    fontsArray = [{ name: fonts, src: fonts }];
  } else {
    logger.warn('Invalid fonts input, expected array, object, or string');
    return '';
  }


  return fontsArray.map(font => {
    const fontName = font.name;
    const fontSrc = font.src;

    if (!fontSrc) {
      logger.warn(`No font source found for: ${fontName}`);
      return '';
    }

    // Google Fonts URLs don't need format specification
    if (fontSrc.includes('fonts.googleapis.com')) {
      return `
        @import url('${fontSrc}');
      `;
    }

    // For other font files, determine the format
    const format = fontSrc.endsWith('.woff2') ? 'woff2' :
                   fontSrc.endsWith('.woff') ? 'woff' :
                   fontSrc.endsWith('.ttf') ? 'truetype' :
                   fontSrc.endsWith('.otf') ? 'opentype' : 'auto';

    logger.debug(`Processing font: ${fontName}`, { src: fontSrc, format });
    
    return `
      @font-face {
        font-family: '${fontName}';
        src: url('${fontSrc}') format('${format}');
        font-weight: ${font.weight || '400'};
        font-style: ${font.style || 'normal'};
        font-display: swap;
      }
    `;
  }).join('\n');
}