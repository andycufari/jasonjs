// lib/auth-config.js - Server-side auth configuration utilities

export async function getAuthContext() {
  // This should only run on server-side
  if (typeof window !== 'undefined') {
    throw new Error('getAuthContext should only be called server-side');
  }

  const { resolveSite } = await import('@/core/sites/resolve');
  const { host: domain } = await resolveSite();

  try {
    // Get site configuration and theme (using dynamic imports to keep MongoDB server-side)
    const { getSite } = await import('@/core/sites/files');
    const site = await getSite(domain);
    const siteId = site?._id?.toString() || domain;

    // Load auth configuration for this tenant (avoiding MongoDB imports)
    // For now, let's use the default config and skip the complex auth loading
    // that includes MongoDB imports
    const { DEFAULT_AUTH_CONFIG } = await import('@/core/auth/defaults');
    const config = DEFAULT_AUTH_CONFIG;

    // Get theme configuration
    const { getTheme } = await import('@/core/render/getTheme');
    const pageTheme = site?.theme || {};
    const { mergedTheme } = getTheme(pageTheme);

    return {
      config,
      siteId,
      domain,
      theme: mergedTheme
    };
  } catch (error) {
    console.error('Error getting auth context:', error);

    // Fallback configuration (dynamic imports)
    const defaultsModule = await import('@/core/auth/defaults');
    const { getTheme } = await import('@/core/render/getTheme');
    const { mergedTheme } = getTheme({});

    return {
      config: defaultsModule.DEFAULT_AUTH_CONFIG,
      siteId: domain,
      domain,
      theme: mergedTheme
    };
  }
}