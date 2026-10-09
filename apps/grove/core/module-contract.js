const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_-]*$/;

function requireStringArray(value, field, pattern) {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new Error(`${field}[${index}] must be a string`);
    }
    if (pattern && !pattern.test(entry)) {
      throw new Error(`${field}[${index}] has an invalid name`);
    }
    if (!pattern && entry.trim().length === 0) {
      throw new Error(`${field}[${index}] must be nonempty`);
    }
    return entry;
  });
}

export function validateModuleDef(def) {
  if (def === null || typeof def !== 'object' || Array.isArray(def)) {
    throw new Error('def must be an object');
  }

  if (typeof def.id !== 'string' || !MODULE_ID_PATTERN.test(def.id)) {
    throw new Error('id must match /^[a-z][a-z0-9-]*$/');
  }
  if (typeof def.version !== 'string' || def.version.trim().length === 0) {
    throw new Error('version must be a nonempty string');
  }
  if (!Number.isSafeInteger(def.schemaVersion) || def.schemaVersion < 1) {
    throw new Error('schemaVersion must be a positive safe integer');
  }

  const capabilities = requireStringArray(def.capabilities, 'capabilities');
  const tools = requireStringArray(def.tools, 'tools', TOOL_NAME_PATTERN);
  const commands = requireStringArray(def.commands, 'commands');

  if (typeof def.activate !== 'function') {
    throw new Error('activate must be a function');
  }
  if (def.migrate !== undefined && typeof def.migrate !== 'function') {
    throw new Error('migrate must be a function when provided');
  }

  const result = {
    id: def.id,
    version: def.version,
    schemaVersion: def.schemaVersion,
    capabilities,
    tools,
    commands,
    activate: def.activate,
  };
  if (def.migrate !== undefined) {
    result.migrate = def.migrate;
  }

  return result;
}
