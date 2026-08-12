import { generateSitemapAndRss, generateRssXml } from '../../core/render/sitemap';
import { getSite } from '../../core/sites/files';
import { resolveSite } from '../../core/sites/resolve';

export async function GET() {
  const { host } = await resolveSite();

  const site = await getSite(host);
  if (!site) throw new Error('Site not found for this host');

  const baseUrl = `https://${host}`;
  const { entries, siteMeta } = await generateSitemapAndRss(site._id || site.domain || host, baseUrl);
  const rssXml = generateRssXml(entries, baseUrl, siteMeta);

  return new Response(rssXml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}

// Set dynamic because we use headers() to get host
export const dynamic = 'force-dynamic';
