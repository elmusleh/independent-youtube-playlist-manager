const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const config = { ...process.env };
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(AMO_API_KEY|AMO_API_SECRET)\s*=\s*(.*?)\s*$/);
    if (match && !config[match[1]]) config[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}
if (!config.AMO_API_KEY || !config.AMO_API_SECRET)
  throw new Error("Configure AMO_API_KEY and AMO_API_SECRET before publishing.");
for (const file of ["dist/firefox/manifest.json", "dist/source-code.zip"]) {
  if (!fs.existsSync(path.join(root, file)))
    throw new Error(`Missing ${file}; build the release and archive its committed source first.`);
}
// Credentials are passed only in the child environment, never in command arguments.
const result = spawnSync(
  "npx",
  [
    "--yes",
    "web-ext@10.8.0",
    "sign",
    "--no-config-discovery",
    "--no-input",
    "--source-dir=dist/firefox",
    "--artifacts-dir=dist/amo",
    "--channel=listed",
    "--upload-source-code=dist/source-code.zip",
    "--amo-metadata=docs/firefox-release-metadata.json",
    "--approval-timeout=0",
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      WEB_EXT_API_KEY: config.AMO_API_KEY,
      WEB_EXT_API_SECRET: config.AMO_API_SECRET,
    },
    stdio: "inherit",
  }
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
