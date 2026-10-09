import assert from 'node:assert/strict';
import test from 'node:test';

import { createStateStore } from '../core/state-store.js';
import { createLifecycle, LifecycleError } from '../core/lifecycle.js';

import {
  successModule,
  partialFailureModule,
  failingCleanupModule,
  migratingModule,
  capabilityErrorModule,
  createRegistryWith,
} from './fixtures/fake-modules.js';
import { createFakePort } from './fixtures/fake-port.js';

function setup({ modules, plannedIds = [], stored = {} } = {}) {
  const port = createFakePort();
  const registry = createRegistryWith(modules ?? [], plannedIds);
  const store = createStateStore(port.storage);
  for (const [key, value] of Object.entries(stored)) {
    port.storage.set(key, value);
  }
  const lifecycle = createLifecycle({ registry, store, port, logger: port.logger });
  return { port, registry, store, lifecycle };
}

// FakePort registers via port.subscribe/subscribe-style callbacks only; the
// success fixtures never call api.registerTool, so registrable modules need
// activate bodies that do. Helper for those that do not touch registration.
function registrationsFor(port, moduleId) {
  const prefix = `grove_${moduleId}_`;
  return port.registrations.filter(
    ({ kind, record }) => kind === 'tool' && String(record.name).startsWith(prefix),
  );
}

async function viewsById(lifecycle) {
  const views = await lifecycle.views();
  return new Map(views.map((view) => [view.id, view]));
}

test('new modules start off and views lists planned entries as planned', async () => {
  const { lifecycle } = setup({
    modules: [successModule('session-stats'), successModule('token-stats')],
    plannedIds: ['task-manager'],
  });

  const views = await lifecycle.views();
  const byId = await viewsById(lifecycle);

  assert.deepEqual(
    views.map((view) => view.id),
    ['session-stats', 'token-stats', 'task-manager'],
  );
  assert.equal(byId.get('session-stats').status, 'off');
  assert.equal(byId.get('session-stats').error, undefined);
  assert.equal(byId.get('token-stats').status, 'off');
  assert.equal(byId.get('task-manager').status, 'planned');
});

test('enable runs activate once, status on, selection persisted', async () => {
  let activations = 0;
  const module = successModule('session-stats', {
    activate: async () => {
      activations += 1;
    },
  });
  const { port, lifecycle } = setup({ modules: [module] });

  const view = await lifecycle.enable('session-stats');

  assert.equal(activations, 1);
  assert.equal(view.id, 'session-stats');
  assert.equal(view.status, 'on');
  assert.equal(view.error, undefined);
  assert.equal(port.registrations.length, 0);
  assert.deepEqual(await port.storage.get('grove:selection'), {
    version: 1,
    enabled: { 'session-stats': true },
  });
});

test('enable twice concurrently activates once', async () => {
  let activations = 0;
  const module = successModule('session-stats', {
    activate: async () => {
      activations += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
    },
  });
  const { port, lifecycle } = setup({ modules: [module] });

  const [first, second] = await Promise.all([
    lifecycle.enable('session-stats'),
    lifecycle.enable('session-stats'),
  ]);

  assert.equal(activations, 1);
  assert.equal(first.status, 'on');
  assert.equal(second.status, 'on');
  const views = await viewsById(lifecycle);
  assert.equal(views.get('session-stats').status, 'on');
});

test('enable then disable concurrently ends off with no residual registrations', async () => {
  const module = successModule('session-stats', {
    activate: async (api) => {
      await api.registerTool({ name: 'summary' });
    },
  });
  const { port, lifecycle } = setup({ modules: [module] });

  await Promise.all([lifecycle.enable('session-stats'), lifecycle.disable('session-stats')]);

  const views = await viewsById(lifecycle);
  assert.equal(views.get('session-stats').status, 'off');
  assert.equal(port.registrations.length, 1);
  assert.equal(port.registrations[0].isDisposed(), true);
});

test('activate failing after one registration rolls back and ends failed, intent kept', async () => {
  const { port, lifecycle } = setup({ modules: [partialFailureModule()] });

  const view = await lifecycle.enable('partial-fail');

  assert.equal(view.status, 'failed');
  assert.equal(view.error.code, 'ACTIVATION_FAILED');
  assert.equal(registrationsFor(port, 'partial-fail').length, 1);
  assert.equal(port.registrations[0].isDisposed(), true);
  assert.deepEqual(await port.storage.get('grove:selection'), {
    version: 1,
    enabled: { 'partial-fail': true },
  });
});

test('error with capability ends blocked', async () => {
  const { port, lifecycle } = setup({ modules: [capabilityErrorModule()] });

  const view = await lifecycle.enable('capability-fail');

  assert.equal(view.status, 'blocked');
  assert.equal(view.error.code, 'ACTIVATION_FAILED');
  assert.equal(port.registrations.length, 0);
});

test('retry after failure succeeds and ends on', async () => {
  let calls = 0;
  const module = successModule('flaky-module', {
    activate: async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('first attempt fails');
      }
    },
  });
  const { lifecycle } = setup({ modules: [module] });

  const failed = await lifecycle.enable('flaky-module');
  assert.equal(failed.status, 'failed');

  const retried = await lifecycle.enable('flaky-module');
  assert.equal(retried.status, 'on');
});

test('cleanup throwing still ends off and other modules unaffected', async () => {
  const healthy = successModule('healthy-module', {
    activate: async (api) => {
      await api.registerTool({ name: 'summary' });
    },
  });
  const { port, lifecycle } = setup({
    modules: [failingCleanupModule(), healthy],
  });

  await lifecycle.enable('cleanup-fail');
  await lifecycle.enable('healthy-module');
  assert.equal(port.registrations.length, 2);

  const view = await lifecycle.disable('cleanup-fail');

  assert.equal(view.status, 'off');
  assert.equal(view.error, undefined);
  const views = await viewsById(lifecycle);
  assert.equal(views.get('cleanup-fail').status, 'off');
  assert.equal(views.get('healthy-module').status, 'on');
  assert.equal(port.registrations[0].isDisposed(), true);
  assert.equal(port.registrations[1].isDisposed(), false);
  assert.ok(port.loggerCalls.some(({ level }) => level === 'error'));
});

test('enable on planned or unknown id rejects with NOT_AVAILABLE / UNKNOWN_MODULE and changes nothing', async () => {
  const { port, lifecycle } = setup({
    modules: [successModule('session-stats')],
    plannedIds: ['task-manager'],
  });

  await assert.rejects(lifecycle.enable('task-manager'), (error) => {
    assert.ok(error instanceof LifecycleError);
    assert.equal(error.code, 'NOT_AVAILABLE');
    return true;
  });
  await assert.rejects(lifecycle.enable('no-such-module'), (error) => {
    assert.ok(error instanceof LifecycleError);
    assert.equal(error.code, 'UNKNOWN_MODULE');
    return true;
  });
  assert.equal(port.registrations.length, 0);
  assert.equal(await port.storage.get('grove:selection'), undefined);
});

test('restore enables stored ids concurrently, ignores unknown ids, one failure does not stop others', async () => {
  const { port, lifecycle } = setup({
    modules: [successModule('session-stats'), partialFailureModule('partial-fail')],
    stored: {
      'grove:selection': {
        version: 1,
        enabled: { 'session-stats': true, 'partial-fail': true, 'ghost-module': true },
      },
    },
  });

  await lifecycle.restore();

  const views = await viewsById(lifecycle);
  assert.equal(views.get('session-stats').status, 'on');
  assert.equal(views.get('partial-fail').status, 'failed');
  // Unknown stored id: ignored, its stale selection entry is left untouched.
  assert.equal(views.get('ghost-module'), undefined);
  assert.deepEqual(await port.storage.get('grove:selection'), {
    version: 1,
    enabled: { 'session-stats': true, 'partial-fail': true, 'ghost-module': true },
  });
});

test('migration: stored schema lower calls migrate(from, api) then records new schema', async () => {
  const migrations = [];
  const module = migratingModule('migrating-module', {
    migrate: async (fromVersion, api) => {
      migrations.push({ fromVersion, apiId: api.id });
    },
  });
  const { port, lifecycle } = setup({
    modules: [module],
    stored: { 'grove:schema:migrating-module': 1 },
  });

  const view = await lifecycle.enable('migrating-module');

  assert.equal(view.status, 'on');
  assert.deepEqual(migrations, [{ fromVersion: 1, apiId: 'migrating-module' }]);
  assert.equal(await port.storage.get('grove:schema:migrating-module'), 2);
});

test('stored schema higher ends failed with code SCHEMA_NEWER', async () => {
  const { port, lifecycle } = setup({
    modules: [migratingModule('migrating-module')],
    stored: { 'grove:schema:migrating-module': 3 },
  });

  const view = await lifecycle.enable('migrating-module');

  assert.equal(view.status, 'failed');
  assert.equal(view.error.code, 'SCHEMA_NEWER');
  assert.equal(await port.storage.get('grove:schema:migrating-module'), 3);
});

test('migrate failure ends failed with code MIGRATION_FAILED and keeps the old schema', async () => {
  const { port, lifecycle } = setup({
    modules: [
      migratingModule('migrating-module', {
        migrate: async () => {
          throw new Error('migration exploded');
        },
      }),
    ],
    stored: { 'grove:schema:migrating-module': 1 },
  });

  const view = await lifecycle.enable('migrating-module');

  assert.equal(view.status, 'failed');
  assert.equal(view.error.code, 'MIGRATION_FAILED');
  assert.equal(await port.storage.get('grove:schema:migrating-module'), 1);
});

test('first run records current schema', async () => {
  const { port, lifecycle } = setup({
    modules: [migratingModule('migrating-module')],
  });

  const view = await lifecycle.enable('migrating-module');

  assert.equal(view.status, 'on');
  assert.equal(await port.storage.get('grove:schema:migrating-module'), 2);
});
