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
const { GET: cancelGet, POST: cancelPost } = await import('../api/bookings/cancel/route.js');
const { GET: lookup } = await import('../api/bookings/lookup/route.js');
const { GET: status } = await import('../api/bookings/status/route.js');
const { priceFor, payableProviders } = await import('./payments.js');
const { onPaymentSucceeded } = await import('../hooks/billing.js');
const { notifyHostOfBooking } = await import('./notify.js');
const { getEmailService } = await import('../../../core/services/email.js');

// Capture host emails instead of sending them.
const sent = [];
getEmailService().send = async (domain, options) => { sent.push(options); return { success: true }; };

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

function raw(handler, url, { db, method = 'GET', body, form } = {}) {
  const init = { method };
  if (body) Object.assign(init, { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  if (form) Object.assign(init, { body: new URLSearchParams(form).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  const request = new Request(`https://andy.test${url}`, init);
  request.addonContext = { database: db, domain: 'andy.test', siteId: 'site1' };
  return handler(request);
}

function call(handler, url, opts) {
  return raw(handler, url, opts).then(async (res) => ({ status: res.status, body: await res.json() }));
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

// ── Cancelling ──────────────────────────────────────────────────────────────────

const soon = new Date(Date.now() + 3 * 24 * 3600e3);
const booking = (over) => ({
  _id: `b_${over.cancelToken}`, userId: 'andy', meetingType: 'intro', status: 'confirmed',
  guestName: 'Ana', guestEmail: 'ana@example.com', subject: 'Migrar a IA local', timezoneGuest: 'UTC',
  startUtc: soon, endUtc: new Date(soon.getTime() + 15 * 60e3), slotLock: `andy|${over.cancelToken}`,
  pagePath: '/meet/intro', ...over,
});
const cdb = fakeDb({
  bc_availability_rules: [type({ meetingType: 'intro', name: { es: '👋 Intro', en: '👋 Intro' }, timezone: 'America/Argentina/Buenos_Aires' })],
  bc_connections: [{ _id: 'c1', userId: 'andy', isPrimary: true, googleAccountEmail: 'andy@cm64.studio' }],
  bc_bookings: [
    booking({ cancelToken: 'tok' }),
    booking({ cancelToken: 'nopage', pagePath: undefined }),
    booking({ cancelToken: 'past', startUtc: new Date(Date.now() - 3600e3) }),
    booking({ cancelToken: 'form' }),
  ],
});
const row = (token) => cdb.use('bc_bookings').fetch({ filters: { cancelToken: token } }).then(r => r[0]);

await test('opening the cancel link never cancels: it sends the guest to the page they booked on', async () => {
  const res = await raw(cancelGet, '/bookings/cancel?token=tok', { db: cdb });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://andy.test/meet/intro?cancel=tok');
  assert.equal((await row('tok')).status, 'confirmed');

  const bare = await raw(cancelGet, '/bookings/cancel?token=nopage', { db: cdb });
  assert.equal(bare.status, 200);
  assert.match(await bare.text(), /<form method="post">/);
  assert.equal((await row('nopage')).status, 'confirmed');
});

await test('lookup tells the cancel view which meeting it is', async () => {
  const r = await call(lookup, '/bookings/lookup?token=tok', { db: cdb });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'confirmed');
  assert.equal(r.body.name.es, '👋 Intro');
  assert.ok(!('cancelToken' in r.body) && !('guestEmail' in r.body));
  assert.equal((await call(lookup, '/bookings/lookup?token=nope', { db: cdb })).status, 404);
});

await test('guest cancels with a reason: row cancelled, slot freed, host emailed with the reason', async () => {
  sent.length = 0;
  const r = await call(cancelPost, '/bookings/cancel', { db: cdb, method: 'POST', body: { token: 'tok', reason: 'Me surgió un viaje' } });
  assert.equal(r.status, 200);
  const after = await row('tok');
  assert.equal(after.status, 'cancelled');
  assert.equal(after.slotLock, null);
  assert.equal(after.cancelledBy, 'guest');
  assert.equal(after.cancelReason, 'Me surgió un viaje');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'andy@cm64.studio');
  assert.ok(sent[0].body, 'emailService takes the HTML as `body`');
  assert.match(sent[0].body, /Me surgió un viaje/);
  assert.match(sent[0].subject, /Cancelled/);

  const again = await call(cancelPost, '/bookings/cancel', { db: cdb, method: 'POST', body: { token: 'tok', reason: 'x' } });
  assert.equal(again.body.alreadyCancelled, true);
  assert.equal(sent.length, 1, 'no second email');
});

await test('a meeting that already started can\'t be cancelled by the guest', async () => {
  const r = await call(cancelPost, '/bookings/cancel', { db: cdb, method: 'POST', body: { token: 'past', reason: 'tarde' } });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'already_started');
  assert.equal((await row('past')).status, 'confirmed');
});

await test('the bare confirm page posts a form and gets HTML back', async () => {
  const res = await raw(cancelPost, '/bookings/cancel', { db: cdb, method: 'POST', form: { token: 'form', reason: 'No llego' } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal((await row('form')).cancelReason, 'No llego');
});

await test('new-booking email reaches the email service with a body', async () => {
  sent.length = 0;
  await notifyHostOfBooking({
    domain: 'andy.test', hostEmail: 'andy@cm64.studio', hostTimezone: 'America/Argentina/Buenos_Aires',
    booking: { guestName: 'Ana', guestEmail: 'ana@example.com', subject: 'Hola', typeName: 'Intro', startUtc: soon.toISOString() },
  });
  assert.equal(sent.length, 1);
  assert.match(sent[0].body, /Hola/);
});


// ── Paying: Stripe or MercadoPago ─────────────────────────────────────────────────

await test('price per provider; a provider is offered only if the site has keys and the type a price', async () => {
  const both = { priceCents: 7900, currency: 'USD', priceArsCents: 9_000_000 };
  assert.deepEqual(priceFor(both, 'stripe'), { amountCents: 7900, currency: 'USD' });
  assert.deepEqual(priceFor(both, 'mercadopago'), { amountCents: 9_000_000, currency: 'ARS' });
  assert.deepEqual(payableProviders(both, ['stripe', 'mercadopago']), ['stripe', 'mercadopago']);
  assert.deepEqual(payableProviders(both, ['stripe']), ['stripe'], 'no MP keys → card only');
  assert.deepEqual(payableProviders({ priceCents: 7900 }, ['stripe', 'mercadopago']), ['stripe'], 'no peso price → card only');
  // The test site has no billing.json: paid types list no providers.
  const r = await call(typesPublic, '/types/public?meetingType=consulta', { db });
  assert.deepEqual(r.body.type.providers, []);
  assert.equal(r.body.type.priceArsCents, 0);
});

await test('status: only the payer (statusToken, or the old Stripe session id) sees the booking', async () => {
  const sdb = fakeDb({ bc_bookings: [
    { _id: 'p1', status: 'confirmed', statusToken: 'tok1', startUtc: soon, guestEmail: 'ana@example.com', meetLink: 'https://meet' },
    { _id: 'p2', status: 'pending_payment', stripeSessionId: 'cs_old' },
  ] });
  const ok = await call(status, '/bookings/status?id=p1&s=tok1', { db: sdb });
  assert.equal(ok.body.status, 'confirmed');
  assert.equal(ok.body.meetLink, 'https://meet');
  assert.equal((await call(status, '/bookings/status?id=p1&s=nope', { db: sdb })).status, 404);
  assert.equal((await call(status, '/bookings/status?id=p2&s=cs_old', { db: sdb })).body.status, 'pending_payment');
});

await test('MercadoPago payment finds its booking by booking_id / external_reference; wrong amount never confirms', async () => {
  const hdb = fakeDb({ bc_bookings: [
    { _id: 'h1', userId: 'andy', status: 'pending_payment', provider: 'mercadopago', amountCents: 9_000_000, currency: 'ARS' },
    { _id: 'h2', userId: 'andy', status: 'confirmed', provider: 'mercadopago', amountCents: 9_000_000, currency: 'ARS', paymentId: '7' },
  ] });
  const context = { database: hdb, domain: 'andy.test' };
  const rows = hdb.use('bc_bookings');
  const h1 = async () => (await rows.fetch({ filters: { _id: 'h1' } }))[0];

  // Paid less than the price (a tampered or edited checkout): logged, not confirmed, no payment recorded.
  const errors = []; const origError = console.error; console.error = (m) => errors.push(String(m));
  await onPaymentSucceeded({ context, provider: null,
    payment: { id: '9', amount: 100, currency: 'ars', metadata: { addon: 'booking-calendar', booking_id: 'h1' } } });
  await onPaymentSucceeded({ context, provider: null,
    payment: { id: '9', amount: 100, currency: 'ars', metadata: {}, externalReference: 'h1' } });
  console.error = origError;
  assert.equal(errors.filter(e => /NOT confirmed/.test(e)).length, 2, 'found by booking_id and by external_reference');
  assert.equal((await h1()).status, 'pending_payment');
  assert.equal((await h1()).paymentId, undefined);

  // A repeated notification for a confirmed booking does nothing (no Google, no refund).
  await onPaymentSucceeded({ context, provider: { refundPayment: () => { throw new Error('no refunds here'); } },
    payment: { id: '7', amount: 9_000_000, currency: 'ars', metadata: { booking_id: 'h2' } } });
});

await test('a booking with unparseable times is skipped, not a 500 for every slots request', async () => {
  const { fetchActiveBookings } = await import('./meetingTypes.js');
  const db = fakeDb({ bc_bookings: [
    { _id: 'ok', userId: 'h', status: 'confirmed', startUtc: '2026-10-20T13:00:00.000Z', endUtc: '2026-10-20T13:15:00.000Z' },
    { _id: 'bad', userId: 'h', status: 'confirmed', startUtc: {}, endUtc: 'nope' },
  ] });
  const err = console.error; console.error = () => {};
  try {
    assert.deepEqual(await fetchActiveBookings(db, 'h'),
      [{ startUtc: '2026-10-20T13:00:00.000Z', endUtc: '2026-10-20T13:15:00.000Z' }]);
  } finally { console.error = err; }
});

console.log(`\nroutes: ${passed}/17 PASS`);
process.exit(0);
