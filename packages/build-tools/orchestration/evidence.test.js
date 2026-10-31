import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { OrchestrationRegistry } from "./registry.js";
import {
  CaseStatus,
  EvidenceError,
  collectTreeEvidence,
  createEvidenceReceipt,
  hashFile,
  latestReceipt,
  loadReceipt,
  storeReceipt,
  validateEvidenceReceipt,
} from "./evidence.js";

function sh(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
}

function createRepo() {
  const dir = fs.mkdtempSync(join("/tmp", "evidence-test-"));
  sh(dir, ["init", "-q"]);
  sh(dir, ["config", "user.email", "evidence@test.local"]);
  sh(dir, ["config", "user.name", "Evidence Test"]);
  fs.writeFileSync(join(dir, "README.md"), "# Evidence\n");
  fs.writeFileSync(join(dir, "report.txt"), "checks passed\n");
  sh(dir, ["add", "-A"]);
  sh(dir, ["commit", "-q", "-m", "init"]);
  return dir;
}

function commit(dir, file, content, message) {
  fs.writeFileSync(join(dir, file), content);
  sh(dir, ["add", file]);
  sh(dir, ["commit", "-q", "-m", message]);
}

async function seedJob(registry) {
  return registry.createJob({
    id: "job-1",
    schemaVersion: "1.0.0",
    policyVersion: "1.0.0",
    changeName: "change-1",
    branch: "feat/job-1",
    worktreePath: "/tmp/wt/job-1",
    worktreeManager: "git",
    startingSha: "abc123",
    dependencies: [],
    state: "queued",
  });
}

let repo;
let registry;

beforeEach(() => {
  repo = createRepo();
  registry = new OrchestrationRegistry(repo, { maxActive: 2 });
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("Evidence - receipt captures head, base, tree and artifacts", () => {
  it("binds the receipt to the exact tree and hashes artifacts", () => {
    const tree = collectTreeEvidence({ repoRoot: repo });
    const receipt = createEvidenceReceipt({
      jobId: "job-1",
      kind: "verification",
      repoRoot: repo,
      base: "origin/next@abc",
      commands: [{ command: "npm test", exitCode: 0, durationMs: 1200 }],
      artifacts: [join(repo, "report.txt")],
      cases: [{ id: "unit", status: CaseStatus.PASSED }],
    });

    expect(receipt.schemaVersion).toBe("1.0.0");
    expect(receipt.head).toBe(tree.head);
    expect(receipt.tree).toBe(tree.tree);
    expect(receipt.base).toBe("origin/next@abc");
    expect(receipt.artifacts[0].sha256).toBe(hashFile(join(repo, "report.txt")));
    expect(receipt.artifacts[0].size).toBeGreaterThan(0);
  });

  it("validates a matching receipt", () => {
    const receipt = createEvidenceReceipt({
      jobId: "job-1",
      repoRoot: repo,
      commands: [{ command: "npm test", exitCode: 0 }],
      artifacts: [join(repo, "report.txt")],
      cases: [{ id: "unit", status: CaseStatus.PASSED }],
    });

    const result = validateEvidenceReceipt(receipt, {
      head: receipt.head,
      base: receipt.base,
      requiredCases: ["unit"],
    });

    expect(result.status).toBe("valid");
    expect(result.problems).toEqual([]);
  });
});

describe("Evidence - invalid evidence is reported, not assumed", () => {
  it("flags a command without an exit code", () => {
    const receipt = createEvidenceReceipt({ jobId: "job-1", repoRoot: repo });
    receipt.commands = [{ command: "npm test", exitCode: null }];

    const result = validateEvidenceReceipt(receipt);
    expect(result.status).toBe("stale");
    expect(result.problems.map((p) => p.code)).toContain("MISSING_EXIT_CODE");
  });

  it("flags a failed command", () => {
    const receipt = createEvidenceReceipt({ jobId: "job-1", repoRoot: repo });
    receipt.commands = [{ command: "npm test", exitCode: 1 }];

    expect(validateEvidenceReceipt(receipt).problems.map((p) => p.code)).toContain(
      "FAILED_COMMAND"
    );
  });

  it("flags a skipped mandatory case", () => {
    const receipt = createEvidenceReceipt({
      jobId: "job-1",
      repoRoot: repo,
      cases: [
        { id: "unit", status: CaseStatus.PASSED },
        { id: "e2e", status: CaseStatus.SKIPPED },
      ],
    });

    const result = validateEvidenceReceipt(receipt, { requiredCases: ["unit", "e2e"] });
    expect(result.status).toBe("stale");
    expect(result.problems.map((p) => p.code)).toEqual(
      expect.arrayContaining(["SKIPPED_CASE", "REQUIRED_CASE_NOT_PASSED"])
    );
  });

  it("flags a missing required case", () => {
    const receipt = createEvidenceReceipt({
      jobId: "job-1",
      repoRoot: repo,
      cases: [{ id: "unit", status: CaseStatus.PASSED }],
    });

    const result = validateEvidenceReceipt(receipt, { requiredCases: ["unit", "build"] });
    expect(result.problems.map((p) => p.code)).toContain("MISSING_REQUIRED_CASE");
  });

  it("invalidates the receipt when the head moves", () => {
    const receipt = createEvidenceReceipt({
      jobId: "job-1",
      repoRoot: repo,
      commands: [{ command: "npm test", exitCode: 0 }],
    });
    commit(repo, "extra.txt", "more work\n", "later commit");

    const result = validateEvidenceReceipt(receipt, { head: sh(repo, ["rev-parse", "HEAD"]) });
    expect(result.status).toBe("stale");
    expect(result.problems.map((p) => p.code)).toContain("STALE_HEAD");
  });

  it("invalidates the receipt when the target advances", () => {
    const receipt = createEvidenceReceipt({ jobId: "job-1", repoRoot: repo, base: "next@111" });

    const result = validateEvidenceReceipt(receipt, { base: "next@222" });
    expect(result.status).toBe("stale");
    expect(result.problems.map((p) => p.code)).toContain("STALE_BASE");
  });

  it("invalidates the receipt when an artifact changes", () => {
    const receipt = createEvidenceReceipt({
      jobId: "job-1",
      repoRoot: repo,
      artifacts: [join(repo, "report.txt")],
    });
    fs.writeFileSync(join(repo, "report.txt"), "tampered\n");

    const result = validateEvidenceReceipt(receipt);
    expect(result.status).toBe("stale");
    expect(result.problems.map((p) => p.code)).toContain("STALE_ARTIFACT");
  });

  it("flags artifacts recorded without hashes", () => {
    const receipt = createEvidenceReceipt({ jobId: "job-1", repoRoot: repo });
    receipt.artifacts = [{ path: "somewhere.txt", sha256: null }];

    expect(validateEvidenceReceipt(receipt).problems.map((p) => p.code)).toContain(
      "MISSING_ARTIFACT_HASH"
    );
  });

  it("treats a missing receipt as stale", () => {
    expect(validateEvidenceReceipt(null).status).toBe("stale");
  });
});

describe("Evidence - persistence", () => {
  it("stores receipts and links them to the job", async () => {
    await seedJob(registry);
    const receipt = createEvidenceReceipt({
      jobId: "job-1",
      repoRoot: repo,
      commands: [{ command: "npm test", exitCode: 0 }],
      cases: [{ id: "unit", status: CaseStatus.PASSED }],
    });

    const stored = await storeReceipt({ registry, jobId: "job-1", receipt });
    expect(stored.stored).toBe(true);
    expect(fs.existsSync(stored.path)).toBe(true);

    expect(registry.getJob("job-1").evidenceReceipts).toContain(receipt.id);
    expect(loadReceipt({ registry, id: receipt.id }).head).toBe(receipt.head);
    expect(latestReceipt({ registry, jobId: "job-1", kind: "verification" }).id).toBe(receipt.id);
  });

  it("returns the newest receipt for a kind", async () => {
    await seedJob(registry);
    const first = createEvidenceReceipt({ jobId: "job-1", repoRoot: repo, kind: "verification" });
    await storeReceipt({ registry, jobId: "job-1", receipt: first });
    const second = createEvidenceReceipt({ jobId: "job-1", repoRoot: repo, kind: "verification" });
    await storeReceipt({ registry, jobId: "job-1", receipt: second });

    expect(latestReceipt({ registry, jobId: "job-1", kind: "verification" }).id).toBe(second.id);
    expect(latestReceipt({ registry, jobId: "job-1", kind: "review" })).toBeNull();
  });

  it("refuses to store a receipt for an unknown job", async () => {
    const receipt = createEvidenceReceipt({ jobId: "job-x", repoRoot: repo });
    await expect(storeReceipt({ registry, jobId: "job-x", receipt })).rejects.toBeInstanceOf(
      EvidenceError
    );
  });
});

describe("Evidence - dirty and untracked code invalidates receipts", () => {
  it.each(["README.md", "untracked-source.js"])(
    "detects changed content in %s without a commit",
    (file) => {
      const receipt = createEvidenceReceipt({ jobId: "job-1", repoRoot: repo });
      fs.writeFileSync(join(repo, file), "changed source");
      expect(validateEvidenceReceipt(receipt).problems.map((problem) => problem.code)).toContain(
        "STALE_WORKING_TREE"
      );
    }
  );
});
