// app/sitemap.js
import { generateSitemapAndRss } from '../core/render/sitemap';
import { getSite } from '../core/sites/files';
import { resolveSite } from '../core/sites/resolve';

// Use Next.js cache for data fetching
async function fetchSitemapData(siteId, baseUrl) {
  const { entries } = await generateSitemapAndRss(siteId, baseUrl);
  return entries;
}

export default async function sitemap() {
  const { host } = await resolveSite();
  const baseUrl = `https://${host}`;

  const site = await getSite(host);
  if (!site) throw new Error('Site not found for this host');

  console.log(`Generating sitemap for site: ${site._id || site.domain || host}`);

  // Fetch sitemap data with proper baseURL
  const entries = await fetchSitemapData(site._id || site.domain || host, baseUrl);

  console.log(`Generated ${entries.length} sitemap entries`);

  // Format entries for Next.js MetadataRoute
  return entries.map(entry => ({
    url: entry.url.startsWith('http') ? entry.url : `${baseUrl}${entry.url}`,
    lastModified: new Date(entry.lastModified),
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}

// Set dynamic because we use headers() to get host
export const dynamic = 'force-dynamic';

// Set revalidate period
export const revalidate = 3600; // Revalidate every hour