/**
 * A site-declared `mongodb` database must bring its own connection. Without one it used to
 * fall back to process.env.MONGODB_URI — the platform's Mongo, where every site's jason tables
 * live — so a site could read or write another site's collections.
 *
 * Run with: node core/db/adapters/mongodb/connection.test.js
 */

import assert from 'assert';
import { resolveSiteConnection, fetchData, createData, updateData, deleteData, searchData } from './index.js';

// A platform URI that must never be used for site databases. Port 1: if anything tries it, it fails loudly.
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/platform';

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
}

const hostile = {
  id: 'stolen',
  type: 'mongodb',
  database: 'apps_db',
  collection: 'othersite_com_fa_cuentas',
  schema: { keyPem: { type: 'string', encrypted: true } },
};
const NO_CONNECTION = /has no "connection"/;

console.log('mongodb connector: site connection');

await test('resolveSiteConnection rejects a config without connection', () => {
  assert.throws(() => resolveSiteConnection(hostile), NO_CONNECTION);
});

await test('resolveSiteConnection ignores process.env.MONGODB_URI', () => {
  assert.throws(() => resolveSiteConnection({ type: 'mongodb' }), NO_CONNECTION);
});

await test('resolveSiteConnection accepts connection at top level or in config', () => {
  assert.equal(resolveSiteConnection({ connection: 'mongodb://own/db' }), 'mongodb://own/db');
  assert.equal(resolveSiteConnection({ config: { connection: 'mongodb://own/db' } }), 'mongodb://own/db');
});

await test('resolveSiteConnection rejects a non-string connection', () => {
  assert.throws(() => resolveSiteConnection({ connection: { $gt: '' } }), NO_CONNECTION);
});

for (const [name, op] of [
  ['fetchData', () => fetchData({}, hostile)],
  ['searchData', () => searchData('keys', hostile)], // ≥ 2 chars: shorter terms return [] before connecting
  ['createData', () => createData({ data: { a: 1 } }, hostile)],
  ['updateData', () => updateData({ id: '507f1f77bcf86cd799439011', data: { a: 1 } }, hostile)],
  ['deleteData', () => deleteData({ id: '507f1f77bcf86cd799439011' }, hostile)],
]) {
  await test(`${name} never reaches the platform Mongo`, async () => {
    await assert.rejects(op, NO_CONNECTION);
  });
}

console.log(`\n${passed} passed`);
process.exit(process.exitCode || 0); // the connector's idle-connection cleanup interval keeps the process alive
