/* eslint-disable no-console */
/** Catch missing runtime folders before packaging; bundling the SPA cannot catch these. */
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
for (const target of ["chrome", "firefox", "edge"]) {
  const base = path.join(root, "dist", target);
  const visited = new Set();
  function visit(relative) {
    const filename = path.resolve(base, relative);
    if (!filename.startsWith(base + path.sep))
      throw new Error(`Module escapes extension: ${relative}`);
    if (!fs.existsSync(filename)) throw new Error(`${target}: missing module ${relative}`);
    if (visited.has(filename)) return;
    visited.add(filename);
    const source = fs.readFileSync(filename, "utf8");
    for (const match of source.matchAll(
      /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)(['"])(\.{1,2}\/[^"']+)\1/g
    )) {
      const imported = match[2];
      if (imported.endsWith(".css")) continue;
      visit(path.relative(base, path.resolve(path.dirname(filename), imported)));
    }
  }
  for (const entry of ["background/index.js", "popup/popup.js", "editor/main.js"]) visit(entry);
  console.log(`${target}: ${visited.size} reachable runtime modules exist.`);
}
