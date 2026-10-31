import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import inventory from "./inventory-data.js";
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
