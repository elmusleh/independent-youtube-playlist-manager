const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(__dirname, "../../..");
const ts = require(
  path.join(root, "apps/browser-extension/playlist-manager/node_modules/typescript")
);
const apiFiles = [
  "shared/storage-client.js",
  "background/library-mutations.js",
  "background/capture-jobs.js",
  "background/capture-controller.js",
  "background/capture-import.js",
  "background/capture-remote.js",
];
const extension = path.join(root, "apps/browser-extension");
function protocolProgram(includeFixtures = false) {
  const options = {
    allowJs: true,
    checkJs: false,
    strict: true,
    noImplicitAny: false,
    useUnknownInCatchVariables: false,
    skipLibCheck: false,
    declaration: true,
    emitDeclarationOnly: true,
    noEmitOnError: false,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    rootDir: root,
    outDir: path.join(root, ".protocol-generated"),
    types: ["firefox-webext-browser"],
    typeRoots: [path.join(root, "node_modules/@types")],
  };
  const files = apiFiles.map((file) => path.join(extension, file));
  files.push(
    path.join(extension, "shared/protocol-contracts.ts"),
    path.join(__dirname, "environment.d.ts")
  );
  if (includeFixtures) files.push(path.join(__dirname, "contract-fixtures.ts"));
  const host = ts.createCompilerHost(options);
  // Check the actual JS, never the adjacent declaration being generated.
  host.resolveModuleNames = (names, containing) =>
    names.map((name) => {
      const candidate = path.resolve(path.dirname(containing), name);
      if (
        name.startsWith(".") &&
        candidate.endsWith(".js") &&
        fs.existsSync(candidate) &&
        candidate.startsWith(extension + path.sep)
      )
        return { resolvedFileName: candidate, extension: ts.Extension.Js };
      return ts.resolveModuleName(name, containing, options, host).resolvedModule;
    });
  return ts.createProgram(files, options, host);
}
module.exports = { root, ts, extension, apiFiles, protocolProgram };
