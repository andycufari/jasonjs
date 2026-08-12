// app/sites-network/page.jsx
import React from 'react';
import { generateMetadata } from '@/core/render/metadata';
import { MongoClient } from 'mongodb';
import SiteNetwork from '@/components/system/SiteNetwork';

export { generateMetadata };

export default async function Page() {
  const startups = await getPublicStartups();

  return (
    <SiteNetwork startups={startups} />
  );
}

// Server-side only — fetches public startup data for the network page
// Only exposes name, domain, description — no internal IDs, secrets, or config
// Reads from the Startup Studio DB (SS_MONGODB_URI / SS_MONGODB_DB_NAME)
async function getPublicStartups() {
    const uri = process.env.SS_MONGODB_URI;
    const dbName = process.env.SS_MONGODB_DB_NAME;
    if (!uri || !dbName) {
        console.warn('[site-network] SS_MONGODB_URI or SS_MONGODB_DB_NAME not set - returning empty list');
        return [];
    }
    let client;
    try {
        client = new MongoClient(uri);
        await client.connect();
        const db = client.db(dbName);
        const startups = await db.collection('startups').find(
          { primary_domain: { $exists: true, $ne: '' } },
          {
            projection: {
              _id: 0,
              name: 1,
              primary_domain: 1,
              description: 1,
            }
          }
        ).toArray();
        console.log(`[site-network] DB: ${dbName}, found ${startups.length} startups`);
        return startups;
    } finally {
        await client?.close();
    }
}