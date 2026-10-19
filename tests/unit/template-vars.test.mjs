// Standalone (node tests/unit/template-vars.test.mjs).
// Database runs every operation's data and filters through replaceTemplateVars: values that
// aren't plain objects must come out as they went in.
import assert from 'node:assert/strict';
import { replaceTemplateVars } from '../../core/render/templateVars.js';

const when = new Date('2026-10-19T18:00:00.000Z');
const out = replaceTemplateVars(
  { startUtc: when, filters: { at: { $gte: when } }, re: /x/i, list: [when], who: '{{params.id}}', nested: { who: '{{user.email}}' } },
  { params: { id: '42' }, user: { email: 'a@b.co' } },
);

assert.ok(out.startUtc instanceof Date, 'a Date stays a Date (it used to become {})');
assert.equal(out.startUtc.toISOString(), '2026-10-19T18:00:00.000Z');
assert.ok(out.filters.at.$gte instanceof Date, 'Dates inside filters too');
assert.ok(out.re instanceof RegExp);
assert.ok(out.list[0] instanceof Date);
assert.equal(out.who, '42', 'params still replaced');
assert.equal(out.nested.who, 'a@b.co', 'plain nested objects still walked');

const bare = Object.create(null); bare.v = '{{params.id}}';
assert.equal(replaceTemplateVars(bare, { params: { id: '7' } }).v, '7', 'null-prototype objects are walked');

console.log('template-vars: PASS');
