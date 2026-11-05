# Evidence harnesses for OpenSpec tasks

Use when a task demands recorded evidence ("save exact commands and exit codes",
"record the verification", "prove X"). A harness that regenerates the evidence beats a
pasted transcript: the next session can rerun it and diff the result.

## Shape of the script

Put it in the repo's tooling directory as a plain Node/Python script, no framework:

1. Run only in a disposable fixture (`mkdtemp` under the system temp dir). Delete it at
   the end; never point a harness at the real working tree.
2. Print JSON to stdout and optionally write it with `--out <path>`. Include:
   `generatedAt`, repository `head` and `tree` (before *and* after), toolchain versions,
   and `remoteMutation: "none"` when nothing touched a remote.
3. Capture each case's `name`, exact argv, `exitCode`, `durationMs` and short
   stdout/stderr tails. Short tails only — never paste full logs into evidence.
4. Exit non-zero when a case fails (`process.exit(summary.allPassed ? 0 : 1)`), so CI and
   a future session can trust the result without reading the JSON.
5. Add a `summary` block asserting the invariants the task names, not just "ran fine".

## Running repo gates

- Execute gates sequentially with an argv array and `shell: false`, capturing `status`
  from `spawnSync`; do not pipe through a shell or `&&` chain that hides which gate failed.
- Compare `head`/`tree` before and after and record `treeUnchanged` — a gate that mutates
  the tree (codegen, formatting) is a finding, not a pass.
- Record environment-specific failures with their attribution instead of hiding them:
  a gate failing on a file that is untracked/preexisting belongs in
  `knownUnrelatedFailures` with the reason, and must not be "fixed" by reverting someone
  else's work.
- Gates that need a network install (`npm ci`) or a browser are a separate class: state
  plainly in the evidence note which gates were not run rather than implying full
  coverage.

## Fixture pitfalls

- Managed workspaces created *inside* the repo make the parent `git status` report them
  as untracked, so dirty-detection tests pass for the wrong reason. Create them under the
  temp dir unless the case is explicitly about nesting.
- Local remotes: `git init --bare --initial-branch=<target>`, seed clone pushes the target,
  feature clone branches from it, a second clone advances the target. This gives real
  push/fetch/merge behaviour with no network and no credentials.
- Refusal paths (denied credentials, collisions) are easiest to force with a
  `hooks/pre-receive` script in the bare repo that prints a message and exits 1; assert on
  the classified result, not on git's exact wording.
- For "lost response" cases, make the fake service store the effect and *then* throw, so
  the retry really would duplicate if the code retried blindly.

## After the run

- Commit the JSON together with the script and a short README listing the reproduction
  command per task.
- Keep generated evidence out of the formatter's scope; formatting recorded output makes
  the next regeneration show a spurious diff.
