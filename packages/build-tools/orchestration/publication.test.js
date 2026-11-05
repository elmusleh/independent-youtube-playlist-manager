import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import {
  PublicationError,
  commitScoped,
  createOrUpdateDraftPr,
  normalizeOwnedPaths,
  publishJob,
  pushFeatureBranch,
} from "./publication.js";

function sh(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
}

function configure(path, name = "Publication Test") {
  sh(path, ["config", "user.email", "pub@test.local"]);
  sh(path, ["config", "user.name", name]);
}

function makeFixture() {
  const root = fs.mkdtempSync(join("/tmp", "publication-test-"));
  const originPath = join(root, "origin.git");
  fs.mkdirSync(originPath);
  sh(originPath, ["init", "--bare", "-q", "--initial-branch=next"]);

  const seed = join(root, "seed");
  sh(root, ["clone", "-q", originPath, seed]);
  configure(seed);
  fs.writeFileSync(join(seed, "app.txt"), "base\n");
  sh(seed, ["add", "app.txt"]);
  sh(seed, ["commit", "-q", "-m", "base"]);
  sh(seed, ["push", "-q", "-u", "origin", "next"]);

  const work = join(root, "work");
  sh(root, ["clone", "-q", "-b", "next", originPath, work]);
  configure(work);
  sh(work, ["checkout", "-q", "-b", "feat/job-1"]);
  fs.writeFileSync(join(work, "feature.txt"), "feature\n");
  sh(work, ["add", "feature.txt"]);
  sh(work, ["commit", "-q", "-m", "feature work"]);

  return { root, originPath, work };
}

function fakeGithub({ existing = null } = {}) {
  const calls = [];
  return {
    calls,
    async findPr(request) {
      calls.push({ fn: "findPr", request });
      return existing;
    },
    async createPr(request) {
      calls.push({ fn: "createPr", request });
      return { number: 42, ...request };
    },
    async updatePr(request) {
      calls.push({ fn: "updatePr", request });
      return { number: request.number, title: request.title, body: request.body, draft: true };
    },
  };
}

let fixture;

beforeEach(() => {
  fixture = makeFixture();
});

afterEach(() => {
  fs.rmSync(fixture.root, { recursive: true, force: true });
});

describe("Publication - scoped staging", () => {
  it("stages and commits only explicit owned paths", () => {
    fs.writeFileSync(join(fixture.work, "other.txt"), "unrelated\n");
    fs.writeFileSync(join(fixture.work, "feature.txt"), "feature updated\n");

    const receipt = commitScoped({
      repoRoot: fixture.work,
      paths: ["feature.txt"],
      message: "update feature only",
    });

    expect(receipt.committed).toBe(true);
    expect(receipt.files).toEqual(["feature.txt"]);

    const committed = sh(fixture.work, ["show", "--name-only", "--pretty=format:", "HEAD"])
      .split("\n")
      .filter(Boolean);
    expect(committed).toEqual(["feature.txt"]);
    expect(sh(fixture.work, ["status", "--porcelain"])).toContain("other.txt");
  });

  it("keeps a commit message literal (no shell evaluation)", () => {
    fs.writeFileSync(join(fixture.work, "feature.txt"), "changed\n");
    const message = "chore: literal $(whoami) and `date` stay text";

    commitScoped({ repoRoot: fixture.work, paths: ["feature.txt"], message });

    expect(sh(fixture.work, ["log", "-1", "--pretty=%s"])).toBe(message);
  });

  it("refuses unscoped, outside or missing paths", () => {
    expect(() => normalizeOwnedPaths(fixture.work, [])).toThrow(PublicationError);
    expect(() => normalizeOwnedPaths(fixture.work, ["."])).toThrow(/Invalid staging path/);
    expect(() => normalizeOwnedPaths(fixture.work, ["../outside.txt"])).toThrow(
      /outside the worktree/
    );
    expect(() => normalizeOwnedPaths(fixture.work, ["missing.txt"])).toThrow(/does not exist/);
  });

  it("refuses to commit when unrelated files are already staged", () => {
    fs.writeFileSync(join(fixture.work, "feature.txt"), "a\n");
    fs.writeFileSync(join(fixture.work, "sneaky.txt"), "b\n");
    sh(fixture.work, ["add", "sneaky.txt"]);

    expect(() =>
      commitScoped({ repoRoot: fixture.work, paths: ["feature.txt"], message: "scoped" })
    ).toThrow(/Unexpected staged files/);
  });

  it("reports nothing-to-commit without creating an empty commit", () => {
    const before = sh(fixture.work, ["rev-parse", "HEAD"]);
    const receipt = commitScoped({
      repoRoot: fixture.work,
      paths: ["feature.txt"],
      message: "no changes",
    });
    expect(receipt.committed).toBe(false);
    expect(receipt.reason).toBe("NOTHING_TO_COMMIT");
    expect(sh(fixture.work, ["rev-parse", "HEAD"])).toBe(before);
  });
});

describe("Publication - guarded push", () => {
  it("pushes the owned feature branch to the configured remote", () => {
    const receipt = pushFeatureBranch({
      repoRoot: fixture.work,
      remote: "origin",
      branch: "feat/job-1",
      expectedBranch: "feat/job-1",
    });

    expect(receipt.pushed).toBe(true);
    expect(receipt.branch).toBe("feat/job-1");
    const remoteBranches = sh(fixture.originPath, ["branch", "--list", "feat/job-1"]);
    expect(remoteBranches).toContain("feat/job-1");
  });

  it("refuses to push a branch other than the expected one", () => {
    expect(() =>
      pushFeatureBranch({
        repoRoot: fixture.work,
        branch: "feat/job-1",
        expectedBranch: "feat/other",
      })
    ).toThrow(/expected 'feat\/other'/);
  });

  it("refuses to push protected branches", () => {
    expect(() => pushFeatureBranch({ repoRoot: fixture.work, branch: "next" })).toThrow(
      /protected branch/
    );
    expect(() => pushFeatureBranch({ repoRoot: fixture.work, branch: "main" })).toThrow(
      /protected branch/
    );
  });

  it("refuses an unconfigured remote", () => {
    expect(() =>
      pushFeatureBranch({ repoRoot: fixture.work, branch: "feat/job-1", remote: "upstream" })
    ).toThrow(/not configured/);
  });

  it("reports a remote branch collision instead of force pushing", () => {
    const other = join(fixture.root, "other");
    sh(fixture.root, ["clone", "-q", fixture.originPath, other]);
    configure(other, "Other Worker");
    sh(other, ["checkout", "-q", "-b", "feat/job-1"]);
    fs.writeFileSync(join(other, "theirs.txt"), "their work\n");
    sh(other, ["add", "theirs.txt"]);
    sh(other, ["commit", "-q", "-m", "other worker"]);
    sh(other, ["push", "-q", "origin", "feat/job-1"]);

    expect(() => pushFeatureBranch({ repoRoot: fixture.work, branch: "feat/job-1" })).toThrow(
      PublicationError
    );

    // The other worker's commit is still the remote head: nothing was forced.
    const remoteHead = sh(fixture.originPath, ["rev-parse", "feat/job-1"]);
    expect(sh(other, ["rev-parse", "HEAD"])).toBe(remoteHead);
  });

  it("reports denied credentials", () => {
    const hookPath = join(fixture.originPath, "hooks", "pre-receive");
    fs.writeFileSync(hookPath, '#!/bin/sh\necho "authentication denied by policy" >&2\nexit 1\n', {
      mode: 0o755,
    });

    expect(() => pushFeatureBranch({ repoRoot: fixture.work, branch: "feat/job-1" })).toThrow(
      /denied credentials/i
    );
  });
});

describe("Publication - idempotent draft PR", () => {
  const pushReceipt = { pushed: true, branch: "feat/job-1", head: "abc123" };

  it("creates one draft PR after a successful push", async () => {
    const github = fakeGithub();
    const result = await createOrUpdateDraftPr({
      github,
      repository: "owner/repo",
      head: "feat/job-1",
      base: "next",
      title: "Feature",
      body: "Body",
      pushReceipt,
    });

    expect(result.created).toBe(true);
    expect(github.calls.map((call) => call.fn)).toEqual(["findPr", "createPr"]);
    expect(github.calls[1].request.draft).toBe(true);
    expect(github.calls[1].request.base).toBe("next");
  });

  it("updates the existing PR instead of opening a duplicate", async () => {
    const github = fakeGithub({ existing: { number: 7, title: "Old", body: "Old body" } });
    const result = await createOrUpdateDraftPr({
      github,
      repository: "owner/repo",
      head: "feat/job-1",
      base: "next",
      title: "New title",
      body: "New body",
      pushReceipt,
    });

    expect(result.created).toBe(false);
    expect(result.updated).toBe(true);
    expect(github.calls.map((call) => call.fn)).toEqual(["findPr", "updatePr"]);
    expect(github.calls[1].request.number).toBe(7);
    expect(github.calls[1].request.draft).toBe(true);
  });

  it("refuses to open a PR before the push", async () => {
    const github = fakeGithub();
    await expect(
      createOrUpdateDraftPr({
        github,
        repository: "owner/repo",
        head: "feat/job-1",
        base: "next",
        title: "Feature",
        body: "Body",
        pushReceipt: { pushed: false },
      })
    ).rejects.toMatchObject({ code: "PUSH_REQUIRED" });
    expect(github.calls).toHaveLength(0);
  });

  it("refuses a base other than next", async () => {
    const github = fakeGithub();
    await expect(
      createOrUpdateDraftPr({
        github,
        repository: "owner/repo",
        head: "feat/job-1",
        base: "main",
        title: "Feature",
        body: "Body",
        pushReceipt,
      })
    ).rejects.toMatchObject({ code: "WRONG_BASE" });
  });
});

describe("Publication - push before PR ordering", () => {
  it("publishes in order and exposes the pushed branch to the PR step", async () => {
    const github = fakeGithub();
    const remoteBranchesAtPrTime = [];

    const originalFind = github.findPr.bind(github);
    github.findPr = async (request) => {
      remoteBranchesAtPrTime.push(sh(fixture.originPath, ["branch", "--list", "feat/job-1"]));
      return originalFind(request);
    };

    const result = await publishJob({
      repoRoot: fixture.work,
      remote: "origin",
      branch: "feat/job-1",
      expectedBranch: "feat/job-1",
      github,
      repository: "owner/repo",
      title: "Feature",
      body: "Body",
    });

    expect(result.push.pushed).toBe(true);
    expect(result.pr.created).toBe(true);
    expect(remoteBranchesAtPrTime[0]).toContain("feat/job-1");
    expect(github.calls.map((call) => call.fn)).toEqual(["findPr", "createPr"]);
  });

  it("does not call the PR adapter when the push fails", async () => {
    const github = fakeGithub();
    const hookPath = join(fixture.originPath, "hooks", "pre-receive");
    fs.writeFileSync(hookPath, '#!/bin/sh\necho "authentication denied" >&2\nexit 1\n', {
      mode: 0o755,
    });

    await expect(
      publishJob({
        repoRoot: fixture.work,
        branch: "feat/job-1",
        expectedBranch: "feat/job-1",
        github,
        repository: "owner/repo",
        title: "Feature",
        body: "Body",
      })
    ).rejects.toMatchObject({ code: "DENIED_CREDENTIALS" });

    expect(github.calls).toHaveLength(0);
  });
});
