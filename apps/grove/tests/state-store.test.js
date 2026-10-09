import assert from 'node:assert/strict';
import test from 'node:test';

import { createStateStore } from '../core/state-store.js';

function memoryStorage() {
  const data = new Map();

  return {
    data,
    async get(key, fallback = undefined) {
      return data.has(key) ? data.get(key) : fallback;
    },
    async set(key, value) {
      data.set(key, structuredClone(value));
    },
    async delete(key) {
      data.delete(key);
    },
  };
}

test('setEnabled persists and getEnabledIds returns it', async () => {
  const storage = memoryStorage();
  const store = createStateStore(storage);

  await store.setEnabled('session-stats', true);

  assert.deepEqual(await store.getEnabledIds(), ['session-stats']);
  assert.deepEqual(await storage.get('grove:selection'), {
    version: 1,
    enabled: { 'session-stats': true },
  });
});

test('setEnabled false removes the id', async () => {
  const store = createStateStore(memoryStorage());

  await store.setEnabled('session-stats', true);
  await store.setEnabled('session-stats', false);

  assert.deepEqual(await store.getEnabledIds(), []);
  assert.deepEqual((await store.getEnabledIds()).length, 0);
});

test('parallel setEnabled for two ids keeps both', async () => {
  const store = createStateStore(memoryStorage());

  await Promise.all([
    store.setEnabled('session-stats', true),
    store.setEnabled('token-stats', true),
  ]);

  const ids = await store.getEnabledIds();
  assert.deepEqual([...ids].sort(), ['session-stats', 'token-stats']);
});

test('getEnabledIds ignores garbage (null, array, string, wrong version)', async () => {
  const storage = memoryStorage();

  await storage.set('grove:selection', null);
  assert.deepEqual(await createStateStore(storage).getEnabledIds(), []);

  await storage.set('grove:selection', [1, 2, 3]);
  assert.deepEqual(await createStateStore(storage).getEnabledIds(), []);

  await storage.set('grove:selection', 'grove:selection');
  assert.deepEqual(await createStateStore(storage).getEnabledIds(), []);

  await storage.set('grove:selection', { version: 99, enabled: { 'session-stats': true } });
  assert.deepEqual(await createStateStore(storage).getEnabledIds(), []);
});

test('garbage selection data is preserved, not deleted', async () => {
  const storage = memoryStorage();
  const garbage = { version: 99, enabled: 'nope' };
  await storage.set('grove:selection', garbage);

  const store = createStateStore(storage);
  assert.deepEqual(await store.getEnabledIds(), []);

  await store.setEnabled('task-manager', true);

  assert.deepEqual(await storage.get('grove:selection'), {
    version: 1,
    enabled: { 'task-manager': true },
  });
});

test('moduleStorage keys are namespaced per module and do not collide', async () => {
  const storage = memoryStorage();
  const store = createStateStore(storage);

  const alpha = store.moduleStorage('alpha');
  const beta = store.moduleStorage('beta');

  await alpha.set('count', 7);
  await beta.set('count', 13);

  assert.equal(await alpha.get('count'), 7);
  assert.equal(await beta.get('count'), 13);
  assert.equal(await storage.get('grove:data:alpha:count'), 7);
  assert.equal(await storage.get('grove:data:beta:count'), 13);
  assert.equal(storage.data.size, 2);

  await alpha.delete('count');
  assert.equal(await alpha.get('count', 'fallback'), 'fallback');
  assert.equal(await beta.get('count'), 13);
});

test('moduleStorage get falls back when unset and set overwrites', async () => {
  const store = createStateStore(memoryStorage());
  const mod = store.moduleStorage('alpha');

  assert.equal(await mod.get('missing', 'dflt'), 'dflt');

  await mod.set('cfg', { nested: true });
  assert.deepEqual(await mod.get('cfg'), { nested: true });

  await mod.set('cfg', { nested: false });
  assert.deepEqual(await mod.get('cfg'), { nested: false });
});

test('getModuleSchema returns null when unset and persists setModuleSchema', async () => {
  const storage = memoryStorage();
  const store = createStateStore(storage);

  assert.equal(await store.getModuleSchema('alpha'), null);

  await store.setModuleSchema('alpha', 3);

  assert.equal(await store.getModuleSchema('alpha'), 3);
  assert.equal(await storage.get('grove:schema:alpha'), 3);
  assert.equal(await store.getModuleSchema('beta'), null);
});

test('getLocaleOverride returns null when unset', async () => {
  const store = createStateStore(memoryStorage());

  assert.equal(await store.getLocaleOverride(), null);
});

test('setLocaleOverride persists a locale and null clears it', async () => {
  const storage = memoryStorage();
  const store = createStateStore(storage);

  await store.setLocaleOverride('zh-TW');
  assert.equal(await store.getLocaleOverride(), 'zh-TW');
  assert.equal(await storage.get('grove:locale'), 'zh-TW');

  await store.setLocaleOverride(null);

  assert.equal(await store.getLocaleOverride(), null);
  assert.equal(await storage.get('grove:locale', 'sentinel'), 'sentinel');
});
