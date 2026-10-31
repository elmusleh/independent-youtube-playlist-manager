import { createHash } from "crypto";
import fs from "fs";

/**
 * Executable discovery and integrity pinning for agent launchers.
 *
 * Pins are supplied by the caller (machine-local, never committed) so that a hijacked
 * PATH entry cannot receive a worktree-writing prompt.
 */

export function findExecutable(name, pathValue = process.env.PATH || "") {
  if (!name) return null;
  if (name.includes("/")) return fs.existsSync(name) ? name : null;
  for (const dir of pathValue.split(":")) {
    if (!dir) continue;
    const candidate = `${dir}/${name}`;
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

/**
 * Hash the file an executable resolves to, so a pin covers the real bytes even when a
 * launcher is a symlink.
 */
export function hashExecutable(executable) {
  const real = fs.realpathSync(executable);
  return createHash("sha256").update(fs.readFileSync(real)).digest("hex");
}

/**
 * Verify a machine-local executable pin. Pins are never assumed: a missing pin, missing
 * hash, path mismatch or hash mismatch all fail closed.
 */
export function verifyExecutablePin(executable, pin) {
  if (!pin) return { ok: false, reason: "unpinned-executable" };
  if (!pin.sha256) return { ok: false, reason: "missing-hash" };

  let real;
  try {
    real = fs.realpathSync(executable);
  } catch {
    return { ok: false, reason: "not-installed" };
  }

  if (pin.path) {
    let pinnedReal;
    try {
      pinnedReal = fs.realpathSync(pin.path);
    } catch {
      return { ok: false, reason: "path-missing", expectedPath: pin.path };
    }
    if (pinnedReal !== real) {
      return { ok: false, reason: "path-mismatch", expectedPath: pinnedReal, actualPath: real };
    }
  }

  const actual = hashExecutable(executable);
  if (actual !== String(pin.sha256).toLowerCase()) {
    return { ok: false, reason: "hash-mismatch", expectedSha256: pin.sha256, actualSha256: actual };
  }

  return { ok: true, reason: "pinned", sha256: actual, path: real };
}
