// app/api/sitemap/route.js
import { generateSitemapAndRss, generateSitemapXml } from '../../../core/render/sitemap';
import { getSite } from '../../../core/sites/files';
import { resolveSite } from '../../../core/sites/resolve';
import { withRequestContext } from '../../../core/utils/requestContext.js';

export const GET = withRequestContext(async function GET() {
  const { host } = await resolveSite();
  const baseUrl = `https://${host}`;

  try {
    const site = await getSite(host);
    if (!site) {
      console.error(`[sitemap] Site not found for host: ${host}`);
      return new Response('Site not found', { status: 404 });
    }

    // Generate sitemap data with full URLs
    const { entries } = await generateSitemapAndRss(site._id || site.domain || host, baseUrl);

    // Format entries correctly for XML
    const formattedEntries = entries.map(entry => ({
      ...entry,
      url: entry.url.startsWith('http') ? entry.url : `${baseUrl}${entry.url}`,
      lastModified: entry.lastModified instanceof Date
        ? entry.lastModified
        : new Date(entry.lastModified || Date.now())
    }));

    // Generate XML using the correct function
    const sitemapXml = generateSitemapXml(formattedEntries);

    // Return XML with proper content type
    return new Response(sitemapXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600' // 1 hour cache
      }
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response(`Error generating sitemap: ${error.message}`, { status: 500 });
  }
});

// Set dynamic because we use headers() to get host
export const dynamic = 'force-dynamic';

export const revalidate = 3600; // Revalidate every hour