// app/api/robots.txt/route.js
// Dynamic robots.txt generation — allows per-site config via settings
import { getSite } from '../../../core/sites/files';
import { resolveSite } from '../../../core/sites/resolve';
import { loadPageDefinition } from '../../../core/render/loadPage';

export async function GET() {
  const { host } = await resolveSite();
  const baseUrl = `https://${host}`;

  try {
    const site = await getSite(host);
    if (!site) {
      return new Response('User-agent: *\nAllow: /\n', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Load site meta for robots config
    const globalSettings = await loadPageDefinition({});
    const meta = globalSettings?.meta || {};
    const robotsConfig = meta.robots || 'index, follow';

    // Build robots.txt
    let output = '';

    // Default: allow all crawlers
    output += 'User-agent: *\n';
    if (robotsConfig.includes('noindex')) {
      output += 'Disallow: /\n';
    } else {
      output += 'Allow: /\n';
      // Block internal/API routes from indexing
      output += 'Disallow: /api/\n';
      output += 'Disallow: /_next/\n';
      output += 'Disallow: /health\n';
    }
    output += '\n';

    // Point to sitemap and llms.txt
    output += `Sitemap: ${baseUrl}/sitemap.xml\n`;

    return new Response(output, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('Error generating robots.txt:', error);
    return new Response('User-agent: *\nAllow: /\n', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 3600;
