// Context handed to addon code for one site: its database (with the site's schemas) and
// identity. Built by the addon API router (with the visitor's session) and by framework
// callbacks that act for a site without a visitor, such as billing webhooks
// (no session, serverSideAccess).

import { getSite, getAllDatabases } from '@/core/sites/files';
import Database from '@/core/db';

/**
 * @param {Object} opts
 * @param {string} opts.host - Site domain
 * @param {Object|null} [opts.session] - NextAuth session of the visitor, if any
 * @param {boolean} [opts.serverSideAccess] - Skip per-user security filtering (framework callbacks only)
 * @returns {Promise<Object|null>} { siteId, domain, userId, session, databaseSchemas, database } or null if the site doesn't exist
 */
export async function createAddonContext({ host, session = null, serverSideAccess = false }) {
  const site = await getSite(host);
  if (!site) return null;

  const databases = await getAllDatabases(host);
  const context = {
    siteId: site._id || host,
    domain: host,
    userId: session?.user?.id || session?.user?.email || null,
    session,
    databaseSchemas: databases,
    ...(serverSideAccess ? { serverSideAccess: true } : {}),
  };

  return { ...context, database: new Database(databases, {}, context) };
}
