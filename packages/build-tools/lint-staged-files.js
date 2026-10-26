const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const portal = path.join(root, "apps/web-portal");
const files = process.argv.slice(2);
const portalFiles = files.filter((file) => file.startsWith(portal + path.sep));
const shellFiles = files.filter(
  (file) =>
    !file.startsWith(portal + path.sep) &&
    /\.(?:js|mjs)$/.test(file) &&
    !file.includes(`${path.sep}playlist-manager${path.sep}`)
);

// Each app must use its own ESLint version/configuration. Extension TypeScript
// and Svelte are validated by npm run check rather than the shell's JS linter.
for (const [directory, selected] of [
  [root, shellFiles],
  [portal, portalFiles],
]) {
  if (!selected.length) continue;
  const result = spawnSync(
    path.join(directory, "node_modules/.bin/eslint"),
    ["--fix", ...selected],
    { cwd: directory, stdio: "inherit" }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    break;
  }
}
