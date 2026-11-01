# Handoff — 2026-10-31, verification complete with all automated gates passing

## 2026-11-01 — context-menu + theme fixes merged to `next` (1.2.1, unreleased)

- `next` head `669049d`. Merged: #63 (`c1a9849`, editor UX polish — by a concurrent
  session), #65 (`d74e0ad`, persisted theme applied at startup), #64 (`669049d`,
  context-menu gating / link resolution / reconciliation / advertised destination).
- **Version deliberately unchanged at 1.2.1.** No tag, release, store upload or `main`
  merge. Owner will release after the next batch of changes.
- Fixed in #64: `disableContextSaved` ignored; a non-video YouTube link captured the open
  video; reconciliation could not remove `yph:saved`/`yph:scopes`/`yph:link`/
  `yph:destination`/`yph:settings` and forgot ids across worker restarts;
  `contextMenus.update` was passed `type`; and (Codex P2) the menu advertised a
  destination that `startCapture()` then rejected. Guarded by 9 tests, 3 new mutations
  (7/7 caught) and `shared/link-capture.js`.
- Fixed in #65: the #63 theme key fix was incomplete — the first extension-storage read at
  startup can answer `{}`, so a persisted/synced `themeChoice` was dropped and the page
  painted the device theme. `readStoredChoice()` now retries; a new E2E guard forces a real
  reload and asserts `data-theme` + the pre-paint cache, and fails on the pre-#63 key.
- Verified on `669049d`: `check` 0 (573 tests), `build` 0 (all budgets), `test:extension` 0
  (102 checks, 8 interaction groups), mutations 7/7. Headed acceptance evidence:
  `HEADED=true IYPM_REQUIRE_EXTENSION_E2E=1 xvfb-run -a npx playwright test
e2e/extension.spec.ts` → 2 passed, exit 0, zero skipped.
- Open: OpenSpec 3.2/3.3/3.4 native menu runs (human only — Playwright cannot open a
  native menu), 3.5 issue evidence (#10/#11/#14; #13 first paint is covered), CM-R7/R8/R9,
  popup theme assertion, Dependabot #60–#62 triage.
- Only Markdown touched in this checkout (this entry, `PROGRESS.md`,
  `docs/CONTEXT_MENU_PLAN.md`, `openspec/.../tasks.md`, new session record).
  Full detail: `.ai-sync/sessions/2026-11-01-context-menu-theme-merge.md`.

## 2026-11-01 — pinned favorites plan formalized (planning only, no code)

- Owner request: replace the single `#/favorite` page with multiple favorites, pinned
  in the sidebar between Manage Playlists and Subscriptions (or after Manage
  Playlists when signed out), with horizontal rules around the group.
- Decisions (owner-confirmed): (1) separate the new `favoritePlaylistIds: string[]`
  list from `watchLaterPlaylistId` (which stays the quick-add / Watch-Later keep-alive
  target and is never deleted; `migrateSettings()` seeds the list from it when empty);
  (2) each pin opens its playlist directly, show ~6 then an "All favorites (N)" link
  to a `#/favorites` card-grid page.
- Backward compatibility: additive settings key (default `[]`), idempotent migration
  seed, backup `schemaVersion` stays 2 (import already merges arbitrary settings keys).
  "Many favorites" handled via visible-pin cap + overflow page + sanitize-on-load
  (dedupe / drop missing playlists).
- Full detail: `.ai-sync/sessions/2026-11-01-pinned-favorites-planning.md`.
  PLAN.md and PROGRESS.md updated. Planning only — no application code, manifest,
  dependency or version changed; the already-dirty `feat/ui-polish` tree was left as
  found. Next: implementation awaits owner go (start at the data-model + migration
  task group).

## 2026-11-01 — Firefox mobile (m.youtube.com) watch-history detection hardened

Owner asked to fix watch history not recording / not resuming on mobile, suspected
`m.youtube.com` was not detected. Investigation found the domain detection was already
present in the source (content-script `matches` included `m.youtube.com` since v1.1.1;
all host checks use `endsWith(".youtube.com")`), so the literal hypothesis did not match
the code. Confirmed with `curl` + a Firefox Android UA that YouTube **redirects
`www.youtube.com/watch` → `m.youtube.com/watch`** on Fenix, and that the local-playlist
`watch_videos?...&t=<n>s` generator URL **drops the `t=` param** on its redirect to
`/watch?v=…&list=TL…` (the content-script `get-yph-history` resume path is what actually
resumes, so that fallback is the linchpin).

Changes (uncommitted, on the already-dirty `feat/ui-polish` tree):

- `manifest.chrome.json` + `manifest.firefox.json`: broadened content-script `matches`
  from the fragile `["*://www.youtube.com/watch*", "*://m.youtube.com/watch*"]` whitelist
  to `["*://*.youtube.com/watch*", "*://youtube.com/watch*"]` — now every YouTube
  subdomain (`m.`, `www.`, `music.`, …) and the bare domain are matched, so any redirect
  target or localized host is covered.
- `content-scripts/watch-tracker.js`: `waitForVideoElement` default raised from
  20×200ms (≈4s) to 150×200ms (≈30s) so a slow Fenix page load (video element
  materialising late) no longer silently skips tracking.
- `README.md` + `docs/PRIVACY_POLICY.md`: updated the watch-script match description.

Verification (real exit codes): `npm run build` exit 0 (chrome/firefox/edge; `dist/*/manifest.json`
now carry the new matches; CSS/manifest/bundle budgets pass); `npm run test` 570/570 in 56
files; `npm run lint` 0 errors (46 pre-existing `no-console`/`no-unused-vars` warnings only).

Not changed / deferred: the `t=` param on the `watch_videos` generator is dead for local
playlists because YouTube's redirect drops it; resume relies on the content script. That
playback/resume model is out of scope for this pass and should get a dedicated look if
resume still misbehaves. No commit/push/PR/version bump/release performed. Editing lock
released.

## 2026-11-01 — modal dismissal on outside click implemented (open, uncommitted)

- Implemented the planned fix in `Modal.svelte`: backdrop click/tap now dismisses any
  dismissible dialog (small/standard/wide/drawer), not just the drawer. Added
  `pointerdown` + `click` backdrop tracking so a press that begins inside and ends on the
  backdrop does not dismiss; the `dismissible` guard and cancel routing are unchanged.
- Added interaction coverage in `packages/build-tools/verify-extension.js`: backdrop
  click dismisses the wide import dialog + restores focus; inside-press drag does not
  dismiss; backdrop click on the small delete-confirm cancels (count stays 10).
- Verification (all real exit codes): `npm run lint` 0 (0 errors); `npx svelte-check`
  0 errors; `npm run test` 570/570; `npm run build` exit 0 (chrome/firefox/edge,
  budgets pass); `npm run test:extension` exit 0 — 96 route/viewport checks + **8**
  interaction groups, no runtime errors.
- Known failures, NOT from this change: (1) `npm run check` stops at `format:check`
  because the owner's concurrent session keeps writing `.ai-sync/PROGRESS.md` without
  Prettier (re-run `npx prettier --write .ai-sync/PROGRESS.md`); (2) `contracts:check`
  still fails with `Stale declaration: background/capture-import.d.ts` — fix with
  `npm run contracts:generate` (unrelated background-script issue).
- Files changed: `Modal.svelte`, `packages/build-tools/verify-extension.js`.
  Editing lock released. OpenSpec change `dismiss-dialogs-on-outside-click` remains in
  planning state; mark its tasks 1.x/2.x done on the next pass or when committing.

## 2026-11-01 — modal dismissal plan formalized (planning only, no code)

- Owner request: dialogs should dismiss on backdrop click (currently only `X`/`Cancel`).
- Root cause: `Modal.svelte` `onclick` only closes when `size === "drawer"`.
- Created OpenSpec change `openspec/changes/dismiss-dialogs-on-outside-click/`
  (proposal, `modal-dismissal` spec, design, tasks); `openspec validate --all --strict
--no-interactive` → 4/4 pass, exit 0.
- Scope: single component (`Modal.svelte`); dismiss any dismissible dialog on backdrop
  click/tap (all sizes), preserve the `dismissible` guard + cancel routing, ignore
  drag-out interactions.
- Dirty tree (`feat/ui-polish`) preserved exactly as found; the owner's concurrent session
  was actively editing. Skills used: `repo-planning-pass`
  (`~/.hermes/skills/software-development/repo-planning-pass`) and `openspec-propose`
  (project skill). Session record: `.ai-sync/sessions/2026-11-01-modal-dismissal-planning.md`.
- Next: implementation awaits owner go (tasks.md group 1). Editing lock released.

## 2026-11-01 — API Setup moved from sidebar footer back into the profile dropdown

- Owner request: move `API Setup` from the sidebar footer into the main-menu
  `profile-container` (ProfileDropdown), where it lived before the UI-polish rework.
- `ProfileDropdown.svelte`: added an "API Setup" menu item after "Keyboard shortcuts"
  (faKey, navigates via `navigateTo("/api-setup")`, closes the dropdown) and a
  `.icon-box .warning-badge` style; `missingCredentials` was already passed from Header.
- `Sidebar.svelte`: removed the API Setup links from both the desktop footer and the
  mobile drawer; removed now-dead `faKey`/`hasYoutubeClientId` imports, the
  `missingCredentials` state, `checkCredentials()` (+ its call) and the orphaned
  `.sidebar-footer .warning-badge` / `.sidebar-footer .icon-box` CSS.
- Verification: `npm run check` matches baseline — lint 0 errors, format clean, 570/570
  tests, and the SAME pre-existing `contracts:check` failure (stale
  `background/capture-import.d.ts`, `window.videoService` missing from declarations;
  run `npm run contracts:generate` to fix — unrelated to this edit). `npm run build`
  exit 0 (chrome/firefox/edge, budgets pass); built chunks contain the new dropdown
  item. The owner's own `npm run build` processes ran concurrently during the pass
  (an `npm ci` mid-run caused one transient vitest failure on a missing
  `@supabase/supabase-js`; re-ran clean after their build finished).
- Files changed by this pass: `ProfileDropdown.svelte`, `Sidebar.svelte` only.
  Editing lock released.

## 2026-11-01 — Data Manager sources/usage, repair queue, API health (uncommitted)

- Branch `feat/ui-polish`; working tree intentionally still dirty from the UI-polish pass.
- Replaced the separate Source Guide and Scalability panels with one expandable
  **Extraction Engines** list. Each row expands to cost, request volume, duration
  support, best-for and caveat. Rows include Page cache, Innertube, Data API, Embed,
  oEmbed, Piped/Invidious, and an unconnected **Apify / hosted actors** `FUTURE · PAID`
  option. No roadmap section remains.
- Usage Estimate now owns the quota explanation in a **How this estimate works**
  expander; the source list no longer repeats the 50-ID / 10,000-unit math.
- Repair Metadata remains one panel with Incomplete/Unavailable tabs, reason/origin
  filters, checked age, origin playlist links, selection-based bulk retry, and shared
  pagination (10 rows default, `metadataPageSize` persisted).
- Added **Refresh Durations**, **Test API Key**, persisted last tab/filter, and a
  quota-aware API health guard: quota/rate/invalid failures pause the Data API and
  show an `API quota paused` / `API key invalid` badge in Usage Estimate.
- Data API health is reset when the API key changes; `lastFetchAttempt` is recorded
  for real tombstones so `Checked …` is accurate.
- Tests: `npm test` **56 files / 570 tests**; `svelte-check` **0 errors** (4 pre-existing
  warnings); `npm run test:extension` **96 route/viewport checks + 7 interaction groups**;
  budgets pass with CSS **200819 bytes / 198 KiB** ceiling. Chrome/Firefox/Edge ZIPs
  rebuilt at 523K.
- Shipped in **PR #63** (squash merge `c1a9849`) into the `next` integration branch.
  All required checks passed. The theme review thread was fixed and resolved; mobile
  visual snapshots are pinned against scrollbar-width drift. The local checkout was
  left on the now-deleted `feat/ui-polish` branch with unrelated dirty work preserved.
- Session record: `.ai-sync/sessions/2026-11-01-data-manager-repair-queue.md`.
- Next: owner review of the merged source/usage layout; commit with the UI-polish
  branch. No remote actions.

## 2026-11-01 — encrypted sync plan formalized (planning only, no code)

- Checkout: branch `feat/ui-polish` (ahead 1 of origin), dirty tree with uncommitted
  UI-polish work (modified Svelte components, deleted `Share.svelte`, new
  `playlist-category.*`, `.coderabbit.yaml`). Preserved exactly as found; no application
  code, manifest, dependency or version changed by this pass.
- Owner approved the zero-knowledge cross-device sync direction and asked to formalize
  it first. Created OpenSpec change `openspec/changes/add-encrypted-cross-device-sync/`
  with proposal.md, three capability specs (`encrypted-device-sync`, `sync-backends`,
  `feature-modules`), a SOLID design.md and tasks.md.
  `openspec validate --all --strict --no-interactive` → 3/3 pass, exit 0.
- New docs: `docs/ENCRYPTED_SYNC_PLAN.md`; linked from `docs/INDEX.md`;
  `openspec/README.md` current-change line updated. `.ai-sync/PLAN.md`,
  `PROGRESS.md` (SY-1…SY-9 suggestions recorded) and this file updated.
  Session record: `.ai-sync/sessions/2026-11-01-encrypted-sync-planning.md`.
- Locked decisions: sync key is the only credential (no email/recovery); AES-256-GCM
  snapshots (PBKDF2 + SHA-256 address); automatic triggers; LWW + pre-import backup;
  backends File + Supabase BYO + Google Drive behind one interface; selectable sync
  contents; Plugins screen with API Setup as toggleable module; mp3/mp4 excluded.
- Skills used: openspec-propose (project skill at `.hermes/skills/openspec-propose`).
- Next: implementation awaits a new owner request (start at the change's tasks.md group
  1; Hermes executes tests per owner delegation). Editing lock released at end of pass.

## 2026-11-01 — deployment/CI notification noise (investigation, uncommitted)

- Investigated the "too many emails per PR" complaint. Sources identified: Vercel PR-comment bot, Vercel deployment-failure mailer, CodeRabbit skip-status comment, Codex auto-review, and this repo's own CI Autofix `bail` comment (3 per failing PR).
- Verified Vercel is **not** deploying PRs to production: `rootDirectory=apps/web-portal`, `ignoreCommand` (`git diff --quiet HEAD^ HEAD -- .`) works — commit status for PR #63 head is `Vercel success "Canceled by Ignored Build Step"`.
- Added `.coderabbit.yaml` (`reviews.review_status: false`) so skipped reviews stop producing comments. Uncommitted.
- Pending user action (dashboard): Vercel project → Settings → Git → disable Pull Request Comments; team → Settings → My Notifications → Deployment Failures → email off.
- Pending decision: patch `~/dev/ci-autofix` template so a `bail` result writes to the step summary only instead of `gh pr comment`.

## Current state

- Repository: `/home/steve/dev/independent-youtube-playlist-manager`.
- Branch `codex/context-menu-plan`, committed HEAD `6ef6034`; open PR #51 targets `next`.
- All new work remains uncommitted and local. No pushes, merge, release, tag, store submission or deployment authorized/performed. GitHub issues/comments were read only.
- **Automated verification executed by Hermes and ALL GATES PASS.** See `.ai-sync/sessions/2026-10-31-hermes-verification-final.md` for full evidence.
- Existing uncommitted 1.2.1 release preparation was preserved: README, changelog, source manifests, all package versions/lockfiles, generated release notes and `docs/RELEASE_1.2.1.md`. Root package scripts and README/changelog also now include implementation additions. No versions/permissions/dependency resolutions were changed by this pass. Keep feature release decisions separate from the existing patch prep.

## Verification results (automated)

All gates from `docs/testing/HERMES_CONTEXT_MENU_VERIFICATION.md` passed:

| Step | Command                                  | Result                                                                                                                                                           |
| ---- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `npm run check`                          | ✅ PASS (lint, format, 248 tests, Svelte 0 errors, 2 CSS warnings, file-size, CSS bundle, Vercel config, tooling versions, release notes)                        |
| 2    | `npm run build`                          | ✅ PASS (Chrome/Firefox/Edge packages, manifest validation, CSS bundle, budgets)                                                                                 |
| 3    | `npm run check` (post-build)             | ✅ PASS                                                                                                                                                          |
| 4    | `npm run test:extension`                 | ✅ PASS (102 route/viewport checks, 7 interaction groups)                                                                                                        |
| 5    | `npm run test:capture-mutations`         | ✅ PASS (4/4 mutations CAUGHT: private-tab exclusion, URL scheme validation, atomic revision, durable builder storage)                                           |
| 6    | `npm run audit:all`                      | ✅ PASS (production deps: 0 vulns across 3 trees; high finding fixed via follow-redirects 1.16.2 override; dev deps: 7 root, 17 playlist-manager, 16 web-portal) |
| 7    | `npm --prefix apps/web-portal run build` | ✅ PASS (Next.js 15 production build)                                                                                                                            |
| 8    | `web-ext lint --source-dir dist/firefox` | ✅ PASS (0 errors, 2 warnings)                                                                                                                                   |

## Fixes applied during verification

### Type contract repairs (Priority 1)

1. **Created canonical protocol contracts** (`shared/protocol-contracts.d.ts`) — single source of truth for operation/result/job types, derived from actual JS behavior.
2. **Fixed `library-mutations.d.ts`** — JS returns results directly (no `{ok,result}` envelope); removed unsupported operations (`create`, `update`, `reorder`); removed private `plainPlaylist` export; fixed result shapes per operation.
3. **Fixed `capture-jobs.d.ts`** — Terminal state is `complete` not `done`; added destination-only jobs; nullable source snapshots; custom destination IDs.
4. **Fixed `capture-controller.d.ts`** and **`capture-import.d.ts`** — Aligned with canonical contracts.
5. **Fixed `storage-client.d.ts`** — Message boundary wraps in `{ok,result}`; worker returns direct result.
6. **Updated all call sites** (`storage-service.ts`, `backup-service.ts`, `supabase-sync.ts`) to handle both envelope and direct result formats.
7. **Fixed test type annotations** (`library-mutations.test.ts`, `capture-retry.test.ts`, `capture-import.test.ts`).

### Security remediation (Priority 2)

1. **Fixed high vulnerability** — `follow-redirects` 1.16.1 → 1.16.2 via npm override in `apps/browser-extension/playlist-manager/package.json` (GHSA-mrwp-f3q8-3g9p: cross-realm sensitiveHeaders array loss on redirects).
2. **Audit status** — All production dependency views: 0 findings. Dev advisories: 7 root, 17 playlist-manager, 16 web-portal (all moderate/low). No high/critical.

### Implementation fixes

1. **Lint fix** (`capture-import.js:47`): Added `{ cause: error }` to preserve error cause.
2. **Test fix** (`page-import.test.js`): Updated to match current `handleChannelImport` implementation.
3. **PlaylistEditor.svelte**: Non-null assertion + duplicate property key fixes.
4. **Build tool fix** (`verify-extension-modules.js`): Skip CSS imports (bundled by Rollup).

## Implementation verified

- Shared capture rules in `shared/tab-selection.js` and `shared/quick-add.js`: strict HTTP(S)/YouTube/ID parsing, seven scopes, clicked anchor, private exclusion, normal windows, stable ordering, cached destination resolution and settings enforcement.
- `background/library-mutations.js`: single serialized authority for the whole local playlist array and builder, revisions checked inside the queue, deletion tombstones, atomic append/new creation and idempotent capture receipts.
- Editor/local CRUD/imports/full restores/cloud writes/watched cleanup/keyboard shortcut and popup captures now use the authority.
- Capture modules split into controller, jobs, import and remote: expiring opaque jobs, validated own-UI messages, source checks, per-job exclusivity, serialized remote append/reconciliation, explicit consent, cancellation and conservative closure.
- Bounded menu model/reconciliation: one branded tree, separate scope/destination, local-only labels, independent disables/master switch, old-menu migration, changed entry updates, observed create errors, Firefox onShown/refresh and Android guard.
- Lazy `Capture.svelte` route: searchable destination chooser with full Local/YouTube titles, import quantity/order, optional channel scrolling, remote review/Sync, progress/retry/cancel and bounded post-save metadata fetching.
- Source scanner validates full URL hosts and IDs, scans only top document and iframe source URLs.
- Builder initial rendering no longer waits on external metadata. Build now copies `shared/`.
- Open issue work: thumbnail URL fallback and badge layering; shared completeness checks and optional capture metadata fetch for duration gaps; reactive device theme updates and early saved-theme preservation; pagination retains 44px controls.
- CM-R1: destination glossary/user guide. CM-R2: six-view, three-tree audit reporter and triage template. CM-R3: disposable mutation verifier for privacy, scheme, revision and persistence guards.
- New/updated unit coverage and capture route fixture written and passing.

## Remaining manual verification (Priority 3)

The following require manual execution with disposable Chrome/Firefox desktop profiles (rebuilt `dist/chrome` and `dist/firefox`), per `docs/testing/HERMES_CONTEXT_MENU_VERIFICATION.md`:

1. **Native browser gesture matrix** (section 41-83): real Firefox/Chromium menus, activeTab on non-YouTube fixture, all contexts, scopes, destinations, source permissions, concurrent captures, remote sync, tab closure rules, large destinations, Firefox Android.
2. **Open issue regression checks** (section 85-97): #10, #11, #13, #14 validation with evidence.
3. **Headed portal E2E** with `HEADED=true` under Xvfb (currently skipped in headless CI).
4. **Real-device/mobile acceptance** and any authorized live remote-account checks.

## File areas changed

Background runtime (new capture/authority/model/access modules plus existing router, menu actions, history and entry point); shared modules (new `protocol-contracts.d.ts`); popup adapters/options; Svelte capture/builder/editor/settings/theme/thumbnail/pagination code and model types; storage/backup/cloud services and tests; new test fixtures/safety suites; root scripts, build packaging/runtime-module guard/mutation/audit/native-fixture tools; README, USER_GUIDE/INDEX/context-menu plan/glossary/triage/Hermes checklist; `.ai-sync` state; `apps/browser-extension/playlist-manager/package.json` (follow-redirects override).

## Open GitHub issues (read 2026-10-31)

- #14: durations missing after import — verify fetch behavior and visible badges.
- #13: dark-theme refresh flash — verify first paint and opposite-device theme cases.
- #11: deleted-video thumbnails — verify opt-in archived bytes and backup round-trip.
- #10: pagination visibility — verify first/last/previous/next and filtering at narrow widths.

## Workflow traps

- Run `check` and `build` sequentially: build reinstalls nested dependencies.
- Use npm 10.8.2 to regenerate lockfiles; keep root and portal Playwright aligned.
- No source `manifest.json`/`manifest.edge.json`; all dist artifacts are generated.
- No new source file over 350 lines; split modules instead of enlarging the allowlist.
- Source UI CSS imports belong in main.ts; no Svelte style @import.
- Preserve dirty editor state; stale revisions must fail visibly, never auto-overwrite.

## Shared worktree documentation — 2026-10-31

Updated AGENT_WORKFLOW.md, START_HERE.md and the TASK/REVIEW/VERIFICATION/HANDOFF
blank templates. They now require explicit worktree/branch/base identity, prerequisite
snapshot checks, one writer per checkout, designated verification ownership, setup for
skills/dependencies/ports, and safe resume/integration/cleanup. AGENTS.md, OpenSpec usage,
PLAN/PROGRESS and docs/INDEX link the same standard. Templates have no actual task
results filled in. No generated OpenSpec skills or product acceptance criteria changed.

Only documentation was edited. No worktrees were created, edits moved/stashed/committed,
or tests/builds/audits rerun. Preserve the newer Hermes verification records; this update
does not refresh or independently certify their evidence. Current checkout still contains
uncommitted work; a future isolated implementation must confirm an appropriate starting
snapshot rather than assume those changes appear in another worktree. WT-1/2/3 are later
ideas recorded in PROGRESS, not implementation completed here.

## Relevant-skill policy added: 2026-10-31

AGENTS.md now requires task-based skill discovery, the smallest relevant set, reading
selected instructions, reassessment on scope changes and reuse on follow-up prompts.
The shared workflow, both starting prompts, all four blank templates and OpenSpec
usage guidance reflect this rule. Session copies record names, source paths, purpose,
missing-skill fallbacks and conflicts; templates remain blank. Skills do not expand
scope, override owner verification delegation or authorize release/destructive actions.

Documentation only. Used writing-guidelines for wording review; no application code,
configuration, generated OpenSpec skills or acceptance tasks changed. No application
tests/builds/audits ran; existing Hermes evidence and uncommitted edits were preserved.

## Parallel orchestration plan: 2026-10-31

Owner requested a semi-automatic workflow and implementation plan for concurrent feature
agents. Created `orchestrate-parallel-implementations` with proposal/spec/design/tasks;
agent-facing policy is `docs/AI_ORCHESTRATION.md`. AGENTS.md, shared workflow/prompts,
blank templates, OpenSpec guide and index now point to it. Default: two independent
implementation jobs, one writer per worktree, explicit role handoffs, owned-branch
target integration, refreshed evidence, push then one PR into next. Manual merging is
the default; guarded merging requires separate owner opt-in and all review/verification/
protection gates. A conflict-free flag alone never authorizes a merge.

Runtime coordinator tools are planned, not implemented. Missing launch capability
produces a pending manual handoff, not a false delegation claim. All 21 runtime/pilot
tasks start unchecked. The existing context-menu acceptance work remains separate.

This turn changed planning/documentation only. No worktrees or workers were created;
no branch was committed/pushed, PR opened/merged or GitHub setting changed. Application
verification remains with Hermes. The current dirty/untracked starting tree must be
prepared through a scoped reviewed commit before live workers depend on its contents.

## Latest independent review — 2026-10-31, HEAD c2c3b4e

The earlier HEAD/all-gates statements above are historical and do not certify the
current dirty tree. New orchestration commits exist. Latest integrated evidence
records 477 tests passed but contracts-check exit 1, allPassed=false, and no builds.
Live pilot tasks 7.3/7.4 remain open. Source review found fail-open merge/integration
inputs and receipts that omit dirty/untracked source identity. Keep merge mode manual.
See sessions/2026-10-31-latest-hermes-review.md for locations, impact and exact next
steps. Some CM-R7/R8/R9 work from Codex's interrupted implementation remains unfinished.
This review ran no tests/builds/audits and changed no application code or remote state.

## Hermes cleanup pass — committed tree, all gates green (2026-10-31, late)

The dirty/untracked starting tree was reviewed by area and committed in scoped commits
rather than stashed or discarded:

- `12f31c7` chore(openspec): workflow skills, config, acceptance change
- `37743d5` feat(capture): capture controller, import jobs, storage client, contracts
- `463bdbb` feat(context-menu): menu model, capture actions, popup/manifest wiring
- `5a93817` build(tooling): protocol declaration generation and verification gates
- `e60255e` refactor(orchestration): split oversized coordinator and launcher modules
- `ca3c78b` fix(orchestration): fail closed on incomplete merge inputs and dirty-tree evidence
- `0bd3961` test(web-portal): require the extension e2e suite in CI
- `c9200e8` docs: release 1.2.1 notes, terminology and verification guides

Codex review findings now addressed and covered by tests:

- guarded merge requires an exact `ready-for-guarded-merge` decision with zero blockers,
  a matching head and explicit protection data (checks, approvals, no admin bypass,
  up-to-date branch); missing data is refused.
- integration requires an observed remote PR head and re-reads remote readiness before
  any merge call; stale evidence refuses without contacting the service.
- receipts bind a working-tree source hash; edits or untracked files invalidate with
  `STALE_WORKING_TREE` (or `SOURCE_IDENTITY_UNAVAILABLE`).
- contracts-check exit 1 fixed by typing capture job payloads and regenerating
  declarations; the file-size allowlist exemptions were deleted after real splits.

Verification on the committed tree (exact exits recorded in
`openspec/changes/orchestrate-parallel-implementations/evidence/task-7.1-checks.json`):
`npm test` 499/499 in 45 files, eslint 0 errors, prettier clean, file-size 0,
contracts-check 0, css/vercel/release-notes 0 — `allPassed: true`, `treeUnchanged: true`.
Workspace preflight and two-job demo harnesses also exit 0 and now run in CI.

Still open: tasks 7.3 (live pilot) and 7.4 (pilot review) need explicit owner
authorization for a push and one draft PR; merge mode stays manual. Nothing was pushed,
no PR opened or merged, no GitHub setting changed, no release or deployment performed.

## Pilot complete — 21/21 change tasks (2026-10-31, later)

Owner authorized tasks 7.3/7.4. Pilot executed without touching the feature work:

- New branch `feat/orchestration-coordinator` cut from `origin/next` containing only the
  coordinator, its change artifacts, docs and the CI harness step.
- Pushed once and opened **draft PR #52** against `next`. No merge, release, tag or
  GitHub setting change.
- Idempotent resume: a repeated push reports "Everything up-to-date" and exactly one PR
  exists for that head, so publication never duplicates.
- Two real CI failures were found and fixed: evidence JSON missing from `.prettierignore`
  (`05f0227`) and three fixture tests assuming `main` as the default branch (`4c154f0`,
  reproduced locally with `init.defaultBranch=master`).
- CI on #52 is fully green: Quality & Security, Extension CI, Web & Extension E2E, npm
  Audit, CodeQL and Dependency Review all pass; CodeRabbit and auto-merge are skipped.
- 7.4 evidence (`task-7.4-pilot-review.json`) runs the real PR through `review.js`:
  required checks pass, `MERGEABLE`, decision `blocked` only because the PR is draft.

Also landed on the working branch: single-owner editing lock
(`packages/build-tools/agent-lock.js`, documented in AGENTS.md), a focused
foreign-sender test suite for `permittedUI`, and `docs/testing/CM_R7_R8_R9_PLAN.md`
with per-item gaps, steps and acceptance for the remaining verification work.

Open next: CM-R7 receipts wired into CI, then CM-R8 contract drift discovery, then
CM-R9 per-target bundle inventory. Merge mode remains manual and PR #52 stays draft.

## Popup mobile sizing + instant-open diagnosis — 2026-10-31 (no code changed)

Owner reported (a) the toolbar popup is too cramped on phones and (b) it does not open on
the first attempt sometimes. Diagnosis only; planning artifacts and `.ai-sync` updated.

Measured in the built `dist/chrome` package served over HTTP with Playwright Chromium
(layout at 280/320/360/375/390/412/430/768 px; timings with cache disabled + 6× CPU
throttle). Results and the full fix plan are in `docs/POPUP_MOBILE_PLAN.md`; the short
version:

- The popup is 360 px wide, not 380/400: `@media (max-width: 767px)` always matches inside
  a popup, and a later "360–389 px" block overrides the width. Body is narrower than the
  viewport at 375 (15 px) and 412 (22 px), leaving an uncovered strip that is white in dark
  theme because `html` has no background.
- `min-height: 100dvh` inside a content-sized popup window makes height self-referential:
  measured 600 px body with content ending at 513 px. The `min-width: 768/1024` branches can
  never match in a popup, so they are dead code.
- `#open-playlists` is 26–30 px tall; inputs are 13 px at ≥390 px (autozoom); safe-area
  padding is dead (`env()` = 0 without `viewport-fit=cover`); theme is applied after the
  module graph + storage, so dark users get a white flash.
- First click handler exists only 189 ms after load (6× throttle, warm disk) because
  `setupUI()` runs after `waitForGlobal("videoService", 30)` and `getSettings()`; earlier
  there are 112 KB CSS (93 KB Font Awesome), 146 KB JS and a 147 KB font on the critical
  path. That is the "first attempt does nothing" report.
- `verify-extension.js` only checks the popup as a regular tab and only for horizontal
  overflow, so none of this can fail CI.

Next steps (in order, per the plan): P0 add `packages/build-tools/verify-popup.js` (popup
mode, width/height, 44 px targets, 16 px inputs, no `vw`/`vh`, paint/handler budgets) and
confirm it fails on this tree; P1 explicit `ui-popup`/`ui-page` classifier via
`extension.getViews({type:"popup"})` with a `?mode=` override and a single breakpoint set;
P2 touch/safe-area/sticky footer; P3 icon sprite + lazy editor modules; P4 handlers before
any `await`, theme before first paint; P5 gates plus real-device matrix.

Files changed this pass: `docs/POPUP_MOBILE_PLAN.md` (new), `docs/INDEX.md`,
`.ai-sync/PROGRESS.md`, `.ai-sync/HANDOFF.md`. Application code, CSS, manifests,
dependencies and versions untouched. No `check`/`build`/tests run for this pass (no code
changed); the pre-existing dirty tree (`vitest.config.mjs`, staged CI/docs work) was left
as found. Editing lock taken and released around the writes.

## Popup mobile + instant-open fix — implemented 2026-10-31

Owner asked to fix the toolbar popup size (bigger) for phones and the "doesn't open on
first attempt" bug, then authorized implementation with best-practice recommendations.
Decisions: desktop popup 420 px, Firefox Android full-screen, Font Awesome → inline SVG.

Changed files:

- `apps/browser-extension/popup/mode.js` (new): classic pre-CSS script that classifies
  `ui-popup` vs `ui-page` via `extension.getViews({ type: "popup" })` (+ `?mode=` override)
  and applies the theme from `localStorage["yph-theme-choice"]` / device before first paint.
- `apps/browser-extension/popup/popup.html`: removed Font Awesome links; inline SVG sprite
  (9 glyphs, FA 6.4.2 solid paths); `viewport-fit=cover`, `color-scheme` meta; menu items
  as a `<nav>` with `role=button`/chevron affordances; `menu-divider` got an id.
- `apps/browser-extension/popup/popup.css`: rewritten around the two modes. Popup mode is
  fixed 420 px, content height, no `vw`/`vh`; page mode is full-bleed, `min-height:100dvh`,
  safe-area padding, 16 px inputs, 44/48 px targets. 11.6 KB (was 19 KB).
- `apps/browser-extension/popup/popup.js`: click handlers wired synchronously at module
  evaluation (no dead-click window); editor modules (`youtube-auth`, `youtube-api`,
  `storage-service`, `utils`, `video-service`) lazy-loaded via dynamic `import()` after
  first paint; theme corrected from storage after paint.
- `apps/browser-extension/popup/target.js`: `updateTargetUI` / `initTargetData` /
  `loadDefaultTabScope` made null-safe so hydration never throws on a torn-down DOM.
- `packages/build-tools/verify-popup.js` (new): regression harness for the sizing contract,
  wired into `test:extension`.
- `package.json`: `test:extension` now runs `verify-extension.js && verify-popup.js`.
- `docs/POPUP_MOBILE_PLAN.md`, `docs/INDEX.md`, `.ai-sync/PROGRESS.md`: updated.

Verification (measured, all passing):

- `npm run check` exit 0 — lint/format clean, 543 vitest tests pass, file-size,
  svelte-check 0 errors, css-bundle/vercel/tooling/release-notes gates pass.
- `npm run test:extension` exit 0 — 102 route/viewport checks + new popup sizing contract.
- Popup probe: 420 px fixed width, content height 472 px (no 100dvh stretch), 0 missing
  icons, 0 sub-44 px controls; page mode full-bleed at 320/360/390/412/430 (0 strip), dark
  theme html/body backgrounds match, 16 px inputs.
- Full `npm run build` (all three targets) was running at handoff; confirm it finished
  clean before treating Firefox/Edge dist as current.

Remaining (manual): real-device matrix — Chrome desktop popup cold-open ×10 (first click
must always open at 420×content), Firefox Android full-screen + keyboard + rotation + safe
area. Not required for the code gates; do not close #13 (dark flash) on source inspection
alone — this pass should also be spot-checked against it on a real device.

No commit, push, PR, version bump or release performed. Editing lock released after the
writes. `.husky/pre-commit` was modified by a concurrent process (a commit attempt at
22:37) and left untouched by this pass.
