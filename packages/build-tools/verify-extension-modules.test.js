import { describe, expect, it } from "vitest";
import { relativeImports } from "./verify-extension-modules.js";

describe("Extension module verification", () => {
  it("ignores JSDoc type imports, which are erased at runtime", () => {
    const source = `
/** @param {import("../shared/protocol-contracts.js").SourceAnchor} anchor */
export function start(anchor) { return anchor; }
`;
    expect(relativeImports(source)).toEqual([]);
  });

  it("still reports real relative imports in the same file", () => {
    const source = `
/** @param {import("../shared/protocol-contracts.js").SourceAnchor} anchor */
import { helper } from "./helper.js";
export function start(anchor) { return helper(anchor); }
`;
    expect(relativeImports(source)).toEqual(["./helper.js"]);
  });

  it("ignores line comments and stylesheets", () => {
    const source = `// import "./commented-out.js"\nimport "./theme.css";\nimport "./real.js";`;
    expect(relativeImports(source)).toEqual(["./real.js"]);
  });

  it("keeps absolute-looking urls from being treated as comments", () => {
    const source = `const url = "https://example.com/x";\nimport "../shared/quick-add.js";`;
    expect(relativeImports(source)).toEqual(["../shared/quick-add.js"]);
  });

  it("finds dynamic imports", () => {
    expect(relativeImports('const mod = await import("./lazy.js");')).toEqual(["./lazy.js"]);
  });
});
