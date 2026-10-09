import { createModuleApi } from '../core/module-api.js';
import { createStateStore } from '../core/state-store.js';
import { runSchemaGate } from '../core/schema-gate.js';
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

    await runSchemaGate(def, store, createStandaloneMigrateApi(def, store, sdk.logger));
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
