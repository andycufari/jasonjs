// Standalone (node tests/unit/routes-host.test.mjs) — no jest needed.
// middleware.js asks /api/internal/routes for a site's function rewrites. fetch
// ignores a Host header, so the site travels in x-jasonjs-routes-host — trusted
// only when the request really arrived on localhost.
import assert from 'node:assert/strict';
import { routesHostFor, internalOrigin, ROUTES_HOST_HEADER } from '../../core/routes/functionRewrites.js';

assert.equal(ROUTES_HOST_HEADER, 'x-jasonjs-routes-host');
assert.equal(routesHostFor('localhost:3000', 'llmule.xyz', 'cm64.io'), 'llmule.xyz', 'middleware fetch on localhost');
assert.equal(routesHostFor('127.0.0.1:3000', 'llmule.xyz', 'cm64.io'), 'llmule.xyz', '127.0.0.1');
assert.equal(routesHostFor('[::1]:3000', 'llmule.xyz', 'cm64.io'), 'llmule.xyz', 'ipv6 loopback');
assert.equal(routesHostFor('evil.com', 'llmule.xyz', 'evil.com'), 'evil.com', 'outside: header ignored');
assert.equal(routesHostFor('localhost.evil.com', 'llmule.xyz', 'x'), 'x', 'not fooled by a localhost prefix');
assert.equal(routesHostFor('llmule.xyz', null, 'llmule.xyz'), 'llmule.xyz', 'no header');
assert.equal(routesHostFor('localhost:3000', null, 'cm64.io'), 'cm64.io', 'localhost without header');

// The middleware must reach its own server over plain http, whatever the request said
assert.equal(internalOrigin('https://localhost:3000', '3000'), 'http://127.0.0.1:3000', 'https from X-Forwarded-Proto → http');
assert.equal(internalOrigin('http://localhost:3055', undefined), 'http://127.0.0.1:3055', 'keeps a local port');
assert.equal(internalOrigin('https://llmule.xyz', '3000'), 'http://127.0.0.1:3000', 'public origin → env port, not the site');
assert.equal(internalOrigin('https://llmule.xyz:8443', '3000'), 'http://127.0.0.1:3000', 'a public port is not ours');
assert.equal(internalOrigin('garbage', undefined), 'http://127.0.0.1:3000', 'default 3000');

console.log('ok — routes-host');
