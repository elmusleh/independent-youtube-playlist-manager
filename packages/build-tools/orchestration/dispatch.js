#!/usr/bin/env node
/**
 * Agent launch adapters.
 *
 * Capabilities are discovered, not assumed: an adapter exists only for an executable
 * that answers `--version` and whose help output shows the exact invocation form used
 * here. Launch always uses an argument array (never a shell string), and a launch
 * receipt only ever claims `dispatched` — `running`/`completed` require separate
 * evidence from the job journal.
 */

import { spawn as childSpawn, spawnSync } from "child_process";
import fs from "fs";
import { findExecutable, hashExecutable, verifyExecutablePin } from "./dispatch-pins.js";

export { findExecutable, hashExecutable, verifyExecutablePin };

export const LaunchStatus = {
  DISPATCHED: "dispatched",
  LAUNCH_FAILED: "launch-failed",
  MANUAL_HANDOFF: "manual-handoff-required",
  UNSUPPORTED: "unsupported",
};

/** Exact invocation forms verified against `--help` on this machine. */
const VERIFIED_FORMS = {
  hermes: {
    dispatch: {
      // `hermes -z PROMPT --in DIR [--skills ...]` — one-shot non-interactive run.
      args: (request) => [
        "-z",
        request.prompt,
        "--in",
        request.worktreePath,
        ...(request.skills?.length ? ["--skills", request.skills.join(",")] : []),
      ],
      helpTokens: ["-z", "--in", "--skills"],
    },
  },
  claude: {
    dispatch: {
      // `claude -p PROMPT --add-dir DIR` — print mode, non-interactive.
      args: (request) => ["-p", request.prompt, "--add-dir", request.worktreePath],
      helpTokens: ["-p", "--print", "--add-dir"],
    },
  },
};

function probe(run, executable, args) {
  const result = run(executable, args, { encoding: "utf-8" });
  return {
    ok: result?.status === 0,
    stdout: result?.stdout || "",
    stderr: result?.stderr || "",
  };
}

/**
 * Discover which agent launch interfaces actually exist.
 *
 * `candidates` maps adapter keys to executable names/PATHs. `run` is injectable so
 * tests never execute a real agent.
 */
export function discoverAgentAdapters({
  candidates = {},
  pins = {},
  requirePins = false,
  run = spawnSync,
  pathValue,
} = {}) {
  const adapters = [];

  for (const [name, executableName] of Object.entries(candidates)) {
    const executable = findExecutable(executableName, pathValue ?? process.env.PATH);
    const forms = VERIFIED_FORMS[name];
    if (!executable || !forms) {
      adapters.push({
        name,
        available: false,
        reason: executable ? "no-verified-form" : "not-installed",
        capabilities: [],
      });
      continue;
    }

    const version = probe(run, executable, ["--version"]);
    if (!version.ok) {
      adapters.push({
        name,
        available: false,
        reason: "version-probe-failed",
        executable,
        capabilities: [],
      });
      continue;
    }

    const help = probe(run, executable, ["--help"]);
    const verified = help.ok
      ? Object.entries(forms).every(([, form]) =>
          form.helpTokens.every((token) => help.stdout.includes(token))
        )
      : false;

    const pin = verifyExecutablePin(executable, pins[name]);
    const pinAllows = pin.ok || (!requirePins && pin.reason === "unpinned-executable");
    const available = verified && pinAllows;
    let observedSha256 = pin.ok ? pin.sha256 : null;
    if (!observedSha256) {
      try {
        observedSha256 = hashExecutable(executable);
      } catch {
        observedSha256 = null;
      }
    }

    adapters.push({
      name,
      available,
      reason: !pinAllows
        ? pin.reason === "unpinned-executable"
          ? "unpinned-executable"
          : `executable-pin-${pin.reason}`
        : verified
          ? "verified"
          : "invocation-form-not-verified",
      executable,
      sha256: observedSha256,
      pinned: pin.ok,
      version: version.stdout.trim().split("\n")[0] || "",
      capabilities: available ? ["dispatch"] : [],
      ...(pinAllows ? {} : { pinDetail: pin }),
    });
  }

  return adapters;
}

/**
 * Build a launch request for a verified adapter. Args stay an array; nothing here is
 * ever evaluated as shell code.
 */
export function buildLaunchRequest(adapterName, request) {
  const form = VERIFIED_FORMS[adapterName]?.dispatch;
  if (!form) {
    return null;
  }
  if (!request?.worktreePath || !request?.prompt) {
    throw new Error("Launch request requires worktreePath and prompt");
  }
  return {
    executable: request.executable,
    args: form.args(request),
    cwd: request.worktreePath,
    shell: false,
  };
}

/**
 * Exact manual handoff. Produced whenever launch is unavailable; it is instructions,
 * not execution, and never claims a running or completed job.
 */
export function buildManualHandoff({
  jobId,
  changeName,
  worktreePath,
  branch,
  task,
  skills = [],
  roles = {},
}) {
  return {
    status: LaunchStatus.MANUAL_HANDOFF,
    jobId,
    worktreePath,
    branch,
    instructions: [
      `Open a session in ${worktreePath} on branch ${branch}.`,
      `Load the OpenSpec apply skill and run: openspec instructions apply --change "${changeName}" --json`,
      `Start with task: ${task}`,
      skills.length ? `Relevant skills: ${skills.join(", ")}` : null,
      roles.implementer ? `Implementer: ${roles.implementer}` : null,
      roles.verifier ? `Verifier: ${roles.verifier}` : null,
      `Resume: re-open this worktree and re-read the job before editing; do not create a second worktree.`,
    ].filter(Boolean),
  };
}

/**
 * Dispatch one job. Returns a receipt; the state claimed never exceeds `dispatched`.
 */
export async function dispatchImplementation({
  adapter,
  request,
  spawn = childSpawn,
  handoff,
} = {}) {
  if (!adapter || !adapter.available) {
    return {
      status: handoff ? LaunchStatus.MANUAL_HANDOFF : LaunchStatus.UNSUPPORTED,
      ...(handoff ? handoff : { reason: adapter?.reason || "no-adapter" }),
    };
  }

  const launch = buildLaunchRequest(adapter.name, { ...request, executable: adapter.executable });

  try {
    fs.accessSync(launch.executable, fs.constants.X_OK);
  } catch {
    return {
      status: LaunchStatus.LAUNCH_FAILED,
      adapter: adapter.name,
      reason: "executable-not-executable",
      evidence: { executable: launch.executable },
    };
  }

  try {
    const child = spawn(launch.executable, launch.args, {
      cwd: launch.cwd,
      shell: false,
      detached: true,
      stdio: "ignore",
    });

    if (!child || !child.pid) {
      return {
        status: LaunchStatus.LAUNCH_FAILED,
        adapter: adapter.name,
        reason: "no-pid",
        evidence: { executable: launch.executable, args: launch.args },
      };
    }

    // Detached children report errors asynchronously; give the error event one turn
    // before claiming dispatch. A reported error is a failure, never a running job.
    let spawnError = null;
    child.once?.("error", (error) => {
      spawnError = error;
    });
    await new Promise((resolve) => setImmediate(resolve));
    child.unref?.();

    if (spawnError) {
      return {
        status: LaunchStatus.LAUNCH_FAILED,
        adapter: adapter.name,
        reason: spawnError.message,
      };
    }

    return {
      status: LaunchStatus.DISPATCHED,
      adapter: adapter.name,
      pid: child.pid,
      jobId: request.jobId,
      evidence: { executable: launch.executable, args: launch.args, cwd: launch.cwd },
    };
  } catch (error) {
    return {
      status: LaunchStatus.LAUNCH_FAILED,
      adapter: adapter.name,
      reason: error.message,
    };
  }
}

/**
 * Choose an adapter for a policy-allowed role, using only verified adapters.
 */
export function selectLaunchAdapter({ policy, verifiedAdapters = [], role = "implementer" } = {}) {
  const roleConfig = policy?.roles?.[role];
  const allowed = policy?.allowedAdapters || [];
  const allowedEntry = allowed.find((entry) => entry.name === roleConfig?.adapter);
  if (!allowedEntry) {
    return { adapter: null, reason: "role-adapter-not-allowed" };
  }

  if (allowedEntry.type === "manual") {
    return { adapter: null, reason: "manual-only" };
  }

  const adapter = verifiedAdapters.find(
    (candidate) => candidate.available && candidate.name === allowedEntry.type
  );
  return adapter
    ? { adapter, reason: "verified" }
    : { adapter: null, reason: "capability-unavailable" };
}

// CLI: `node dispatch.js discover [--out file]` prints verified launch capabilities.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args[0] !== "discover") {
    console.error(
      "Usage: node dispatch.js discover [--out <file>] [--pins <pins.json>] [--require-pins]"
    );
    process.exit(1);
  }
  const outIndex = args.indexOf("--out");
  const pinsIndex = args.indexOf("--pins");
  const requirePins = args.includes("--require-pins");
  let pins = {};
  if (pinsIndex > -1) {
    const pinsPath = args[pinsIndex + 1];
    if (!pinsPath) {
      console.error("--pins requires a path to a pin file");
      process.exit(1);
    }
    try {
      pins = JSON.parse(fs.readFileSync(pinsPath, "utf-8"));
    } catch (error) {
      console.error(`Could not read pins from ${pinsPath}: ${error.message}`);
      process.exit(1);
    }
  }

  const capabilities = discoverAgentAdapters({
    candidates: { hermes: "hermes", claude: "claude", codex: "codex" },
    pins,
    requirePins,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    adapters: capabilities,
    verified: capabilities
      .filter((a) => a.available)
      .map((a) => ({
        name: a.name,
        executable: a.executable,
        sha256: a.sha256,
        pinned: a.pinned,
        version: a.version,
        forms:
          a.name === "hermes" ? ["-z PROMPT --in DIR [--skills ...]"] : ["-p PROMPT --add-dir DIR"],
      })),
  };
  const json = JSON.stringify(report, null, 2);
  if (outIndex > -1 && args[outIndex + 1]) {
    const target = args[outIndex + 1];
    const { dirname } = await import("path");
    fs.mkdirSync(dirname(target), { recursive: true });
    fs.writeFileSync(target, json + "\n");
  }
  console.log(json);
}
