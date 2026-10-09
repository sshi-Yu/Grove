import { defineApp } from "./sdk/app-contract/server-client.js";

import { createLifecycle } from "./core/lifecycle.js";
import { createRegistry } from "./core/registry.js";
import { createStateStore } from "./core/state-store.js";
import { createHostPort } from "./host/ports.js";
import { registerRoutes } from "./host/routes.js";
import { modules, planned } from "./modules/index.js";

export const name = "grove";

export default defineApp(async (sdk) => {
  const port = createHostPort(sdk);
  const store = createStateStore(port.storage);
  const registry = createRegistry({ modules, planned });
  const lifecycle = createLifecycle({ registry, store, port });

  await sdk.routes.register((app) => registerRoutes(app, { lifecycle, store }));
  await lifecycle.restore();
});
