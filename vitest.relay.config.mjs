import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.mjs"],
    include: ["apps/browser-extension/playlist-manager/src/services/sync/e2e-relay.test.ts"],
    passWithNoTests: false,
  },
});
