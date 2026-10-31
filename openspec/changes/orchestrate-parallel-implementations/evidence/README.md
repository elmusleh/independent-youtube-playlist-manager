# Orchestration evidence

Recorded evidence for the `orchestrate-parallel-implementations` change. Every harness
writes JSON and exits non-zero when its own checks fail.

## Task 3.1 — workspace preflight

```bash
node packages/build-tools/orchestration/evidence-preflight.js \
  --out openspec/changes/orchestrate-parallel-implementations/evidence/task-3.1-preflight.json
```

Exit code `0` means `summary.allCasesPassed` is `true`. The harness works only in a
disposable `/tmp` repository and deletes it afterwards; it never touches this tree.

| Case                           | Expectation                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `committedPrerequisites`       | Required artifacts exist in the committed starting snapshot                                       |
| `missingCommittedPrerequisite` | Missing committed artifact is reported in `missing`                                               |
| `dirtySourcePreservation`      | Dirty source is detected, warned about and left untouched (never auto-committed or discarded)     |
| `protectedBranch`              | `main` (and `next`/`release/*`/`hotfix/*`/`production`) is rejected                               |
| `occupiedBranchReuse`          | Existing job/branch/worktree is reused instead of duplicated, with no false "branch exists" error |
| `validAllocation`              | Clean allocation passes dry-run and `preflightJob`                                                |

## Task 3.3 — agent launch capabilities

```bash
node packages/build-tools/orchestration/dispatch.js discover \
  --out openspec/changes/orchestrate-parallel-implementations/evidence/task-3.3-capabilities.json
```

Re-run on the machine that will actually dispatch, since capability is verified per host
(`--version` plus every flag the adapter passes). The report includes each executable's
SHA-256 so it can be recorded in a machine-local pin file; production dispatch passes
`requirePins: true` so an unpinned or altered executable gets no dispatch capability.

```bash
node packages/build-tools/orchestration/dispatch.js discover \
  --pins orchestration.pins.json --require-pins
```

## Task 7.1 — repository check gates

```bash
node packages/build-tools/orchestration/evidence-integrated.js \
  --out openspec/changes/orchestrate-parallel-implementations/evidence/task-7.1-checks.json
```

Runs tests, lint, format, file-size, CSS bundle, Vercel config, protocol contracts and
release-notes checks sequentially, recording exact argv, exit codes, durations and the
head/tree before and after. It performs no remote mutation and does not run build gates
that require `npm ci`/network access.

`contracts-check` currently fails because of **untracked, unrelated** working-tree files
(`apps/browser-extension/background/capture-import.js`, `capture-controller.d.ts`); this
change preserves them rather than modifying them, and the failure is recorded as
`knownUnrelatedFailures` instead of being hidden.

## Task 7.2 — two parallel jobs, one queued

```bash
node packages/build-tools/orchestration/demo-parallel.js \
  --out openspec/changes/orchestrate-parallel-implementations/evidence/task-7.2-demo.json
```

Builds a disposable repo plus bare local remote and demonstrates: two implementing jobs
in separate worktrees with unique ports/profiles, a third job queued by the two-slot
limit, manual dispatch handoff when no agent adapter is available, implementer→verifier
writer handoff and resume, a conflicting target update that needs intervention, and a
zero-overlap writer proof. The fixture is deleted afterwards.

## Deliberate exceptions

`registry.js`, `recovery.js` and `workspace.js` exceed the 350-line file-size gate and are
listed in `verify-file-size.js` as accepted debt. Splitting the lock/journal and Git
primitive helpers out is recorded as follow-up work rather than done inside this change.
