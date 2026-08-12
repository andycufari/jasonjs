// app/api/data/[database]/init/route.js
import { NextResponse } from 'next/server';
import { getSite } from '@/core/sites/files';
import { resolveSite } from '@/core/sites/resolve';
import { getAllDatabases } from '@/core/sites/files.js';
import { ensureIndexes } from '@/core/db/adapters/jason/index.js';

/**
 * Initialize database indexes
 * GET /api/data/{database}/init
 */
export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const { host } = await resolveSite(request);

    const site = await getSite(host);
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Use getAllDatabases which supports both legacy and new format
    const databases = await getAllDatabases(host);

    if (!databases?.[resolvedParams.database]) {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    const dbConfig = databases[resolvedParams.database];

    // Add siteId to config
    const fullConfig = {
      ...dbConfig,
      siteId: site._id || host
    };

    // Ensure indexes are created
    await ensureIndexes(fullConfig);

    return NextResponse.json({
      success: true,
      message: `Indexes created for ${resolvedParams.database}`,
      database: resolvedParams.database
    });

  } catch (error) {
    console.error('Index initialization error:', error);
    return NextResponse.json({
      error: 'Failed to initialize indexes',
      details: error.message
    }, { status: 500 });
  }
}
