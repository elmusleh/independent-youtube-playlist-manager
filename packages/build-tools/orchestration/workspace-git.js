import fs from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { WorkspaceError, WorkspaceBackend } from "./workspace-types.js";

export function branchExists(repoRoot, branchName, checkRemote = true) {
  try {
    // Check local
    execSync(`git rev-parse --verify ${branchName}`, {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return { exists: true, location: "local" };
  } catch {
    // Check remote
    if (checkRemote) {
      try {
        execSync(`git rev-parse --verify origin/${branchName}`, {
          cwd: repoRoot,
          stdio: "ignore",
        });
        return { exists: true, location: "remote" };
      } catch {
        return { exists: false };
      }
    }
    return { exists: false };
  }
}

export function getWorktreeInventory(repoRoot) {
  try {
    const output = execSync("git worktree list --porcelain", {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    const worktrees = [];
    const lines = output.split("\n");
    let current = {};

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        if (current.path) worktrees.push(current);
        current = { path: line.slice("worktree ".length).trim() };
      } else if (line.startsWith("HEAD ")) {
        current.head = line.slice("HEAD ".length).trim();
      } else if (line.startsWith("branch ")) {
        current.branch = line.slice("branch ".length).trim();
      } else if (line === "bare") {
        current.bare = true;
      } else if (line.startsWith("detached")) {
        current.detached = true;
      }
    }
    if (current.path) worktrees.push(current);

    return worktrees;
  } catch {
    return [];
  }
}

export function getDirtyStatus(repoRoot) {
  try {
    const output = execSync("git status --porcelain", {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    if (!output) return { dirty: false, files: [] };

    const files = output.split("\n").map((line) => line.slice(3).trim());
    return { dirty: true, files };
  } catch {
    return { dirty: false, files: [] };
  }
}

export function createWorktreeGit(repoRoot, worktreePath, branchName, startingSha) {
  // Create branch from starting SHA
  execSync(`git branch ${branchName} ${startingSha}`, { cwd: repoRoot, stdio: "ignore" });

  // Create worktree
  execSync(`git worktree add ${worktreePath} ${branchName}`, { cwd: repoRoot, stdio: "ignore" });

  return { backend: WorkspaceBackend.GIT, path: worktreePath, branch: branchName };
}

export function removeWorktreeGit(repoRoot, worktreePath, force = false) {
  // Check for dirty state first
  const dirty = getDirtyStatus(worktreePath);
  if (dirty.dirty && !force) {
    throw new WorkspaceError(
      `Worktree ${worktreePath} has uncommitted changes. Use force=true to override.`,
      "DIRTY_WORKTREE"
    );
  }

  // Check if it's a managed worktree (has .git file pointing to main repo)
  const gitDir = join(worktreePath, ".git");
  let isWorktree = false;
  if (fs.existsSync(gitDir)) {
    const content = fs.readFileSync(gitDir, "utf-8").trim();
    isWorktree = content.startsWith("gitdir:");
  }

  if (!isWorktree) {
    throw new WorkspaceError(
      `Path ${worktreePath} does not appear to be a git worktree`,
      "NOT_A_WORKTREE"
    );
  }

  // Remove worktree
  const removeArgs = force ? `--force ${worktreePath}` : worktreePath;
  execSync(`git worktree remove ${removeArgs}`, { cwd: repoRoot, stdio: "ignore" });

  // Also delete the branch if it's a feature branch
  // Note: We don't auto-delete branches - that's a separate decision

  return { removed: true, path: worktreePath };
}

export function archiveWorktreeManaged(repoRoot, worktreePath, _managerId) {
  // This would integrate with Codex/Hermes managed worktree APIs
  // For now, delegate to git with metadata preservation
  return removeWorktreeGit(repoRoot, worktreePath);
}
