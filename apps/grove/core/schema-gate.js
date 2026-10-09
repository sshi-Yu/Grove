// Schema migration gate shared by the lifecycle engine and the standalone
// entry: no stored record -> record the current version; a lower stored
// version -> migrate(from, api) then record; a higher stored version is a
// downgrade and fails with SCHEMA_NEWER. Failures surface as MIGRATION_FAILED
// with the old record left untouched.

export async function runSchemaGate(def, store, api) {
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
