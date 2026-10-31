# Post-Hermes review and next development plan — 2026-10-31

This is a source/artifact review, not a new test run. The owner delegates execution
of tests to Hermes. No implementation, dependency upgrade, merge or release occurs
as part of this planning review.

## What the saved evidence supports

- Hermes reports check/build/check, 248 unit tests, mutation checks, portal build and
  Firefox manifest lint succeeded. The saved Chromium report independently contains
  102 route/viewport entries and seven interaction groups. The session report does
  not include full command logs/exit codes, so do not call every result independently
  reproduced or attach these results to a later changed tree.
- Native menu gestures/activeTab, issue regression acceptance, real devices and live
  remote-account checks remain open. Portal extension E2E was skipped, not passed.
  CI already runs `HEADED=true xvfb-run npm --prefix apps/web-portal run test:e2e`;
  lack of a physical display is not by itself a reason to leave this suite skipped.
- Saved audit has root 7 findings (2 low/5 moderate), editor 18 (2 low/15 moderate/1 high),
  portal 14 moderate, and zero findings in the three production-only views.
- `audit-dependency-trees.js` sets exit code 1 for a high/critical finding in either
  scope. The report's audit PASS is inconsistent with its own saved high finding.
  Its actual exit status needs recorded evidence; it cannot be accepted as a clean gate.
- Production-only audit is an installation classification. Svelte is a devDependency
  yet contributes code to shipped bundles. Zero `--omit=dev` findings does not establish
  that all bundled runtime code is free of advisories. Review reachability per package.

## Priority 1 — repair the new type contracts

Hermes's declarations do not consistently describe the JavaScript:

- `library-mutations.d.ts` declares `{ok,result}` as the direct mutation return, while
  JS returns the result itself. The envelope exists only at the runtime message boundary.
- It imports Playlist from `types/services.js`, which imports the model type for its
  own use rather than exporting it. Import the canonical model directly.
- It exports `plainPlaylist`, but JS keeps that helper private.
- It permits create/update/reorder operations that JS rejects as unknown.
- Capture declarations use terminal state `done`, while JS writes `complete`; they omit
  destination-only jobs, nullable source snapshots, custom destination IDs and result fields.
- Shared client declarations duplicate model structures and promise a required revision
  for operations whose actual results need not have one. Keep variants distinct.

Use one shared discriminated operation/result/job contract. Prefer JSDoc checked against
JS or generated declarations, rather than unrelated handwritten copies. Type-level
negative fixtures should reject unsupported operations and enforce correct result access.
Acceptance: Hermes check/build plus faithful runtime contract tests; no casts introduced
solely to hide protocol inconsistencies. Passing check alone is not proof JS and d.ts agree.

## Priority 2 — resolve security findings and audit status

Editor path: `http-proxy` → `follow-redirects` 1.16.0/1.16.1. The saved advisory is
[GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p): cross-realm
sensitiveHeaders arrays can lose custom credential protections on redirects; patched
version is 1.16.2 (checked 2026-10-31). The local proxy imports http-proxy, so assess the
actual developer-server exposure and caller behavior; do not claim an exploit was proven.

Inspect installed/lockfile versions, prefer a compatible transitive lock refresh using
npm 10.8.2, then review other findings by reachability. No forced majors or blanket
severity exceptions. Record direct/transitive paths, whether emitted into bundles or
used by build/server tools, remediation and residual risk. Hermes reruns the six audit
views and affected build/test gates. A generated audit JSON is not a passing exit code.

## Priority 3 — complete existing acceptance gates

After contract/security changes, ask Hermes to execute sequential verification and the
headed portal/extension suite with HEADED=true under Xvfb (or a suitable real display).
The test harness must not report a green mandatory job when all extension tests skip
or when the worker fails to register.

Then complete real Chrome and Firefox native gestures in disposable profiles against
the loopback fixture: first non-YouTube page import/activeTab, then settings, scopes,
concurrency, navigation/cancellation/closure and worker restart. Record exact browser
versions and built artifact identities. Calling event handlers is not native proof.

Collect #10/#11/#13/#14 regression evidence. Keep Android hardware and live-account
checks explicitly unverified when unavailable; no silent conversion into desktop coverage.
Do not close issues/resolve review threads or mark release readiness before their evidence.

## Three new recommendations

- CM-R7 — Verification receipts: save command, actual exit code, browser/tool versions,
  tested tree/patch identity and artifact hashes outside transient dist. This prevents
  skipped/stale results or advisory output being mistaken for a passed gate.
- CM-R8 — Generated protocol contracts: derive d.ts from checked JS/JSDoc and use one
  canonical operation/job/result definition. This prevents green type checks backed by
  declarations that disagree with runtime behavior.
- CM-R9 — Bundle-aware dependency inventory: map packages to emitted extension chunks,
  development servers and build tools. This makes security triage follow shipped code
  and exposure instead of relying only on devDependency/production flags.

No new product feature is recommended before these correctness and acceptance gaps close.
