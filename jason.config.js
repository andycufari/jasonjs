// jason.config.js — instance-level defaults for this JasonJS installation.
//
// These are the last-resort values the framework falls back to when a site
// doesn't define its own (via settings/meta.json, settings/site.json, ...).
// Edit freely — this file is yours, not the framework's.

const jasonConfig = {
  // Used when a page/site defines no title or description of its own
  defaultTitle: 'JasonJS',
  defaultDescription: 'A JSON-driven web framework',

  // Footer appended to transactional emails (verification codes, magic links)
  email: {
    footerText: 'Powered by JasonJS',
    footerLink: 'https://github.com/andycufari/jasonjs'
  },

  // The /site-network page and its sitemap entry
  network: {
    title: 'Site Network',
    description: 'Sites running on this JasonJS instance.'
  },

  // User-Agent sent by the image/media proxy when fetching remote assets
  proxyUserAgent: 'Mozilla/5.0 (compatible; JasonJS/1.0)'
};

export default jasonConfig;
