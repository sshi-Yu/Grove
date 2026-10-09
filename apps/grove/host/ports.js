// Host adapter: turns the Hana v2 App SDK surface into the HostPort shape the
// Grove core expects (see core/module-api.js). Registration receipts come in
// three documented shapes (docs/superpowers/plans/sdk-notes.md):
//   1. a bare callable disposer  `() => void`
//   2. `{ disposeAsync }`
//   3. a full AppRegistration `{ ready, disposeAsync }`
// All are normalized to `Disposable = () => Promise<void> | void`, awaiting
// `ready` and preferring `disposeAsync` when present.

export function createHostPort(sdk) {
  if (sdk === null || typeof sdk !== 'object') {
    throw new Error('sdk must be an object');
  }

  const toolsRegister = findRegister(sdk, ['tools']);
  const commandsRegister = findRegister(sdk, ['commands']);
  const busSubscribe = findSubscribe(sdk);

  const globalStorage = resolveGlobalStorage(sdk);
  if (globalStorage === undefined) {
    throw new Error('sdk.storage.global is required');
  }

  const logger = sdk.logger;
  if (logger === null || typeof logger !== 'object') {
    throw new Error('sdk.logger is required');
  }

  return {
    registerTool: (spec) => toolsRegister(spec).then(toDisposable),
    registerCommand: (spec) => commandsRegister(spec).then(toDisposable),
    subscribe: (callback, filter) => busSubscribe(callback, filter).then(toDisposable),
    storage: globalStorage,
    logger,
  };
}

function findRegister(sdk, [sectionName]) {
  const section = sdk[sectionName];
  const register = section !== null && typeof section === 'object'
    ? section.register
    : sdk[sectionToRootMethod(sectionName)];
  if (typeof register !== 'function') {
    throw new Error(`sdk.${sectionName}.register is required`);
  }
  return register;
}

function sectionToRootMethod(sectionName) {
  // sdk.tools.register -> sdk.registerTool, singular form of the section name
  const singular = sectionName.replace(/s$/, '');
  return `register${singular[0].toUpperCase()}${singular.slice(1)}`;
}

function findSubscribe(sdk) {
  const subscribe = sdk.bus !== null && typeof sdk.bus === 'object'
    ? sdk.bus.subscribe
    : sdk.subscribe;
  if (typeof subscribe !== 'function') {
    throw new Error('sdk.bus.subscribe is required');
  }
  return subscribe;
}

function resolveGlobalStorage(sdk) {
  const storage = sdk.storage;
  if (storage === null || typeof storage !== 'object') {
    return undefined;
  }
  return storage.global !== null && typeof storage.global === 'object' ? storage.global : undefined;
}

function toDisposable(receipt) {
  if (typeof receipt === 'function') {
    return receipt;
  }
  if (receipt === null || typeof receipt !== 'object') {
    throw new Error(`unexpected registration receipt: ${String(receipt)}`);
  }

  const { ready, disposeAsync, dispose } = receipt;
  if (typeof disposeAsync === 'function') {
    return async () => {
      if (ready !== undefined) {
        await ready;
      }
      await disposeAsync();
    };
  }
  if (typeof dispose === 'function') {
    return async () => {
      if (ready !== undefined) {
        await ready;
      }
      await dispose();
    };
  }
  throw new Error('registration receipt has no callable disposer');
}
