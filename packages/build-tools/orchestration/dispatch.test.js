import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import {
  LaunchStatus,
  buildLaunchRequest,
  hashExecutable,
  verifyExecutablePin,
  buildManualHandoff,
  discoverAgentAdapters,
  dispatchImplementation,
  selectLaunchAdapter,
} from "./dispatch.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function writeExecutable(dir, name, body) {
  const path = join(dir, name);
  fs.writeFileSync(path, body, { mode: 0o755 });
  return path;
}

const HERMES_STUB = `#!/bin/sh
case "$1" in
  --version) echo "Hermes Agent v0.0.0-stub"; exit 0 ;;
  --help) echo "usage: hermes [-z PROMPT] [--in DIR] [--skills SKILLS]"; exit 0 ;;
  *) exit 0 ;;
esac
`;

const CLAUDE_STUB = `#!/bin/sh
case "$1" in
  --version) echo "9.9.9 (Claude Code stub)"; exit 0 ;;
  --help) echo "Options: -p, --print   --add-dir <dirs...>"; exit 0 ;;
  *) exit 0 ;;
esac
`;

const BROKEN_STUB = `#!/bin/sh
exit 3
`;

const UNVERIFIED_STUB = `#!/bin/sh
case "$1" in
  --version) echo "mystery 1.0"; exit 0 ;;
  --help) echo "no useful flags here"; exit 0 ;;
  *) exit 0 ;;
esac
`;

function fakeChild({ pid = 4242, emitError = null } = {}) {
  const handlers = {};
  const child = {
    pid,
    once(event, handler) {
      handlers[event] = handler;
      if (event === "error" && emitError) {
        process.nextTick(() => handler(emitError));
      }
      return child;
    },
    unref() {},
  };
  return child;
}

describe("Dispatch - capability discovery", () => {
  let dir;

  beforeAll(() => {
    dir = fs.mkdtempSync(join("/tmp", "dispatch-discovery-"));
    writeExecutable(dir, "hermes", HERMES_STUB);
    writeExecutable(dir, "claude", CLAUDE_STUB);
    writeExecutable(dir, "broken", BROKEN_STUB);
    writeExecutable(dir, "mystery", UNVERIFIED_STUB);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("verifies adapters whose help output shows the exact invocation form", () => {
    const adapters = discoverAgentAdapters({
      candidates: { hermes: "hermes", claude: "claude", codex: "codex" },
      pathValue: dir,
      run: spawnSync,
    });

    const hermes = adapters.find((a) => a.name === "hermes");
    const claude = adapters.find((a) => a.name === "claude");
    const codex = adapters.find((a) => a.name === "codex");

    expect(hermes.available).toBe(true);
    expect(hermes.capabilities).toContain("dispatch");
    expect(hermes.executable).toBe(join(dir, "hermes"));
    expect(claude.available).toBe(true);
    expect(codex.available).toBe(false);
    expect(codex.reason).toBe("not-installed");
    expect(codex.capabilities).toEqual([]);
  });

  it("does not claim capability when the version probe fails", () => {
    const [broken] = discoverAgentAdapters({
      candidates: { hermes: "broken" },
      pathValue: dir,
      run: spawnSync,
    });
    expect(broken.available).toBe(false);
    expect(broken.reason).toBe("version-probe-failed");
  });

  it("does not claim capability when the invocation form is unproven", () => {
    const [mystery] = discoverAgentAdapters({
      candidates: { hermes: "mystery" },
      pathValue: dir,
      run: spawnSync,
    });
    expect(mystery.available).toBe(false);
    expect(mystery.reason).toBe("invocation-form-not-verified");
  });
});

describe("Dispatch - launch request safety", () => {
  it("builds an argument array with no shell interpretation", () => {
    const launch = buildLaunchRequest("hermes", {
      executable: "/usr/local/bin/hermes",
      worktreePath: "/tmp/wt/job-1",
      prompt: "implement task 3.3; rm -rf / --dry-run $(whoami)",
      skills: ["openspec-apply-change"],
    });

    expect(launch.shell).toBe(false);
    expect(launch.args[0]).toBe("-z");
    expect(launch.args[1]).toContain("; rm -rf /");
    expect(launch.args).toContain("--in");
    expect(launch.args).toContain("/tmp/wt/job-1");
    expect(launch.args).toContain("--skills");
    expect(launch.args).toContain("openspec-apply-change");
  });

  it("rejects launch requests without a worktree or prompt", () => {
    expect(() => buildLaunchRequest("hermes", { executable: "hermes", prompt: "x" })).toThrow();
    expect(
      buildLaunchRequest("unknown", { executable: "x", worktreePath: "/tmp", prompt: "x" })
    ).toBeNull();
  });
});

describe("Dispatch - manual handoff fallback", () => {
  const request = {
    jobId: "job-1",
    changeName: "orchestrate-parallel-implementations",
    worktreePath: "/tmp/wt/job-1",
    branch: "feat/job-1",
    task: "3.3 Discover supported agent launch interfaces",
    skills: ["openspec-apply-change"],
    roles: { implementer: "hermes", verifier: "hermes" },
  };

  it("emits exact instructions instead of pretending to launch", () => {
    const handoff = buildManualHandoff(request);
    expect(handoff.status).toBe(LaunchStatus.MANUAL_HANDOFF);
    expect(handoff.worktreePath).toBe("/tmp/wt/job-1");
    const text = handoff.instructions.join("\n");
    expect(text).toContain("/tmp/wt/job-1");
    expect(text).toContain("feat/job-1");
    expect(text).toContain("openspec-apply-change");
    expect(text).toContain("3.3 Discover supported agent launch interfaces");
    expect(text).toContain("Verifier: hermes");
    expect(text.toLowerCase()).toContain("resume");
    expect(handoff.pid).toBeUndefined();
  });

  it("returns the handoff when no adapter is available", async () => {
    const handoff = buildManualHandoff(request);
    const receipt = await dispatchImplementation({
      adapter: { name: "hermes", available: false, reason: "not-installed" },
      request,
      handoff,
      spawn: () => {
        throw new Error("must not spawn");
      },
    });

    expect(receipt.status).toBe(LaunchStatus.MANUAL_HANDOFF);
    expect(receipt.instructions).toBeDefined();
    expect(receipt.pid).toBeUndefined();
  });
});

describe("Dispatch - launch failures never claim a running job", () => {
  const request = {
    jobId: "job-1",
    worktreePath: "/tmp/wt/job-1",
    prompt: "do the task",
  };
  const adapter = { name: "hermes", available: true, executable: process.execPath };

  it("reports launch failure when spawn yields no pid", async () => {
    const receipt = await dispatchImplementation({
      adapter,
      request,
      spawn: () => fakeChild({ pid: null }),
    });
    expect(receipt.status).toBe(LaunchStatus.LAUNCH_FAILED);
    expect(receipt.reason).toBe("no-pid");
    expect(receipt.status).not.toBe("running");
  });

  it("reports launch failure when spawn throws", async () => {
    const receipt = await dispatchImplementation({
      adapter,
      request,
      spawn: () => {
        throw new Error("EACCES");
      },
    });
    expect(receipt.status).toBe(LaunchStatus.LAUNCH_FAILED);
    expect(receipt.reason).toContain("EACCES");
  });

  it("reports launch failure when the child emits an error", async () => {
    const receipt = await dispatchImplementation({
      adapter,
      request,
      spawn: () => fakeChild({ emitError: new Error("ENOENT") }),
    });
    expect(receipt.status).toBe(LaunchStatus.LAUNCH_FAILED);
    expect(receipt.reason).toContain("ENOENT");
  });

  it("reports launch failure for a non-executable path", async () => {
    const receipt = await dispatchImplementation({
      adapter: { ...adapter, executable: join("/tmp", "does-not-exist-hermes") },
      request,
      spawn: () => fakeChild(),
    });
    expect(receipt.status).toBe(LaunchStatus.LAUNCH_FAILED);
    expect(receipt.reason).toBe("executable-not-executable");
  });
});

describe("Dispatch - successful dispatch claims only 'dispatched'", () => {
  const request = {
    jobId: "job-1",
    worktreePath: "/tmp/wt/job-1",
    prompt: "implement",
    skills: ["openspec-apply-change"],
  };
  const adapter = { name: "hermes", available: true, executable: process.execPath };

  it("returns a dispatched receipt with the exact argv", async () => {
    const calls = [];
    const receipt = await dispatchImplementation({
      adapter,
      request,
      spawn: (executable, args, options) => {
        calls.push({ executable, args, options });
        return fakeChild({ pid: 5150 });
      },
    });

    expect(receipt.status).toBe(LaunchStatus.DISPATCHED);
    expect(receipt.pid).toBe(5150);
    expect(receipt.jobId).toBe("job-1");
    expect(calls).toHaveLength(1);
    expect(calls[0].options.shell).toBe(false);
    expect(calls[0].options.cwd).toBe("/tmp/wt/job-1");
    expect(calls[0].args[0]).toBe("-z");
    expect(receipt.status).not.toBe("running");
    expect(receipt.status).not.toBe("completed");
  });

  it("never reports a terminal or running state from a launch receipt", async () => {
    const receipts = await Promise.all([
      dispatchImplementation({ adapter, request, spawn: () => fakeChild({ pid: 1 }) }),
      dispatchImplementation({
        adapter: { ...adapter, available: false, reason: "not-installed" },
        request,
        handoff: buildManualHandoff({ ...request, changeName: "c", branch: "b", task: "t" }),
      }),
      dispatchImplementation({ adapter, request, spawn: () => fakeChild({ pid: null }) }),
    ]);

    const allowed = new Set([
      LaunchStatus.DISPATCHED,
      LaunchStatus.LAUNCH_FAILED,
      LaunchStatus.MANUAL_HANDOFF,
      LaunchStatus.UNSUPPORTED,
    ]);
    for (const receipt of receipts) {
      expect(allowed.has(receipt.status)).toBe(true);
    }
  });
});

describe("Dispatch - policy adapter selection", () => {
  const policy = JSON.parse(readFileSync(resolve(__dirname, "policy.json"), "utf-8"));

  it("selects a verified adapter for the implementer role", () => {
    const verified = [
      {
        name: "hermes",
        available: true,
        capabilities: ["dispatch"],
        executable: "/usr/local/bin/hermes",
      },
    ];
    const result = selectLaunchAdapter({ policy, verifiedAdapters: verified, role: "implementer" });
    expect(result.reason).toBe("verified");
    expect(result.adapter.name).toBe("hermes");
  });

  it("falls back to manual when the role adapter is unverified", () => {
    const result = selectLaunchAdapter({ policy, verifiedAdapters: [], role: "implementer" });
    expect(result.adapter).toBeNull();
    expect(result.reason).toBe("capability-unavailable");
  });

  it("treats the manual role adapter as manual-only", () => {
    const manualPolicy = {
      roles: { implementer: { adapter: "manual-handoff" } },
      allowedAdapters: [{ name: "manual-handoff", type: "manual", capabilities: ["dispatch"] }],
    };
    const result = selectLaunchAdapter({
      policy: manualPolicy,
      verifiedAdapters: [],
      role: "implementer",
    });
    expect(result.adapter).toBeNull();
    expect(result.reason).toBe("manual-only");
  });
});

describe("Dispatch - executable pins fail closed", () => {
  let dir;
  let hermesPath;
  const hermesSha = () => hashExecutable(hermesPath);

  beforeAll(() => {
    dir = fs.mkdtempSync(join("/tmp", "dispatch-pins-"));
    hermesPath = writeExecutable(dir, "hermes", HERMES_STUB);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("accepts an executable whose path and hash match the pin", () => {
    const [adapter] = discoverAgentAdapters({
      candidates: { hermes: "hermes" },
      pathValue: dir,
      pins: { hermes: { path: hermesPath, sha256: hermesSha() } },
      requirePins: true,
      run: spawnSync,
    });

    expect(adapter.available).toBe(true);
    expect(adapter.pinned).toBe(true);
    expect(adapter.sha256).toBe(hermesSha());
  });

  it("refuses an executable whose bytes do not match the pin", () => {
    const [adapter] = discoverAgentAdapters({
      candidates: { hermes: "hermes" },
      pathValue: dir,
      pins: { hermes: { path: hermesPath, sha256: "0".repeat(64) } },
      requirePins: true,
      run: spawnSync,
    });

    expect(adapter.available).toBe(false);
    expect(adapter.reason).toBe("executable-pin-hash-mismatch");
    expect(adapter.capabilities).toEqual([]);
  });

  it("refuses an unpinned executable in strict mode", () => {
    const [adapter] = discoverAgentAdapters({
      candidates: { hermes: "hermes" },
      pathValue: dir,
      requirePins: true,
      run: spawnSync,
    });

    expect(adapter.available).toBe(false);
    expect(adapter.reason).toBe("unpinned-executable");
  });

  it("still reports capability when pins are advisory", () => {
    const [adapter] = discoverAgentAdapters({
      candidates: { hermes: "hermes" },
      pathValue: dir,
      run: spawnSync,
    });

    expect(adapter.available).toBe(true);
    expect(adapter.pinned).toBe(false);
  });

  it("refuses a pin without a hash", () => {
    const [adapter] = discoverAgentAdapters({
      candidates: { hermes: "hermes" },
      pathValue: dir,
      pins: { hermes: { path: hermesPath } },
      requirePins: true,
      run: spawnSync,
    });

    expect(adapter.available).toBe(false);
    expect(adapter.reason).toBe("executable-pin-missing-hash");
  });

  it("refuses a pin that names a different file", () => {
    const otherPath = writeExecutable(dir, "other-hermes", HERMES_STUB);
    const [adapter] = discoverAgentAdapters({
      candidates: { hermes: "hermes" },
      pathValue: dir,
      pins: { hermes: { path: otherPath, sha256: hermesSha() } },
      requirePins: true,
      run: spawnSync,
    });

    expect(adapter.available).toBe(false);
    expect(adapter.reason).toBe("executable-pin-path-mismatch");
  });

  it("verifies the real file behind a symlink", () => {
    const linkPath = join(dir, "hermes-link");
    fs.symlinkSync(hermesPath, linkPath);

    const pin = verifyExecutablePin(linkPath, { path: hermesPath, sha256: hermesSha() });
    expect(pin.ok).toBe(true);
    expect(pin.sha256).toBe(hermesSha());
  });

  it("reports a missing pinned path", () => {
    const pin = verifyExecutablePin(hermesPath, {
      path: join(dir, "gone"),
      sha256: hermesSha(),
    });
    expect(pin.ok).toBe(false);
    expect(pin.reason).toBe("path-missing");
  });
});
