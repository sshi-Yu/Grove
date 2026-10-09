import assert from 'node:assert/strict';
import test from 'node:test';

import { createStandaloneApp } from '../host/standalone.js';

// Standalone entry for single-module v2 Apps: build a HostPort from the sdk,
// run the schema gate, then activate once. No panel, no registry.

function createFakeSdk({ storage } = {}) {
  const calls = { tools: [], commands: [], subscriptions: [] };
  const receipts = [];
  let nextId = 0;
  const store = storage ?? new Map();

  function register(record) {
    const receipt = {
      id: (nextId += 1),
      disposeAsync: async () => {
        record.disposed = true;
      },
    };
    receipts.push(receipt);
    return receipt;
  }

  const sdk = {
    calls,
    receipts,
    storage: {
      global: {
        get: (key, fallback) => Promise.resolve(store.has(key) ? store.get(key) : fallback),
        set: (key, value) => {
          store.set(key, value);
          return Promise.resolve();
        },
        delete: (key) => {
          store.delete(key);
          return Promise.resolve();
        },
      },
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    tools: {
      register: async (spec) => {
        calls.tools.push(spec);
        return register(spec);
      },
    },
    commands: {
      register: async (spec) => {
        calls.commands.push(spec);
        return register(spec);
      },
    },
    bus: {
      subscribe: async (callback, filter) => {
        calls.subscriptions.push({ callback, filter });
        return register({ callback, filter });
      },
    },
  };
  return sdk;
}

function moduleDef(overrides = {}) {
  return {
    id: 'hello-world',
    version: '1.0.0',
    schemaVersion: 1,
    capabilities: [],
    tools: ['greet'],
    commands: [],
    activate: async () => {},
    ...overrides,
  };
}

test('activates once and registers tools with the grove_<id>_ prefix', async () => {
  let activateCalls = 0;
  const def = moduleDef({
    tools: ['greet'],
    activate: async (api) => {
      activateCalls += 1;
      await api.registerTool({ name: 'greet', description: 'greets', execute: async () => 'hi' });
    },
  });
  const sdk = createFakeSdk();

  const entry = createStandaloneApp(def);
  assert.equal(typeof entry, 'function');

  await entry(sdk);

  assert.equal(activateCalls, 1);
  assert.deepEqual(sdk.calls.tools.map(({ name }) => name), ['grove_hello-world_greet']);
});

test('runs migrate(from, api) when the stored schema is lower, then records the new schema', async () => {
  const seen = [];
  const def = moduleDef({
    schemaVersion: 2,
    migrate: async (fromVersion, api) => {
      seen.push(['migrate', fromVersion, api.id]);
    },
  });
  const sdk = createFakeSdk({
    storage: new Map([['grove:schema:hello-world', 1]]),
  });

  await createStandaloneApp(def)(sdk);

  assert.deepEqual(seen, [['migrate', 1, 'hello-world']]);

  const portStorage = sdk.storage.global;
  assert.equal(await portStorage.get('grove:schema:hello-world'), 2);
});

test('first run records the current schema without calling migrate', async () => {
  let migrateCalls = 0;
  const def = moduleDef({ migrate: async () => { migrateCalls += 1; } });
  const sdk = createFakeSdk();

  await createStandaloneApp(def)(sdk);

  assert.equal(migrateCalls, 0);
  assert.equal(await sdk.storage.global.get('grove:schema:hello-world'), 1);
});

test('migrate failing rejects the promise and keeps the old schema', async () => {
  const def = moduleDef({
    schemaVersion: 3,
    migrate: async () => {
      throw new Error('migration exploded');
    },
  });
  const sdk = createFakeSdk({
    storage: new Map([['grove:schema:hello-world', 2]]),
  });

  await assert.rejects(
    () => createStandaloneApp(def)(sdk),
    /migration exploded/,
  );
  assert.equal(await sdk.storage.global.get('grove:schema:hello-world'), 2);
});

test('stored schema higher than the module rejects with SCHEMA_NEWER', async () => {
  const def = moduleDef({ schemaVersion: 1 });
  const sdk = createFakeSdk({
    storage: new Map([['grove:schema:hello-world', 2]]),
  });

  await assert.rejects(
    () => createStandaloneApp(def)(sdk),
    (error) => error.code === 'SCHEMA_NEWER',
  );
});

test('activate throwing rejects the createStandaloneApp promise', async () => {
  const def = moduleDef({
    activate: async () => {
      throw new Error('boom during activate');
    },
  });
  const sdk = createFakeSdk();

  await assert.rejects(() => createStandaloneApp(def)(sdk), /boom during activate/);
});

test('storage namespacing reaches the module api', async () => {
  let capturedApi;
  const def = moduleDef({
    activate: async (api) => {
      capturedApi = api;
      await api.storage.set('counter', 7);
    },
  });
  const sdk = createFakeSdk();

  await createStandaloneApp(def)(sdk);

  assert.equal(await sdk.storage.global.get('grove:data:hello-world:counter'), 7);
  assert.equal(await capturedApi.storage.get('counter'), 7);
});
