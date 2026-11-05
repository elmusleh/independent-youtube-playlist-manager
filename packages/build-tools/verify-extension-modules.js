/* eslint-disable no-console */
/** Catch missing runtime folders before packaging; bundling the SPA cannot catch these. */
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");

/** JSDoc type imports are erased at runtime, so they must not count as module edges. */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Relative import specifiers that actually execute. */
function relativeImports(source) {
  const code = withoutComments(source);
  const found = [];
  for (const match of code.matchAll(
    /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)(['"])(\.{1,2}\/[^"']+)\1/g
  )) {
    if (!match[2].endsWith(".css")) found.push(match[2]);
  }
  return found;
}

function verifyTarget(target) {
  const base = path.join(root, "dist", target);
  const visited = new Set();
  function visit(relative) {
    const filename = path.resolve(base, relative);
    if (!filename.startsWith(base + path.sep))
      throw new Error(`Module escapes extension: ${relative}`);
    if (!fs.existsSync(filename)) throw new Error(`${target}: missing module ${relative}`);
    if (visited.has(filename)) return;
    visited.add(filename);
    for (const imported of relativeImports(fs.readFileSync(filename, "utf8"))) {
      visit(path.relative(base, path.resolve(path.dirname(filename), imported)));
    }
  }
  for (const entry of ["background/index.js", "popup/popup.js", "editor/main.js"]) visit(entry);
  return visited.size;
}

function main() {
  for (const target of ["chrome", "firefox", "edge"]) {
    console.log(`${target}: ${verifyTarget(target)} reachable runtime modules exist.`);
  }
}

module.exports = { relativeImports, verifyTarget, withoutComments };

if (require.main === module) main();
