import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { createRegistry } from '../core/registry.js';
import { modules, planned } from '../modules/index.js';

export function checkModules({ registry, manifest }) {
  if (registry === null || typeof registry !== 'object') {
    throw new Error('registry must be an object');
  }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('manifest must be an object');
  }

  const errors = [];

  const ownersByToolName = new Map();
  const ownersByCommandName = new Map();
  const modulesByCapability = new Map();

  for (const module of registry.modules) {
    const localTools = new Set();
    for (const name of module.tools) {
      if (localTools.has(name)) {
        errors.push(`module "${module.id}" declares duplicate local tool name "${name}"`);
      }
      localTools.add(name);

      const derivedTool = `grove_${module.id}_${name}`;
      const toolOwners = ownersByToolName.get(derivedTool) ?? [];
      toolOwners.push(module.id);
      ownersByToolName.set(derivedTool, toolOwners);
    }

    for (const name of module.commands) {
      const derivedCommand = `grove-${module.id}-${name}`;
      const commandOwners = ownersByCommandName.get(derivedCommand) ?? [];
      commandOwners.push(module.id);
      ownersByCommandName.set(derivedCommand, commandOwners);
    }

    for (const capability of module.capabilities) {
      const requiring = modulesByCapability.get(capability) ?? [];
      requiring.push(module.id);
      modulesByCapability.set(capability, requiring);
    }
  }

  for (const [derivedTool, owners] of ownersByToolName) {
    if (owners.length > 1) {
      const ownerList = owners.map((id) => `"${id}"`).join(', ');
      errors.push(`duplicate derived tool name "${derivedTool}" (declared by: ${ownerList})`);
    }
  }
  for (const [derivedCommand, owners] of ownersByCommandName) {
    if (owners.length > 1) {
      const ownerList = owners.map((id) => `"${id}"`).join(', ');
      errors.push(`duplicate derived command name "${derivedCommand}" (declared by: ${ownerList})`);
    }
  }

  const declaredCapabilities = manifest.capabilities;
  if (!Array.isArray(declaredCapabilities)) {
    errors.push('manifest.capabilities must be an array of strings');
  } else {
    const declared = new Set(declaredCapabilities);
    for (const capability of registry.capabilityUnion()) {
      if (!declared.has(capability)) {
        const requiring = modulesByCapability.get(capability).map((id) => `"${id}"`).join(', ');
        errors.push(`manifest.capabilities missing "${capability}" (required by: ${requiring})`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function main() {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const registry = createRegistry({ modules, planned });
  const { ok, errors } = checkModules({ registry, manifest });

  if (!ok) {
    for (const error of errors) {
      console.error(`error: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `check:modules: ok (${registry.modules.length} modules, `
      + `${registry.capabilityUnion().length} required capabilities)`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
