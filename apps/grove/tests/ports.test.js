import assert from 'node:assert/strict';
import test from 'node:test';

import { createHostPort } from '../host/ports.js';

// Receipt shapes documented in docs/superpowers/plans/sdk-notes.md:
// bare callable disposer, { disposeAsync }, or full AppRegistration
// { ready, disposeAsync }. The port must normalize all three.

test('normalizes a bare function receipt into an awaitable disposable', async () => {
  let calls = 0;
  const sdk = {
    tools: { register: async () => () => { calls += 1; } },
    commands: { register: async () => () => { calls += 1; } },
    bus: { subscribe: async () => () => { calls += 1; } },
    storage: { global: makeStorage() },
    logger: makeLogger(),
  };

  const port = createHostPort(sdk);
  const disposable = await port.registerTool({ name: 't', execute: async () => 1 });
  assert.equal(typeof disposable, 'function');

  await disposable();
  assert.equal(calls, 1);
});

test('normalizes a { disposeAsync } receipt', async () => {
  let calls = 0;
  const sdk = {
    tools: { register: async () => ({ disposeAsync: async () => { calls += 1; } }) },
    commands: { register: async () => ({ disposeAsync: async () => { calls += 1; } }) },
    bus: { subscribe: async () => ({ disposeAsync: async () => { calls += 1; } }) },
    storage: { global: makeStorage() },
    logger: makeLogger(),
  };

  const port = createHostPort(sdk);
  const disposable = await port.registerCommand({ name: 'c', handler: () => {} });
  await disposable();
  assert.equal(calls, 1);
});

test('normalizes a full { ready, disposeAsync } AppRegistration receipt', async () => {
  let disposeCalls = 0;
  let readyResolved = false;
  const sdk = {
    tools: { register: async () => makeFullReceipt() },
    commands: { register: async () => makeFullReceipt() },
    bus: {
      subscribe: async () => ({
        ready: Promise.resolve().then(() => { readyResolved = true; }),
        disposeAsync: async () => { disposeCalls += 1; },
      }),
    },
    storage: { global: makeStorage() },
    logger: makeLogger(),
  };

  const port = createHostPort(sdk);
  const disposable = await port.subscribe(() => {}, { types: ['x'] });
  await disposable();

  assert.equal(readyResolved, true, 'disposable must await receipt.ready before disposing');
  assert.equal(disposeCalls, 1);
});

test('maps storage.global and logger straight from the sdk', async () => {
  const globalScope = makeStorage();
  const loggerCalls = [];
  const sdk = {
    tools: { register: async () => () => {} },
    commands: { register: async () => () => {} },
    bus: { subscribe: async () => () => {} },
    storage: { global: globalScope },
    logger: {
      info: (m) => loggerCalls.push(['info', m]),
      warn: (m) => loggerCalls.push(['warn', m]),
      error: (m) => loggerCalls.push(['error', m]),
    },
  };

  const port = createHostPort(sdk);
  assert.equal(port.storage, globalScope);
  assert.equal(port.logger, sdk.logger);

  await port.storage.set('k', { v: 1 });
  assert.deepEqual(await port.storage.get('k'), { v: 1 });
  assert.equal(await port.storage.get('missing', 'fb'), 'fb');
  await port.storage.delete('k');
  assert.equal(await port.storage.get('k'), undefined);

  port.logger.info('a');
  port.logger.warn('b');
  port.logger.error('c');
  assert.deepEqual(loggerCalls, [['info', 'a'], ['warn', 'b'], ['error', 'c']]);
});

test('single object with methods is also accepted and mixed receipts work', async () => {
  let disposed = 0;
  let syncDisposed = 0;
  const sdk = {
    registerTool: async () => () => { syncDisposed += 1; },
    registerCommand: async () => ({ disposeAsync: async () => { disposed += 1; } }),
    subscribe: async () => () => { syncDisposed += 1; },
    storage: { global: makeStorage() },
    logger: makeLogger(),
  };

  const port = createHostPort(sdk);
  const a = await port.registerTool({ name: 't' });
  const b = await port.registerCommand({ name: 'c' });
  const c = await port.subscribe(() => {});

  await a();
  await b();
  await c();
  assert.equal(syncDisposed, 2);
  assert.equal(disposed, 1);
});

function makeFullReceipt() {
  let calls = 0;
  return {
    ready: Promise.resolve(),
    disposeAsync: async () => { calls += 1; },
    calls: () => calls,
  };
}

function makeStorage() {
  const store = new Map();
  return {
    get: (key, fallback) => Promise.resolve(store.has(key) ? store.get(key) : fallback),
    set: (key, value) => { store.set(key, value); return Promise.resolve(); },
    delete: (key) => { store.delete(key); return Promise.resolve(); },
  };
}

function makeLogger() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}
