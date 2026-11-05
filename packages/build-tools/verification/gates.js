const path = require("node:path");
const gates = {
  check: ["npm", ["run", "check"]],
  build: ["npm", ["run", "build"]],
  contracts: ["npm", ["run", "contracts:check"]],
  extension: ["npm", ["run", "test:extension"]],
  mutations: ["npm", ["run", "test:capture-mutations"]],
  audit: ["npm", ["run", "audit:all"]],
  "web-build": ["npm", ["--prefix", "apps/web-portal", "run", "build"]],
  headed: [
    "xvfb-run",
    ["-a", "npm", "--prefix", "apps/web-portal", "run", "test:e2e:required"],
    { HEADED: "true", IYPM_REQUIRE_EXTENSION_E2E: "1" },
  ],
  "firefox-lint": ["web-ext", ["lint", "--source-dir", "dist/firefox"]],
};
function commandForGate(name, root) {
  if (!Object.hasOwn(gates, name))
    throw new Error(`Unknown verification gate. Choose: ${Object.keys(gates).join(", ")}`);
  const [command, args, environment] = gates[name];
  return {
    command: command === "web-ext" ? path.join(root, "node_modules/.bin/web-ext") : command,
    args,
    environment: environment || {},
  };
}
module.exports = { commandForGate };
