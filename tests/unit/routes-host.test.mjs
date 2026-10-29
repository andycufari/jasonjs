// Standalone (node tests/unit/routes-host.test.mjs) — no jest needed.
// middleware.js asks /api/internal/routes for a site's function rewrites. fetch
// ignores a Host header, so the site travels in x-jasonjs-routes-host — trusted
// only when the request really arrived on localhost.
import assert from 'node:assert/strict';
import { routesHostFor, ROUTES_HOST_HEADER } from '../../core/routes/functionRewrites.js';

assert.equal(ROUTES_HOST_HEADER, 'x-jasonjs-routes-host');
assert.equal(routesHostFor('localhost:3000', 'llmule.xyz', 'cm64.io'), 'llmule.xyz', 'middleware fetch on localhost');
assert.equal(routesHostFor('127.0.0.1:3000', 'llmule.xyz', 'cm64.io'), 'llmule.xyz', '127.0.0.1');
assert.equal(routesHostFor('[::1]:3000', 'llmule.xyz', 'cm64.io'), 'llmule.xyz', 'ipv6 loopback');
assert.equal(routesHostFor('evil.com', 'llmule.xyz', 'evil.com'), 'evil.com', 'outside: header ignored');
assert.equal(routesHostFor('localhost.evil.com', 'llmule.xyz', 'x'), 'x', 'not fooled by a localhost prefix');
assert.equal(routesHostFor('llmule.xyz', null, 'llmule.xyz'), 'llmule.xyz', 'no header');
assert.equal(routesHostFor('localhost:3000', null, 'cm64.io'), 'cm64.io', 'localhost without header');

console.log('ok — routes-host');
