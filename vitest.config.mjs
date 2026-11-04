import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.mjs"],
    include: [
      "apps/browser-extension/playlist-manager/src/**/*.{test,spec}.{js,ts}",
      "packages/build-tools/**/*.{test,spec}.{js,ts}",
    ],
    exclude: [
      "**/e2e-relay.test.ts",
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
    ],
    passWithNoTests: true,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "html"],
    },
  },
});
