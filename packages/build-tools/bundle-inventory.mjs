import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

// Rollup only applies the CommonJS plugin to node_modules, so a static default import of
// our own CJS helper fails the build. Load it through Node's interop instead.
const require = createRequire(import.meta.url);
const inventory = require("./inventory-data.js");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export function bundleInventory() {
  return {
    name: "iypm-bundle-inventory",
    generateBundle(_options, bundle) {
      this.emitFile({
        type: "asset",
        fileName: "bundle-dependencies.json",
        source: JSON.stringify(inventory.inventoryForBundle(bundle, root), null, 2) + "\n",
      });
    },
  };
}
