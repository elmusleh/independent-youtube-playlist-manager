import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "apps/browser-extension/editor/**",
      "apps/browser-extension/assets/browser-polyfill.min.js",
      "apps/browser-extension/playlist-manager/**",
      "apps/web-portal/**",
    ],
  },
  {
    files: ["apps/browser-extension/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        browser: "readonly",
        chrome: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
      "prefer-const": "error",
      "no-var": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "AssignmentExpression[left.type='MemberExpression'][left.property.name='window']",
          message:
            'Do not assign `.window = ...` directly; Firefox Window contexts define `window` as a getter-only property. Centralize the ServiceWorker polyfill in `background/init.js` guarded by `typeof globalThis.window === "undefined"`.',
        },
      ],
    },
  },
  {
    files: ["apps/browser-extension/background/init.js"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["packages/build-tools/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    files: [
      "packages/build-tools/sync-version.mjs",
      "packages/build-tools/*.test.js",
      "packages/build-tools/agent-lock.js",
      "packages/build-tools/orchestration/**/*.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
];
