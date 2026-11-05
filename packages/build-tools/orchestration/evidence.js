#!/usr/bin/env node
/**
 * Evidence receipts.
 *
 * A receipt binds a verification/review outcome to the exact head, base, tree and
 * artifacts it observed. Anything that moves afterwards makes the receipt stale rather
 * than silently reusable.
 */

import fs from "fs";
import identity from "../verification/identity.js";
import { createHash } from "crypto";
import { join } from "path";
import { execFileSync } from "child_process";

export class EvidenceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "EvidenceError";
    this.code = code;
  }
}

export const RECEIPT_SCHEMA_VERSION = "1.0.0";

export const CaseStatus = {
  PASSED: "passed",
  FAILED: "failed",
  SKIPPED: "skipped",
};

export function hashFile(path) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(path));
  return hash.digest("hex");
}

function git(repoRoot, args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf-8", stdio: "pipe" }).trim();
}

/**
 * Capture the tree evidence a receipt is bound to.
 */
export function collectTreeEvidence({ repoRoot }) {
  return {
    head: git(repoRoot, ["rev-parse", "HEAD"]),
    tree: git(repoRoot, ["rev-parse", "HEAD^{tree}"]),
    workingTree: identity.sourceIdentity(repoRoot).sha256,
  };
}

/**
 * Build a receipt. Missing command exit codes or artifacts without hashes are recorded
 * as-is; validation reports them as incomplete instead of assuming success.
 */
export function createEvidenceReceipt({
  jobId,
  kind = "verification",
  repoRoot,
  base,
  commands = [],
  artifacts = [],
  cases = [],
  createdAt = new Date().toISOString(),
}) {
  if (!jobId) throw new EvidenceError("jobId is required", "MISSING_JOB_ID");
  if (!repoRoot) throw new EvidenceError("repoRoot is required", "MISSING_REPO_ROOT");

  const tree = collectTreeEvidence({ repoRoot });

  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    jobId,
    kind,
    createdAt,
    repoRoot,
    workingTree: tree.workingTree,
    head: tree.head,
    tree: tree.tree,
    base: base || null,
    commands: commands.map((entry) => ({
      command: entry.command,
      exitCode: entry.exitCode ?? null,
      durationMs: entry.durationMs ?? null,
    })),
    artifacts: artifacts.map((entry) =>
      typeof entry === "string"
        ? { path: entry, sha256: hashFile(entry), size: fs.statSync(entry).size }
        : {
            path: entry.path,
            sha256: entry.sha256 ?? hashFile(entry.path),
            size: entry.size ?? null,
          }
    ),
    cases: cases.map((entry) => ({
      id: entry.id,
      status: entry.status,
      detail: entry.detail ?? null,
    })),
  };
}

/**
 * Validate a receipt against the current head/base and its own commands, cases and
 * artifacts. The receipt is only reusable when every check passes.
 */
export function validateEvidenceReceipt(
  receipt,
  { head, base, requiredCases = [], artifactResolver = hashFile } = {}
) {
  const problems = [];

  if (!receipt) {
    return { status: "stale", problems: [{ code: "MISSING_RECEIPT" }] };
  }
  try {
    const current = receipt.repoRoot && collectTreeEvidence({ repoRoot: receipt.repoRoot });
    if (
      !current ||
      !receipt.workingTree ||
      current.workingTree !== receipt.workingTree ||
      current.head !== receipt.head
    )
      problems.push({ code: "STALE_WORKING_TREE" });
  } catch {
    problems.push({ code: "SOURCE_IDENTITY_UNAVAILABLE" });
  }
  if (!receipt.head || !receipt.tree) {
    problems.push({ code: "MISSING_TREE_EVIDENCE" });
  }
  if (head && receipt.head !== head) {
    problems.push({ code: "STALE_HEAD", expected: receipt.head, actual: head });
  }
  if (base && receipt.base !== base) {
    problems.push({ code: "STALE_BASE", expected: receipt.base, actual: base });
  }

  for (const command of receipt.commands || []) {
    if (command.exitCode === null || command.exitCode === undefined) {
      problems.push({ code: "MISSING_EXIT_CODE", command: command.command });
    } else if (command.exitCode !== 0) {
      problems.push({
        code: "FAILED_COMMAND",
        command: command.command,
        exitCode: command.exitCode,
      });
    }
  }

  for (const entry of receipt.cases || []) {
    if (entry.status === CaseStatus.SKIPPED) {
      problems.push({ code: "SKIPPED_CASE", case: entry.id });
    } else if (entry.status === CaseStatus.FAILED) {
      problems.push({ code: "FAILED_CASE", case: entry.id });
    }
  }

  const recorded = new Map((receipt.cases || []).map((entry) => [entry.id, entry]));
  for (const required of requiredCases) {
    const entry = recorded.get(required);
    if (!entry) {
      problems.push({ code: "MISSING_REQUIRED_CASE", case: required });
    } else if (entry.status !== CaseStatus.PASSED) {
      problems.push({ code: "REQUIRED_CASE_NOT_PASSED", case: required, status: entry.status });
    }
  }

  for (const artifact of receipt.artifacts || []) {
    if (!artifact.sha256) {
      problems.push({ code: "MISSING_ARTIFACT_HASH", artifact: artifact.path });
      continue;
    }
    if (artifactResolver) {
      let actual;
      try {
        actual = artifactResolver(artifact.path);
      } catch {
        actual = null;
      }
      if (actual !== artifact.sha256) {
        problems.push({ code: "STALE_ARTIFACT", artifact: artifact.path });
      }
    }
  }

  return { status: problems.length === 0 ? "valid" : "stale", problems };
}

function evidenceDir(registry) {
  const dir = join(registry.registryDir, "evidence");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/**
 * Persist a receipt and point the job at it.
 */
export async function storeReceipt({ registry, jobId, receipt }) {
  return registry.withLock(async () => {
    const job = registry.getJob(jobId);
    if (!job) throw new EvidenceError(`Job ${jobId} not found`, "JOB_NOT_FOUND");

    const dir = evidenceDir(registry);
    const path = join(dir, `${receipt.id}.json`);
    registry.atomicWrite(path, JSON.stringify(receipt, null, 2));

    const ids = [...(job.evidenceReceipts || []), receipt.id];
    const now = new Date().toISOString();
    registry.atomicWrite(
      registry.getJobPath(jobId),
      JSON.stringify(
        {
          ...job,
          evidenceReceipts: ids,
          updatedAt: now,
        },
        null,
        2
      )
    );

    return { stored: true, id: receipt.id, path };
  });
}

export function loadReceipt({ registry, id }) {
  const path = join(registry.registryDir, "evidence", `${id}.json`);
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

/**
 * Latest receipt for a job, optionally filtered by kind.
 */
export function latestReceipt({ registry, jobId, kind }) {
  const job = registry.getJob(jobId);
  if (!job) return null;
  const ids = [...(job.evidenceReceipts || [])].reverse();
  for (const id of ids) {
    const receipt = loadReceipt({ registry, id });
    if (receipt && (!kind || receipt.kind === kind)) return receipt;
  }
  return null;
}
