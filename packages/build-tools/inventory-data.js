const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
function packageForModule(id, root) {
  if (id.startsWith("\0")) return null;
  const normalized = id.replaceAll("\\", "/").split("?")[0];
  const marker = normalized.lastIndexOf("/node_modules/");
  if (marker < 0) return null;
  const parts = normalized.slice(marker + 14).split("/");
  const name = parts[0].startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
  const directory = normalized.slice(0, marker + 14) + name;
  const filename = path.join(directory, "package.json");
  if (!fs.existsSync(filename)) return null;
  const pkg = JSON.parse(fs.readFileSync(filename, "utf8"));
  return {
    name: pkg.name,
    version: pkg.version,
    installPath: path.relative(root, directory).replaceAll(path.sep, "/"),
  };
}
function inventoryForBundle(bundle, root) {
  const packages = new Map();
  const chunks = [];
  for (const [name, chunk] of Object.entries(bundle)) {
    if (chunk.type !== "chunk") continue;
    chunks.push({ file: name, sha256: digest(chunk.code) });
    for (const [id, details] of Object.entries(chunk.modules)) {
      if (details.renderedLength === 0) continue;
      const pkg = packageForModule(id, root);
      if (!pkg) continue;
      const key = `${pkg.installPath}@${pkg.version}`;
      if (!packages.has(key)) packages.set(key, { ...pkg, chunks: new Set(), modules: new Set() });
      packages.get(key).chunks.add(name);
      packages.get(key).modules.add(path.relative(root, id).replaceAll(path.sep, "/"));
    }
  }
  const lockfile = "apps/browser-extension/playlist-manager/package-lock.json";
  return {
    schemaVersion: 1,
    scope: "Rendered extension JavaScript; CSS, static scripts and portal require separate review",
    lockfile,
    lockfileSha256: digest(fs.readFileSync(path.join(root, lockfile))),
    chunks: chunks.sort((a, b) => a.file.localeCompare(b.file)),
    packages: [...packages.values()]
      .map((pkg) => ({ ...pkg, chunks: [...pkg.chunks].sort(), modules: [...pkg.modules].sort() }))
      .sort((a, b) => a.installPath.localeCompare(b.installPath)),
  };
}
module.exports = { packageForModule, inventoryForBundle, digest };
