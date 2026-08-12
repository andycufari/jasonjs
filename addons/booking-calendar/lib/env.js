// Resolve addon env vars from (tenant .env.json → process.env).

import { getEnv } from '../../../core/sites/files.js';

export async function loadBookingEnv(domain) {
  const get = async (key) => (await getEnv(domain, key)) || process.env[key] || null;
  const env = {
    GOOGLE_CLIENT_ID: await get('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: await get('GOOGLE_CLIENT_SECRET'),
    GOOGLE_REDIRECT_URI: await get('GOOGLE_REDIRECT_URI'),
    BOOKING_CALENDAR_STATE_SECRET: await get('BOOKING_CALENDAR_STATE_SECRET'),
  };
  const missing = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    const err = new Error(`booking-calendar env missing: ${missing.join(', ')}`);
    err.code = 'ADDON_ENV_MISSING';
    err.missing = missing;
    throw err;
  }
  return env;
}
