// Runs the real route handlers against an in-memory database — the paths that don't
// reach Google (host resolution, meeting types, booking form validation). esbuild only
// checks syntax and imports; this catches runtime errors (e.g. a variable used before
// it's declared) before a deploy does.
//
//   node --import ./tests/unit/support/alias-loader.mjs addons/booking-calendar/lib/routes.test.mjs
import assert from 'node:assert/strict';

delete process.env.REDIS_URL; delete process.env.REDIS_URI; // memory caches only

const { GET: typesPublic } = await import('../api/types/public/route.js');
const { GET: slots } = await import('../api/slots/route.js');
const { POST: create } = await import('../api/bookings/create/route.js');

function fakeDb(tables) {
  const match = (row, filters) => Object.entries(filters || {}).every(([k, v]) =>
    (k === '_id' ? String(row._id) === String(v) : row[k] === v));
  return {
    use(name) {
      const rows = (tables[name] ||= []);
      return {
        fetch: async ({ filters, limit } = {}) => rows.filter(r => match(r, filters)).slice(0, limit || 1000),
        add: async (data) => { const row = { ...data, _id: `${name}_${rows.length}` }; rows.push(row); return row; },
        update: async (id, patch) => {
          const row = rows.find(r => String(r._id) === String(id));
          if (!row) return { success: false, error: 'not found' };
          Object.assign(row, patch);
          return { success: true };
        },
        delete: async (id) => { const i = rows.findIndex(r => String(r._id) === String(id)); if (i >= 0) rows.splice(i, 1); return { success: true }; },
      };
    },
  };
}

const QUESTIONS = [
  { key: 'canal', label: { es: '¿Cómo llegaste?', en: 'How did you find me?' }, type: 'select',
    options: [{ es: 'LinkedIn', en: 'LinkedIn' }, { es: 'Una recomendación', en: 'A referral' }], required: true },
  { key: 'repo', label: { es: 'Link al repo', en: 'Repo link' }, type: 'url', options: [], required: false },
];
const type = (over) => ({
  _id: `t_${over.meetingType}`, userId: 'andy', durationMinutes: 15, timezone: 'UTC',
  weeklyHours: {}, name: { es: over.meetingType }, priceCents: 0, currency: 'USD', ...over,
});

function call(handler, url, { db, method = 'GET', body } = {}) {
  const request = new Request(`https://andy.test${url}`, {
    method, ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  });
  request.addonContext = { database: db, domain: 'andy.test', siteId: 'site1' };
  return handler(request).then(async (res) => ({ status: res.status, body: await res.json() }));
}

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`✓ ${name}`); }

const db = fakeDb({
  bc_availability_rules: [
    type({ meetingType: 'intro', order: 0 }),
    type({ meetingType: 'consulta', priceCents: 7900, durationMinutes: 35, showDuration: false, order: 10, questions: QUESTIONS }),
    type({ meetingType: 'oculta', active: false }),
  ],
});

await test('types/public without userId lists the single host\'s active types, in order', async () => {
  const r = await call(typesPublic, '/types/public', { db });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.types.map(t => t.meetingType), ['intro', 'consulta']);
  const consulta = r.body.types[1];
  assert.equal(consulta.durationMinutes, null, 'duration hidden');
  assert.equal(consulta.questions.length, 2);
  assert.ok(!('userId' in consulta) && !('weeklyHours' in consulta));
});

await test('types/public: one type, missing type, switched-off type', async () => {
  assert.equal((await call(typesPublic, '/types/public?meetingType=consulta', { db })).body.type.priceCents, 7900);
  assert.equal((await call(typesPublic, '/types/public?meetingType=nope', { db })).status, 404);
  assert.equal((await call(typesPublic, '/types/public?meetingType=oculta', { db })).status, 404);
});

await test('two hosts and no userId → nothing is guessed', async () => {
  const two = fakeDb({ bc_availability_rules: [type({ meetingType: 'a' }), type({ meetingType: 'b', userId: 'otro' })] });
  assert.deepEqual((await call(typesPublic, '/types/public', { db: two })).body.types, []);
  assert.equal((await call(typesPublic, '/types/public?userId=otro', { db: two })).body.types[0].meetingType, 'b');
});

await test('slots resolves the host, 404s unknown types, stops at missing connections', async () => {
  const q = 'fromUtc=2026-10-20T00:00:00Z&toUtc=2026-10-21T00:00:00Z';
  assert.equal((await call(slots, `/slots?meetingType=nope&${q}`, { db })).status, 404);
  const r = await call(slots, `/slots?meetingType=intro&${q}`, { db });
  assert.equal(r.status, 200);
  assert.equal(r.body.reason, 'no_connections');
});

const base = {
  meetingType: 'consulta', startUtc: '2026-10-20T13:00:00Z',
  guestName: 'Ana', guestEmail: 'ana@example.com', subject: 'Migrar a IA local',
  answers: { canal: 1 },
};

await test('create: subject is required', async () => {
  const r = await call(create, '/bookings/create', { db, method: 'POST', body: { ...base, subject: '  ' } });
  assert.equal(r.status, 400);
});

await test('create: bad WhatsApp, missing required answer, bad option, bad URL', async () => {
  const post = (body) => call(create, '/bookings/create', { db, method: 'POST', body: { ...base, ...body } });
  assert.equal((await post({ whatsapp: 'llamame' })).body.error, 'whatsapp_invalid');
  assert.equal((await post({ answers: {} })).body.error, 'required:canal');
  assert.equal((await post({ answers: { canal: 7 } })).body.error, 'required:canal');
  assert.equal((await post({ answers: { canal: 0, repo: 'github.com/x' } })).body.error, 'invalid_url:repo');
});

await test('create: valid form reaches the calendar step (no connections → 409), unknown type → 404', async () => {
  const ok = await call(create, '/bookings/create', { db, method: 'POST',
    body: { ...base, whatsapp: '+54 9 11 5555-5555', answers: { canal: 1, repo: 'https://github.com/x' } } });
  assert.equal(ok.status, 409);
  assert.equal(ok.body.error, 'Host has no connected calendars');
  const unknown = await call(create, '/bookings/create', { db, method: 'POST', body: { ...base, meetingType: 'nope' } });
  assert.equal(unknown.status, 404);
});

console.log(`\nroutes: ${passed}/7 PASS`);
process.exit(0);
