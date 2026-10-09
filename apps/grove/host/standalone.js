import { createModuleApi } from '../core/module-api.js';
import { createStateStore } from '../core/state-store.js';
import { createHostPort } from './ports.js';

// Standalone entry factory for single-module v2 Apps: build a HostPort from
// the sdk, reuse the panel's storage keys, run the same schema gate rules as
// the lifecycle engine, then activate once. There is no registry and no
// panel; any failure rejects so Hana marks the App `failed`.

export function createStandaloneApp(def) {
  if (def === null || typeof def !== 'object' || typeof def.id !== 'string') {
    throw new Error('def must be a module definition object with an id');
  }

  return async function standaloneEntry(sdk) {
    if (sdk === null || typeof sdk !== 'object') {
      throw new Error('sdk must be an object');
    }

    const port = createHostPort(sdk);
    const store = createStateStore(port.storage);
    const { api, disposeAll } = createModuleApi(port, def, store.moduleStorage(def.id));

    await runSchemaGate(def, store, sdk.logger);
    try {
      const cleanup = await def.activate(api);
      if (typeof cleanup === 'function') {
        registerStandaloneCleanup(sdk, cleanup);
      }
    } catch (cause) {
      const errors = await disposeAll();
      const failure = new Error(`standalone module ${def.id} failed to activate: ${cause.message}`);
      failure.cause = cause;
      if (errors.length > 0) {
        failure.rollbackErrors = errors;
      }
      throw failure;
    }
  };
}

// Mirrors core/lifecycle.js runSchemaGate: no record -> write current version;
// lower -> migrate(from, api) then record; higher -> SCHEMA_NEWER failure.
async function runSchemaGate(def, store, logger) {
  const stored = await store.getModuleSchema(def.id);
  if (stored === null) {
    await store.setModuleSchema(def.id, def.schemaVersion);
    return;
  }
  if (stored === def.schemaVersion) {
    return;
  }
  if (stored > def.schemaVersion) {
    const error = new Error(
      `stored schema ${stored} is newer than module schema ${def.schemaVersion}`,
    );
    error.code = 'SCHEMA_NEWER';
    throw error;
  }
  if (typeof def.migrate !== 'function') {
    const error = new Error(
      `module ${def.id} has no migrate but stored schema is ${stored} < ${def.schemaVersion}`,
    );
    error.code = 'MIGRATION_FAILED';
    throw error;
  }
  try {
    await def.migrate(stored, createStandaloneMigrateApi(def, store, logger));
  } catch (cause) {
    const error = new Error(`migrate failed for ${def.id}: ${cause.message}`);
    error.code = 'MIGRATION_FAILED';
    error.cause = cause;
    throw error;
  }
  await store.setModuleSchema(def.id, def.schemaVersion);
}

function createStandaloneMigrateApi(def, store, logger) {
  return createModuleApi(
    {
      registerTool: () => Promise.reject(noStandaloneRegistration('tools')),
      registerCommand: () => Promise.reject(noStandaloneRegistration('commands')),
      subscribe: () => Promise.reject(noStandaloneRegistration('bus subscriptions')),
      storage: store.moduleStorage(def.id),
      logger: logger ?? { info() {}, warn() {}, error() {} },
    },
    def,
    store.moduleStorage(def.id),
  ).api;
}

function noStandaloneRegistration(what) {
  return new Error(
    `registering ${what} during standalone migrate is not supported; register in activate instead`,
  );
}

function registerStandaloneCleanup(sdk, cleanup) {
  // Keep the module's cleanup callable; the Hana host tears the app down via
  // registration receipts, which we do not own here. Best effort only.
  const anySdk = sdk;
  if (!Array.isArray(anySdk.__groveStandaloneCleanups)) {
    anySdk.__groveStandaloneCleanups = [];
  }
  anySdk.__groveStandaloneCleanups.push(async () => {
    try {
      await cleanup();
    } catch (error) {
      anySdk.logger?.error?.(`[grove:${def.id}] cleanup failed: ${error.message}`);
    }
  });
}
