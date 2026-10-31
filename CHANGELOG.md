# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Automated beta releases: every merge to `next` now builds the extension and cuts a
  public GitHub Prerelease (`vX.Y.Z-beta.N`, manifest build `X.Y.Z.N`) with the Chrome,
  Edge and Firefox ZIPs attached, so builds can be tested before an official release.
  The version is derived per merge and never committed; the `main` official-release
  flow is unchanged.
- Unreleased desktop page context menu with seven capture scopes, bounded destination
  selection, searchable local/YouTube chooser, page import options, explicit remote
  Sync review, expiring capture jobs, progress and cancellation. Native captures keep
  tabs open by default; optional closure checks newly saved IDs and unchanged source tabs.
- Shared background authority for playlist and builder writes with atomic revisions,
  conflict feedback and retry receipts. Add dependency-tree triage, runtime module packaging
  verification and disposable safety mutation checks. Verification is pending Hermes.

### Fixed

- Harden the unreleased context-menu capture path: exclude private tabs, validate YouTube
  URL schemes and video IDs, preserve clicked-tab selection and cross-window order,
  fall back from media URLs to watch-page URLs, and create new local playlists offline.
  Reject remote destinations until explicit review is available instead of silently
  making local copies; do not recreate missing favorite destinations.

## [1.2.1] - 2026-10-27

### Fixed

- Import from Page works on any regular web page again, not only pages whose channel could
  be detected: the popup no longer requires a channel name to scan a tab. Quantity `0`
  now means "all videos" (the injector treats it as unlimited), scrolling stops after
  three _consecutive_ stalled attempts instead of three attempts in total, and failures are
  reported inline under the form instead of in an `alert()` that dismissed the popup.
- Mobile UX improvements across the extension popup and SPA editor: touch targets now meet
  the 44px minimum on all interactive elements (ProfileDropdown avatar, dropdown menu items,
  modal actions, MultiSortModal controls, SearchInput clear button, ListRow drag handles,
  popup menu items, Header sign-in/create/menu-toggle buttons, Manage action buttons,
  PlaybackSettings info icon, checkboxes in ListRow/PlaylistVideo/BulkActionsBar); ConfirmationModal
  migrated to the shared Modal component with focus restoration and Escape handling; popup widths
  aligned to design tokens (`--popup-max-width: calc(100vw - 32px)`); sidebar drawer and header
  heights standardized via `--header-height-mobile`; tablet (768px) horizontal overflow fixed
  by correcting media query overlap in App.svelte. Phase 4 real-device verification (screenshots,
  manual Firefox Android test) remains pending.

### Changed

- Documentation restructured for handover: `.ai-sync/HANDOFF.md` is now a short, verified
  current-state file (branches, SHAs, pending work, known traps) instead of 650 lines of
  per-session narration; the old log is frozen in `.ai-sync/HISTORY.md`. `PLAN.md` and
  `PROGRESS.md` describe only scheduled and open work, `docs/INDEX.md` maps every document,
  and `AGENTS.md` opens with an explicit reading order. Removed `docs/RELEASE_SPEC.md`, which
  still instructed agents to release from `main` and contradicted `docs/RELEASING.md`, and
  moved three completed implementation plans out of the repository root into `docs/archive/`.
- Git workflow: `next` is the integration branch and `main` holds releases only. Work
  branches from `next` and PRs into it, squash-merged; a release is one squash-merged PR
  from `next` to `main`, tagged `vX.Y.Z`, after which `main` is merged back into `next`.
- CI and security workflows run on `next` as well as `main`.
- The extension E2E suite no longer breaks when the root and portal trees resolve different
  Playwright versions: CI now installs browsers for both trees, and
  `verify-tooling-versions.js` (in `npm run check`) fails with the fix instead of leaving a
  missing-executable error that reads like a flake.
- Dependabot now monitors all three npm trees: root, `apps/web-portal` and
  `apps/browser-extension/playlist-manager`. Previously only `/` was configured, so portal
  and extension dependencies received no update PRs at all. Each tree is grouped
  separately, and framework majors (next/react/react-dom, svelte) are ignored — they are
  migrations, not weekly chores.
- Vercel deployment fixed: `rootDirectory` removed from `vercel.json` (it is a project
  setting, not a config key) and guarded by `verify-vercel-config.js`, so deployments no
  longer fail at config parse.

## [1.2.0] - 2026-10-26

### Added

- **Data Manager** (`#/metadata`): shows how many cached videos are missing a title, channel or duration and repairs them — Re-scan, Refresh Missing Metadata, Remove Incomplete Entries, Clear All Cache, and per-entry Retry. Reachable from the sidebar (with a gap badge) and from Metadata settings.
- `utils/metadata-completeness.ts`: a single definition of a resolved entry (`hasCompleteMetadata` / `needsAttention`) shared by the badge, the stat cards and the gaps list, so the three counts can no longer disagree.
- 30 new unit tests: metadata completeness (23) and forced-refresh semantics (7).
- CSS bundle verification tool (`packages/build-tools/verify-css-bundle.js`) enforcing no `@import` in Svelte components
- Developer CLI script (`iypm.sh`) with commands: `status`, `features`, `changes`, `check`, `build`
- Design token system as single source of truth (`src/css/design-tokens.css`)
- Responsive utility tokens and breakpoints for popup and page layouts
- Comprehensive test suites for metadata fallback, video metadata regression, thumbnail archive, theme store
- ESLint `ignores` property migration (replacing deprecated `.eslintignore`)
- Microsoft Edge (Chromium) support: derived MV3 manifest, store ZIP packaging, portal install button, and Edge Add-ons submission guide

### Changed

- **Metadata refresh no longer destroys cached data.** A forced refresh used to delete the IndexedDB rows before fetching, so an entry that only lacked a duration could lose its title and channel when the refetch failed. Ids are now marked in memory (`services/refresh-registry.ts`); successful results overwrite, failures leave the previous entry untouched.
- `types/services.d.ts` and `types/window.d.ts` became `types/services.ts` and `types/window.ts` (`declare global` + `export {}`). `skipLibCheck` skips every `.d.ts`, so the entire `window` API contract was previously unverified.
- **BREAKING**: Svelte components must no longer use `<style> @import "..." </style>` — global styles must be imported in `src/main.ts`
- Removed `@import "../css/view-layout.css"` from 14+ Svelte components
- Build and check scripts now run CSS bundle verification automatically
- Updated AGENTS.md with critical CSS & Component Styling Rules section
- Updated README.md with developer CLI documentation
- Edge manifest is generated from the Chrome manifest minus `key`/`browser_specific_settings`; no static Edge manifest is maintained
- Edge install button is gated by `NEXT_PUBLIC_EDGE_STORE_URL` until the store listing is approved
- **In-app release notes are generated from this file** (`packages/build-tools/gen-release-notes.mjs`). The modal previously carried a hand-copied history that had drifted into showing a 2020 entry for 1.2.0.
- The build installs extension dependencies with `npm ci` instead of `npm install`; npm 11 prunes a nested `picomatch` entry npm 10 requires, so a local build could silently break CI.

### Fixed

- A zero-length duration (`PT0S`, `0:00`, `00:00:00`) is treated as missing instead of satisfying the duration requirement — the bug that made videos with an unknown length look complete forever.
- `getPlaylist` is declared `Promise<Playlist | null>`, which it always was; copy/move and bulk delete now guard the null case instead of dereferencing it.
- Refresh reports how many entries actually resolved, and names the ones that did not, instead of echoing the requested count.
- `refreshMetadataGaps()` returned the request count when nothing resolved.
- GitHub UI issues and dependency alerts
- Stray `@import` statements in generated `bundle.css` that browsers ignored
- Vercel configuration for web-portal (rootDirectory set to `apps/web-portal`)
- The extension E2E suite had never executed an assertion: the fixture resolved the unpacked extension one directory short (`apps/dist/chrome`) while the build writes to `<repo>/dist/chrome`, so Chromium stalled on a missing `--load-extension` path until the 60s timeout. Two stale assertions replaced with ones that survive auth state.
- The Manage page's bulk action bar was declared as a snippet outside `StickyHeader`, so select-all, Merge, Save Offline, bulk Delete and privacy changes were unreachable.
- Closed dialogs painted as empty bordered boxes: the base `dialog` rule set `display: flex`, which outranks the browser's `dialog:not([open]) { display: none }`.
- Saving from the Playlist Builder called `ytUpdatePlaylist()` with a timestamp id that never existed on YouTube; the builder is now a local playlist.
- Videos added by quick-add while the builder was open were never shown, and saving cleared them.
- Restoring a backup created before thumbnail archiving replaced the database but left the old images on disk, which were then re-exported.
- `iypm.sh reset` always failed: `clean` deleted the tracked `package-lock.json` that `npm ci` requires.

## [1.1.1] - 2026-08-26

### Changed

- Version bump to 1.1.1 (submitted to Chrome Web Store and Firefox AMO)
- Chrome: Pending review (auto-publish on approval)
- Firefox Listed: Unreviewed (ID 6620554)
- Firefox Unlisted Test: v1.2.0.1 (ID 6620940)

## [1.1.0] - 2026-08-26

### Added

- Design token system & workflow analysis
- Responsive UI plan for phone, tablet, desktop
- Comprehensive UI/UX improvements for all display sizes

### Changed

- Improved responsive UX and hardened extension release
- Planned responsive popup and page layouts

### Fixed

- Keep playlist pagination compact and accessible
- Remove incorrect Next.js dependency from root package.json

## [1.0.x] - Earlier Releases

### Added

- Initial project setup with MIT license
- Browser extension (MV3) for Chrome and Firefox
- Web portal (Next.js 15 + Tailwind + shadcn/ui)
- IndexedDB video metadata storage with multi-tier fetch engine
- Supabase cloud sync with bidirectional delta-sync
- Full database backup/restore (JSON, CSV, M3U)
- Tab harvester, batch add, right-click context menus
- Bulk operations: merge, split, deduplicate, smart sort
- Cross-device sync (optional, encrypted)

---

## Release Notes

- **v1.1.1**: Production release submitted to both extension stores
- **v1.1.0**: Major UI overhaul with design tokens and responsive system
- **Unreleased**: CSS architecture enforcement, developer tooling, test expansion, Microsoft Edge support
