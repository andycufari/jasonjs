/**
 * Database API security — regression tests.
 *
 * Three fail-open holes found 2026-08-12, all reachable from the open internet
 * with no session, no cookie, nothing:
 *
 *   1. String-form rules were ignored. `{"read": "admin"}` fell through the
 *      `!security.level` guard and returned unvalidated, so it meant "public".
 *      A single GET returned an entire members table — names, emails and phone
 *      numbers — to an anonymous caller. The docs taught the string form.
 *
 *   2. Undeclared writes were open. A database declaring only `read` got null
 *      from validateSecurity for POST/PUT/DELETE — "no rule, nothing to filter" —
 *      so anonymous requests could insert, update and delete rows in any
 *      database on the site. Declaring reads and staying silent about writes is
 *      the normal case, so the normal case was an open write endpoint.
 *
 *   3. Unknown levels defaulted to permissive. A typo, or the documented-but-
 *      unimplemented `never`, resolved to "authenticated" instead of denied.
 *
 * Run: node tests/unit/security-fieldFilter.test.js
 */

import { validateSecurity, validateSecurityLevel, normalizeSecurityRule } from '../../core/security/fieldFilter.js';

let failures = 0;
const ANON = null;
const USER = { user: { id: 'u1', role: 'user' } };
const ADMIN = { user: { id: 'a1', role: 'admin' } };

/** Returns 'ALLOWED' or 'DENIED' for a validateSecurity call. */
const attempt = (db, method, session) => {
  try {
    validateSecurity(db, method, session);
    return 'ALLOWED';
  } catch {
    return 'DENIED';
  }
};

const expect = (actual, wanted, label) => {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : `  (expected ${wanted}, got ${actual})`}`);
  if (!ok) failures++;
};

console.log('--- bug 1: string-form rules must be honoured, not ignored ---');
// The exact shape that exposed the member list.
expect(attempt({ security: { read: 'admin' } }, 'GET', ANON), 'DENIED', 'GET read:"admin" blocks anonymous');
expect(attempt({ security: { read: 'admin' } }, 'GET', USER), 'DENIED', 'GET read:"admin" blocks plain user');
expect(attempt({ security: { read: 'admin' } }, 'GET', ADMIN), 'ALLOWED', 'GET read:"admin" allows admin');
expect(attempt({ security: { read: 'authenticated' } }, 'GET', ANON), 'DENIED', 'GET read:"authenticated" blocks anonymous');
expect(attempt({ security: { read: 'authenticated' } }, 'GET', USER), 'ALLOWED', 'GET read:"authenticated" allows user');
expect(attempt({ security: { read: 'public' } }, 'GET', ANON), 'ALLOWED', 'GET read:"public" stays public');

console.log('\n--- both spellings must behave identically ---');
for (const level of ['public', 'authenticated', 'owner', 'admin']) {
  for (const [session, who] of [[ANON, 'anon'], [USER, 'user'], [ADMIN, 'admin']]) {
    const asString = attempt({ security: { read: level } }, 'GET', session);
    const asObject = attempt({ security: { read: { level } } }, 'GET', session);
    expect(asString, asObject, `read:"${level}" === read:{level:"${level}"} for ${who}`);
  }
}

console.log('\n--- bug 2: undeclared writes must fail closed ---');
// The database that let an anonymous POST insert a row: reads locked, writes unmentioned.
const readOnlyDeclared = { security: { read: { level: 'admin' } } };
expect(attempt(readOnlyDeclared, 'POST', ANON), 'DENIED', 'POST with no create rule blocks anonymous');
expect(attempt(readOnlyDeclared, 'PUT', ANON), 'DENIED', 'PUT with no update rule blocks anonymous');
expect(attempt(readOnlyDeclared, 'DELETE', ANON), 'DENIED', 'DELETE with no delete rule blocks anonymous');
expect(attempt(readOnlyDeclared, 'POST', USER), 'ALLOWED', 'POST with no create rule allows a logged-in user');

// A database with no security block at all.
expect(attempt({}, 'POST', ANON), 'DENIED', 'POST on an undeclared database blocks anonymous');
expect(attempt({}, 'DELETE', ANON), 'DENIED', 'DELETE on an undeclared database blocks anonymous');
// Reads stay permissive by default — pages depend on it.
expect(attempt({}, 'GET', ANON), 'ALLOWED', 'GET on an undeclared database stays public');

console.log('\n--- explicit rules still win over the implicit default ---');
expect(attempt({ security: { create: { level: 'public' } } }, 'POST', ANON), 'ALLOWED', 'explicit create:public allows anonymous');
expect(attempt({ security: { create: 'public' } }, 'POST', ANON), 'ALLOWED', 'explicit create:"public" (string) allows anonymous');
expect(attempt({ security: { create: { level: 'admin' } } }, 'POST', USER), 'DENIED', 'create:admin blocks plain user');
expect(attempt({ security: { create: { level: 'admin' } } }, 'POST', ADMIN), 'ALLOWED', 'create:admin allows admin');
expect(attempt({ security: { write: { level: 'admin' } } }, 'DELETE', USER), 'DENIED', 'general write rule covers DELETE');

console.log('\n--- bug 3: unknown and malformed levels must fail closed ---');
expect(attempt({ security: { read: 'addmin' } }, 'GET', ANON), 'DENIED', 'typo in level denies anonymous');
expect(attempt({ security: { read: 'addmin' } }, 'GET', USER), 'DENIED', 'typo in level denies plain user');
expect(attempt({ security: { read: 'never' } }, 'GET', ADMIN), 'DENIED', 'documented "never" denies even admin');
expect(attempt({ security: { read: { level: 'system' } } }, 'GET', ADMIN), 'DENIED', '"system" denies even admin');
expect(attempt({ security: { read: { levl: 'admin' } } }, 'GET', ANON), 'DENIED', 'misspelled KEY (levl) denies anonymous');
expect(attempt({ security: { read: 42 } }, 'GET', ANON), 'DENIED', 'numeric rule denies anonymous');
expect(attempt({ security: { read: ['admin'] } }, 'GET', ANON), 'DENIED', 'array rule denies anonymous');

console.log('\n--- normalizeSecurityRule ---');
expect(JSON.stringify(normalizeSecurityRule('admin')), '{"level":"admin"}', 'string normalizes to object');
expect(JSON.stringify(normalizeSecurityRule({ level: 'admin' })), '{"level":"admin"}', 'object passes through');
expect(String(normalizeSecurityRule(null)), 'null', 'null stays null');
expect(String(normalizeSecurityRule(undefined)), 'null', 'undefined becomes null');
expect(normalizeSecurityRule({ levl: 'admin' }).level, '__malformed__', 'malformed shape is marked, not trusted');

console.log('\n--- the reported attacks, end to end ---');
// GET /api/data/<members table>?limit=500 with no session at all.
expect(
  attempt({ security: { read: 'admin' } }, 'GET', ANON),
  'DENIED',
  'anonymous GET no longer dumps a read:"admin" table'
);
// Anonymous POST against a database whose author only locked reads.
expect(
  attempt({ security: { read: 'admin' } }, 'POST', ANON),
  'DENIED',
  'anonymous POST no longer inserts a row'
);

console.log(`\n${failures === 0 ? 'All tests passed.' : `${failures} test(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
