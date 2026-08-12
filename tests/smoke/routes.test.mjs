// tests/smoke/routes.test.mjs — route-level smoke suite
//
// Verifies the runtime end to end against the example.com demo site:
// page render, dynamic route, site-local component, native function
// GET/POST, app.db round-trip on the file store, and asset serving.
//
// Run:            npm run smoke          (spawns `next dev` on :3987)
// Against a URL:  SMOKE_BASE_URL=http://localhost:3000 npm run smoke
//
// This suite gates every Phase 2 rename commit: build + smoke must be
// green before and after each rename.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = process.env.SMOKE_PORT || 3987;
const EXTERNAL = process.env.SMOKE_BASE_URL;
const BASE = EXTERNAL || `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 120_000;

let server = null;

async function waitForReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${BASE} not ready after ${READY_TIMEOUT_MS / 1000}s`);
}

before(async () => {
  if (!EXTERNAL) {
    server = spawn('npx', ['next', 'dev', '--port', String(PORT)], {
      cwd: new URL('../..', import.meta.url).pathname,
      env: {
        ...process.env,
        DEFAULT_DOMAIN: 'example.com',
        SITES_PATH: './sites',
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'smoke-test-secret'
      },
      detached: true,
      stdio: process.env.SMOKE_VERBOSE ? 'inherit' : 'ignore'
    });
  }
  await waitForReady();
});

after(() => {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
});

// Function routes enforce same-origin access by default
const sameOrigin = { Origin: BASE };

test('page render: homepage serves the JSON-defined page', async () => {
  const res = await fetch(`${BASE}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Build Apps with JSON/);
});

test('page render: dynamic route /docs/[slug] resolves params', async () => {
  const res = await fetch(`${BASE}/docs/getting-started`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /getting-started/);
});

test('component render: site-local ./Header mounts on /about', async () => {
  const res = await fetch(`${BASE}/about`);
  assert.equal(res.status, 200);
  const html = await res.text();
  // distinctive classes from sites/example.com/components/Header.jsx
  assert.match(html, /bg-white shadow-sm border-b/);
});

test('function GET: /api/hello runs a native site function', async () => {
  const res = await fetch(`${BASE}/api/hello?name=Smoke`, { headers: sameOrigin });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.message, 'Hello from JasonJS');
  assert.equal(json.name, 'Smoke');
});

test('function POST + app.db: guestbook write/read round-trip on file store', async () => {
  const token = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const post = await fetch(`${BASE}/api/guestbook`, {
    method: 'POST',
    headers: { ...sameOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Test', message: token })
  });
  assert.equal(post.status, 201);
  const created = await post.json();
  assert.ok(created.id, 'created entry should have an id');

  const get = await fetch(`${BASE}/api/guestbook`, { headers: sameOrigin });
  assert.equal(get.status, 200);
  const { entries } = await get.json();
  assert.ok(
    entries.some((e) => e.message === token),
    'posted entry should come back from app.db'
  );
});

test('asset serving: /assets/logo.svg served from sites/<domain>/assets/', async () => {
  const res = await fetch(`${BASE}/assets/logo.svg`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /image\/svg\+xml/);
  const body = await res.text();
  assert.match(body, /JasonJS/);
});

test('asset serving: missing asset is a 404, not an error', async () => {
  const res = await fetch(`${BASE}/assets/does-not-exist.svg`);
  assert.equal(res.status, 404);
});
