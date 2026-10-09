// Fake ModuleDefs for the lifecycle tests: success paths, partial-activation
// failure, failing cleanup, migration, and capability-gated errors.

import { createRegistry } from '../../core/registry.js';

function makeDef(overrides = {}) {
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

export function successModule(id = 'session-stats', overrides = {}) {
  return makeDef({ id, ...overrides });
}

// Registers one tool, then throws: the earlier registration must be rolled
// back and the module must end up `failed` with its enable intent kept.
export function partialFailureModule(id = 'partial-fail', overrides = {}) {
  return makeDef({
    id,
    activate: async (api) => {
      await api.registerTool({ name: 'summary' });
      throw new Error('activation exploded after registering');
    },
    ...overrides,
  });
}

// Returns a cleanup function that throws: disable must still complete, the
// registrations must be revoked, and the error must be logged, not thrown.
export function failingCleanupModule(id = 'cleanup-fail', overrides = {}) {
  return makeDef({
    id,
    activate: async (api) => {
      await api.registerTool({ name: 'summary' });
      return async () => {
        throw new Error('cleanup exploded');
      };
    },
    ...overrides,
  });
}

// Exposes def.migrate for the schema-migration cases.
export function migratingModule(id = 'migrating-module', overrides = {}) {
  return makeDef({ id, schemaVersion: 2, ...overrides });
}

// Throws an error carrying a `capability` field: the engine must classify
// this as `blocked` rather than `failed`.
export function capabilityErrorModule(id = 'capability-fail', overrides = {}) {
  return makeDef({
    id,
    capabilities: ['network.fetch'],
    activate: async () => {
      const error = new Error('capability network.fetch was not granted');
      error.capability = 'network.fetch';
      throw error;
    },
    ...overrides,
  });
}

export function createRegistryWith(modules, plannedIds = []) {
  return createRegistry({ modules, planned: plannedIds.map((id) => ({ id })) });
}
