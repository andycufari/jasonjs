// Standalone (node tests/unit/curl-guard.test.mjs) — no jest needed.
// app.CURL: the allowlist is read from settings/general.json (documented) and from
// the legacy `allowedExternalDomains` setting (a file whose content is the array).
// getAllSettings() returns one key per setting file: { general: {...}, ... }.
import assert from 'node:assert/strict';
import { checkCurlUrl, getAllowedExternalDomains } from '../../core/functions/curlGuard.js';

const STRIPE = 'https://api.stripe.com/v1/checkout/sessions';
const MP = 'https://api.mercadopago.com/checkout/preferences';

// 1. Documented place: settings/general.json (the bug: always "No external domains")
const general = { general: { allowedExternalDomains: ['api.stripe.com', 'api.mercadopago.com'] } };
assert.equal(checkCurlUrl(STRIPE, general), null, 'general.json allowlist');
assert.equal(checkCurlUrl(MP, general), null, 'general.json allowlist (2nd domain)');

// 2. Legacy: a setting file named allowedExternalDomains holding the array
const legacy = { allowedExternalDomains: ['api.stripe.com', 'api.mercadopago.com'] };
assert.equal(checkCurlUrl(STRIPE, legacy), null, 'legacy top-level allowlist');

// 3. Both: merged, no duplicates
const both = { general: { allowedExternalDomains: ['api.stripe.com'] }, allowedExternalDomains: ['API.MercadoPago.com', 'api.stripe.com'] };
assert.deepEqual(getAllowedExternalDomains(both), ['api.stripe.com', 'api.mercadopago.com'], 'merged + lowercased + deduped');
assert.equal(checkCurlUrl(MP, both), null, 'merged allowlist');

// 4. Empty → clear error pointing at general.json
for (const empty of [{}, null, undefined, { general: {} }, { general: { allowedExternalDomains: [] } }]) {
  const err = checkCurlUrl(STRIPE, empty);
  assert.match(err, /^No external domains configured/, `empty: ${JSON.stringify(empty)}`);
  assert.match(err, /settings\/general\.json/);
}

// 5. Domain not in the list
assert.match(checkCurlUrl('https://evil.example.com/', general), /not in the allowed domains list/);

// 6. Non-https → its own message (with and without an allowlist)
assert.equal(checkCurlUrl('http://api.stripe.com/v1', general), 'Only HTTPS URLs are allowed for security reasons');
assert.equal(checkCurlUrl('http://api.stripe.com/v1', {}), 'Only HTTPS URLs are allowed for security reasons');

// 7. Security blocks hold even if the host is allowlisted
const permissive = { general: { allowedExternalDomains: ['*.internal', 'printer.local', '10.0.0.5'] } };
assert.match(checkCurlUrl('https://10.0.0.5/', permissive), /Direct IP addresses are not allowed/);
assert.match(checkCurlUrl('https://127.0.0.1/', permissive), /Direct IP addresses are not allowed/);
assert.match(checkCurlUrl('https://169.254.169.254/latest/meta-data', permissive), /Direct IP addresses|cloud metadata/);
assert.match(checkCurlUrl('https://metadata.google.internal/', permissive), /cloud metadata/);
assert.match(checkCurlUrl('https://printer.local/', permissive), /internal domain/);

// 8. Wildcard
const wild = { general: { allowedExternalDomains: ['*.twilio.com'] } };
assert.equal(checkCurlUrl('https://api.twilio.com/2010-04-01', wild), null, 'wildcard subdomain');

// 9. Invalid URL and odd config types don't break it
assert.equal(checkCurlUrl('not a url', general), 'Invalid URL format');
assert.equal(checkCurlUrl(STRIPE, { general: { allowedExternalDomains: 'api.stripe.com' } }), null, 'single string accepted');
assert.match(checkCurlUrl(STRIPE, { general: { allowedExternalDomains: [42, null, {}] } }), /^No external domains configured/, 'non-string entries ignored');

console.log('ok — curl-guard');
