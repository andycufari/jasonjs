// Standalone (node tests/unit/app-sleep.test.mjs) — no jest needed.
// app.sleep lets a function poll (e.g. wait for a job row to be answered) without
// setTimeout, which the sandbox doesn't expose. It must never outlive the run.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// core/functions/appContext.js imports '@/...' aliases that only Next resolves, so
// evaluate just the factory's source instead of importing the module.
const src = readFileSync(new URL('../../core/functions/appContext.js', import.meta.url), 'utf8');
const m = src.match(/export function createSleep\([\s\S]*?\n}\n/);
assert.ok(m, 'createSleep not found in core/functions/appContext.js');
const createSleep = new Function(m[0].replace('export ', '') + '; return createSleep;')();

const sleep = createSleep(Date.now() + 60000);

let t = Date.now();
await sleep(200);
assert.ok(Date.now() - t >= 190, 'waits roughly ms');

t = Date.now();
await sleep(-5);
await sleep('nope');
assert.ok(Date.now() - t < 50, 'negative / non-numeric = no wait');

// capped at 10s: with 11s left, sleep(60000) waits 10s instead of failing
const capped = createSleep(Date.now() + 11000);
const realSetTimeout = globalThis.setTimeout;
let asked;
globalThis.setTimeout = (fn, ms) => { asked = ms; return realSetTimeout(fn, 0); };
await capped(60000);
globalThis.setTimeout = realSetTimeout;
assert.equal(asked, 10000, 'capped at 10s per call');

// past the deadline it throws instead of keeping a timed-out run alive
const late = createSleep(Date.now() + 100);
await assert.rejects(() => late(500), /time limit/);
await late(10); // still inside the deadline
await new Promise(r => realSetTimeout(r, 120));
await assert.rejects(() => late(1), /time limit/, 'deadline already passed');

console.log('ok — app-sleep');
