// Standalone (node tests/unit/api-keys-same-origin.test.mjs) — no jest needed.
// A route that declares `keys` in api.json must require X-API-Key even when the request
// claims to be same-origin: "Sec-Fetch-Site: same-origin" is just a header, cURL can send it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// apiAccess/apiConfig import '@/…' modules that only Next resolves: load their source with stubs.
const load = (src) => import('data:text/javascript,' + encodeURIComponent(src));
const cfgSrc = readFileSync(new URL('../../core/security/apiConfig.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, 'const getFile = async () => null;');
const { matchRoute } = await load(cfgSrc);

let ROUTES = {};
globalThis.__stubs = { getApiConfig: async () => ({ routes: ROUTES }), matchRoute, getEnv: async (h, k) => ({ CAL_KEY: 'secret-123' })[k] };
const accSrc = readFileSync(new URL('../../core/security/apiAccess.js', import.meta.url), 'utf8')
  .replace(/^import crypto from 'crypto';$/m, "import crypto from 'node:crypto';")
  .replace(/^import \{ getApiConfig, matchRoute \} from .*$/m, 'const { getApiConfig, matchRoute } = globalThis.__stubs;')
  .replace(/^import \{ getEnv \} from .*$/m, 'const { getEnv } = globalThis.__stubs;')
  .replace(/^import \{ defaultDomain \} from .*$/m, "const defaultDomain = () => 'localhost';");
assert.ok(!/^import .*@\//m.test(accSrc), 'unexpected import left in apiAccess.js');
const { validateApiAccess } = await load(accSrc);

const H = (o) => new Headers(o);
const HOST = 'site.example.com';
ROUTES = { calEventos: { public: true, keys: ['[[env.CAL_KEY]]'] }, hook: { public: true } };

// keyed route
let r = await validateApiAccess(H({ 'sec-fetch-site': 'same-origin' }), HOST, 'calEventos');
assert.equal(r.allowed, false, 'forged same-origin without key must NOT pass');
assert.equal(r.status, 401);
r = await validateApiAccess(H({ origin: 'https://site.example.com' }), HOST, 'calEventos');
assert.equal(r.allowed, false, 'forged Origin without key must NOT pass');
r = await validateApiAccess(H({ 'sec-fetch-site': 'same-origin', 'x-api-key': 'nope' }), HOST, 'calEventos');
assert.equal(r.allowed, false, 'same-origin with wrong key');
r = await validateApiAccess(H({ 'sec-fetch-site': 'same-origin', 'x-api-key': 'secret-123' }), HOST, 'calEventos');
assert.equal(r.allowed, true, 'same-origin with right key');
r = await validateApiAccess(H({ 'x-api-key': 'secret-123' }), HOST, 'calEventos');
assert.equal(r.allowed, true, 'external with right key');
assert.equal(r.source, 'external');
r = await validateApiAccess(H({}), HOST, 'calEventos');
assert.equal(r.allowed, false, 'external without key');

// unchanged behaviour
r = await validateApiAccess(H({ 'sec-fetch-site': 'same-origin' }), HOST, 'someInternalFn');
assert.equal(r.allowed, true, 'same-origin to a function not in api.json still allowed');
r = await validateApiAccess(H({ 'sec-fetch-site': 'same-origin' }), HOST, 'hook');
assert.equal(r.allowed, true, 'same-origin to a public route without keys still allowed');
r = await validateApiAccess(H({}), HOST, 'someInternalFn');
assert.equal(r.allowed, false, 'external to a function not in api.json still blocked');
r = await validateApiAccess(H({}), HOST, 'hook');
assert.equal(r.allowed, true, 'external to public route without keys still allowed');

console.log('ok — api-keys-same-origin');
