#!/usr/bin/env node
/**
 * Publication: scoped staging, guarded push and idempotent draft PRs.
 *
 * Everything here uses argument arrays (no shell strings), stages only explicit owned
 * paths, refuses unexpected staged files, verifies the branch before pushing and only
 * opens/updates one draft PR per repository/head/base after the push succeeded.
 */

import { execFileSync } from "child_process";
import { existsSync, realpathSync } from "fs";
import { relative, resolve, isAbsolute, join } from "path";

export class PublicationError extends Error {
  constructor(message, code, detail = {}) {
    super(message);
    this.name = "PublicationError";
    this.code = code;
    this.detail = detail;
  }
}

export function git(repoRoot, args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf-8", stdio: "pipe" }).trim();
}

function gitTry(repoRoot, args) {
  try {
    return { ok: true, stdout: git(repoRoot, args), stderr: "" };
  } catch (error) {
    return {
      ok: false,
      stdout: (error.stdout || "").toString().trim(),
      stderr: (error.stderr || "").toString().trim(),
      code: error.status,
    };
  }
}

export function currentBranch(repoRoot) {
  return git(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export function remoteUrl(repoRoot, remote) {
  const result = gitTry(repoRoot, ["remote", "get-url", remote]);
  return result.ok ? result.stdout : null;
}

/**
 * Resolve explicit owned paths relative to the repo. Absolute paths outside the worktree
 * and paths that escape the repo are refused instead of silently normalized.
 */
export function normalizeOwnedPaths(repoRoot, paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new PublicationError(
      "Explicit paths are required; refusing to stage everything",
      "UNSCOPED_STAGE"
    );
  }

  const root = realpathSync(repoRoot);
  const normalized = [];

  for (const entry of paths) {
    if (typeof entry !== "string" || entry.trim() === "" || entry === "." || entry === "-A") {
      throw new PublicationError(`Invalid staging path '${entry}'`, "UNSCOPED_STAGE");
    }
    const absolute = isAbsolute(entry) ? entry : resolve(root, entry);
    const relativePath = relative(root, absolute);
    if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new PublicationError(
        `Path '${entry}' is outside the worktree`,
        "PATH_OUTSIDE_WORKTREE"
      );
    }
    if (!existsSync(join(root, relativePath))) {
      throw new PublicationError(`Path '${relativePath}' does not exist`, "PATH_NOT_FOUND");
    }
    normalized.push(relativePath);
  }

  return normalized;
}

/**
 * Stage and commit exactly the owned paths.
 */
export function commitScoped({ repoRoot, paths, message, allowEmpty = false }) {
  if (!message || !String(message).trim()) {
    throw new PublicationError("Commit message is required", "MISSING_MESSAGE");
  }
  const owned = normalizeOwnedPaths(repoRoot, paths);

  git(repoRoot, ["add", "--", ...owned]);

  const staged = git(repoRoot, ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
  const unexpected = staged.filter((file) => !owned.includes(file));
  if (unexpected.length > 0) {
    throw new PublicationError(
      `Unexpected staged files: ${unexpected.join(", ")}`,
      "UNEXPECTED_STAGED_FILES",
      { unexpected }
    );
  }

  if (staged.length === 0 && !allowEmpty) {
    return { committed: false, reason: "NOTHING_TO_COMMIT", files: owned };
  }

  const commitArgs = ["commit", "-m", message];
  if (allowEmpty) commitArgs.push("--allow-empty");
  const result = gitTry(repoRoot, commitArgs);
  if (!result.ok) {
    throw new PublicationError(`Commit failed: ${result.stderr || result.stdout}`, "COMMIT_FAILED");
  }

  return {
    committed: true,
    files: staged,
    head: git(repoRoot, ["rev-parse", "HEAD"]),
    lastMessage: git(repoRoot, ["log", "-1", "--pretty=%s"]),
  };
}

/**
 * Push the owned feature branch. Never forces, never pushes another branch.
 */
export function pushFeatureBranch({
  repoRoot,
  remote = "origin",
  branch,
  expectedBranch,
  remoteShaBefore = null,
}) {
  if (!branch) throw new PublicationError("branch is required", "MISSING_BRANCH");
  if (expectedBranch && branch !== expectedBranch) {
    throw new PublicationError(
      `Refusing to push '${branch}' (expected '${expectedBranch}')`,
      "WRONG_BRANCH"
    );
  }
  if (branch === "next" || branch === "main") {
    throw new PublicationError(
      `Refusing to publish protected branch '${branch}'`,
      "PROTECTED_BRANCH"
    );
  }
  if (!remoteUrl(repoRoot, remote)) {
    throw new PublicationError(`Remote '${remote}' is not configured`, "WRONG_REMOTE");
  }
  const head = currentBranch(repoRoot);
  if (head !== branch) {
    throw new PublicationError(
      `Checked-out branch is '${head}', not '${branch}'`,
      "CHECKOUT_MISMATCH"
    );
  }

  const localSha = git(repoRoot, ["rev-parse", "HEAD"]);
  const push = gitTry(repoRoot, ["push", "--porcelain", remote, `${branch}:${branch}`]);

  if (!push.ok) {
    const text = `${push.stderr}\n${push.stdout}`.toLowerCase();
    if (text.includes("authentication") || text.includes("permission") || text.includes("denied")) {
      throw new PublicationError("Remote denied credentials for push", "DENIED_CREDENTIALS", {
        stderr: push.stderr,
      });
    }
    if (text.includes("non-fast-forward") || text.includes("rejected")) {
      throw new PublicationError(
        "Remote branch has commits this checkout does not contain",
        "REMOTE_COLLISION",
        { stderr: push.stderr }
      );
    }
    throw new PublicationError(`Push failed: ${push.stderr || push.stdout}`, "PUSH_FAILED", {
      stderr: push.stderr,
    });
  }

  return {
    pushed: true,
    remote,
    branch,
    head: localSha,
    previousRemoteSha: remoteShaBefore,
    output: push.stdout,
  };
}

/**
 * Create or update exactly one draft PR for repository/head/base.
 *
 * `github` is an injected adapter with `findPr`, `createPr` and `updatePr`. Calls are
 * strictly ordered: discovery, then create or update — never a duplicate create.
 */
export async function createOrUpdateDraftPr({
  github,
  repository,
  head,
  base = "next",
  title,
  body,
  pushReceipt,
}) {
  if (!github || typeof github.findPr !== "function") {
    throw new PublicationError("GitHub adapter with findPr is required", "MISSING_ADAPTER");
  }
  if (!pushReceipt?.pushed) {
    throw new PublicationError(
      "Refusing to open a PR before the branch is pushed",
      "PUSH_REQUIRED"
    );
  }
  if (base !== "next") {
    throw new PublicationError(`Draft PRs target 'next', not '${base}'`, "WRONG_BASE");
  }
  if (head !== pushReceipt.branch) {
    throw new PublicationError(
      `PR head '${head}' does not match pushed branch '${pushReceipt.branch}'`,
      "HEAD_MISMATCH"
    );
  }

  const existing = await github.findPr({ repository, head, base });

  if (existing) {
    const updated = await github.updatePr({
      repository,
      number: existing.number,
      title: title ?? existing.title,
      body: body ?? existing.body,
      draft: true,
    });
    return { created: false, updated: true, pr: updated || { ...existing, title, body } };
  }

  const created = await github.createPr({
    repository,
    head,
    base,
    title,
    body,
    draft: true,
  });

  return { created: true, updated: false, pr: created };
}

/**
 * Full publication flow. The order is fixed and observable: commit (already done by the
 * caller or here), push, then PR discovery/create.
 */
export async function publishJob({
  repoRoot,
  remote = "origin",
  branch,
  expectedBranch,
  github,
  repository,
  title,
  body,
  paths = null,
  message = null,
  base = "next",
}) {
  let commitReceipt = null;
  if (paths) {
    commitReceipt = commitScoped({ repoRoot, paths, message });
  }

  const pushReceipt = pushFeatureBranch({
    repoRoot,
    remote,
    branch,
    expectedBranch,
    remoteShaBefore: null,
  });

  const pr = await createOrUpdateDraftPr({
    github,
    repository,
    head: branch,
    base,
    title,
    body,
    pushReceipt,
  });

  return { commit: commitReceipt, push: pushReceipt, pr };
}
