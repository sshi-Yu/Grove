import assert from 'node:assert/strict';
import test from 'node:test';

import { registerRoutes } from '../host/routes.js';

// Minimal Hono-compatible surface, exactly the interface the routes contract
// assumes: app.get/post/put(path, handler) and handlers that use c.json,
// c.req.param and c.req.json.

function createFakeRouter() {
  const routes = new Map();

  return {
    get: (path, handler) => routes.set(`GET ${path}`, handler),
    post: (path, handler) => routes.set(`POST ${path}`, handler),
    put: (path, handler) => routes.set(`PUT ${path}`, handler),
    routes,

    async request(method, path, { body } = {}) {
      for (const [key, handler] of routes) {
        const [routeMethod, routePath] = key.split(' ');
        if (routeMethod !== method) {
          continue;
        }
        const params = matchPath(routePath, path);
        if (params === null) {
          continue;
        }
        const c = {
          req: {
            param: (name) => params[name],
            json: async () => body,
          },
          json(object, status = 200) {
            return { status, body: object };
          },
        };
        return handler(c);
      }
      throw new Error(`no handler registered for ${method} ${path}`);
    },
  };
}

function matchPath(routePath, requestPath) {
  const routeSegments = routePath.split('/').filter(Boolean);
  const requestSegments = requestPath.split('/').filter(Boolean);
  if (routeSegments.length !== requestSegments.length) {
    return null;
  }
  const params = {};
  for (let i = 0; i < routeSegments.length; i += 1) {
    const routeSegment = routeSegments[i];
    if (routeSegment.startsWith(':')) {
      params[routeSegment.slice(1)] = decodeURIComponent(requestSegments[i]);
    } else if (routeSegment !== requestSegments[i]) {
      return null;
    }
  }
  return params;
}

function createFakeLifecycle({ error } = {}) {
  const calls = [];
  let localeOverride = null;

  const store = {
    getLocaleOverride: async () => localeOverride,
    setLocaleOverride: async (value) => {
      localeOverride = value;
    },
  };

  return {
    calls,
    views: async () => {
      calls.push('views');
      return [
        { id: 'session-stats', status: 'on' },
        { id: 'token-stats', status: 'planned' },
      ];
    },
    enable: async (id) => {
      calls.push(['enable', id]);
      if (error) {
        throw error;
      }
      return { id, status: 'on' };
    },
    disable: async (id) => {
      calls.push(['disable', id]);
      if (error) {
        throw error;
      }
      return { id, status: 'off' };
    },
    restore: async () => {
      calls.push('restore');
    },
    store,
  };
}

function failingLifecycle(code, message = `${code} failure`) {
  const error = new Error(message);
  error.code = code;
  return createFakeLifecycle({ error });
}

test('registers exactly the documented routes', () => {
  const app = createFakeRouter();
  const lifecycle = createFakeLifecycle();
  registerRoutes(app, { lifecycle, store: lifecycle.store });

  assert.deepEqual(
    [...app.routes.keys()].sort(),
    ['GET /state', 'POST /modules/:id/disable', 'POST /modules/:id/enable', 'PUT /locale'].sort(),
  );
});

test('GET /state returns locale from store and lifecycle views', async () => {
  const app = createFakeRouter();
  const lifecycle = createFakeLifecycle();
  registerRoutes(app, { lifecycle, store: lifecycle.store });

  const response = await app.request('GET', '/state');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    locale: null,
    modules: [
      { id: 'session-stats', status: 'on' },
      { id: 'token-stats', status: 'planned' },
    ],
  });
});

test('GET /state reports the stored locale override when present', async () => {
  const app = createFakeRouter();
  const lifecycle = createFakeLifecycle();
  registerRoutes(app, { lifecycle, store: lifecycle.store });
  await lifecycle.store.setLocaleOverride('en');

  const response = await app.request('GET', '/state');
  assert.deepEqual(response.body.locale, 'en');
});

test('POST /modules/:id/enable returns the module view', async () => {
  const app = createFakeRouter();
  const lifecycle = createFakeLifecycle();
  registerRoutes(app, { lifecycle, store: lifecycle.store });

  const response = await app.request('POST', '/modules/task-manager/enable');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { id: 'task-manager', status: 'on' });
  assert.deepEqual(lifecycle.calls, [['enable', 'task-manager']]);
});

test('POST /modules/:id/disable returns the module view', async () => {
  const app = createFakeRouter();
  const lifecycle = createFakeLifecycle();
  registerRoutes(app, { lifecycle, store: lifecycle.store });

  const response = await app.request('POST', '/modules/session-stats/disable');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { id: 'session-stats', status: 'off' });
  assert.deepEqual(lifecycle.calls, [['disable', 'session-stats']]);
});

test('enable on unknown module maps to 404 with { error, code }', async () => {
  const app = createFakeRouter();
  const lifecycle = failingLifecycle('UNKNOWN_MODULE', 'unknown module id: ghost');
  registerRoutes(app, { lifecycle, store: lifecycle.store });

  const response = await app.request('POST', '/modules/ghost/enable');
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    error: 'unknown module id: ghost',
    code: 'UNKNOWN_MODULE',
  });
});

test('enable on planned module maps to 409 with { error, code }', async () => {
  const app = createFakeRouter();
  const lifecycle = failingLifecycle('NOT_AVAILABLE', 'module token-stats is planned');
  registerRoutes(app, { lifecycle, store: lifecycle.store });

  const response = await app.request('POST', '/modules/token-stats/enable');
  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: 'module token-stats is planned',
    code: 'NOT_AVAILABLE',
  });
});

test('any other enable error maps to 500 with { error, code }', async () => {
  const app = createFakeRouter();
  const lifecycle = failingLifecycle('MIGRATION_FAILED', 'migrate failed');
  registerRoutes(app, { lifecycle, store: lifecycle.store });

  const response = await app.request('POST', '/modules/session-stats/enable');
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: 'migrate failed', code: 'MIGRATION_FAILED' });
});

test('disable errors go through the same mapping', async () => {
  const app = createFakeRouter();
  const lifecycle = failingLifecycle('UNKNOWN_MODULE', 'unknown module id: ghost');
  registerRoutes(app, { lifecycle, store: lifecycle.store });

  const response = await app.request('POST', '/modules/ghost/disable');
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'unknown module id: ghost', code: 'UNKNOWN_MODULE' });
});

test('PUT /locale persists a supported override and returns the new state locale', async () => {
  const app = createFakeRouter();
  const lifecycle = createFakeLifecycle();
  registerRoutes(app, { lifecycle, store: lifecycle.store });

  const response = await app.request('PUT', '/locale', { body: { locale: 'ja' } });
  assert.equal(response.status, 200);
  assert.equal(response.body.locale, 'ja');

  const state = await app.request('GET', '/state');
  assert.equal(state.body.locale, 'ja');
});

test('PUT /locale with null clears the override and returns null locale', async () => {
  const app = createFakeRouter();
  const lifecycle = createFakeLifecycle();
  registerRoutes(app, { lifecycle, store: lifecycle.store });

  await app.request('PUT', '/locale', { body: { locale: 'ko' } });
  const response = await app.request('PUT', '/locale', { body: { locale: null } });
  assert.equal(response.status, 200);
  assert.equal(response.body.locale, null);

  const state = await app.request('GET', '/state');
  assert.equal(state.body.locale, null);
});

test('PUT /locale rejects unsupported values with 400', async () => {
  const app = createFakeRouter();
  const lifecycle = createFakeLifecycle();
  registerRoutes(app, { lifecycle, store: lifecycle.store });

  for (const bad of [42, true, {}, 'fr', 'zh-Hant-XYZ', 'DE-de']) {
    const response = await app.request('PUT', '/locale', { body: { locale: bad } });
    assert.equal(response.status, 400, `expected 400 for ${JSON.stringify(bad)}`);
    assert.equal(typeof response.body.error, 'string');
  }
});
