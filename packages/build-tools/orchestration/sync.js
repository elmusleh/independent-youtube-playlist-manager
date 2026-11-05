#!/usr/bin/env node
/**
 * Target synchronization.
 *
 * Integrates the current integration target (`origin/next`) into the job's owned
 * feature branch with a merge. It never checks out the target branch, never rebases
 * reviewed history and refuses to run on a dirty or unexpected branch.
 */

import { execFileSync } from "child_process";

export class SyncError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "SyncError";
    this.code = code;
  }
}

export function git(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: "pipe",
  }).trim();
}

function gitResult(repoRoot, args) {
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

export function resolveCommit(repoRoot, ref) {
  const result = gitResult(repoRoot, ["rev-parse", `${ref}^{commit}`]);
  return result.ok ? result.stdout : null;
}

export function remoteExists(repoRoot, remote) {
  return gitResult(repoRoot, ["remote", "get-url", remote]).ok;
}

export function getDirty(repoRoot) {
  const status = git(repoRoot, ["status", "--porcelain"]);
  if (!status) return { dirty: false, files: [] };
  return { dirty: true, files: status.split("\n").map((line) => line.slice(3)) };
}

/**
 * Fetch the configured remote/target and report the remote head.
 */
export function fetchTarget({ repoRoot, remote = "origin", target = "next" }) {
  if (!remoteExists(repoRoot, remote)) {
    throw new SyncError(`Remote '${remote}' is not configured`, "WRONG_REMOTE");
  }

  const fetched = gitResult(repoRoot, ["fetch", "--no-tags", remote, target]);
  if (!fetched.ok) {
    throw new SyncError(
      `Could not fetch ${remote}/${target}: ${fetched.stderr || fetched.stdout}`,
      "FETCH_FAILED"
    );
  }

  const sha = resolveCommit(repoRoot, "FETCH_HEAD");
  if (!sha) {
    throw new SyncError(`Fetched ${remote}/${target} but could not resolve it`, "FETCH_UNRESOLVED");
  }
  return { remote, target, sha };
}

/**
 * Merge the fetched target into the owned feature branch.
 *
 * Returns `{ status: "updated" | "up-to-date" | "conflict" }`. Conflicts abort the merge
 * and report the affected files; the branch is left as it was.
 */
export function syncTargetIntoBranch({
  repoRoot,
  remote = "origin",
  target = "next",
  expectedBranch,
}) {
  if (!expectedBranch) {
    throw new SyncError("expectedBranch is required", "MISSING_EXPECTED_BRANCH");
  }
  if (!remoteExists(repoRoot, remote)) {
    throw new SyncError(`Remote '${remote}' is not configured`, "WRONG_REMOTE");
  }

  const branch = currentBranch(repoRoot);
  if (branch !== expectedBranch) {
    throw new SyncError(
      `Refusing to sync on branch '${branch}' (expected '${expectedBranch}')`,
      "WRONG_BRANCH"
    );
  }
  if (branch === target) {
    throw new SyncError("Refusing to sync the integration target into itself", "TARGET_BRANCH");
  }

  const dirty = getDirty(repoRoot);
  if (dirty.dirty) {
    throw new SyncError(
      `Working tree has ${dirty.files.length} uncommitted change(s); refusing to stash or discard them`,
      "DIRTY_WORKTREE"
    );
  }

  const headBefore = resolveCommit(repoRoot, "HEAD");
  const fetched = fetchTarget({ repoRoot, remote, target });

  const mergeBase = gitResult(repoRoot, ["merge-base", "HEAD", fetched.sha]);
  if (!mergeBase.ok) {
    throw new SyncError(
      "Feature branch and target share no history; manual reconciliation required",
      "UNRELATED_HISTORY"
    );
  }

  if (mergeBase.stdout === fetched.sha) {
    return {
      status: "up-to-date",
      branch,
      head: headBefore,
      target: fetched.sha,
      mergeCommit: null,
    };
  }

  const merge = gitResult(repoRoot, [
    "merge",
    "--no-edit",
    "--no-ff",
    "-m",
    `chore: sync ${remote}/${target} into ${branch}`,
    fetched.sha,
  ]);

  if (!merge.ok) {
    const conflicted = gitResult(repoRoot, ["diff", "--name-only", "--diff-filter=U"]);
    const files = conflicted.ok && conflicted.stdout ? conflicted.stdout.split("\n") : [];
    gitResult(repoRoot, ["merge", "--abort"]);

    // The branch must be exactly where it was before the failed merge.
    const headAfterAbort = resolveCommit(repoRoot, "HEAD");
    return {
      status: "conflict",
      branch,
      files,
      head: headBefore,
      restoredHead: headAfterAbort,
      target: fetched.sha,
      message: merge.stderr || merge.stdout,
    };
  }

  return {
    status: "updated",
    branch,
    previousHead: headBefore,
    head: resolveCommit(repoRoot, "HEAD"),
    target: fetched.sha,
    mergeCommit: resolveCommit(repoRoot, "HEAD"),
  };
}

/**
 * Prove reviewed history was preserved: the pre-sync head is an ancestor of the new head.
 */
export function isAncestor(repoRoot, ancestor, descendant) {
  return gitResult(repoRoot, ["merge-base", "--is-ancestor", ancestor, descendant]).ok;
}
