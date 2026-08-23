import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import copy from "rollup-plugin-copy";
import css from "rollup-plugin-css-only";
import svelte from "rollup-plugin-svelte";
import terser from "@rollup/plugin-terser";
import sveltePreprocess from "svelte-preprocess";

const production = process.env.PRODUCTION;

export default {
  input: {
    main: "src/main.ts",
    "youtube-auth": "src/services/youtube-auth.ts",
    "youtube-api": "src/services/youtube-api.ts",
    "storage-service": "src/services/storage-service.ts",
    "video-service": "src/services/video-service.ts",
    "utils": "src/services/utils.ts",
    "sync-state-service": "src/services/sync-state-service.ts",
    "supabase-client": "src/services/supabase-client.ts",
    "supabase-sync": "src/services/supabase-sync.ts",
  },
  onwarn: (warning, handler) => {
    if (warning.code === "CIRCULAR_DEPENDENCY" && warning.message.includes("node_modules/svelte/")) {
      return;
    }
    handler(warning);
  },
  output: {
    sourcemap: !production,
    format: "es",
    name: "app",
    dir: production ? "../src/editor/" : "public/build/",
    entryFileNames: "[name].js",
    chunkFileNames: "chunks/[name]-[hash].js",
  },
  plugins: [
    replace({
      preventAssignment: true,
      "import.meta.env.DEV": JSON.stringify(!production),
      "import.meta.env.PROD": JSON.stringify(production),
      "import.meta.env.MODE": JSON.stringify(production ? "production" : "development"),
    }),
    svelte({
      include: ["src/**/*.svelte", "src/**/*.svelte.ts", "src/**/*.svelte.js"],
      preprocess: sveltePreprocess({ sourceMap: !production, typescript: true }),
      compilerOptions: {
        dev: !production,
        runes: true,
      },
      onwarn: (warning, handler) => {
        if (warning.filename?.includes("node_modules")) return;
        if (warning.code === "a11y-no-onchange") return;
        handler(warning);
      },
    }),
    svelte({
      include: "node_modules/svelte-spa-router/**/*.svelte",
      compilerOptions: {
        dev: !production,
        runes: true,
      },
      onwarn: (warning, handler) => {
        if (warning.code && (warning.code.startsWith("a11y-") || warning.code.startsWith("a11y_"))) return;
        handler(warning);
      },
    }),
    svelte({
      include: [
        "node_modules/svelte-fa/**/*.svelte",
        "node_modules/svelte-paginate/**/*.svelte"
      ],
      compilerOptions: {
        dev: !production,
      },
      onwarn: (warning, handler) => {
        if (warning.code && (warning.code.startsWith("a11y-") || warning.code.startsWith("a11y_"))) return;
        handler(warning);
      },
    }),
    // we'll extract any component CSS out into
    // a separate file - better for performance
    css({ output: "bundle.css" }),
    resolve({
      browser: true,
      dedupe: ["svelte"],
      exportConditions: ["svelte", "browser", "production"],
    }),
    commonjs({
      include: /node_modules/,
    }),
    typescript({
      sourceMap: !production,
      inlineSources: !production,
    }),
    production && terser(),
    production && copy({
      targets: [
        { src: "public/global.css", dest: "../src/editor" },
      ],
    }),
  ],
};