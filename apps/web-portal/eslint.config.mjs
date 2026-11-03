import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    // Playwright fixtures receive an argument literally named `use`, which
    // react-hooks/rules-of-hooks reports as a hook called outside a component.
    // E2E specs are not app code, so that rule does not apply to them.
    files: ["e2e/**/*.ts", "e2e/**/*.cjs", "e2e/**/*.mjs", "e2e/**/*.js"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    ignores: ["e2e/test-results/**", "playwright-report/**"],
  },
];

export default eslintConfig;
