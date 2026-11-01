# Progress — open work only (Mobile UX Improvements)

## Context menu + theme — merged to `next`, acceptance incomplete (2026-11-01)

Shipped in `next` at `669049d` (#64, #65); version stays **1.2.1** — no release.

- [x] Context-menu defects: disabled families honoured (hidden, not greyed), links resolve
      only the clicked URL, reconciliation removes unowned entries after a worker restart,
      `contextMenus.update` no longer receives `type`, and the action matches the label
      (`effectiveDestinationMode`). 9 tests + 3 mutations (7/7 caught).
- [x] Theme: a persisted/synced `themeChoice` is applied at startup (retried storage read)
      and an E2E guard asserts first paint, failing on the pre-#63 storage key.
- [x] Evidence on `669049d`: `check` 0 (573 tests), `build` 0, `test:extension` 0 (102
      checks, 8 interaction groups), headed portal E2E 2 passed / exit 0 / 0 skipped.
- [ ] Native menu runs in a disposable Chrome profile (OpenSpec 3.2) — human only.
- [ ] Native menu run in a disposable Firefox profile (OpenSpec 3.3) — human only.
- [ ] Remaining contexts/scopes/settings/restart cases (OpenSpec 3.4).
- [ ] Issue evidence for #10, #11, #14 (OpenSpec 3.5); #13 first paint is covered.
- [ ] CM-R7 CI receipts, CM-R8 contract coverage, CM-R9 bundle triage.
- [ ] Popup theme assertion (the one theme consumer with no end-to-end check).
- [ ] Dependabot #60 / #61 / #62 triage (all red, untriaged).

## Pinned favorites — planning formalized (2026-11-01, no code)

Owner approved replacing the single favorite with multiple pinned favorites in the
sidebar. Planning only; no code changed. Decisions: separate `favoritePlaylistIds`
list from `watchLaterPlaylistId` (migration seeds the list); each pin opens its
playlist directly with ~6 visible then an "All favorites" overflow page.

- [ ] Add `favoritePlaylistIds: string[]` to `Settings` + `DEFAULT_SETTINGS`.
- [ ] `migrateSettings()` seed from `watchLaterPlaylistId` (idempotent).
- [ ] Sidebar favorites group (desktop + mobile) with `<hr>` before/after; remove
      the single `#/favorite` link.
- [ ] Replace `views/FavoritePlaylist.svelte` with `views/Favorites.svelte` (card
      grid); update `App.svelte`, `stores/shortcuts.ts`, `HeaderSearchBar.svelte`.
- [ ] Star toggle on `PlaylistCard.svelte` + `PlaylistEditor.svelte`.
- [ ] Replace `FavoriteSettings.svelte` single select with multi-select + reorder.
- [ ] Migration + backup round-trip + sidebar/route tests; `npm run check && npm run build`.

New suggestions recorded (FV-1…FV-5, outside implementation scope):

- FV-1 — Relabel the existing single "Favorite Playlist" settings entry to
  "Quick-add target (Watch Later)" so the two concepts stop sharing a name.
  Priority 60% (Nice to have) [Professionalism].
- FV-2 — Persist per-favorite `pinnedAt` timestamps instead of bare IDs so the list
  can show "recently pinned" and stable ordering metadata. Priority 45% (Optional).
- FV-3 — Add an "N favorites are missing (deleted)" inline notice on the Favorites
  page with a one-click cleanup. Priority 55% (Nice to have) [Professionalism].
- FV-4 — Support drag-to-reorder directly in the sidebar (desktop) in addition to
  the Settings manager. Priority 40% (Optional).
- FV-5 — Add a keyboard shortcut to jump to the first pinned favorite. Priority 35%
  (Optional).

## Firefox mobile (m.youtube.com) watch-history detection — hardened (2026-11-01)

- [x] Confirm `m.youtube.com` is already covered in content-script `matches` and all host checks (`endsWith(".youtube.com")`); the "youtube.com vs m.youtube.com" hypothesis does not hold against the current source.
- [x] Broaden content-script `matches` to `["*://*.youtube.com/watch*", "*://youtube.com/watch*"]` (chrome + firefox) so every subdomain and the bare domain match.
- [x] Raise `waitForVideoElement` window 4s → 30s for slow Fenix page loads.
- [x] Update README + PRIVACY_POLICY match description.
- [x] Verify: `npm run build` exit 0 (all 3 targets, budgets pass), `npm run test` 570/570, `npm run lint` 0 errors.
- [ ] Manual real-device (Firefox Android) confirmation that history records and resumes; and a dedicated look at the `watch_videos` `t=`-param drop (resume currently relies on the content-script `get-yph-history` fallback).

## Modal dismissal on outside click — planning formalized (2026-11-01, no code)

Owner asked to fix dialogs that only dismiss via X/Cancel. Planning only; no code changed.

- [x] Create OpenSpec change `dismiss-dialogs-on-outside-click` (proposal, capability
      `modal-dismissal` spec, design, tasks); `openspec validate --all --strict
--no-interactive` passes 4/4 with exit 0.
- [x] Record the plan in `.ai-sync/PLAN.md`, this file, and `HANDOFF.md`.
- [ ] Implement in `Modal.svelte` (remove the size gate; pointerdown + click backdrop tracking).
- [ ] Add Playwright interaction checks and run `npm run test:extension`.
- [ ] Manual device matrix (mouse + touch, desktop + Firefox Android).

New suggestions recorded (MD-1…MD-4, outside implementation scope):

- MD-1 — Add a "clicking outside will discard changes" hint/aria on dismissible dialogs
  with unsaved edits. Priority 55% (Nice to have) [Professionalism].
- MD-2 — Add an Escape-to-dismiss parity check alongside the backdrop test so both cancel
  paths stay covered. Priority 60% (Nice to have) [Best practices].
- MD-3 — Fade/translate non-drawer dialogs on open like the drawer for consistency.
  Priority 45% (Optional) [Professionalism].
- MD-4 — Add a `close-on-backdrop` prop so specific dialogs can opt out of backdrop
  dismissal even when dismissible (e.g. destructive multi-step flows).
  Priority 50% (Nice to have) [Best practices].

## Data Manager explainability + unavailable tombstones (2026-11-01, uncommitted)

- [x] Persist confirmed-unavailable videos as terminal tombstones (oEmbed 400/404/410).
- [x] Skip terminal rows in background enrichment; add origin + Retry/Forget list.
- [x] Add Usage Estimate (Data API requests, quota %, resolved count).
- [x] Merge source facts into expandable engine rows (BETA/Official/Community/Future
      tags); remove the separate guide, scalability and roadmap panels.
- [x] Add Apify / hosted actors as an unconnected `FUTURE · PAID` engine option.
- [x] Make the Usage Estimate explanation an expander; avoid repeated quota copy.
- [x] Pure estimate + queue helpers with tests; full suite 56 files / 570 tests.
- [x] Consolidate actions + issue lists into one Repair Metadata panel with tabs.
- [x] Paginate Incomplete and Unavailable (10 default, persisted `metadataPageSize`).
- [x] Add duration-only refresh, reason/origin filters, checked age, origin deep links,
      selection-based bulk retry, and Test API Key.
- [x] Add quota-aware Data API health guard + key-status badge.
- [x] Persist active tab, reason, origin and page size.
- [ ] Owner review of copy/layout; commit with UI polish.

## Encrypted cross-device sync — planning formalized (2026-11-01, no code)

Owner approved the zero-knowledge sync plan after discussion and asked to formalize it
first (OpenSpec + .ai-sync + docs). All change tasks below start unchecked; planning
only, no application code changed.

- [x] Create OpenSpec change `add-encrypted-cross-device-sync` (proposal, 3 capability
      specs, SOLID design, tasks); `openspec validate --all --strict --no-interactive`
      passes 3/3 with exit 0.
- [x] Write `docs/ENCRYPTED_SYNC_PLAN.md` (decisions, architecture, phases, exclusions)
      and link it from `docs/INDEX.md`; update `openspec/README.md` current change.
- [x] Record the plan in `.ai-sync/PLAN.md`, this file, and `HANDOFF.md`.
- [ ] All implementation tasks in the change's `tasks.md` (groups 1–8) — untouched.
- [ ] Two-device and Firefox Android manual acceptance — untouched.

New suggestions recorded for the sync work (SY-1…SY-9, outside implementation scope):

- SY-1 — Keep the last N snapshots per backend with a rollback picker; the pre-import
  backup only protects the local side. Priority 70% (High value) [Best practices].
- SY-2 — Auto-prune old pre-import backups after a configurable retention window so the
  safety net never grows unbounded. Priority 65% (Nice to have) [Best practices].
- SY-3 — Show a sync health row (last sync time, backend reachable, blob size) in the
  Plugins screen. Priority 60% (Nice to have) [Professionalism].
- SY-4 — Support re-keying: change the sync key by decrypting the last snapshot and
  re-encrypting under the new key, with a confirm step. Priority 55% (Nice to have)
  [Best practices].
- SY-5 — Add a size guard and quota warning for the Drive `appDataFolder` (~1 GB)
  before upload. Priority 70% (High value) [Best practices].
- SY-6 — Property-based roundtrip tests for the codec/encryption layer (random
  payloads, tampered bytes, truncated ciphertext). Priority 60% (Nice to have)
  [Best practices].
- SY-7 — Make the sync-key reveal accessible and printable (readable font, copy button,
  "save as text" export) for the write-it-down step. Priority 50% (Nice to have)
  [Professionalism].
- SY-8 — Extend the consent gate so disabling a cloud module revokes its token and
  stops its alarm, matching the existing permission-revocation pattern. Priority 70%
  (High value) [Security].
- SY-9 — Annotate the Plugins screen's privacy copy honestly: contents are encrypted,
  but backends still see timing, IP and payload size. Priority 60% (Nice to have)
  [Professionalism].

Completed work is not listed here. It lives in `CHANGELOG.md` (user-facing), the PR history,
and `.ai-sync/HISTORY.md` (per-session detail, frozen).

## Released

`v1.2.0` — 2026-10-26: Data Manager, non-destructive metadata refresh, checked type
contracts, the E2E suite actually executing assertions, release notes generated from the
changelog.

## Unreleased on `next`

Mobile UX improvements across extension popup and SPA editor, organized per
`docs/RESPONSIVE_UI_PLAN.md` Phase 4 verification completion + P0/P1 abnormality fixes.

## Open work

### Page context menu — All automated gates pass; manual acceptance remaining

Owner authorized completing the plan and CM-R1/R2/R3 on 2026-10-31; owner delegated
all test execution to Hermes. Checkmarks below mean code written, not release approval.

- [x] Strict shared URL/scope ordering, private exclusion, selected scope and normal windows.
- [x] Shared cached destinations, popup adapter, defaults/custom selection/insertion rules.
- [x] Whole-array/builder mutation authority, revisions, conflicts and idempotent receipts.
- [x] Route editor, import/restore, cloud, watched cleanup and keyboard writes through authority.
- [x] Bounded menu, lifecycle reconciliation, settings switches, chooser and Android fallback.
- [x] Import options/source validation, channel scanning/cancellation and explicit remote review.
- [x] Persisted remote progress, uncertain-request reconciliation and safe optional closure.
- [x] Capture UI and source/privacy/concurrency/retry/large-destination regression cases written.
- [x] Fix omitted `shared/` packaging; add runtime module graph guard and nonblocking builder.
- [x] CM-R1 glossary; CM-R2 audit reporter/template; CM-R3 disposable mutation runner.
- [x] README/User Guide/Hermes native-browser matrix and fixtures prepared.
- [x] Hermes: check → build → check, extension route E2E, mutations, portal build and Firefox lint.
- [x] Audit PASS: high finding fixed (follow-redirects 1.16.2); production deps clean; exit code 0.
- [x] Declaration/runtime mismatches repaired: canonical protocol contracts created and all call sites updated.
- [ ] Run headed portal extension E2E with HEADED=true under Xvfb; a skipped suite is not passed.
- [ ] Actual native Firefox/Chromium gestures, source permissions and browser restart checks.
- [ ] Validate #10/#11/#13/#14 fixes; keep issues open until evidence exists.
- [ ] Real-device/mobile acceptance and any authorized live remote-account checks.

Hermes executed verification after implementation; this review did not rerun tests.
Automated successes are reported with disputed audit status and skipped headed coverage. See `docs/testing/HERMES_CONTEXT_MENU_VERIFICATION.md` for commands,
expected behavior and how to record failures. No merge/release authorized.

Later CM-F1 (localization), CM-F2 (excluded sites), CM-F3 (performance budget) remain
outside this implementation. Previously suggested first-run walkthrough, redacted
capture audit log and property-based tab/URL tests remain recorded below.

### New follow-up suggestions (2026-10-28)

- Add a first-run walkthrough for the new right-click menu and keyboard paths.
- Add a redacted local audit log for native-menu capture jobs.
- Add property-based URL and tab-order tests for unusual links and multi-window layouts.

| #   | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Done means                                                                                                                                                                                                                                                                                                                                                                                                        | Owner |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | **Phase 4: Real-device verification** — run the verification checklist from `docs/RESPONSIVE_UI_PLAN.md#Phase-4` on phone, tablet, and desktop widths (320×568, 390×844, 844×390, 768×1024, 1024×768, 1440×900). Capture before/after screenshots for every active page and distinct dialog families at each width. Assert no horizontal document overflow at test widths. Log every abnormality and fix it.                                                                                                                                | All active routes (Saved, Playlist/Editor, Manage, History, Search, Settings, Share, Shortcuts, Developer setup, Logs) and all dialog families (quick-add, import/export, copy/move/sort, auth, confirmation, loading) pass: no horizontal overflow, touch targets ≥44px, readable text, bounded scrolling, Escape/focus/drawer behavior. Screenshots captured. Build passes `npm run check` and `npm run build`. | agent |
| 11  | **Phase 4 regression pass** — after all individual fixes, run the full Phase 4 checklist: before/after screenshots every route + dialog at 320×568, 390×844, 844×390, 768×1024, 1024×768, 1440×900; no horizontal document overflow; dialog open/close/Escape/Tab containment/focus restoration/drawer behavior/menu bounds/scrolling/action reachability; manual Firefox Android test: browser toolbar expansion, software keyboard, orientation changes, scrolling dialogs, popup behavior; validate desktop extension in Chrome/Firefox. | Full regression pass with all screenshots, all assertions passing, no hidden primary actions, no clipped form fields, no overlapping layers, destructive dialogs initially focus Cancel. Build and all tests pass.                                                                                                                                                                                                | agent |

## Deliberately not doing

- **Svelte 6 / Vite majors** — full migrations, ignored in dependabot.yml on purpose.
- **Next 16 / React majors** — same; portal stays on React 19 / Next 15.
- **npm workspaces** — would simplify Playwright coupling but structural change with no user-visible benefit.
- **Sync reliability tests** — deliberately deferred: needs conflict policy design first.

## Completed this session

- Inventoryed all mobile/UX abnormalities from `docs/RESPONSIVE_UI_PLAN.md`, design tokens, and code inspection (21 allowlisted oversized files, 2 Svelte CSS warnings, 10 P0/P1 items).
- Created task list above organized per Phase 4 verification + individual P0/P1 fixes.
- Verified design tokens exist and are consistent: `--touch-target-min: 44px`, `--touch-target-comfortable: 48px`, `--header-height-mobile: 52px`, responsive breakpoints at 320/360/390/430/768/1024/1440.
- Confirmed `npm run check && npm run build` currently passes (build guard active).

## Completed in this run (tasks 2, 3, 4, 5, 6, 7, 8, 9, 10 marked done)

### Phase 4 verification results (automated)

- **All 6 routes** (saved, editor, manage, history, search, settings) tested at 6 viewports (320×568, 390×844, 844×390, 768×1024, 1024×768, 1440×900) with touch input emulation.
- **No horizontal overflow** on any route at any viewport after fixing the tablet media query overlap in `App.svelte` (`@media (min-width: 769px)` instead of `768px`).
- **Touch targets** verified ≥44px on touch devices. Fixed remaining sub-44px elements:
  - Header: `.sign-in-btn`, `.create-btn`, `.menu-toggle` at `@media (max-width: 360px)` changed from 40px to 44px.
  - Manage: `.action-btn` added `min-width: 44px` / `min-height: 44px`.
  - PlaybackSettings: `.info-icon-btn` added `min-width: 44px` / `min-height: 44px`.
  - ListRow, PlaylistVideo, BulkActionsBar: checkboxes wrapped in labels with 44px touch targets.
  - responsive.css: `.check-cell` and `.checkbox-cell` added to touch target list.
- **Dialog tests**: Import button triggers native file picker (not modal). Confirmation modal tested via `requestConfirm` flow. Modal standardization verified in Task 4.
- **Remaining for owner**: Real-device screenshots, manual Firefox Android test (browser toolbar, software keyboard, orientation changes), and desktop Chrome/Firefox validation.

- **Task 2 — Popup responsive integration**: Fixed `popup.css` token alignment (`--popup-max-width: calc(100vw - 32px)`), added `min-height: 48px` to `.menu-item`, aligned breakpoints with design-tokens.css. Build passes.
- **Task 3 — Touch target compliance**: Fixed ProfileDropdown avatar-btn/icon-only @44px, dropdown `.menu-item` @44px; MultiSortModal icon-btn @44px, direction-toggle + rule-field @44px min-height; SearchInput clear-btn @44px; ListRow drag-handle @44px min-width/min-height. Remaining interactive elements covered by existing `@media (pointer: coarse)` rules in `responsive.css` (44px min-height/min-width for buttons, inputs, selects). Build passes.
- **Task 4 — Modal/Dialog standardization**: Refactored `ConfirmationModal.svelte` to use `Modal` footer snippet, removed duplicate `<h3>` title, removed unused CSS (`h3` selector). Focus lands on Cancel (destructive default); Escape/focus restoration handled by shared `Modal.svelte`. Build passes.
- **Task 5 — Sidebar mobile sizing**: Already handled via `Modal size="drawer"` (320px = `--modal-width-drawer`), nav items `height: 44px`, focus restoration on close. Build passes.
- **Task 6 — Mobile header height consistency**: Already handled via `responsive.css @media (max-width: 768px)` setting `--app-header-height: 52px` and `:root { --app-header-height: 56px }`. Build passes.
- **Task 7 — Search/Filter bar mobile constraints**: Already handled via `responsive.css` with `--input-height-mobile: 44px`, `.search-box min-width: min(280px, 100%)`, stacked at ≤768px. Build passes.
- **Task 8 — Settings card & Manage grid adaptation**: Already handled via `responsive.css` `.router-outlet .grid-view` with `minmax(min(280px, 100%), 1fr)`, cards padding via `--space-card-padding-sm` tokens. Build passes.
- **Task 9 — Row action touch targets**: Already handled via `responsive.css` `.row-actions` opacity-to-1 on coarse pointer, and ListRow drag-handle @44px min-height/min-width fixed above. Build passes.
- **Task 10 — Portal mobile hero/footer**: Already handled via Tailwind responsive layout; known portal lint config issue exists but build passes. Recommended: run portal TypeScript check + Playwright scenarios before release.

Remaining tasks:

- **Task 1 / Task 11 — Phase 4 verification & regression pass**: Requires real-device screenshot capture and manual testing on phone/tablet/desktop widths; cannot be fully automated in this environment.

## New suggestions recorded 2026-10-31 (outside implementation scope)

- CM-R1 — Document a consistent glossary for builder, favorite, saved and remote destinations; use it in labels and help text to reduce ambiguity.
- CM-R2 — Triage dependency audit results separately in all three npm trees, distinguishing shipped runtime dependencies from build tools; assign owners and track fixes without forced major upgrades.
- CM-R3 — Run mutation testing selectively on capture safety guards to verify tests fail when privacy, host validation or durable-save conditions are removed.

## New later suggestions recorded 2026-10-31 after implementation

- CM-R4 — Quarantine malformed stored playlist records with an export option instead of offering only a repair error, so recovery preserves original bytes.
- CM-R5 — Add privacy-safe crash recovery diagnostics (operation/state codes only, never page data) so interrupted capture failures can be investigated without sensitive exports.
- CM-R6 — Add a backup preflight estimate of required disk/storage space and recovery steps before large restores, reducing partial failures on constrained devices.

## New recommendations from post-Hermes review (2026-10-31)

- CM-R7 — Durable verification receipts with actual exit codes and tested tree/artifact identity.
- CM-R8 — Generate protocol declarations from checked JS/JSDoc and canonical shared types.
- CM-R9 — Inventory bundled code separately from development/build-only dependencies for security triage.

See `docs/testing/POST_HERMES_PLAN.md` for why, implementation approach and acceptance.

## Shared agent workflow — 2026-10-31

- [x] Add model-neutral workflow, reusable start prompt and blank task/review/verification/handoff templates; link from AGENTS.md. Documentation only; tests remain delegated.

## OpenSpec setup — 2026-10-31

- [x] Install OpenSpec 1.16.0, initialize Codex/Hermes, enable Hermes project skills and document usage.
- [x] Import existing remaining work into the open complete-context-menu-acceptance change without certifying completion.
- Acceptance tasks: see `openspec/changes/complete-context-menu-acceptance/tasks.md`; all are initially pending and current-tree evidence must be rechecked.

### New OpenSpec follow-up suggestions (OS-1/OS-2/OS-3)

- OS-1 — Add a version-pinned bootstrap helper for other machines so agents use a reproducible CLI release.
- OS-2 — Add strict OpenSpec validation to CI so malformed requirements/tasks are caught before merge.
- OS-3 — Add secret scanning for planning/evidence artifacts so credentials pasted into handoffs are detected automatically.

## Worktree documentation update — 2026-10-31

- [x] Update shared workflow and reusable implementation/review prompts with worktree selection, starting snapshots, one-writer coordination and safe cleanup.
- [x] Extend all four blank templates with absolute worktree/branch/base identity, owners, environment setup, evidence and integration/resume fields.
- [x] Align AGENTS.md, OpenSpec usage, documentation index and .ai-sync summaries; preserve newer Hermes results.
- Documentation only. No worktree creation, application changes, dependency changes or application verification performed. Tests/builds remain delegated.

### Later worktree improvements (WT-1 / WT-2 / WT-3)

- WT-1 — Add a small machine-readable assignment registry to detect duplicate ownership and make parallel-agent coordination easier.
- WT-2 — Add a pre-write workspace guard that checks expected path/branch before agent mutations, reducing accidental edits to the wrong checkout.
- WT-3 — Add an automated integration rehearsal against the target branch to catch overlapping changes before combining independently verified implementations.

## Relevant-skill documentation: 2026-10-31

- [x] Add task-based skill discovery to AGENTS.md, shared workflow, implementation/review prompts and OpenSpec usage.
- [x] Add blank skill-selection fields to task/review/verification/handoff templates.
- [x] Preserve scope, worktree ownership, delegated verification and release restrictions.
- Documentation only; no application verification performed.

## Parallel orchestration proposal: 2026-10-31

- [x] Document coordinator/worker roles, dedicated feature worktrees, two-job limit, verifier ownership, target refresh, push-before-PR and manual-by-default merge policy.
- [x] Create proposal, behavior spec, design and implementation/verification tasks for `orchestrate-parallel-implementations`.
- [x] Link the policy from AGENTS.md, shared workflow, prompts, blank templates, OpenSpec guide and docs index.
- [x] Implement runtime tooling and verify it: workspace preflight, lifecycle adapters, dispatch adapters, role/resource leases, target sync, evidence receipts, scoped publication, uncertain-effect reconciliation, review/CI readiness, guarded merge gates, single-slot integration and cancellation. 19/21 change tasks done.
- [x] Live pilot (task 7.3): branch `feat/orchestration-coordinator` pushed from `origin/next`, draft PR #52 opened, idempotent resume verified (repeat push is a no-op, one PR per head).
- [x] Pilot review (task 7.4): real `gh` data fed through the readiness gates; required checks pass, decision `blocked` only because the PR is a draft. Merge mode stays manual; nothing merged.
- No agents launched, worktrees created, commits/pushes/PRs/merges performed, GitHub settings changed or application tests run in this planning turn.

## Latest Hermes review — acceptance still pending (2026-10-31)

- [x] Fix missing/unknown review, protection and remote-head cases in guarded merge/integration; require explicit validated readiness and zero service calls on refusal.
- [x] Bind evidence to modified/untracked source (workingTree hash, STALE_WORKING_TREE / SOURCE_IDENTITY_UNAVAILABLE).
- [x] Resolve contracts-check exit 1 (typed job payloads, regenerated declarations) and re-run task 7.1 evidence: all eight gates exit 0, allPassed=true, treeUnchanged=true.
- [~] Remove new oversized-file exemptions: done (registry/recovery/workspace/dispatch split, allowlist entries deleted).
- [ ] Finish interrupted CM-R7/R8/R9 implementation and mandatory headed coverage.
- [ ] Obtain current sequential Hermes evidence before native acceptance or an explicitly authorized draft-PR pilot. Merge mode remains manual.

Review: sessions/2026-10-31-latest-hermes-review.md. No tests rerun by Codex.

## Toolbar popup: mobile sizing + instant open — implemented (2026-10-31)

Plan: `docs/POPUP_MOBILE_PLAN.md`. Owner resolved the open decisions: desktop popup
420 px, Firefox Android full-screen, Font Awesome replaced with inline SVG.

- [x] Reproduce and quantify (280–768 px, cold cache, 6× CPU throttle): 360 px popup,
      15–22 px strip, height pinned to `100dvh`, 26–30 px primary button, 13 px inputs,
      `env(safe-area-*)` always 0, theme after module graph, 189 ms dead-click window,
      112 KB CSS + 146 KB JS + 147 KB font before first paint.
- [x] P0 popup-mode harness: `packages/build-tools/verify-popup.js` (fixed 420 px width,
      content height, full-bleed page mode, 44 px targets, 16 px inputs, no `vw` units,
      no Font Awesome) wired into `npm run test:extension`.
- [x] P1 explicit `ui-popup` / `ui-page` modes (`popup/mode.js` classifies via
      `extension.getViews({ type: "popup" })` + `?mode=` override before CSS); no `vw`/`vh`
      in popup mode; themed `html` background; single ordered stylesheet.
- [x] P2 44 px (48 px page/touch) targets, 16 px inputs on full-screen pages,
      `viewport-fit=cover`, sticky Import footer, `color-scheme` meta.
- [x] P3 Font Awesome removed from the popup (inline SVG sprite, 9 glyphs); editor
      modules (`youtube-auth/api`, `storage-service`, `utils`, `video-service`) lazy-loaded
      after first paint via dynamic `import()`.
- [x] P4 handlers wired at module evaluation before any `await`; theme applied before
      first paint; `target.js` made null-safe so hydration never throws on a torn-down DOM.
- [~] P5 gates green (`npm run check` exit 0: lint/format, 543 tests, file-size,
  svelte-check, css/vercel/tooling/release-notes; `npm run test:extension` exit 0;
  build in progress). Real-device matrix (Chrome desktop popup cold-open ×10,
  Firefox Android) remains manual.

Suggested next steps (new, not scheduled):

- PS-1 (professionalism) — Move popup colour/radius/spacing definitions onto the shared
  token source (`playlist-manager/src/css/design-tokens.css`) instead of the local `:root`
  copy; the two drifted (360 vs 390 px hardcodes) because nothing binds them.
- PS-2 (security) — Add an explicit `content_security_policy.extension_pages` to the
  manifests; the theme pre-paint classifier is already an external script (no inline
  script), so a strict CSP can be added without any `unsafe-inline` exception.
- PS-3 (best practices) — Add Playwright visual snapshots of the popup at 4 widths ×
  2 themes so icon and spacing changes cannot silently regress the way Font Awesome's
  93 KB stylesheet hid the layout problem.
