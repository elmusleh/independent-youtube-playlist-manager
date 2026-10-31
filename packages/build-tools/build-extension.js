/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const target = process.argv[2];
if (!["chrome", "firefox", "edge"].includes(target))
  throw new Error("Expected chrome, firefox, or edge.");
const root = path.resolve(__dirname, "../..");
const source = path.join(root, "apps/browser-extension");
if (fs.existsSync(path.join(source, "manifest.json")))
  throw new Error(
    "Remove the generated manifest.json from apps/browser-extension before building."
  );
const destination = path.join(root, "dist", target);
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
for (const directory of ["assets", "background", "content-scripts", "editor", "popup", "shared"]) {
  fs.cpSync(path.join(source, directory), path.join(destination, directory), {
    recursive: true,
    filter: (file) => !file.endsWith(".d.ts") && !file.endsWith(".map"),
  });
}
const destinationManifest = path.join(destination, "manifest.json");
if (target === "edge") {
  // Edge is Chromium-based: derive its manifest from Chrome and strip fields
  // that are Chrome/Firefox-specific or undesirable for Edge Add-ons.
  const edgeManifest = JSON.parse(
    fs.readFileSync(path.join(source, "manifest.chrome.json"), "utf8")
  );
  delete edgeManifest.key;
  delete edgeManifest.browser_specific_settings;
  fs.writeFileSync(destinationManifest, `${JSON.stringify(edgeManifest, null, 2)}\n`);
} else {
  fs.copyFileSync(path.join(source, `manifest.${target}.json`), destinationManifest);
}
console.log(`Built ${target} package from generated assets and extension runtime files.`);
