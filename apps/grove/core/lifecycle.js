import { createModuleApi } from './module-api.js';

// Lifecycle engine: owns each module's run status and serializes all
// operations on a module through a per-module promise chain. Enable runs the
// schema gate, then activate; any failure rolls back registrations while the
// enable intent stays persisted. An error carrying a `capability` field means
// the platform did not grant a capability and marks the module `blocked`.

export class LifecycleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LifecycleError';
    this.code = code;
  }
}

const ACTIVE_STATES = new Set(['on', 'starting']);

function createPerModuleChain() {
  const chains = new Map();

  function enqueue(id, job) {
    const tail = chains.get(id) ?? Promise.resolve();
    const run = tail.then(job, job);
    chains.set(
      id,
      run.then(
        () => {},
        () => {},
      ),
    );
    return run;
  }

  return enqueue;
}

export function createLifecycle({ registry, store, port, logger }) {
  if (registry === null || typeof registry !== 'object') {
    throw new Error('registry must be an object');
  }
  if (store === null || typeof store !== 'object') {
    throw new Error('store must be an object');
  }
  if (port === null || typeof port !== 'object') {
    throw new Error('port must be an object');
  }
  const log = logger ?? port.logger;
  if (log === null || typeof log !== 'object') {
    throw new Error('logger must be an object');
  }

  const statuses = new Map();
  const cleanups = new Map();
  const disposals = new Map();
  const enqueue = createPerModuleChain();

  for (const module of registry.modules) {
    statuses.set(module.id, { status: 'off', error: undefined });
  }
  for (const { id } of registry.planned) {
    statuses.set(id, { status: 'planned', error: undefined });
  }

  function setStatus(id, status, error) {
    statuses.set(id, { status, error });
  }

  function requireKnown(id) {
    if (registry.isPlanned(id)) {
      throw new LifecycleError('NOT_AVAILABLE', `module ${id} is planned and cannot be enabled`);
    }
    const def = registry.get(id);
    if (def === undefined) {
      throw new LifecycleError('UNKNOWN_MODULE', `unknown module id: ${id}`);
    }
    return def;
  }

  async function runSchemaGate(def, api) {
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
      await def.migrate(stored, api);
    } catch (cause) {
      const error = new Error(`migrate failed for ${def.id}: ${cause.message}`);
      error.code = 'MIGRATION_FAILED';
      error.cause = cause;
      throw error;
    }
    await store.setModuleSchema(def.id, def.schemaVersion);
  }

  function toView([id, { status, error }]) {
    const view = { id, status };
    if (error !== undefined) {
      view.error = error;
    }
    return view;
  }

  function plannedView(id) {
    return { id, status: 'planned' };
  }

  async function disposeAndLog(id, disposeAll) {
    const errors = await disposeAll();
    for (const error of errors) {
      log.error(`[grove:${id}] disposal failed: ${error.message}`);
    }
  }

  async function enableOrRetry(id) {
    const def = requireKnown(id);
    const current = statuses.get(id);

    if (ACTIVE_STATES.has(current.status)) {
      return toView([id, current]);
    }

    setStatus(id, 'starting');
    const { api, disposeAll } = createModuleApiFor(def);
    try {
      await runSchemaGate(def, api);
      const cleanup = await def.activate(api);
      cleanups.set(id, typeof cleanup === 'function' ? cleanup : undefined);
      disposals.set(id, disposeAll);
      setStatus(id, 'on');
      return toView([id, statuses.get(id)]);
    } catch (cause) {
      cleanups.delete(id);
      await disposeAndLog(id, disposeAll);
      const status = cause && cause.capability !== undefined ? 'blocked' : 'failed';
      setStatus(id, status, { code: cause.code ?? 'ACTIVATION_FAILED', message: cause.message });
      throw cause;
    }
  }

  function createModuleApiFor(def) {
    return createModuleApi(port, def, store.moduleStorage(def.id));
  }

  function enable(id) {
    return enqueue(id, async () => {
      requireKnown(id);
      await store.setEnabled(id, true);
      try {
        return await enableOrRetry(id);
      } catch (cause) {
        if (!(cause instanceof LifecycleError)) {
          log.error(`[grove:${id}] enable failed: ${cause.message}`);
        }
        return toView([id, statuses.get(id)]);
      }
    });
  }

  function disable(id) {
    return enqueue(id, async () => {
      requireKnown(id);
      const current = statuses.get(id);

      if (current.status === 'planned') {
        throw new LifecycleError('NOT_AVAILABLE', `module ${id} is planned and cannot be disabled`);
      }
      if (current.status === 'off') {
        return toView([id, current]);
      }

      setStatus(id, 'stopping');
      await runDisableCleanup(id);
      const disposeAll = disposals.get(id);
      disposals.delete(id);
      if (disposeAll !== undefined) {
        await disposeAndLog(id, disposeAll);
      }
      await store.setEnabled(id, false);
      setStatus(id, 'off');
      return toView([id, statuses.get(id)]);
    });
  }

  async function runDisableCleanup(id) {
    const cleanup = cleanups.get(id);
    cleanups.delete(id);
    if (typeof cleanup === 'function') {
      try {
        await cleanup();
      } catch (error) {
        log.error(`[grove:${id}] cleanup failed: ${error.message}`);
      }
    }
  }

  async function views() {
    const list = [];
    for (const module of registry.modules) {
      list.push(toView([module.id, statuses.get(module.id)]));
    }
    for (const { id } of registry.planned) {
      list.push(plannedView(id));
    }
    return list;
  }

  async function restore() {
    const storedIds = await store.getEnabledIds();
    await Promise.all(
      storedIds.map(async (id) => {
        if (registry.get(id) === undefined) {
          return;
        }
        try {
          await enable(id);
        } catch (error) {
          log.error(`[grove:${id}] restore failed: ${error.message}`);
        }
      }),
    );
  }

  return { views, enable, disable, restore };
}
