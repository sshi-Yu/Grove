const SELECTION_KEY = 'grove:selection';
const LOCALE_KEY = 'grove:locale';
const SCHEMA_PREFIX = 'grove:schema:';
const DATA_PREFIX = 'grove:data:';

function isValidSelection(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  if (value.version !== 1) {
    return false;
  }
  if (value.enabled === null || typeof value.enabled !== 'object' || Array.isArray(value.enabled)) {
    return false;
  }
  return true;
}

function createWriteQueue() {
  let tail = Promise.resolve();

  return function enqueue(job) {
    const run = tail.then(job);
    tail = run.then(
      () => {},
      () => {},
    );
    return run;
  };
}

export function createStateStore(storage) {
  const enqueueSelectionWrite = createWriteQueue();

  async function readSelection() {
    const value = await storage.get(SELECTION_KEY);
    return isValidSelection(value) ? value : null;
  }

  async function updateSelection(mutate) {
    return enqueueSelectionWrite(async () => {
      const current = await readSelection();
      const selection = current === null ? { version: 1, enabled: {} } : { ...current, enabled: { ...current.enabled } };
      await storage.set(SELECTION_KEY, mutate(selection));
    });
  }

  async function getEnabledIds() {
    const selection = await readSelection();
    if (selection === null) {
      return [];
    }
    return Object.keys(selection.enabled).sort();
  }

  function setEnabled(id, on) {
    return updateSelection((selection) => {
      if (on) {
        selection.enabled[id] = true;
      } else {
        delete selection.enabled[id];
      }
      return selection;
    });
  }

  async function getModuleSchema(id) {
    const value = await storage.get(SCHEMA_PREFIX + id);
    return Number.isSafeInteger(value) && value >= 1 ? value : null;
  }

  function setModuleSchema(id, schemaVersion) {
    return storage.set(SCHEMA_PREFIX + id, schemaVersion);
  }

  async function getLocaleOverride() {
    const value = await storage.get(LOCALE_KEY);
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  async function setLocaleOverride(locale) {
    if (locale === null) {
      await storage.delete(LOCALE_KEY);
      return;
    }
    await storage.set(LOCALE_KEY, locale);
  }

  function moduleStorage(id) {
    const prefix = DATA_PREFIX + id + ':';

    return {
      get(key, fallback = undefined) {
        return storage.get(prefix + key, fallback);
      },
      set(key, value) {
        return storage.set(prefix + key, value);
      },
      delete(key) {
        return storage.delete(prefix + key);
      },
    };
  }

  return {
    getEnabledIds,
    setEnabled,
    getModuleSchema,
    setModuleSchema,
    getLocaleOverride,
    setLocaleOverride,
    moduleStorage,
  };
}
