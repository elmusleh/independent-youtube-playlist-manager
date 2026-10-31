#!/usr/bin/env node
/**
 * Single-owner editing lock for a repository.
 *
 * Two agents editing the same tree at once produced real breakage: a duplicated import and
 * a duplicated object key that only surfaced later. This lock makes concurrent editing
 * explicit instead of accidental.
 *
 * Design:
 * - the marker (`.agents/EDITING`) is created with `wx`, so creation is atomic;
 * - a short-lived guard file serialises read-modify-write of the marker;
 * - a marker whose owner PID is gone is stale and may be taken over;
 * - release requires the same PID unless `force` is passed.
 *
 * Usage:
 *   node agent-lock.js status
 *   node agent-lock.js acquire --agent hermes [--branch b] [--note "..."]
 *   node agent-lock.js release [--force]
 *   node agent-lock.js run -- npm test        # hold the lock for the command
 */

import { spawnSync } from "child_process";
import fs from "fs";
import { join } from "path";

export class LockError extends Error {
  constructor(message, code, detail) {
    super(message);
    this.name = "LockError";
    this.code = code;
    this.detail = detail;
  }
}

const DEFAULT_MARKER = join(".agents", "EDITING");
const GUARD_SUFFIX = ".guard";
const GUARD_RETRIES = 40;
const GUARD_DELAY_MS = 25;

export function lockPaths(repoRoot, markerPath = DEFAULT_MARKER) {
  const marker = join(repoRoot, markerPath);
  return { marker, guard: `${marker}${GUARD_SUFFIX}`, dir: join(marker, "..") };
}

export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withGuard(paths, fn) {
  fs.mkdirSync(paths.dir, { recursive: true });
  for (let attempt = 0; attempt < GUARD_RETRIES; attempt += 1) {
    try {
      const fd = fs.openSync(paths.guard, "wx");
      try {
        return fn();
      } finally {
        fs.closeSync(fd);
        fs.rmSync(paths.guard, { force: true });
      }
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      sleep(GUARD_DELAY_MS);
    }
  }
  throw new LockError("Could not take the lock guard", "LOCK_BUSY", { guard: paths.guard });
}

export function readLock(repoRoot, markerPath) {
  const paths = lockPaths(repoRoot, markerPath);
  if (!fs.existsSync(paths.marker)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(paths.marker, "utf-8"));
    return { ...parsed, alive: isProcessAlive(parsed.pid) };
  } catch {
    return { pid: null, alive: false, corrupt: true };
  }
}

export function acquireLock({
  repoRoot,
  agent = "unknown",
  branch = null,
  note = "",
  pid = process.pid,
  markerPath,
  now = () => new Date().toISOString(),
  alive = isProcessAlive,
} = {}) {
  if (!repoRoot) throw new LockError("repoRoot is required", "MISSING_REPO_ROOT");
  const paths = lockPaths(repoRoot, markerPath);

  return withGuard(paths, () => {
    if (fs.existsSync(paths.marker)) {
      const existing = readLock(repoRoot, markerPath);
      if (existing && existing.pid && alive(existing.pid)) {
        throw new LockError(
          `Tree is already being edited by ${existing.agent || "unknown"} (pid ${existing.pid})`,
          "LOCK_HELD",
          existing
        );
      }
    }
    const record = { pid, agent, branch, note, startedAt: now() };
    fs.writeFileSync(paths.marker, JSON.stringify(record, null, 2) + "\n");
    return record;
  });
}

export function releaseLock({ repoRoot, pid = process.pid, force = false, markerPath } = {}) {
  if (!repoRoot) throw new LockError("repoRoot is required", "MISSING_REPO_ROOT");
  const paths = lockPaths(repoRoot, markerPath);

  return withGuard(paths, () => {
    if (!fs.existsSync(paths.marker)) return { released: false, reason: "NOT_HELD" };
    const existing = readLock(repoRoot, markerPath);
    if (!force && existing?.pid !== pid) {
      throw new LockError(
        `Lock is owned by pid ${existing?.pid ?? "unknown"}, not ${pid}`,
        "LOCK_NOT_OWNED",
        existing
      );
    }
    fs.rmSync(paths.marker, { force: true });
    return { released: true, owner: existing };
  });
}

export function withAgentLock(meta, fn) {
  acquireLock(meta);
  try {
    return fn();
  } finally {
    releaseLock({ repoRoot: meta.repoRoot, pid: meta.pid ?? process.pid, force: true });
  }
}

function main(argv = process.argv.slice(2)) {
  const repoRoot = process.cwd();
  const value = (flag) => {
    const index = argv.indexOf(flag);
    return index > -1 ? argv[index + 1] : null;
  };
  const command = argv[0];

  if (command === "status") {
    const lock = readLock(repoRoot);
    console.log(JSON.stringify(lock ?? { held: false }, null, 2));
    return lock && lock.alive ? 3 : 0;
  }

  if (command === "acquire") {
    try {
      const record = acquireLock({
        repoRoot,
        agent: value("--agent") || process.env.HERMES_AGENT_NAME || "unknown",
        branch: value("--branch"),
        note: value("--note") || "",
      });
      console.log(JSON.stringify(record, null, 2));
      return 0;
    } catch (error) {
      console.error(`${error.code}: ${error.message}`);
      return error.code === "LOCK_HELD" ? 3 : 1;
    }
  }

  if (command === "release") {
    try {
      console.log(JSON.stringify(releaseLock({ repoRoot, force: argv.includes("--force") })));
      return 0;
    } catch (error) {
      console.error(`${error.code}: ${error.message}`);
      return 1;
    }
  }

  if (command === "run") {
    const separator = argv.indexOf("--");
    if (separator < 0 || !argv[separator + 1]) {
      console.error("Usage: node agent-lock.js run -- <command> [args...]");
      return 1;
    }
    const args = argv.slice(separator + 1);
    acquireLock({ repoRoot, agent: value("--agent") || "unknown", note: args.join(" ") });
    try {
      const result = spawnSync(args[0], args.slice(1), { stdio: "inherit" });
      return result.status ?? 1;
    } finally {
      releaseLock({ repoRoot, force: true });
    }
  }

  console.error("Usage: node agent-lock.js status|acquire|release|run -- <command>");
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
