# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
