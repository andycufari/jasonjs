// app/api/(site)/version-info/route.js - Debug endpoint for version resolution
import { NextResponse } from 'next/server';
import { resolveSite } from '@/core/sites/resolve';
import { getSite, getDeployVersion, getFileSystem } from '@/core/sites/files';

/**
 * GET /api/version-info - Debug endpoint to show version resolution for current domain
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isDev = searchParams.get('dev') === 'true' || searchParams.get('dev') === '1';
    const specificVersion = searchParams.get('v') || null;
    const { host } = await resolveSite();

    if (!host) {
      return NextResponse.json({ error: 'Host not found' }, { status: 400 });
    }

    const site = await getSite(host);
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    let versionInfo = null;
    let resolvedVersion = 'development';
    let resolutionReason = 'Default development mode';

    if (!isDev && getFileSystem().hasAdapter()) {
      if (specificVersion) {
        versionInfo = await getDeployVersion(site._id, specificVersion);
        resolvedVersion = specificVersion;
        resolutionReason = 'Explicit version parameter';
      } else if (site.domainBuilds && site.domainBuilds[host]) {
        const domainBuild = site.domainBuilds[host];
        if (domainBuild === 'development') {
          resolvedVersion = 'development';
          resolutionReason = 'Domain mapped to development';
        } else {
          versionInfo = await getDeployVersion(site._id, domainBuild);
          resolvedVersion = domainBuild;
          resolutionReason = 'Domain-specific build mapping';
        }
      } else if (site.productionDeployId) {
        versionInfo = await getDeployVersion(site._id, site.productionDeployId);
        resolvedVersion = site.productionDeployId;
        resolutionReason = 'Production deploy fallback';
      } else {
        resolutionReason = 'No production deploy set, using development';
      }
    } else if (isDev) {
      resolutionReason = 'Development mode forced by dev parameter';
    } else {
      resolutionReason = 'No adapter registered (local mode)';
    }

    return NextResponse.json({
      success: true,
      debug: {
        host,
        siteId: site._id?.toString(),
        siteName: site.name,
        isDev,
        specificVersion,
        resolvedVersion,
        resolutionReason,
        domainBuilds: site.domainBuilds || null,
        productionDeployId: site.productionDeployId || null,
        versionExists: !!versionInfo,
        mode: getFileSystem().hasAdapter() ? 'adapter' : 'local'
      }
    });
  } catch (error) {
    console.error('Version info debug error:', error);
    return NextResponse.json({
      error: 'Failed to get version info',
      details: error.message
    }, { status: 500 });
  }
}