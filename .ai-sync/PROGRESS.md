# Pagination progress

## Data Manager hardening + checked type contracts (2026-10-26)

- [x] Make forced refresh non-destructive: `refresh-registry` intent instead of
      `dbDeleteMetadata` before fetching; cache survives a failed refetch.
- [x] Single definition of "incomplete": `needsAttention` in the summary; badge, stat
      cards and gaps list agree, `complete + needsAttention === total`.
- [x] Treat zero-length durations (`PT0S`, `0:00`) as missing in `hasDuration`.
- [x] Report refresh results from `metaMap.size` / `unavailableIds`.
- [x] Render gap reasons from `getMetadataGaps` instead of a divergent copy.
- [x] Convert `types/services.d.ts` + `types/window.d.ts` to checked `.ts` modules
      (`declare global` + `export {}`) — `skipLibCheck` had hidden them entirely.
- [x] Resolve the conflicting `Window` members it exposed and make `getPlaylist`
      truthfully nullable; guard the two call sites that assumed non-null.
- [x] Split the Data Manager into three scoped-style components; delete the global
      `css/metadata-manager.css` that collided with `.card` / `.loading-state`.
- [x] Cap the gaps list at 100 with "Show N more"; add `aria-live` progress and an
      exact-count `aria-label` on the badge.
- [x] Single source of truth for engine labels/order (`services/metadata-engines.ts`).
- [x] Load the Sidebar gap badge on idle instead of on every app start.
- [x] Tests: 23 for metadata completeness, 7 for enrichment force semantics.
- [x] `npm run check` PASS (19 files / 181 tests, file-size + CSS gates, 0 svelte-check
      errors) and `npm run build` PASS for chrome/firefox/edge.
- [ ] Decide whether `VideoService.clearCache()` (now unused) stays as public API.
- [ ] Real browser pass over `#/metadata` via `npm run test:extension`.

## Data Manager view + test environment fix (2026-10-26)

- [x] Expose gap APIs on `window` (`getMetadataCacheCount`, `getMetadataGapSummary`,
      `getMetadataGaps`, `refreshMetadataGaps`, `clearIncompleteMetadata`).
- [x] Treat a missing duration as "not fresh" in `shouldSkipFetch` so duration is re-fetched.
- [x] Build `views/MetadataManager.svelte` (stat grid, engine list, bulk refresh,
      remove-incomplete, clear-cache, per-entry retry).
- [x] Move view CSS to `css/metadata-manager.css`; drop the in-component `<style>` block.
- [x] Add `#/metadata` route, sidebar nav item + gap badge, and settings entry points.
- [x] Trim `types/services.d.ts` to 323 lines via shared `YtVideoMetaResult` interface.
- [x] Fix jsdom `localStorage` being shadowed by Node 26's experimental global
      (`vitest.setup.mjs` + `setupFiles`); `theme.store.test.ts` is unmodified.
- [x] Final `npm run check` PASS: 151 tests / 17 files, Prettier clean, file-size
      gate clean, svelte-check 0 errors (2 pre-existing warnings), CSS gate clean.
- [ ] Manual smoke test of the Data Manager in an unpacked build.

## GitHub issues and Dependabot follow-up

- [x] Read all four open issues and 45 open Dependabot alerts through GitHub.
- [x] Verify #10 pagination; reproduce/fix #13 pre-paint theme and #14 duration enrichment.
- [x] Add #11 optional persistent thumbnail archive, shared preview fallback, controls and backups.
- [x] Root/extension/portal audits clean; no versions match any of the 45 alert ranges.
- [x] Verify check/build/portal build, focused issue suite, Chromium/Firefox and portal layouts.
- [x] Prepare local fix commit with only this task's changes; preserve pre-existing edits. Owner pushes later.

- [x] Baseline checks: 99 tests passed, no Svelte diagnostics.
- [x] Implement compact shared navigation and filtered playlist page counts.
- [x] Add page-window regression tests.
- [x] Final check: lint, formatting, 103 tests, zero Svelte errors/warnings.
- [x] Browser verification: page jumps, arrow boundaries, keyboard Enter,
      widths 240–1000px without horizontal overflow or runtime errors.
- [x] Final Chrome/Firefox production builds and manifest validation passed.

## Responsive layout planning

- [x] Inspect popup, shared dialogs/shell, active views, and current portal layout.
- [x] Document concrete findings, phased scope, and acceptance/test criteria.
- [x] Implement Phase 1: popup and shared dialogs.
- [x] Implement Phase 2: shell and shared components.
- [x] Implement Phase 3: active routes and portal responsive fixes.
- [ ] Complete Phase 4: responsive and real-device regression verification.

## Release readiness work

- [x] Remove unused bookmarks permission identified in Chrome's October 15 takedown.
- [x] Limit web exposure, support mobile YouTube hosts, fix tab metadata persistence.
- [x] Restore builder route, filtered reordering, touch/keyboard reorder controls.
- [x] Fix cross-context settings cache invalidation and Firefox OAuth URL/state handling.
- [x] Reject malformed/future backups and avoid clearing unrelated data for legacy imports.
- [x] Fix clean-build HTML generation and eliminate stale chunks from release packages.
- [x] Upgrade vulnerable dependencies: extension audit clean; portal production audit clean.
- [x] Portal production build now includes working lint and type checks.
- [x] Unit checks: 111 tests; zero Svelte errors/warnings.
- [x] Real Firefox: 90 route/viewport checks on desktop, 90 with Android user agent.
- [x] Portal: six sizes and fail-closed sync API behavior verified.
- [x] Chromium suite after final modal teardown guard: 90 checks, six interaction groups, no runtime errors.
- [x] Firefox package web-ext lint: zero errors, warnings, notices.
- [x] Initial 1.1.0 release committed/tagged and packaged; Firefox submission withdrawn for disclosure correction.
- [x] Correct Firefox data declaration and add optional account/search consent with background request guards.
- [x] Consent regression coverage: 120 unit tests, zero Svelte diagnostics; 1.1.1 version synchronized.
- [x] Save accurate Chrome data categories and listing description.
- [x] Final 1.1.1 source archive, store packages, commit dff9c9c and annotated tag v1.1.1.
- [x] Submit replacement Firefox listed update: version 6620554, unreviewed, source uploaded.
- [x] Submit Chrome update: 1.1.1 pending review, automatic publication after approval selected.
- [x] Record exact store outcomes and remaining real-device/authenticated-flow limitations.
- [x] Create unlisted Firefox test release (v1.2.0.1, AMO version ID 6620940) for external testing.
- [ ] Await user confirmation before pushing main/tag or updating official public portal release.

## Design Token System & Workflow Analysis (2026-10-25)

- [x] Create comprehensive design-tokens.css (single source of truth for responsive tokens)
- [x] Update main.ts to import design-tokens.css first
- [x] Run full check/build/test:extension verification — all pass
- [x] Create workflow analysis document: ~/Notebooks/Projects/iypm/workflow-analysis-2026-W43.md
- [x] Create Phase 4 verification checklist: ~/Notebooks/Projects/iypm/phase4-verification-checklist.md
- [x] Create Tailwind 4 migration research: ~/Notebooks/Areas/_reference/Research/tailwind4-migration-plan.md
- [x] Create Hermes profile: ~/.hermes/profiles/iypm/ with workflow-analyst, github, vercel skills
- [x] Configure cron jobs for weekly workflow review and productivity reports

## Microsoft Edge Browser Support (2026-10-25)

- [x] Derive Edge manifest from Chrome (`key`/`browser_specific_settings` stripped); no static Edge manifest
- [x] Update build-extension.js to support the "edge" target
- [x] Create Edge store packaging script: packages/build-tools/package-edge-store.js
- [x] Strengthen validate-manifests.js: Edge must equal Chrome minus key/browser_specific_settings
- [x] Update verify-css-bundle.js to include the Edge bundle.css path
- [x] Update package.json: add build-edge, pack:edge, update build/pack scripts
- [x] Update iypm.sh: add pack:edge, status, help, completions (bash/zsh/fish)
- [x] Replace portal Edge icon with the official Microsoft Edge logo
- [x] Gate the landing-page Edge button behind NEXT_PUBLIC_EDGE_STORE_URL
- [x] Update docs, AGENTS, README, CI labels, changelog, release notes, and release readiness
- [x] Build, validate, and package the Edge 1.1.1 ZIP locally
- [x] Create `docs/edge-release-metadata.json`, `docs/EDGE_STORE_SUBMISSION.md`, and 300×300 Edge store logo
- [x] Verify manifest equality, negative validation, ZIP contents, and portal env gating
- [ ] Submit to Microsoft Edge Add-ons (free Partner Center registration)
- [ ] Complete the IARC questionnaire and listing fields in Partner Center
- [ ] Verify the published Edge package on Windows/macOS
- [ ] Set NEXT_PUBLIC_EDGE_STORE_URL and add the Edge badge after approval

## Theme Picker / Appearance Dropdown Fix (2026-10-25)

- [x] Fix ThemePicker positioning: changed from centered modal to right-aligned submenu
- [x] Update theme-submenu CSS: absolute positioning at `right: 100%` with proper animation
- [x] Integrate with ProfileDropdown: added themeSubmenuOpen state and click-outside handling
- [x] Fix click-outside behavior: clicking in dropdown but outside theme submenu closes only submenu
- [x] Update ThemePicker to accept onSubmenuToggle callback for parent coordination
- [x] Fix "Device default" theme: accept "device" in localStorage, add prefers-color-scheme listener
- [x] Add system theme change detection: mediaQuery listener in theme.store.ts
- [x] Mobile responsive: bottom sheet animation on mobile (<600px)
- [x] Accessibility: role="menuitemradio", aria-checked, proper keyboard navigation
- [x] Run full check/build/test:extension verification — all pass (except pre-existing localStorage test issue)

## Modal/Dialog Refactoring (2026-10-25)

- [x] Update Modal.svelte: add header with title + close button, enforce Header→Body→Footer structure via slots
- [x] Add destructive button variant to SimpleButton (uses --color-brand-danger)
- [x] Update ManageModals.svelte: Merge, Save Offline, Progress, Export modals use new structure
- [x] Update PlaylistModals.svelte: Export, Import, Copy/Move, PlayAllInfo, ScrapeHtml modals use new structure
- [x] Update PlaybackSettings.svelte: PlayAllInfo modal uses new structure
- [x] Update Manage.svelte: Inline Progress, Merge, Save Offline dialogs use Modal component
- [x] Update RangeSelectModal.svelte: Use new Modal with header/footer slots
- [x] Update MultiSortModal.svelte: Use new Modal with header/footer slots
- [x] Button copy improvements: "Cancel" → "Cancel", "Close" → "Done", specific actions like "Merge Now", "Save Offline", "Copy", "Move"
- [x] Footer button order: Primary (right) / Secondary (left) enforced via slot="footer"
- [x] Accessibility: proper aria labels, focus management, Escape key handling
- [x] Run full check/build/test:extension verification — all pass (except pre-existing localStorage test issue)

## CI gates, onboarding, Svelte repair, OAuth UX (2026-10-26)

- [x] CI: bump Node 20 → 22 in all `.github/workflows/ci.yml` jobs.
- [x] CI: make high-severity root `npm audit` blocking.
- [x] CI: add `npm run test:extension` to the PR `test-web` job after Playwright install.
- [x] Add `packages/build-tools/verify-budgets.js` to `npm run build` (main.js 380 KiB,
      bundle.css 175 KiB, popup.css 22 KiB, background.js 16 KiB).
- [x] Add `packages/build-tools/verify-file-size.js` with exact-path allowlist for
      22 legacy files >350 lines; wire to `npm run check` / `check:file-size`.
- [x] Onboarding: `Saved.svelte` distinguishes first run from filtered-empty; first-run
      CTA “Create your first playlist” → `#/new`, local-first/no-Google-account copy.
- [x] Onboarding: `PlaylistGrid.svelte` passes empty-state action props;
      `EmptyState.svelte` gains focus-visible styling.
- [x] Remove unused `services/sync-service.ts`, `views/Saved-refactored.svelte`, and
      dead `_syncServiceLoaded` / `SyncService` window declarations.
- [x] Add `services/playlist-actions.test.ts` (16 tests); fix stale sync-state cleanup
      when a remote playlist no longer exists.
- [x] Modal: add `footer` snippet support; convert all 15 legacy `slot="footer"` callers.
- [x] Repair `Manage.svelte` Modal/ProgressBar imports and `Settings.svelte`
      `bind:showPlayAllInfo`.
- [x] Restore metadata types (`isShorts`, `liveBroadcastDetails`, `RawVideoMeta.isShort`).
- [x] OAuth UX: BYO Client ID required; API key optional for signed-out metadata
      fallback; built-in shared OAuth not enabled.
- [x] Add `utils/youtube-credentials.ts` + 5 tests; update auth guard/messages and
      Header/ProfileDropdown/AuthPlaceholder/OfflineNotice/FavoriteSettings/DeveloperSetup copy.
- [x] Update `docs/USER_GUIDE.md` (API key optional, no source editing, redirect URI
      from API Setup, per-Google-Cloud-project quota).
- [x] Verify `npm run check` PASS: 17 test files, 151 tests, 0 svelte-check errors,
      2 pre-existing unused-CSS warnings in `PlaylistModals.svelte`, file-size/CSS gates pass.
- [x] Verify `npm run build` PASS for Chrome, Firefox, Edge; manifest and bundle budgets pass.
- [x] Verify `npm run test:extension` PASS: 90 route/viewport checks, 6 interaction
      groups, no runtime errors.
- [x] Confirm `npm audit --audit-level=high` previously clean at root;
      playlist-manager install reports 0 vulnerabilities.
- [x] Leave dirty working tree (pre-existing Edge, modal/theme, portal, docs changes)
      uncommitted; no commit or push performed.
- [ ] Split/commit the intended release scope; keep Edge/issue fixes separate from
      unrelated UI work.
- [ ] Add Phase 1 active-sync reliability tests: quota failure/resume, local-wins
      overwrite/conflict policy, and `savePlaylist` failure handling.
- [ ] Real Microsoft Edge smoke test and Partner Center/IARC submission (external;
      Edge store ID still unknown).
- [ ] Resolve OAuth silent-refresh fragility and unused built-in `CLIENT_ID` before
      shipping any shared client.

# Sorted local playlist save failure (2026-10-26)

- [x] Reproduce nested reactive sort-rule clone failure; cover 1,404 and 14,000 videos.
- [x] Detach local playlist data before browser storage writes without losing sort rules.
- [x] Keep edits on save failure, expose visible error and Retry, avoid unhandled save rejections.
- [x] Track silent saves and suppress misleading sort success after failure.
- [x] Full check/build: 184 tests, zero type errors; Chrome/Firefox/Edge builds pass.
- [ ] Integrate fix with the intended next release and verify the user's real playlist.
