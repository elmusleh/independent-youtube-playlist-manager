/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { digest } = require("./inventory-data.js");
const root = path.resolve(__dirname, "../..");
const manifestPath = path.join(root, "dist/chrome/editor/bundle-dependencies.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (digest(fs.readFileSync(path.join(root, manifest.lockfile))) !== manifest.lockfileSha256)
  throw new Error("Bundle inventory is stale: rebuild before triage.");
for (const chunk of manifest.chunks) {
  if (digest(fs.readFileSync(path.join(root, "dist/chrome/editor", chunk.file))) !== chunk.sha256)
    throw new Error(`Bundle chunk changed: ${chunk.file}`);
}
const audit = JSON.parse(
  fs.readFileSync(path.join(root, "dist/verification/dependency-audit.json"), "utf8")
);
const findings = audit.trees.flatMap((tree) =>
  tree.scopes.all.vulnerabilities.map((finding) => {
    const matching =
      tree.directory === "apps/browser-extension/playlist-manager"
        ? manifest.packages.filter(
            (pkg) =>
              pkg.name === finding.name &&
              finding.nodes.some((node) => pkg.installPath === `${tree.directory}/${node}`)
          )
        : [];
    return {
      tree: tree.directory,
      name: finding.name,
      severity: finding.severity,
      classification: matching.length
        ? "rendered-extension-javascript"
        : "not-observed-or-outside-inventory-scope",
      versions: matching.map((pkg) => pkg.version),
      chunks: [...new Set(matching.flatMap((pkg) => pkg.chunks))],
    };
  })
);
const report = {
  schemaVersion: 1,
  inventorySha256: digest(fs.readFileSync(manifestPath)),
  auditGeneratedAt: audit.generatedAt,
  scope: manifest.scope,
  findings,
};
const output = path.join(root, "dist/verification/bundle-audit.json");
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(`Bundle-aware triage: ${output}. Not-observed is not a security clearance.`);
