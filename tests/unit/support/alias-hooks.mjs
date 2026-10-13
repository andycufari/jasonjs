// Node resolve hook for standalone tests that import route handlers:
//  - maps the Next.js "@/…" alias to the repo root;
//  - retries extensionless imports with ".js" — bare ("next/server") or relative
//    ("../../jason.config") — which Next's bundler resolves but Node's ESM loader doesn't.
// Used via alias-loader.mjs.
const root = new URL('../../../', import.meta.url);

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const base = new URL(specifier.slice(2), root).href;
    for (const candidate of [base, `${base}.js`, `${base}/index.js`]) {
      try { return await next(candidate, context); } catch {}
    }
  }
  try {
    return await next(specifier, context);
  } catch (err) {
    if (!/\.[cm]?jsx?$|\.json$/.test(specifier) && !specifier.startsWith('node:')) {
      return next(`${specifier}.js`, context);
    }
    throw err;
  }
}
