import { getFile, getSite } from '../sites/files.js';

/**
 * Get site information from site.json
 * Fallback chain:
 * 1. site.json file (user-defined)
 * 2. Startup metadata from database (name, description, image)
 * 3. Default JasonJS branding
 *
 * @param {string} domain - The domain to get site info for
 * @returns {Promise<Object>} Site information object
 */
export async function getSiteInfo(domain) {
  // Stage 1: Try site.json file
  try {
    const siteJson = await getFile(domain, 'site', 'site');
    if (siteJson) {
      return JSON.parse(siteJson);
    }
  } catch (error) {
    // Silent fail - try next fallback
  }

  // Stage 2: Get site metadata from the site record
  try {
    const site = await getSite(domain);
    if (site && site.name) {
      return {
        name: site.name,
        url: domain,
        logo: site.image || null,
        description: site.description || site.startupMetadata?.tagline || `Welcome to ${site.name}`,
        tagline: site.startupMetadata?.tagline || site.description || null,
        foundedDate: site.created_at ? new Date(site.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        legal: {
          termsUrl: '/terms',
          privacyUrl: '/privacy',
          cookiesUrl: '/cookies'
        },
        social: {},
        contact: {
          email: `hello@${domain}`,
          support: `support@${domain}`
        },
        branding: {
          protectedByText: 'Protected by',
          poweredByText: 'Powered by'
        }
      };
    }
  } catch (error) {
    // Silent fail - use default fallback
  }

  // Stage 3: Default JasonJS branding (last resort)
  return {
    name: 'JasonJS',
    url: domain,
    logo: null,
    description: 'Built with JasonJS Framework',
    tagline: 'The AI-powered web framework',
    foundedDate: new Date().toISOString().split('T')[0],
    legal: {
      termsUrl: '/terms',
      privacyUrl: '/privacy',
      cookiesUrl: '/cookies'
    },
    social: {
      twitter: '@jasonjs',
      github: 'jasonjs-framework'
    },
    contact: {
      email: `hello@${domain}`,
      support: `support@${domain}`
    },
    branding: {
      protectedByText: 'Protected by',
      poweredByText: 'Powered by'
    }
  };
}