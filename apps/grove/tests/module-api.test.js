import assert from 'node:assert/strict';
import test from 'node:test';

import { createModuleApi } from '../core/module-api.js';
import { validateModuleDef } from '../core/module-contract.js';
import { createFakePort } from './fixtures/fake-port.js';

function moduleDef(overrides = {}) {
  return validateModuleDef({
    id: 'session-stats',
    version: '1.0.0',
    schemaVersion: 1,
    capabilities: [],
    tools: ['summary'],
    commands: ['refresh'],
    activate: async () => {},
    ...overrides,
  });
}

test('registerTool prefixes name as grove_<id>_<name>', async () => {
  const port = createFakePort();
  const def = moduleDef({ tools: ['summary', 'daily'] });
  const { api } = createModuleApi(port, def, port.storage);

  await api.registerTool({ name: 'summary', handler: async () => ({}) });
  await api.registerTool({ name: 'daily', handler: async () => ({}) });

  assert.equal(port.registrations.length, 2);
  assert.deepEqual(
    port.registrations.map(({ record }) => record.name),
    ['grove_session-stats_summary', 'grove_session-stats_daily'],
  );
});

test('registerCommand prefixes name as grove-<id>-<name>', async () => {
  const port = createFakePort();
  const def = moduleDef({ commands: ['refresh'] });
  const { api } = createModuleApi(port, def, port.storage);

  await api.registerCommand({ name: 'refresh', handler: async () => {} });

  assert.equal(port.registrations.length, 1);
  assert.equal(port.registrations[0].record.name, 'grove-session-stats-refresh');
});

test('registerTool rejects a name not declared in def.tools', async () => {
  const port = createFakePort();
  const def = moduleDef({ tools: ['summary'] });
  const { api } = createModuleApi(port, def, port.storage);

  await assert.rejects(
    api.registerTool({ name: 'undeclared', handler: async () => ({}) }),
    /undeclared/,
  );
  assert.equal(port.registrations.length, 0);
});

test('registerCommand rejects a name not declared in def.commands', async () => {
  const port = createFakePort();
  const def = moduleDef({ commands: ['refresh'] });
  const { api } = createModuleApi(port, def, port.storage);

  await assert.rejects(
    api.registerCommand({ name: 'unknown', handler: async () => {} }),
    /unknown/,
  );
  assert.equal(port.registrations.length, 0);
});

test('disposeAll calls every disposer in reverse order and returns collected errors without throwing', async () => {
  const port = createFakePort({ failOnNthDisposal: 1 });
  const def = moduleDef();
  const { api, disposeAll } = createModuleApi(port, def, port.storage);

  await api.registerTool({ name: 'summary', handler: async () => ({}) });
  await api.registerCommand({ name: 'refresh', handler: async () => {} });
  await api.subscribe(() => {});
  assert.equal(port.disposed.length, 0);

  const errors = await disposeAll();

  assert.equal(port.disposed.length, 3);
  assert.deepEqual(port.disposed.map(({ kind }) => kind), ['subscription', 'command', 'tool']);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /disposal #1 failed/);
});

test('a failing registration leaves earlier ones tracked so disposeAll can roll them back', async () => {
  const port = createFakePort({ failOnNthRegistration: 2 });
  const def = moduleDef({ tools: ['summary', 'daily'] });
  const { api, disposeAll } = createModuleApi(port, def, port.storage);

  await api.registerTool({ name: 'summary', handler: async () => ({}) });
  await assert.rejects(api.registerTool({ name: 'daily', handler: async () => ({}) }));
  assert.equal(port.registrations.length, 1);

  const errors = await disposeAll();

  assert.deepEqual(port.disposed.map(({ kind }) => kind), ['tool']);
  assert.deepEqual(errors, []);
});

test('log forwards to port.logger with [grove:<id>] prefix', async () => {
  const port = createFakePort();
  const { api } = createModuleApi(port, moduleDef(), port.storage);

  api.log('info', 'hello');
  api.log('warn', 'careful');
  api.log('error', 'boom');

  assert.deepEqual(port.loggerCalls, [
    { level: 'info', message: '[grove:session-stats] hello' },
    { level: 'warn', message: '[grove:session-stats] careful' },
    { level: 'error', message: '[grove:session-stats] boom' },
  ]);
});

test('api.storage is the provided moduleStorage', async () => {
  const port = createFakePort();
  const calls = [];
  const moduleStorage = {
    get: (key, fallback) => {
      calls.push(['get', key, fallback]);
      return Promise.resolve(fallback);
    },
    set: (key, value) => {
      calls.push(['set', key, value]);
      return Promise.resolve();
    },
    delete: (key) => {
      calls.push(['delete', key]);
      return Promise.resolve();
    },
  };
  const { api } = createModuleApi(port, moduleDef(), moduleStorage);

  assert.equal(api.storage, moduleStorage);
  await api.storage.get('count', 0);
  await api.storage.set('count', 2);
  await api.storage.delete('count');

  assert.deepEqual(calls, [['get', 'count', 0], ['set', 'count', 2], ['delete', 'count']]);
});

test('api exposes the module id and prefixes specs without mutating the caller object', async () => {
  const port = createFakePort();
  const def = moduleDef();
  const { api } = createModuleApi(port, def, port.storage);

  assert.equal(api.id, 'session-stats');

  const handler = async () => ({});
  const toolSpec = { name: 'summary', handler };
  await api.registerTool(toolSpec);
  assert.notEqual(port.registrations[0].record, toolSpec);
  assert.deepEqual(port.registrations[0].record, {
    name: 'grove_session-stats_summary',
    handler,
  });
  assert.deepEqual(toolSpec, { name: 'summary', handler });
});

test('subscribe forwards callback and optional filter', async () => {
  const port = createFakePort();
  const { api } = createModuleApi(port, moduleDef(), port.storage);
  const callback = () => {};

  await api.subscribe(callback);
  assert.deepEqual(port.registrations[0].record, { callback, filter: undefined });

  const filter = { topic: 'sessions' };
  await api.subscribe(callback, filter);
  assert.deepEqual(port.registrations[1].record, { callback, filter });
});
