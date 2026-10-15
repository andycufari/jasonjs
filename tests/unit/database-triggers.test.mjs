// Standalone (node tests/unit/database-triggers.test.mjs) — no jest needed.
// Database triggers: "triggers": { "onAdd": { "type": "function", "target": "fn" } }
// in a database file run that function after a successful write.
// core/db/index.js pulls in Mongo/Next modules on import, so evaluate just the
// method's source, with the function runner swapped for a stub.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../core/db/index.js', import.meta.url), 'utf8');
const m = src.match(/\n  fireTrigger\(event, record\) \{[\s\S]*?\n  \}\n/);
assert.ok(m, 'fireTrigger not found in core/db/index.js');
const body = m[0].trim().replace("import('../functions/run.js')", '__importRun()');
assert.ok(body.includes('__importRun()'), 'fireTrigger no longer imports ../functions/run.js');

const calls = [];
const errors = [];
const logger = { error: (msg) => errors.push(msg) };
const runner = (run) => () => Promise.resolve({ runFunction: run });
const recording = runner(async (domain, functionName, opts) => { calls.push({ domain, functionName, ...opts }); });
const build = (importRun) => new Function('logger', '__importRun', `return function ${body};`)(logger, importRun);
const fireTrigger = build(recording);

const flush = () => new Promise(r => setTimeout(r, 0));
const db = (triggers) => ({ id: 'waitlist', triggers });
const self = (database, context = {}) => ({
  selectedDatabase: database,
  context: { siteId: 'example.com', domain: 'example.com', ...context },
  domainConfig: { waitlist: database }
});

// onAdd → runs the target with the record, as a trigger
const created = { _id: 'r1', email: 'a@b.c', createdAt: new Date('2026-10-15T12:00:00Z') };
const onAdd = self(db({ onAdd: { type: 'function', target: 'notifySignup' } }));
fireTrigger.call(onAdd, 'onAdd', created);
await flush();
assert.equal(calls.length, 1, 'onAdd should run the function');
assert.equal(calls[0].domain, 'example.com');
assert.equal(calls[0].functionName, 'notifySignup');
assert.equal(calls[0].source, 'trigger');
assert.equal(calls[0].databaseConfig, onAdd.domainConfig, 'the loaded database config is reused');
assert.deepEqual(calls[0].params, {
  event: 'onAdd',
  database: 'waitlist',
  record: { _id: 'r1', email: 'a@b.c', createdAt: '2026-10-15T12:00:00.000Z' }
}, 'record arrives as plain JSON');

// A Record instance (fields in _data, no toJSON) arrives as its values
calls.length = 0;
const asRecord = { _data: { _id: 'r9', email: 'r@x' }, _database: {}, getValues() { return { ...this._data }; } };
fireTrigger.call(self(db({ onDelete: { target: 'fn' } })), 'onDelete', asRecord);
await flush();
assert.deepEqual(calls[0].params.record, { _id: 'r9', email: 'r@x' }, 'Record → plain values');

// "type" defaults to function; "function" works as an alias of "target"
calls.length = 0;
fireTrigger.call(self(db({ onUpdate: { function: 'fn' } })), 'onUpdate', { id: 'r1' });
await flush();
assert.equal(calls.length, 1);
assert.equal(calls[0].functionName, 'fn');

// No trigger for that event, no database, no record → nothing runs
calls.length = 0;
fireTrigger.call(self(db({ onAdd: { target: 'fn' } })), 'onDelete', { id: 'r1' });
fireTrigger.call(self(db(undefined)), 'onAdd', { id: 'r1' });
fireTrigger.call(self(null), 'onAdd', { id: 'r1' });
fireTrigger.call(self(db({ onAdd: { target: 'fn' } })), 'onAdd', null);
await flush();
assert.equal(calls.length, 0, 'nothing should run');

// A trigger function writing to its own database doesn't fire it again
fireTrigger.call(self(db({ onAdd: { target: 'fn' } }), { triggeredBy: 'waitlist' }), 'onAdd', { id: 'r2' });
await flush();
assert.equal(calls.length, 0, 'no loop');
// ...but writing to a different database does
fireTrigger.call(self(db({ onAdd: { target: 'fn' } }), { triggeredBy: 'other_table' }), 'onAdd', { id: 'r2' });
await flush();
assert.equal(calls.length, 1, 'chains across databases are allowed');

// Unknown trigger type → logged, not run
calls.length = 0;
fireTrigger.call(self(db({ onAdd: { type: 'webhook', target: 'https://x' } })), 'onAdd', { id: 'r3' });
await flush();
assert.equal(calls.length, 0);
assert.ok(errors.some(e => e.includes('only { "type": "function"')), 'unsupported type is reported');

// Without a site (e.g. a script) nothing runs
fireTrigger.call({ selectedDatabase: db({ onAdd: { target: 'fn' } }), context: {} }, 'onAdd', { id: 'r4' });
await flush();
assert.equal(calls.length, 0);

// A rejected run is logged, never thrown at the write
const throwing = build(runner(async () => { throw new Error('boom'); }));
assert.doesNotThrow(() => throwing.call(self(db({ onAdd: { target: 'fn' } })), 'onAdd', { id: 'r5' }));
await flush(); await flush();
assert.ok(errors.some(e => e.includes('waitlist.onAdd -> fn failed: boom')), 'rejection is logged');

// runFunction reports failures as a result (it catches the function's errors): log those too
errors.length = 0;
const results = [
  { error: 'Function execution failed', message: 'kaput' },
  { __STATUS__: 404, error: 'Function not found: gone' },
  { __STATUS__: 403, error: 'Trigger only' },
  { __STATUS__: 200, ok: true },
  undefined
];
for (const result of results) {
  const fire = build(runner(async () => result));
  fire.call(self(db({ onAdd: { target: 'fn' } })), 'onAdd', { id: 'r6' });
}
await flush(); await flush(); await flush();
assert.deepEqual(errors.sort(), [
  '[trigger] waitlist.onAdd -> fn failed: Function not found: gone',
  '[trigger] waitlist.onAdd -> fn failed: Trigger only',
  '[trigger] waitlist.onAdd -> fn failed: kaput'
], 'error results are logged; successful ones are not');

console.log('database-triggers: all assertions passed');
