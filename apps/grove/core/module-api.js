// ModuleApi: the per-module facade handed to ModuleDef.activate.
// Registrations go on a stack only after the port call succeeds; disposeAll
// unwinds that stack in reverse, collecting disposer errors instead of throwing.

const LOG_LEVELS = new Set(['info', 'warn', 'error']);

export function createModuleApi(port, def, moduleStorage) {
  if (port === null || typeof port !== 'object') {
    throw new Error('port must be an object');
  }
  if (def === null || typeof def !== 'object' || typeof def.id !== 'string') {
    throw new Error('def must be an object with an id');
  }
  if (moduleStorage === null || typeof moduleStorage !== 'object') {
    throw new Error('moduleStorage must be an object');
  }

  const disposables = [];

  function track(register) {
    return register().then((disposable) => {
      disposables.push(disposable);
      return disposable;
    });
  }

  function withToolName(spec) {
    return { ...spec, name: `grove_${def.id}_${spec.name}` };
  }

  function withCommandName(spec) {
    return { ...spec, name: `grove-${def.id}-${spec.name}` };
  }

  const api = {
    id: def.id,

    log(level, message) {
      if (!LOG_LEVELS.has(level)) {
        throw new Error(`unknown log level: ${level}`);
      }
      if (typeof message !== 'string' || message.length === 0) {
        throw new Error('message must be a nonempty string');
      }
      port.logger[level](`[grove:${def.id}] ${message}`);
    },

    registerTool(spec) {
      if (!def.tools.includes(spec.name)) {
        return Promise.reject(
          new Error(`tool name not declared in def.tools: ${spec.name}`),
        );
      }
      return track(() => port.registerTool(withToolName(spec)));
    },

    registerCommand(spec) {
      if (!def.commands.includes(spec.name)) {
        return Promise.reject(
          new Error(`command name not declared in def.commands: ${spec.name}`),
        );
      }
      return track(() => port.registerCommand(withCommandName(spec)));
    },

    subscribe(callback, filter) {
      return track(() => port.subscribe(callback, filter));
    },

    storage: moduleStorage,
  };

  async function disposeAll() {
    const errors = [];
    while (disposables.length > 0) {
      const disposable = disposables.pop();
      try {
        await disposable();
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  }

  return { api, disposeAll };
}
