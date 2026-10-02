// Standalone (node tests/unit/site-admin-guard.test.mjs) — no jest needed.
// Guard used by app.auth.updateUser/deleteUser in site functions. Functions are
// callable without a session from the same origin, so this is the only thing
// standing between a public endpoint and editing users (incl. other tenants').
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// core/functions/appContext.js imports '@/...' aliases that only Next resolves, so
// evaluate just the guard's source instead of importing the module.
const src = readFileSync(new URL('../../core/functions/appContext.js', import.meta.url), 'utf8');
const m = src.match(/export function isSiteAdmin\([\s\S]*?\n}\n/);
assert.ok(m, 'isSiteAdmin not found in core/functions/appContext.js');
const isSiteAdmin = new Function(m[0].replace('export ', '') + '; return isSiteAdmin;')();

const SITE = '67ad3804c03bd9c0659041be';
const OTHER = '66e9a4bd636d581ac7573690';
const s = (user) => ({ user });

assert.equal(isSiteAdmin(null, SITE, false), false, 'no session');
assert.equal(isSiteAdmin(s({ roles: ['lab'], siteId: SITE }), SITE, false), false, 'not admin');
assert.equal(isSiteAdmin(s({ roles: ['lab', 'admin'], siteId: SITE }), SITE, false), true, 'admin in roles[]');
assert.equal(isSiteAdmin(s({ role: 'admin', siteId: SITE }), SITE, false), true, 'legacy single role');
assert.equal(isSiteAdmin(s({ roles: ['admin'], siteId: OTHER }), SITE, false), false, 'admin of ANOTHER site');
assert.equal(isSiteAdmin(s({ roles: ['admin'] }), SITE, false), true, 'session without siteId (legacy token)');
assert.equal(isSiteAdmin(null, SITE, true), true, 'verified Studio request');

console.log('ok — site-admin-guard');
