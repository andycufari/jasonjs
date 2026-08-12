// core/services/tracking/salt-manager.js
// Rotating daily salt for cookieless visitor hashing.
//
// The salt rotates every UTC day and is TTL-deleted after 48h.
// Once gone, old visitor hashes are mathematically irreversible — that's
// the privacy guarantee that lets us track without cookies or consent.

import crypto from 'crypto';
import { getMongoClient } from '../../db/adapters/mongodb/index.js';

let cachedSalt = null;
let cachedDay = null;
let ttlEnsured = false;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

async function getCollection() {
  const client = await getMongoClient(process.env.MONGODB_URI);
  const db = client.db(process.env.MONGODB_DB_NAME);
  const col = db.collection('analytics_salts');

  if (!ttlEnsured) {
    // Idempotent — but Mongo only treats createIndex as a no-op when BOTH the
    // key spec and the name match. Some live DBs already have these indexes
    // under names like `salt_ttl_idx` (created out-of-band), so we pin
    // explicit names matching what's in the wild, and swallow the
    // "IndexOptionsConflict" (85) / "IndexKeySpecsConflict" (86) errors that
    // surface when a previously-existing index has the same key under a
    // different name — the index is already doing its job either way.
    try {
      await col.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 60 * 60 * 48, name: 'salt_ttl_idx' }
      );
    } catch (err) {
      if (err.code !== 85 && err.code !== 86) {
        console.error('[salt-manager] Failed to ensure TTL index:', err.message);
      }
    }
    try {
      await col.createIndex({ day: 1 }, { unique: true, name: 'salt_day_unique_idx' });
    } catch (err) {
      if (err.code !== 85 && err.code !== 86) {
        console.error('[salt-manager] Failed to ensure day index:', err.message);
      }
    }
    ttlEnsured = true;
  }

  return col;
}

/**
 * Get today's salt. Cached in-process; falls through to Mongo on cold starts
 * and midnight UTC rollovers. Multi-instance deployments converge on the same
 * salt via the unique { day } index + upsert.
 */
export async function getDailySalt() {
  const day = todayKey();
  if (cachedDay === day && cachedSalt) return cachedSalt;

  try {
    const col = await getCollection();
    const newSalt = crypto.randomBytes(32).toString('hex');

    // findOneAndUpdate with $setOnInsert: first writer wins, everyone else
    // gets the same salt back.
    const result = await col.findOneAndUpdate(
      { day },
      { $setOnInsert: { day, salt: newSalt, createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );

    // MongoDB driver v4/v5 return shapes differ — handle both.
    const doc = result?.value || result;
    cachedSalt = doc?.salt || newSalt;
    cachedDay = day;
    return cachedSalt;
  } catch (err) {
    console.error('[salt-manager] Failed to get daily salt:', err.message);
    return null;
  }
}

/**
 * Compute a visitor hash: 64 bits (16 hex chars) of sha256 over
 * salt + ip + userAgent + siteId. Same inputs → same hash (within a day).
 * Different day → different salt → different hash (no cross-day linkage).
 *
 * Returns null if IP is missing or salt cannot be retrieved.
 */
export async function hashVisitor(ip, userAgent, siteId) {
  if (!ip) return null;
  const salt = await getDailySalt();
  if (!salt) return null;

  return crypto
    .createHash('sha256')
    .update(salt + '|' + ip + '|' + (userAgent || '') + '|' + String(siteId || ''))
    .digest('hex')
    .slice(0, 16);
}
