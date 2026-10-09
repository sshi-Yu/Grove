import { validateModuleDef } from './module-contract.js';

export function createRegistry({ modules, planned }) {
  if (!Array.isArray(modules)) {
    throw new Error('modules must be an array');
  }
  if (!Array.isArray(planned)) {
    throw new Error('planned must be an array');
  }

  const validatedModules = modules.map(validateModuleDef);
  const moduleIds = new Set();
  for (const module of validatedModules) {
    if (moduleIds.has(module.id)) {
      throw new Error(`duplicate module id: ${module.id}`);
    }
    moduleIds.add(module.id);
  }

  const plannedEntries = planned.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`planned[${index}] must be an object`);
    }
    if (typeof entry.id !== 'string' || entry.id.length === 0) {
      throw new Error(`planned[${index}].id must be a nonempty string`);
    }
    if (moduleIds.has(entry.id)) {
      throw new Error(`planned id collides with module id: ${entry.id}`);
    }
    return Object.freeze({ ...entry });
  });

  const frozenModules = validatedModules.map((module) => {
    Object.freeze(module.capabilities);
    Object.freeze(module.tools);
    Object.freeze(module.commands);
    return Object.freeze(module);
  });
  const frozenPlanned = Object.freeze(plannedEntries);
  const frozenModuleList = Object.freeze(frozenModules);
  const modulesById = new Map(frozenModules.map((module) => [module.id, module]));
  const plannedIds = new Set(plannedEntries.map(({ id }) => id));

  return Object.freeze({
    modules: frozenModuleList,
    planned: frozenPlanned,
    get(id) {
      return modulesById.get(id);
    },
    isPlanned(id) {
      return plannedIds.has(id);
    },
    capabilityUnion() {
      return [...new Set(frozenModules.flatMap(({ capabilities }) => capabilities))].sort();
    },
  });
}
