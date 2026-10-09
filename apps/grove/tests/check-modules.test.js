import assert from 'node:assert/strict';
import test from 'node:test';

import { checkModules } from '../scripts/check-modules.mjs';

function moduleDef(overrides = {}) {
  return {
    id: 'demo',
    version: '1.0.0',
    schemaVersion: 1,
    capabilities: [],
    tools: [],
    commands: [],
    activate: async () => {},
    ...overrides,
  };
}

function manifest(overrides = {}) {
  return {
    manifestVersion: 2,
    id: 'grove',
    capabilities: [],
    ...overrides,
  };
}

function fakeRegistry(modules) {
  return {
    modules,
    planned: [],
    capabilityUnion() {
      return [...new Set(modules.flatMap(({ capabilities }) => capabilities))].sort();
    },
  };
}

test('passes for empty registry with empty capabilities', () => {
  const result = checkModules({ registry: fakeRegistry([]), manifest: manifest() });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('fails and names the missing capability when manifest lacks one a module needs', () => {
  const registry = fakeRegistry([
    moduleDef({ id: 'alpha', capabilities: ['app/tools.expose-to-model'] }),
  ]);

  const missing = checkModules({ registry, manifest: manifest() });
  assert.equal(missing.ok, false);
  assert.equal(missing.errors.length, 1);
  assert.match(missing.errors[0], /manifest\.capabilities missing "app\/tools\.expose-to-model"/);
  assert.match(missing.errors[0], /alpha/);

  const covered = checkModules({
    registry,
    manifest: manifest({ capabilities: ['app/tools.expose-to-model'] }),
  });
  assert.equal(covered.ok, true);
  assert.deepEqual(covered.errors, []);
});

test('fails when two modules derive the same tool name', () => {
  const registry = fakeRegistry([
    moduleDef({ id: 'demo', tools: ['share'] }),
    moduleDef({ id: 'demo', tools: ['share'] }),
  ]);

  const result = checkModules({ registry, manifest: manifest() });

  assert.equal(result.ok, false);
  assert.match(result.errors[0], /duplicate derived tool name "grove_demo_share"/);
});

test('fails when two modules derive the same command name', () => {
  const registry = fakeRegistry([
    moduleDef({ id: 'alpha', commands: ['stats-refresh'] }),
    moduleDef({ id: 'alpha-stats', commands: ['refresh'] }),
  ]);

  const result = checkModules({ registry, manifest: manifest() });

  assert.equal(result.ok, false);
  assert.match(result.errors[0], /duplicate derived command name "grove-alpha-stats-refresh"/);
  assert.match(result.errors[0], /alpha/);
  assert.match(result.errors[0], /alpha-stats/);
});

test('fails on duplicate local tool names within one module', () => {
  const registry = fakeRegistry([moduleDef({ id: 'demo', tools: ['summary', 'summary'] })]);

  const result = checkModules({ registry, manifest: manifest() });

  assert.equal(result.ok, false);
  assert.match(result.errors[0], /module "demo" declares duplicate local tool name "summary"/);
});
