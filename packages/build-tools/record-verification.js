/* eslint-disable no-console */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { sourceIdentity, artifactIdentity } = require("./verification/identity.js");
const { commandForGate } = require("./verification/gates.js");
const root = path.resolve(__dirname, "../..");
async function main() {
  const gate = process.argv[2];
  const selected = commandForGate(gate, root);
  const directory = path.resolve(
    process.env.IYPM_VERIFICATION_DIR || path.join(os.homedir(), ".local/state/iypm/verification")
  );
  if (directory === root || directory.startsWith(root + path.sep))
    throw new Error(
      "Store receipts outside the checkout so they cannot alter their own source identity."
    );
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const id = crypto.randomUUID();
  const file = path.join(directory, `${id}.json`);
  const receipt = {
    schemaVersion: 1,
    id,
    gate,
    cwd: root,
    command: [selected.command, ...selected.args],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: "NOT RUN",
    exitCode: null,
    signal: null,
    sourceBefore: sourceIdentity(root),
    sourceAfter: null,
    sourceChanged: null,
    artifactsBefore: artifactIdentity(root),
    artifactsAfter: null,
    versions: {
      node: process.version,
      npm: spawnSync("npm", ["--version"], { encoding: "utf8" }).stdout?.trim() || "unavailable",
    },
    output: null,
    error: null,
  };
  function save() {
    const temporary = file + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
    fs.renameSync(temporary, file);
  }
  save();
  const stdout = crypto.createHash("sha256"),
    stderr = crypto.createHash("sha256");
  let stdoutBytes = 0,
    stderrBytes = 0;
  const child = spawn(selected.command, selected.args, {
    cwd: root,
    env: {
      ...process.env,
      ...selected.environment,
      IYPM_VERIFICATION_E2E_REPORT: file + ".e2e.json",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (data) => {
    stdout.update(data);
    stdoutBytes += data.length;
    process.stdout.write(data);
  });
  child.stderr.on("data", (data) => {
    stderr.update(data);
    stderrBytes += data.length;
    process.stderr.write(data);
  });
  child.on("error", (error) => {
    receipt.error = error.code || "launch_failed";
  });
  const interrupt = () => child.kill("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  await new Promise((resolve) =>
    child.on("close", (code, signal) => {
      receipt.exitCode = code;
      receipt.signal = signal;
      resolve();
    })
  );
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
  receipt.finishedAt = new Date().toISOString();
  receipt.sourceAfter = sourceIdentity(root);
  receipt.sourceChanged =
    receipt.sourceBefore.sha256 !== receipt.sourceAfter.sha256 ||
    receipt.sourceBefore.head !== receipt.sourceAfter.head;
  receipt.artifactsAfter = artifactIdentity(root);
  receipt.output = {
    stdoutSha256: stdout.digest("hex"),
    stderrSha256: stderr.digest("hex"),
    stdoutBytes,
    stderrBytes,
  };
  receipt.status =
    receipt.error || receipt.signal
      ? "BLOCKED"
      : receipt.exitCode !== 0
        ? "FAIL"
        : receipt.sourceChanged
          ? "BLOCKED"
          : "PASS";
  if (gate === "headed") {
    try {
      receipt.browserEvidence = JSON.parse(fs.readFileSync(file + ".e2e.json", "utf8"));
      if (!receipt.browserEvidence.mandatoryPassed) receipt.status = "FAIL";
    } catch {
      receipt.status = "BLOCKED";
      receipt.error = "missing_headed_evidence";
    }
  }
  // Raw child output is never persisted: tests can print page data or credentials.
  save();
  console.log(
    `Verification receipt: ${file} (${receipt.status}; command exit ${receipt.exitCode})`
  );
  process.exitCode = receipt.status === "PASS" ? 0 : 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
