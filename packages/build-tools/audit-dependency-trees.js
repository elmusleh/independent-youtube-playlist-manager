/* eslint-disable no-console */
/** Advisory triage only: never installs or upgrades dependencies. */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const output = path.join(root, "dist/verification/dependency-audit.json");
const report = { generatedAt: new Date().toISOString(), trees: [] };
let failures = false;
for (const directory of [".", "apps/browser-extension/playlist-manager", "apps/web-portal"]) {
  const tree = { directory, scopes: {} };
  for (const [scope, flags] of [
    ["all", []],
    ["production", ["--omit=dev"]],
  ]) {
    const result = spawnSync("npm", ["audit", "--json", ...flags], {
      cwd: path.resolve(root, directory),
      encoding: "utf8",
      timeout: 90000,
    });
    let audit;
    try {
      audit = JSON.parse(result.stdout);
    } catch {
      throw new Error(
        `Audit unavailable for ${directory} (${scope}). No dependencies were changed.`
      );
    }
    if (result.error || audit.error)
      throw new Error(`Audit unavailable for ${directory} (${scope}). Retry with registry access.`);
    const vulnerabilities = Object.values(audit.vulnerabilities || {}).map((entry) => ({
      name: entry.name,
      severity: entry.severity,
      direct: entry.isDirect,
      range: entry.range,
      fixAvailable: entry.fixAvailable,
      via: entry.via,
      nodes: entry.nodes,
    }));
    tree.scopes[scope] = { counts: audit.metadata?.vulnerabilities || {}, vulnerabilities };
    if (vulnerabilities.some((entry) => ["high", "critical"].includes(entry.severity)))
      failures = true;
    console.log(
      `${directory} (${scope}): ${JSON.stringify(audit.metadata?.vulnerabilities || {})}`
    );
  }
  report.trees.push(tree);
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(`Saved triage report: ${output}`);
if (failures) process.exitCode = 1;
