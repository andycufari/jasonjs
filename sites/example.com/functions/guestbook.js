/**
 * Guestbook example — demonstrates app.db from a site function.
 *
 * List entries:   GET  /api/guestbook
 * Sign it:        POST /api/guestbook  { "name": "Ada", "message": "Hi!" }
 *
 * The `guestbook` database is declared in settings/database.json.
 * app.response(data, status) sets the HTTP status code of the reply.
 */

export const config = {
  public: true,
  methods: ['GET', 'POST']
};

export default async function ({ app, method, body }) {
  const guestbook = app.db.use('guestbook');

  if (method === 'POST') {
    if (!body?.name || !body?.message) {
      return app.response({ error: 'Both "name" and "message" are required' }, 400);
    }

    const entry = await guestbook.add({
      name: String(body.name).slice(0, 100),
      message: String(body.message).slice(0, 1000),
      createdAt: new Date().toISOString()
    });

    return app.response({ success: true, id: entry.id }, 201);
  }

  // GET — newest first, capped at 50
  const result = await guestbook.fetch({
    sort: { createdAt: -1 },
    limit: 50
  });

  return { entries: result.data || [] };
}
