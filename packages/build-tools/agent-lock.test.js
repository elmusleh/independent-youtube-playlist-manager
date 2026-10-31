import fs from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LockError,
  acquireLock,
  isProcessAlive,
  readLock,
  releaseLock,
  withAgentLock,
} from "./agent-lock.js";

let repoRoot;

beforeEach(() => {
  repoRoot = fs.mkdtempSync(join("/tmp", "agent-lock-"));
});

afterEach(() => {
  fs.rmSync(repoRoot, { recursive: true, force: true });
});

describe("agent editing lock", () => {
  it("records the owner when the tree is free", () => {
    const record = acquireLock({ repoRoot, agent: "hermes", branch: "main" });
    const lock = readLock(repoRoot);

    expect(record.agent).toBe("hermes");
    expect(lock.pid).toBe(process.pid);
    expect(lock.branch).toBe("main");
    expect(lock.alive).toBe(true);
  });

  it("refuses a second owner while the first is alive", () => {
    acquireLock({ repoRoot, agent: "hermes" });

    expect(() => acquireLock({ repoRoot, agent: "codex", pid: process.pid + 1 })).toThrowError(
      /already being edited/
    );
    try {
      acquireLock({ repoRoot, agent: "codex", pid: process.pid + 1 });
    } catch (error) {
      expect(error.code).toBe("LOCK_HELD");
      expect(error.detail.agent).toBe("hermes");
    }
  });

  it("takes over a marker whose owner process is gone", () => {
    acquireLock({ repoRoot, agent: "hermes", pid: 999999 });
    const record = acquireLock({ repoRoot, agent: "codex" });

    expect(record.agent).toBe("codex");
    expect(readLock(repoRoot).agent).toBe("codex");
  });

  it("does not treat a live marker as stale just because it is old", () => {
    fs.mkdirSync(join(repoRoot, ".agents"), { recursive: true });
    fs.writeFileSync(
      join(repoRoot, ".agents", "EDITING"),
      JSON.stringify({ pid: process.pid, agent: "hermes", startedAt: "2000-01-01T00:00:00Z" })
    );

    expect(() => acquireLock({ repoRoot, agent: "codex" })).toThrowError(/already being edited/);
  });

  it("refuses to release a lock owned by another process", () => {
    acquireLock({ repoRoot, agent: "hermes", pid: 999999 });

    expect(() => releaseLock({ repoRoot, pid: process.pid })).toThrowError(/owned by pid/);
    expect(readLock(repoRoot)).not.toBeNull();
  });

  it("releases the lock for its owner", () => {
    acquireLock({ repoRoot, agent: "hermes" });
    const result = releaseLock({ repoRoot });

    expect(result.released).toBe(true);
    expect(readLock(repoRoot)).toBeNull();
  });

  it("reports a free tree instead of throwing", () => {
    expect(releaseLock({ repoRoot }).reason).toBe("NOT_HELD");
  });

  it("recovers a corrupt marker instead of blocking forever", () => {
    fs.mkdirSync(join(repoRoot, ".agents"), { recursive: true });
    fs.writeFileSync(join(repoRoot, ".agents", "EDITING"), "{not json");

    expect(readLock(repoRoot).corrupt).toBe(true);
    expect(acquireLock({ repoRoot, agent: "codex" }).agent).toBe("codex");
  });

  it("releases the lock even when the guarded work throws", () => {
    expect(() =>
      withAgentLock({ repoRoot, agent: "hermes" }, () => {
        throw new Error("boom");
      })
    ).toThrowError("boom");
    expect(readLock(repoRoot)).toBeNull();
  });

  it("leaves no guard file behind", () => {
    acquireLock({ repoRoot, agent: "hermes" });
    releaseLock({ repoRoot, force: true });

    expect(fs.existsSync(join(repoRoot, ".agents", "EDITING.guard"))).toBe(false);
  });

  it("classifies process liveness", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(999999)).toBe(false);
    expect(isProcessAlive(0)).toBe(false);
    expect(isProcessAlive(undefined)).toBe(false);
  });

  it("requires a repository root", () => {
    expect(() => acquireLock({})).toThrowError(LockError);
  });
});
