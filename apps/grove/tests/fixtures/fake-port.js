// Test double for HostPort: records every registration, can fail the Nth
// registration, injects a failure into the Nth disposer call, and records
// which disposables were invoked (in call order).

export function createFakePort(options = {}) {
  const {
    failOnNthRegistration = 0,
    failOnNthDisposal = 0,
    failWith,
  } = options;

  const registrations = [];
  const disposed = [];
  const loggerCalls = [];
  const store = new Map();
  let registrationCount = 0;
  let disposalCount = 0;

  function register(kind, record) {
    registrationCount += 1;
    if (failOnNthRegistration > 0 && registrationCount === failOnNthRegistration) {
      return Promise.reject(failWith ?? new Error(`registration #${registrationCount} failed`));
    }

    let disposedFlag = false;
    const disposable = async () => {
      disposedFlag = true;
      disposalCount += 1;
      disposed.push({ kind, record });
      if (failOnNthDisposal > 0 && disposalCount === failOnNthDisposal) {
        throw new Error(`disposal #${disposalCount} failed`);
      }
    };
    registrations.push({ kind, record, disposable, isDisposed: () => disposedFlag });
    return Promise.resolve(disposable);
  }

  return {
    registrations,
    disposed,
    loggerCalls,
    registerTool: (spec) => register('tool', spec),
    registerCommand: (spec) => register('command', spec),
    subscribe: (callback, filter) => register('subscription', { callback, filter }),
    storage: {
      get(key, fallback) {
        return Promise.resolve(store.has(key) ? store.get(key) : fallback);
      },
      set(key, value) {
        store.set(key, value);
        return Promise.resolve();
      },
      delete(key) {
        store.delete(key);
        return Promise.resolve();
      },
    },
    logger: {
      info: (message) => loggerCalls.push({ level: 'info', message }),
      warn: (message) => loggerCalls.push({ level: 'warn', message }),
      error: (message) => loggerCalls.push({ level: 'error', message }),
    },
  };
}
