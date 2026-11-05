# Plan — CM-R7 / CM-R8 / CM-R9 (verification, contracts, bundle inventory)

Status of the interrupted implementation and the exact remaining work. Written after
inspecting the code that already exists, not from the earlier notes.

Ground rules: no new product features until these close; nothing here may infer release
readiness, close issues or approve a merge; every gate records the command, environment
and exit code it actually observed.

---

## CM-R7 — durable verification receipts

**Already in place**

- `packages/build-tools/record-verification.js` runs one gate and writes a receipt with
  command/args/environment, `exitCode`, `signal`, `error`, duration, stdout/stderr
  SHA-256 plus byte counts, `sourceBefore`/`sourceAfter` identity and `sourceChanged`,
  `artifactsBefore`/`artifactsAfter`, and a derived `status`
  (`PASS`/`FAIL`/`BLOCKED`). Raw child output is deliberately not persisted.
- `packages/build-tools/verification/gates.js` maps named gates
  (`check`, `build`, `contracts`, `extension`, `mutations`, `audit`, `web-build`, `headed`,
  `firefox-lint`) to exact argv and environment.
- `packages/build-tools/verification/identity.js` provides `sourceIdentity` (head, tree
  and working-tree hash) and `artifactIdentity`.
- Headed runs bind a browser-evidence file and fail when it is missing or
  `mandatoryPassed !== true`.
- `npm run verify:record -- <gate>` exists.

**Gaps**

1. No receipt is produced by CI; receipts only exist when someone runs the command locally.
2. No index/manifest aggregates receipts for one run, so "which gates ran, with what
   exit codes" is still reconstructed by hand.
3. Skip detection is only implemented for the headed gate.
4. No retention rule: receipts accumulate without a documented location or pruning.

**Steps**

1. Add `--index <dir>` support: after each receipt, append `{gate, status, exitCode,
command, sourceSha256, startedAt}` to `verification/index.json`, and fail the gate when
   a receipt for the same gate/head already exists with a worse status.
2. Wrap the CI steps for `check`, `contracts`, `headed`, `mutations` and `audit` with
   `npm run verify:record -- <gate>`, uploading `verification/` as an artifact.
3. Generalise skip detection: any gate whose output file reports zero executed cases is
   `BLOCKED`, not `PASS` (headed already does this via `browserEvidence`).
4. Document retention: keep the last run under `verification/latest/`, ignore it in git,
   and state that receipts are evidence, not release approval.

**Acceptance**

- A CI run on a branch produces one index listing every gate with its real exit code.
- Faking success is impossible without editing the receipt, which changes its hash.
- Killing a gate mid-run yields `BLOCKED` with the signal recorded.

**Effort:** 2–3 hours. **Risk:** low; no product code touched.

---

## CM-R8 — generated protocol contracts

**Already in place**

- `apps/browser-extension/shared/protocol-contracts.ts` is the canonical type source.
- `packages/build-tools/contracts/program.js` builds a TS program over the extension and
  `generate-protocol-declarations.js` emits `*.d.ts` next to each checked module.
- `npm run contracts:check` regenerates into memory and fails on drift; it runs inside
  `npm run check` and therefore in CI.
- `packages/build-tools/contracts/contract-fixtures.ts` holds compile-time fixtures.

**Gaps**

1. Coverage is opt-in: a new checked module is only enforced once it is added to
   `apiFiles`, and nothing fails when a module with `@ts-check` is missing from that list.
2. The declarations are generated from TS source, not from runtime JSDoc; a runtime value
   that disagrees with the type is only caught if a test exercises it.
3. No negative test proves `contracts:check` actually fails on drift.

**Steps**

1. Discover checked modules automatically: walk `apps/browser-extension/**` for files with
   `// @ts-check` and fail when one is absent from `apiFiles`, printing the exact addition.
2. Add `packages/build-tools/contracts/drift.test.js`: copy the tree to a temp dir, mutate
   one property in `protocol-contracts.ts`, run the generator with `--check`, and assert a
   non-zero exit plus the file name in stderr.
3. Add one runtime assertion per contract boundary (job payload, storage client response)
   so a type/runtime disagreement fails a unit test as well as the type check.

**Acceptance**

- Adding `// @ts-check` to a file without listing it fails `npm run check` with an
  actionable message.
- The drift test fails when the generator is stubbed to no-op.
- `contracts:check` exit 0 on a clean tree and 1 on drift.

**Effort:** 2–4 hours. **Risk:** medium; touches the type-check wiring.

---

## CM-R9 — bundle-aware dependency inventory

**Already in place**

- `packages/build-tools/bundle-inventory.mjs` is a Rollup plugin wired into the production
  build (`rollup.config.js`), emitting `bundle-dependencies.json`.
- `inventory-data.js` maps emitted chunks and modules back to packages and records a
  lockfile hash.
- `inventory-security.js` (`npm run audit:bundles`) refuses a stale inventory and verifies
  each chunk hash before triage.

**Gaps**

1. Nothing classifies each package by _reachability_ (shipped and executed, shipped but
   unreachable, dev-only) — the field security triage actually needs.
2. The Chrome inventory is the only one verified; Edge/Firefox builds are not checked, so a
   bundle difference between targets is invisible.
3. Inventory is produced only on `npm run build`; CI never builds, so no inventory exists
   for a PR.
4. No test asserts that a dependency removed from `package.json` disappears from the
   inventory (stale-entry detection).

**Steps**

1. Add `reachability` per package in `inventory-data.js`: `shipped-executed` when a chunk
   imports it at top level, `shipped-unreferenced` when present but only in metadata, and
   leave dev-only packages out of the shipped manifest entirely.
2. Emit one manifest per target (`dist/{chrome,firefox,edge}/editor/`) and make
   `inventory-security.js` verify every target present.
3. Add a CI job that builds, runs `npm run audit:bundles`, and uploads the manifests.
4. Add tests: fixture Rollup bundle with an unused dependency must be classified
   `shipped-unreferenced`; a removed dependency must not appear.

**Acceptance**

- `npm run build && npm run audit:bundles` prints a per-target, per-package reachability
  table and exits non-zero on a stale or unverified manifest.
- A dependency that is imported only by a dev script never appears as shipped.
- CI fails when only one target's manifest is regenerated.

**Effort:** 4–6 hours (needs a real build). **Risk:** medium; build output paths change.

---

## Suggested order

1. **CM-R7** first (smallest, unlocks trustworthy evidence for the other two).
2. **CM-R8** second (guards the contracts the capture work depends on).
3. **CM-R9** last (needs real builds and touches output layout).

Do not start CM-R8 or CM-R9 until CM-R7 receipts exist for `npm run check` — otherwise
their completion claims rest on the same untraceable output the earlier review rejected.
