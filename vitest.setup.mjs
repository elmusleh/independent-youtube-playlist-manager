// Make git-spawning tests hermetic. When the suite runs inside a `git commit`
// pre-commit hook, git exports `GIT_INDEX_FILE` (= `.git/index`) — and possibly
// `GIT_DIR` / `GIT_WORKTREE` / `GIT_COMMON_DIR` — to the hook and every subprocess it
// spawns. The build-tools/orchestration tests create throwaway temp repos and run
// `git worktree add` in them; inheriting a *relative* `GIT_INDEX_FILE` makes git
// resolve the worktree's index against the wrong path and fail with
// "fatal: .git/index: index file open failed: Not a directory". This is deterministic
// under any `git commit` (not a parallelism flake), so it only surfaced via the
// pre-commit hook while plain `npm test` runs clean. Stripping these lets each temp
// repo fall back to its own default index.
for (const key of ["GIT_INDEX_FILE", "GIT_DIR", "GIT_WORKTREE", "GIT_COMMON_DIR"]) {
  delete process.env[key];
}

// Node >= 22.4 ships an experimental `localStorage` global that resolves to
// `undefined` unless the process is started with `--localstorage-file`.
//
// Vitest's jsdom environment copies jsdom's window keys onto globalThis with
// `populateGlobal()`, but it *skips* any key that Node already defines — so the
// broken Node getter wins and bare `localStorage` is undefined everywhere
// (vitest then sets `globalThis.window = globalThis`, which is why
// `window.localStorage` is undefined too).
//
// Re-point the global at the real Storage instance owned by the jsdom window.
const storage = globalThis.jsdom?.window?.localStorage;

if (storage) {
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}
