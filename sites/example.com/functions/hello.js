/**
 * Minimal example function.
 *
 * Call it:   GET /api/hello?name=Ada
 *            POST /api/hello  { "name": "Ada" }
 *
 * Site functions are native ES modules with a default export that
 * receives the jcontext object. External (cross-origin) access is
 * controlled by settings/api.json; `config` here declares intent and
 * lets the runner enforce allowed methods / auth.
 */

export const config = {
  public: true,
  methods: ['GET', 'POST']
};

export default async function ({ params, query, method }) {
  return {
    message: 'Hello from JasonJS',
    name: params?.name || query?.name || 'world',
    method,
    time: new Date().toISOString()
  };
}
