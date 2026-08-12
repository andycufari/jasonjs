const path = require('path');
const fs = require('fs');

// Fix for Node.js 25+ which has a broken experimental localStorage global
// Node's localStorage is an empty object {} without getItem/setItem methods
// This causes "localStorage.getItem is not a function" errors
// We delete it so code properly falls back to browser checks
if (typeof window === 'undefined' && typeof localStorage !== 'undefined') {
  // Only delete if it's Node's broken implementation (empty object without Storage API)
  if (localStorage && typeof localStorage.getItem !== 'function') {
    delete globalThis.localStorage;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable dev indicators that may have SSR issues
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts: self, inline, blob workers, and common CDNs
              "script-src 'self' 'unsafe-inline' blob: https://www.youtube.com https://www.google.com https://www.googletagmanager.com https://static.cloudflareinsights.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com https://v8.js-dos.com https://tally.so",
              // Styles: self, inline, and common CDNs
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com https://v8.js-dos.com",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
              "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://tally.so",
              "connect-src 'self' https: wss: blob:",
              "media-src 'self' https: blob:",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Alias for cache and site directories
    config.resolve.alias['.cache'] = path.join(__dirname, '.cache');
    config.resolve.alias['@site'] = path.join(__dirname, 'sites');
    config.resolve.alias['@sites'] = path.join(__dirname, 'sites');

    // CM64 addon: when a .cm64/ directory is present it provides runtime
    // component compilation + database-mode function execution. Without it,
    // @cm64 resolves to stubs that throw with a helpful message.
    const hasCm64 = fs.existsSync(path.join(__dirname, '.cm64'));
    config.resolve.alias['@cm64'] = hasCm64
      ? path.join(__dirname, '.cm64')
      : path.join(__dirname, 'core/cm64-stub');

    // Key the webpack cache on .cm64 presence so flipping it invalidates
    // previously cached module resolutions (filesystem cache only).
    if (config.cache && typeof config.cache === 'object') {
      config.cache = {
        ...config.cache,
        version: (config.cache.version || '') + (hasCm64 ? '-cm64' : '-oss'),
      };
    }


    // Exclude cache and generated site components from watching
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/.cache/**',
        '**/node_modules/**',
        // Ignore generated site components but keep example sites
        '**/sites/[!example.com|localhost]*/components/**',
      ],
    };

    // Exclude cache directories from compilation (safety measure)
    if (config.externals) {
      const externals = Array.isArray(config.externals) 
        ? config.externals 
        : [config.externals];
      config.externals = [...externals, /^\.cache\/.+$/];
    }
    
    return config;
  },
  // Exclude .cache directory from page compilation
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  transpilePackages: ['tailwindcss'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '**',
      },
    ],
    domains: [
      'www.notion.so',
      'notion.so',
      's3.us-west-2.amazonaws.com',
      'prod-files-secure.s3.us-west-2.amazonaws.com',
      'images.unsplash.com',
      'cm64-ss-public.s3.amazonaws.com'
      // Add other domains where your images might be hosted
    ],
  },
  serverExternalPackages: ['mongodb'],
};

module.exports = nextConfig;