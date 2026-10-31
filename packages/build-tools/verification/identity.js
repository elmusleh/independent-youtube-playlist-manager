const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}
function sourceIdentity(root) {
  const names = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root }
  )
    .toString()
    .split("\0")
    .filter(Boolean);
  const hash = crypto.createHash("sha256");
  let files = 0;
  for (const relative of [...new Set(names)].sort()) {
    const filename = path.join(root, relative);
    const stat = fs.lstatSync(filename, { throwIfNoEntry: false });
    if (!stat) {
      hash.update(`${relative}\0DELETED\0`);
      continue;
    }
    if (!stat.isFile() && !stat.isSymbolicLink()) continue;
    const content = stat.isSymbolicLink() ? fs.readlinkSync(filename) : fs.readFileSync(filename);
    hash.update(
      `${relative}\0${stat.isSymbolicLink() ? "link" : stat.mode & 0o111}\0${sha(content)}\0`
    );
    files++;
  }
  return {
    head: git(root, ["rev-parse", "HEAD"]),
    branch: git(root, ["branch", "--show-current"]),
    sha256: hash.digest("hex"),
    files,
  };
}
function artifactIdentity(root) {
  const result = {};
  for (const folder of ["dist/chrome", "dist/firefox", "dist/edge"]) {
    const base = path.join(root, folder);
    if (!fs.existsSync(base)) {
      result[folder] = null;
      continue;
    }
    const hash = crypto.createHash("sha256");
    let count = 0;
    function walk(directory) {
      for (const name of fs.readdirSync(directory).sort()) {
        if (name === "web-ext-artifacts") continue;
        const filename = path.join(directory, name);
        const stat = fs.lstatSync(filename);
        if (stat.isDirectory()) walk(filename);
        else if (stat.isFile()) {
          hash.update(`${path.relative(base, filename)}\0${sha(fs.readFileSync(filename))}\0`);
          count++;
        }
      }
    }
    walk(base);
    result[folder] = { sha256: hash.digest("hex"), files: count };
  }
  return result;
}
module.exports = { sourceIdentity, artifactIdentity, sha };
