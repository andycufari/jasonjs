// core/auth/sessionCache.js - Cached session fetcher to avoid duplicate calls

import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { createAuthOptions } from './options';
import { createLogger } from '../utils/logger';

const logger = createLogger('SessionCache');

/**
 * Internal session fetcher (always cached via React's cache())
 */
const fetchSessionInternal = cache(async (pageAuth = null, cacheKey = 'default') => {
  logger.debug('Fetching session', { hasPageAuth: !!pageAuth, cacheKey });

  try {
    const authOptions = await createAuthOptions(pageAuth);
    const session = await getServerSession(authOptions);

    logger.debug('Session retrieved', {
      authenticated: !!session?.user,
      userId: session?.user?.id
    });

    return session;
  } catch (error) {
    logger.error('Failed to fetch session', error);
    return null;
  }
});

/**
 * Cached session fetcher using React's cache() to deduplicate
 * session authentication calls across the same request.
 *
 * This prevents the duplicate session fetching that happens in:
 * 1. generateMetadata()
 * 2. renderPage()
 *
 * React's cache() ensures that within a single request, the same
 * session is returned without re-fetching from the database.
 *
 * @param {Object} pageAuth - Page-specific auth configuration
 * @param {boolean} isDev - Development mode flag (bypasses cache when true)
 */
export async function getCachedSession(pageAuth = null, isDev = false) {
  // In dev mode, use timestamp as cache key to bypass React cache
  // This ensures fresh session data during development
  const cacheKey = isDev ? Date.now().toString() : 'default';

  return fetchSessionInternal(pageAuth, cacheKey);
}

/**
 * Extract user from cached session
 * @param {Object} pageAuth - Page-specific auth configuration
 * @param {boolean} isDev - Development mode flag
 */
export async function getCachedUser(pageAuth = null, isDev = false) {
  const session = await getCachedSession(pageAuth, isDev);
  return session?.user || null;
}

export default getCachedSession;
