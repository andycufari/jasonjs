// app/api/internal/routes/route.js
// Function rewrites from settings/routes.json, for middleware.js — it runs in the
// Edge Runtime and can't read the site's files itself.

import { NextResponse } from 'next/server';
import { getSettings } from '../../../../core/sites/files';
import { resolveSite } from '../../../../core/sites/resolve';
import { routesHostFor, ROUTES_HOST_HEADER } from '../../../../core/routes/functionRewrites';

export async function GET(request) {
  try {
    const { host: resolved } = await resolveSite(request);
    const host = routesHostFor(
      request.headers.get('host'),
      request.headers.get(ROUTES_HOST_HEADER),
      resolved
    );
    const routes = await getSettings(host, 'routes');

    if (!routes || typeof routes !== 'object') {
      return NextResponse.json({ functionRoutes: {} });
    }

    // Only function routes (entries with a "function" key)
    const functionRoutes = {};
    for (const [pattern, config] of Object.entries(routes)) {
      if (config && typeof config === 'object' && config.function) {
        functionRoutes[pattern] = { function: config.function };
      }
    }

    return NextResponse.json({ functionRoutes });
  } catch (error) {
    console.error('[internal/routes] Error loading routes:', error.message);
    return NextResponse.json({ functionRoutes: {} });
  }
}
