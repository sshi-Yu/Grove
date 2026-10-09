import { SUPPORTED_LOCALES } from '../core/i18n.js';

// Grove's Hono routes, mounted relative to /api/apps/grove/routes/:
//   GET  /state               -> { locale, modules: ModuleView[] }
//   POST /modules/:id/enable  -> ModuleView
//   POST /modules/:id/disable -> ModuleView
//   PUT  /locale              -> { locale, modules }
// The app object is only assumed to expose get/post/put(path, handler);
// handlers use c.json, c.req.param and c.req.json only.

export function registerRoutes(app, { lifecycle, store }) {
  if (app === null || typeof app !== 'object' || typeof app.get !== 'function') {
    throw new Error('app must be an object with get/post/put');
  }
  if (lifecycle === null || typeof lifecycle !== 'object') {
    throw new Error('lifecycle must be an object');
  }
  if (store === null || typeof store !== 'object') {
    throw new Error('store must be an object');
  }

  app.get('/state', (c) => handleState(c, { lifecycle, store }));
  app.post('/modules/:id/enable', (c) => handleToggle(c, { lifecycle, method: 'enable' }));
  app.post('/modules/:id/disable', (c) => handleToggle(c, { lifecycle, method: 'disable' }));
  app.put('/locale', (c) => handleLocale(c, { lifecycle, store }));
}

async function handleState(c, { lifecycle, store }) {
  const [locale, modules] = await Promise.all([store.getLocaleOverride(), lifecycle.views()]);
  return c.json({ locale, modules });
}

async function handleToggle(c, { lifecycle, method }) {
  try {
    const view = await lifecycle[method](c.req.param('id'));
    return c.json(view);
  } catch (error) {
    return toErrorResponse(c, error);
  }
}

async function handleLocale(c, { lifecycle, store }) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'request body must be valid JSON' }, 400);
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'body must be an object like { locale }' }, 400);
  }

  const { locale } = body;
  if (locale !== null && !SUPPORTED_LOCALES.includes(locale)) {
    return c.json(
      { error: `locale must be null or one of: ${SUPPORTED_LOCALES.join(', ')}` },
      400,
    );
  }

  await store.setLocaleOverride(locale);
  return handleState(c, { lifecycle, store });
}

// Central error-code mapping shared by every Grove route:
//   UNKNOWN_MODULE -> 404, NOT_AVAILABLE -> 409, anything else -> 500.
// Lifecycle.enable/disable swallow failures and still return a view, so this
// path also covers unexpected internal errors.
function toErrorResponse(c, error) {
  const code = error && typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR';
  const message = error && typeof error.message === 'string' ? error.message : 'internal error';
  const status = code === 'UNKNOWN_MODULE' ? 404 : code === 'NOT_AVAILABLE' ? 409 : 500;
  return c.json({ error: message, code }, status);
}
