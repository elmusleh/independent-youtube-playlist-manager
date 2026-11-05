import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import {
  SyncError,
  currentBranch,
  fetchTarget,
  getDirty,
  isAncestor,
  resolveCommit,
  syncTargetIntoBranch,
} from "./sync.js";

function sh(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
}

function configure(path, name = "Sync Test") {
  sh(path, ["config", "user.email", "sync@test.local"]);
  sh(path, ["config", "user.name", name]);
}

function commitFile(path, file, content, message) {
  fs.writeFileSync(join(path, file), content);
  sh(path, ["add", file]);
  sh(path, ["commit", "-q", "-m", message]);
}

/**
 * origin (bare) + next seeded + a feature branch cloned from it.
 */
function createFixture() {
  const root = fs.mkdtempSync(join("/tmp", "sync-test-"));
  const originPath = join(root, "origin.git");
  fs.mkdirSync(originPath);
  sh(originPath, ["init", "--bare", "-q", "--initial-branch=next"]);

  const seedPath = join(root, "seed");
  sh(root, ["clone", "-q", originPath, seedPath]);
  configure(seedPath);
  commitFile(seedPath, "app.txt", "base\n", "base commit");
  fs.writeFileSync(join(seedPath, "shared.txt"), "line one\nline two\n");
  sh(seedPath, ["add", "shared.txt"]);
  sh(seedPath, ["commit", "-q", "-m", "add shared"]);
  sh(seedPath, ["push", "-q", "-u", "origin", "next"]);

  const featurePath = join(root, "feature");
  sh(root, ["clone", "-q", "-b", "next", originPath, featurePath]);
  configure(featurePath);
  sh(featurePath, ["checkout", "-q", "-b", "feat/job-1"]);
  commitFile(featurePath, "feature.txt", "feature work\n", "feature commit");

  const otherPath = join(root, "other");
  sh(root, ["clone", "-q", "-b", "next", originPath, otherPath]);
  configure(otherPath);

  return { root, originPath, featurePath, otherPath };
}

function advanceTarget(fixture, file, content, message) {
  commitFile(fixture.otherPath, file, content, message);
  sh(fixture.otherPath, ["push", "-q", "origin", "next"]);
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

let fixture;

beforeEach(() => {
  fixture = createFixture();
});

afterEach(() => {
  cleanup(fixture.root);
});

describe("Sync - clean target update", () => {
  it("merges origin/next into the feature branch without switching branches", () => {
    advanceTarget(fixture, "target.txt", "target work\n", "target advance");
    const headBefore = resolveCommit(fixture.featurePath, "HEAD");
    const targetBefore = resolveCommit(fixture.featurePath, "origin/next");

    const result = syncTargetIntoBranch({
      repoRoot: fixture.featurePath,
      remote: "origin",
      target: "next",
      expectedBranch: "feat/job-1",
    });

    expect(result.status).toBe("updated");
    expect(result.branch).toBe("feat/job-1");
    expect(currentBranch(fixture.featurePath)).toBe("feat/job-1");
    expect(result.target).not.toBe(targetBefore);

    // The reviewed feature head is preserved as an ancestor (merge, not rebase).
    expect(isAncestor(fixture.featurePath, headBefore, result.head)).toBe(true);

    // Both sides are present and the merge commit has two parents.
    expect(fs.readFileSync(join(fixture.featurePath, "target.txt"), "utf-8")).toBe("target work\n");
    expect(fs.readFileSync(join(fixture.featurePath, "feature.txt"), "utf-8")).toBe(
      "feature work\n"
    );
    const parents = sh(fixture.featurePath, ["rev-list", "--parents", "-n", "1", result.head])
      .split(" ")
      .slice(1);
    expect(parents).toHaveLength(2);
  });

  it("reports up-to-date when the target has not advanced", () => {
    const result = syncTargetIntoBranch({
      repoRoot: fixture.featurePath,
      remote: "origin",
      target: "next",
      expectedBranch: "feat/job-1",
    });

    expect(result.status).toBe("up-to-date");
    expect(result.mergeCommit).toBeNull();
  });

  it("re-checks after a second advance instead of reusing a stale target", () => {
    advanceTarget(fixture, "one.txt", "1\n", "advance one");
    const first = syncTargetIntoBranch({
      repoRoot: fixture.featurePath,
      remote: "origin",
      target: "next",
      expectedBranch: "feat/job-1",
    });
    expect(first.status).toBe("updated");

    advanceTarget(fixture, "two.txt", "2\n", "advance two");
    const second = syncTargetIntoBranch({
      repoRoot: fixture.featurePath,
      remote: "origin",
      target: "next",
      expectedBranch: "feat/job-1",
    });

    expect(second.status).toBe("updated");
    expect(second.target).not.toBe(first.target);
    expect(fs.existsSync(join(fixture.featurePath, "two.txt"))).toBe(true);
  });
});

describe("Sync - conflicts block without rewriting history", () => {
  it("aborts the merge, keeps the branch and reports conflicted files", () => {
    commitFile(
      fixture.featurePath,
      "shared.txt",
      "line one\nfeature change\n",
      "feature edits shared"
    );
    advanceTarget(fixture, "shared.txt", "line one\ntarget change\n", "target edits shared");

    const headBefore = resolveCommit(fixture.featurePath, "HEAD");
    const result = syncTargetIntoBranch({
      repoRoot: fixture.featurePath,
      remote: "origin",
      target: "next",
      expectedBranch: "feat/job-1",
    });

    expect(result.status).toBe("conflict");
    expect(result.files).toContain("shared.txt");
    expect(result.restoredHead).toBe(headBefore);
    expect(resolveCommit(fixture.featurePath, "HEAD")).toBe(headBefore);
    expect(currentBranch(fixture.featurePath)).toBe("feat/job-1");
    expect(fs.existsSync(join(fixture.featurePath, ".git", "MERGE_HEAD"))).toBe(false);

    // The feature's own content survives untouched.
    expect(fs.readFileSync(join(fixture.featurePath, "shared.txt"), "utf-8")).toContain(
      "feature change"
    );
  });
});

describe("Sync - refusals", () => {
  it("refuses to sync a dirty worktree and preserves the edits", () => {
    fs.writeFileSync(join(fixture.featurePath, "unrelated-local.txt"), "do not touch\n");

    expect(() =>
      syncTargetIntoBranch({
        repoRoot: fixture.featurePath,
        remote: "origin",
        target: "next",
        expectedBranch: "feat/job-1",
      })
    ).toThrow(SyncError);

    expect(getDirty(fixture.featurePath).dirty).toBe(true);
    expect(fs.readFileSync(join(fixture.featurePath, "unrelated-local.txt"), "utf-8")).toBe(
      "do not touch\n"
    );
  });

  it("refuses the wrong branch", () => {
    expect(() =>
      syncTargetIntoBranch({
        repoRoot: fixture.featurePath,
        remote: "origin",
        target: "next",
        expectedBranch: "feat/other-job",
      })
    ).toThrow(/expected 'feat\/other-job'/);
    expect(currentBranch(fixture.featurePath)).toBe("feat/job-1");
  });

  it("refuses an unconfigured remote", () => {
    expect(() =>
      syncTargetIntoBranch({
        repoRoot: fixture.featurePath,
        remote: "upstream",
        target: "next",
        expectedBranch: "feat/job-1",
      })
    ).toThrow(/Remote 'upstream' is not configured/);
  });

  it("refuses to sync the target branch into itself", () => {
    sh(fixture.featurePath, ["checkout", "-q", "next"]);
    expect(() =>
      syncTargetIntoBranch({
        repoRoot: fixture.featurePath,
        remote: "origin",
        target: "next",
        expectedBranch: "next",
      })
    ).toThrow(/integration target/);
    expect(currentBranch(fixture.featurePath)).toBe("next");
  });

  it("refuses a fetch from a missing target branch", () => {
    expect(() =>
      fetchTarget({ repoRoot: fixture.featurePath, remote: "origin", target: "does-not-exist" })
    ).toThrow(/Could not fetch/);
  });
});
