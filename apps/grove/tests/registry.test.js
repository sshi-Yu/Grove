import assert from 'node:assert/strict';
import test from 'node:test';

import { validateModuleDef } from '../core/module-contract.js';
import { createRegistry } from '../core/registry.js';

function moduleDef(overrides = {}) {
  return {
    id: 'session-stats',
    version: '1.0.0',
    schemaVersion: 1,
    capabilities: [],
    tools: ['summary'],
    commands: ['refresh'],
    activate: async () => {},
    ...overrides,
  };
}

test('rejects id not matching /^[a-z][a-z0-9-]*$/', () => {
  assert.throws(() => validateModuleDef(moduleDef({ id: 'Bad_Id' })), /id/);
});

test('rejects non-integer or <1 schemaVersion', () => {
  assert.throws(() => validateModuleDef(moduleDef({ schemaVersion: 1.5 })), /schemaVersion/);
  assert.throws(() => validateModuleDef(moduleDef({ schemaVersion: 0 })), /schemaVersion/);
});

test('rejects tools entries not matching /^[a-z][a-z0-9_-]*$/', () => {
  assert.throws(() => validateModuleDef(moduleDef({ tools: ['Bad_Tool'] })), /tools/);
});

test('createRegistry throws on duplicate module id', () => {
  assert.throws(
    () => createRegistry({ modules: [moduleDef(), moduleDef()], planned: [] }),
    /duplicate.*session-stats/i,
  );
});

test('createRegistry throws when a planned id equals a module id', () => {
  assert.throws(
    () => createRegistry({ modules: [moduleDef()], planned: [{ id: 'session-stats' }] }),
    /session-stats/,
  );
});

test('capabilityUnion returns sorted unique union', () => {
  const registry = createRegistry({
    modules: [
      moduleDef({ id: 'alpha', capabilities: ['zeta', 'shared'] }),
      moduleDef({ id: 'beta', capabilities: ['alpha', 'shared'] }),
    ],
    planned: [],
  });

  assert.deepEqual(registry.capabilityUnion(), ['alpha', 'shared', 'zeta']);
});

test('isPlanned is true only for planned ids', () => {
  const registry = createRegistry({
    modules: [moduleDef()],
    planned: [{ id: 'token-stats' }, { id: 'task-manager' }],
  });

  assert.equal(registry.isPlanned('token-stats'), true);
  assert.equal(registry.isPlanned('task-manager'), true);
  assert.equal(registry.isPlanned('session-stats'), false);
  assert.equal(registry.isPlanned('unknown'), false);
});

test('validateModuleDef returns a copy with copied arrays', () => {
  const input = moduleDef();
  const result = validateModuleDef(input);

  assert.notEqual(result, input);
  assert.notEqual(result.capabilities, input.capabilities);
  assert.notEqual(result.tools, input.tools);
  assert.notEqual(result.commands, input.commands);
});

test('registry membership arrays are copied and frozen', () => {
  const inputModule = moduleDef();
  const inputModules = [inputModule];
  const inputPlanned = [{ id: 'token-stats' }];
  const registry = createRegistry({ modules: inputModules, planned: inputPlanned });

  inputModules.push(moduleDef({ id: 'other-module' }));
  inputPlanned.push({ id: 'other-planned' });

  assert.equal(registry.modules.length, 1);
  assert.deepEqual(registry.planned.map(({ id }) => id), ['token-stats']);
  assert.throws(() => registry.modules.push(moduleDef({ id: 'third-module' })), TypeError);
  assert.throws(() => registry.planned.push({ id: 'third-planned' }), TypeError);
});
