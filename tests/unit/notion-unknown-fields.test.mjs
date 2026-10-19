// Standalone (node --import ./tests/unit/support/alias-loader.mjs tests/unit/notion-unknown-fields.test.mjs).
// A write to a Notion database used to drop every field whose name didn't match the schema
// exactly and create an EMPTY row, reporting success.
import assert from 'node:assert/strict';
import { transformToNotionProperties } from '../../core/db/adapters/notion/transformers/notionReverse.js';

const schema = { Name: 'title', Email: 'email', Source: 'text' };
const warn = console.warn; console.warn = () => {};
try {
  const props = transformToNotionProperties({ name: 'Ana', email: 'ana@example.com' }, schema);
  assert.deepEqual(Object.keys(props).sort(), ['Email', 'Name'], 'field names match the schema regardless of case');
  assert.equal(props.Email.email, 'ana@example.com');

  const partial = transformToNotionProperties({ Email: 'a@b.co', utm: 'x' }, schema);
  assert.deepEqual(Object.keys(partial), ['Email'], 'an extra unknown field is still just skipped');

  assert.throws(() => transformToNotionProperties({ mail: 'a@b.co', nombre: 'Ana' }, schema),
    e => e.status === 400 && e.expose && /mail, nombre/.test(e.message) && /Email/.test(e.message),
    'no known field at all: error instead of an empty row');

  assert.deepEqual(transformToNotionProperties({ id: 'x' }, schema), {}, 'only special fields: nothing to check');
} finally { console.warn = warn; }
console.log('notion-unknown-fields: PASS');
