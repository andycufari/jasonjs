/**
 * Tests for deepMerge.
 *
 * The critical property is PURITY. Callers merge per-tenant config onto shared
 * module-level singletons (notably DEFAULT_AUTH_CONFIG in core/auth/defaults.js),
 * so a mutating merge leaks one tenant's settings into every other tenant served
 * by the same process.
 *
 * Run with: node core/utils/deepMerge.test.js
 */

import { deepMerge } from './deepMerge.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('✅ PASS: ' + msg); passed++; }
  else { console.error('❌ FAIL: ' + msg); failed++; }
}

function assertEqual(actual, expected, msg) {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    msg + (JSON.stringify(actual) === JSON.stringify(expected)
      ? ''
      : ` (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`));
}

// ---------------------------------------------------------------------------
// Regression: cross-tenant config bleed
//
// A site whose settings/auth.json is {} was inheriting another site's required
// signup fields, producing a signup form that demanded a "Phone number" it never
// rendered an input for — unfillable.
// ---------------------------------------------------------------------------

const DEFAULT_AUTH_CONFIG = {
  providers: { credentials: { enabled: true } },
  registration: { enabled: true, customFields: [] },
};
const pristine = JSON.stringify(DEFAULT_AUTH_CONFIG);

const siteA = deepMerge(DEFAULT_AUTH_CONFIG, {
  signup: { fields: { phone: { label: 'Phone number', required: true, type: 'tel' } } },
});
assert(siteA.signup.fields.phone.required === true,
  'site with configured fields still receives them');

const siteB = deepMerge(DEFAULT_AUTH_CONFIG, {});
assert(siteB.signup === undefined,
  'site with no auth.json does NOT inherit another site\'s signup fields');

const siteC = deepMerge(DEFAULT_AUTH_CONFIG, { providers: { google: { enabled: true } } });
assert(siteC.signup === undefined,
  'unrelated site is unaffected by an earlier merge');

assertEqual(JSON.parse(pristine), DEFAULT_AUTH_CONFIG,
  'shared defaults singleton is never mutated');

assert(siteA !== DEFAULT_AUTH_CONFIG && siteB !== DEFAULT_AUTH_CONFIG,
  'returns a new object rather than the target');

assert(deepMerge({ a: { b: 1 } }, { a: { c: 2 } }).a.b === 1 &&
  (() => { const t = { a: { b: 1 } }; deepMerge(t, { a: { b: 99 } }); return t.a.b === 1; })(),
  'nested objects in the target are not mutated either');

// ---------------------------------------------------------------------------
// Merge semantics
// ---------------------------------------------------------------------------

assertEqual(deepMerge({ x: 1 }, { x: 2 }), { x: 2 }, 'source overrides target');
assertEqual(deepMerge({ x: 1 }, { y: 2 }), { x: 1, y: 2 }, 'disjoint keys combine');
assert(deepMerge({ registration: { enabled: true, codeExpiryMinutes: 10 } },
  { registration: { enabled: false } }).registration.codeExpiryMinutes === 10,
  'nested merge preserves sibling defaults');
assert(deepMerge({ a: { b: { c: 1, d: 2 } } }, { a: { b: { c: 9 } } }).a.b.d === 2,
  'merges deeply nested objects');

assertEqual(deepMerge({ a: [1, 2, 3] }, { a: [9] }).a, [9],
  'arrays are replaced wholesale, not merged element-wise');
assert((() => {
  const source = { a: [1] };
  const result = deepMerge({ a: [0] }, source);
  result.a.push(2);
  return source.a.length === 1;
})(), 'merged arrays do not alias the source array');

assert(deepMerge({ a: 1 }, null) === null, 'non-object source is returned as-is');
assert(deepMerge(null, { a: 1 }).a === 1, 'non-object target falls through to source');
assert(deepMerge({ a: { b: 1 } }, { a: null }).a === null, 'explicit null overrides an object');
assert(deepMerge({ a: { b: 1 } }, { a: [1] }).a.length === 1, 'array replaces an object');

// ---------------------------------------------------------------------------
// Prototype pollution — source objects can originate from tenant JSON
// ---------------------------------------------------------------------------

deepMerge({}, JSON.parse('{"__proto__":{"polluted":true}}'));
assert({}.polluted === undefined, 'does not pollute Object.prototype via __proto__');

deepMerge({}, JSON.parse('{"constructor":{"prototype":{"polluted2":true}}}'));
assert({}.polluted2 === undefined, 'does not pollute via constructor.prototype');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
