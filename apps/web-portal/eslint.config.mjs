import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Playwright fixtures receive an argument literally named `use`, which
    // react-hooks/rules-of-hooks reports as a hook called outside a component.
    // E2E specs are not app code, so that rule does not apply to them.
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    ignores: ["e2e/test-results/**", "playwright-report/**"],
  },
];

export default eslintConfig;
