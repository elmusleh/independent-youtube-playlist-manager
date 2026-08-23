# Release Notes

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **5-Tier Resilient YouTube Metadata Extraction Engine** — completely resolved the issue where videos only displayed thumbnails by implementing a high-reliability fallback pipeline:
  - **Tier 1 (YouTube Data API v3):** Batch queries (`/videos?id=...`) with 50-item chunks consuming only 1 quota point when authenticated or when a custom API key is supplied.
  - **Tier 2 (Multi-Client Innertube):** Upgraded Innertube to modern `MWEB` and `WEB` client configurations (`clientVersion: "2.20240801.01.00"`), bypassing YouTube's bot-detection and deprecated Android client blocks.
  - **Tier 3 (Embed Page Scraper):** Headless fetch of `https://www.youtube.com/embed/{id}` extracting `ytInitialPlayerResponse` JSON directly from lightweight embed HTML.
  - **Tier 4 (Official YouTube oEmbed):** Integrated official YouTube oEmbed API (`/oembed`) replacing third-party `noembed.com` proxy.
- **Free / Zero-Quota First Strategy** — prioritized zero-quota engines (Innertube `MWEB`/`WEB`, Embed Parser, oEmbed) before the official YouTube Data API v3, preserving 100% of user API quota for account mutations and full syncs.
- **Dedicated Scraping & Metadata Settings Section** — added full user control over metadata providers in Settings:
  - Select between *Zero-Quota / Free First* vs *Official YouTube Data API First* execution strategies.
  - Individual toggle switches for Innertube, Embed Page Scraper, Official oEmbed, and Piped/Invidious.
  - Support for custom self-hosted Invidious and Piped API instance URLs.
  - Live IndexedDB metadata cache stats badge with one-click *Clear Metadata Cache* button.
- **Skeleton Loading Shimmer in Video Cards** — added smooth CSS skeleton placeholder animations in `PlaylistVideo.svelte` to provide instant visual feedback while background metadata resolution is in-flight.
- **Thumbnail Status Badges** — added visual indicators on video thumbnails for `LIVE` (pulsing red), `Private` (neutral gray), and `Deleted` / `Unavailable` (warning red) states.
- **Transactional IndexedDB Storage Engine (`db-service.ts`)** — implemented resilient, atomic batch operations and exponential backoff retry mechanisms for IndexedDB writes to eliminate data loss, contention locks, and storage dropping.
- **Strict Schema Normalization (`schema-normalizer.ts`)** — enforced rigid TypeScript and JSON schemas across all video metadata, playlists, and watch history records, guaranteeing deterministic schema validation and sanitization prior to persistent storage.
- **Full Database Backup & Portable Restore (`backup-service.ts`)** — created a zero-data-loss export and import pipeline:
  - **Export Full Backup (.json):** Dumps entire application state including playlists, complete IndexedDB video metadata cache, watch history timestamps, and settings into a validated backup format (`schemaVersion: 2`).
  - **Portable Restore Pipeline:** Supports safe *Merge* (retaining existing playlists and freshest metadata/progress) and *Overwrite* restoration modes with automated schema validation and duplicate resolution.
- **Uncapped Storage Capacity** — removed legacy 4,000-item metadata limits, fully unlocking `unlimitedStorage` multi-gigabyte IndexedDB capacity.
- **Automatic IndexedDB Cache Pruning** — registered background housekeeping in `background.js` to automatically purge stale video metadata cache entries older than 30 days.

---

## [2.12.10] - 2026-07-01

### Added
- **Mobile drawer navigation** — on screens ≤768px, the sidebar now transforms into a slide-in drawer with hamburger menu toggle, providing a native mobile app experience
  - _Technical: `Sidebar.svelte` now renders both a desktop sidebar and a mobile drawer; drawer uses `transform: translateX` for smooth slide animation; close button and nav click handlers delegate to parent via `onClose` prop; shared CSS selectors keep nav item styling consistent across both modes_

---

## [2.12.9] - 2026-06-30

### Added
- **Per-video IndexedDB metadata cache with TTL** — video metadata is now cached per-video using `idb-keyval` (IndexedDB) instead of a single monolithic `browser.storage.local` object, improving read/write performance at scale
  - _Technical: Each video's metadata is stored under `yph:meta:<videoId>` with a configurable TTL; stale entries are silently refreshed in the background_
- **Opt-in auto-fetch setting** — users can now choose to enable automatic metadata fetching on page load via a new toggle in Settings; defaults to off for privacy
  - _Technical: Added `autoFetchMetadata` boolean setting; `PlaylistEditor.svelte` checks this before calling `ensureMetadataLoaded()`_
- **Playlist dropdown placeholder & "Create New" option** — the playlist selector dropdown now shows a helpful placeholder when empty and includes a "+ Create New Playlist" quick-action at the top
  - _Technical: Added `placeholder` prop and inline creation flow to the dropdown component in `PlaylistEditor.svelte`_

### Changed
- **Removed persistent negative cache check from batch fetch** — the batch metadata fetcher no longer reads persistent cache for negative entries, allowing immediate retries when metadata becomes available
  - _Technical: Removed `PERSISTENT_CACHE_KEY` lookup from `ytFetchVideoDurations()` in `youtube-api.ts`; session cache still deduplicates within a single page load_
- **Metadata architecture documentation** — added comprehensive docs explaining the hybrid storage model, IndexedDB cache structure, TTL behavior, and fetch orchestration between Innertube and Invidious APIs
  - _Technical: New `docs/metadata-architecture.md` documenting the caching layers, fallback order, and performance characteristics_

---

## [2.12.8] - 2026-06-30

### Added
- **Playlist import validation & size limits** — importing playlists now validates metadata format and enforces size limits; cache timestamps are tracked for better cache management
  - _Technical: Added validation in `PlaylistEditor.svelte` and `video-service.ts`; `lastFetchAttempt` timestamps now tracked for all cache entries_
- **History export/import** — you can now export and import your watch history, and playlist exports bundle video metadata for offline portability
  - _Technical: Added history serialization in `storage-service.ts`; playlist exports now include full metadata alongside video IDs_
- **In-flight deduplication & concurrency guards** — simultaneous metadata fetch requests for the same video are now deduplicated, preventing duplicate API calls
  - _Technical: Added `_pendingFetches` Map in `youtube-api.ts` that coalesces concurrent requests for the same videoId_
- **Favorite playlist relinking** — if your Favorite Playlist gets unlinked (e.g. after storage clear), it is automatically rediscovered and relinked on next load
  - _Technical: `storage-service.ts` now scans for existing `[YPH][FAV]` playlists when the stored favorite ID is missing_

### Changed
- **IndexedDB per-video metadata cache** — migrated from a monolithic `browser.storage.local` object (`yph_video_metadata_cache`) to per-video IndexedDB entries via `idb-keyval` (`yph:meta:<videoId>`). Eliminates O(n) reads/writes and removes quota risk for large caches.
  - _Technical: `video-service.ts` now uses `idbGetMany`/`idbSetMany` for batch operations; legacy cache is transparently migrated on first load after update_
- **Larger fetch batches** — metadata fetch batch size increased from 10 to 50 videos for Innertube and Invidious APIs. Removed fixed inter-batch delays; replaced with adaptive pacing that only slows down when >50% of a batch fails.
  - _Technical: `BATCH_SIZE` increased in `youtube-api.ts`; adaptive delay logic added to `fetchMetadataInnertube` and `fetchDurationsInvidious`_
- **Single-pass refetch with clear reporting** — "Refetch from Source" now completes in one pass instead of first-pass + retry-pass. Reports exact unavailable video IDs (e.g. "Updated 487/500 videos. 13 unavailable").
  - _Technical: `ensureMetadataLoaded()` in `PlaylistEditor.svelte` no longer wipes persistent cache on normal fetches; only force-refetch clears caches. Unavailable IDs logged to console after one pass._
- **Opt-in background auto-fetch** — automatic metadata fetching on page load is now a user-controllable setting (default OFF). When enabled, missing metadata is fetched silently in the background. When disabled, an info toast guides the user to manual refetch.
  - _Technical: Added `autoFetchMetadata` setting to `Settings` interface; gated silent fetch in `loadPageVideos()` behind this flag; toggle added to Settings page_
- **Favorite playlist in filtered lists** — the Favorite Playlist is now included when filtering playlists by type, and settings changes trigger automatic playlist list reload
  - _Technical: `Saved.svelte` filter logic updated to include favorite; `storage-service.ts` broadcasts reload event when favorite setting changes_

---

## [2.12.7] - 2026-06-30

### Added
- **Inline title editing** — ViewHeader now shows a pencil icon button next to the title when an `onTitleChange` callback is provided, allowing users to edit playlist titles directly in the header
  - _Technical: Added edit button with hover animation in `ViewHeader.svelte`; only renders when `onTitleChange` prop is defined_
- **Reactive playlist reloading** — switching between playlists via hash navigation now refreshes playlist data correctly in SPA mode
  - _Technical: `PlaylistLoader.svelte` now watches for URL changes and `PlaylistView.svelte` handles hash params with early-return optimization in `getParam()`_
- **Retry pass for missing metadata** — empty fetch responses no longer wipe existing cache entries; a second pass re-attempts videos that failed on the first try
  - _Technical: `PlaylistEditor.svelte` preserves existing cache entries when `metaMap` is empty; `video-service.ts` stores `lastFetchAttempt` for all outcomes; `loadPageVideos` awaited after sort to ensure UI sync_

### Changed
- **Relaxed metadata validation** — removed negative-cache stub creation and reduced persistent cache TTL from 60 minutes to 5 minutes for faster recovery when metadata becomes available
  - _Technical: Removed negative stub creation in `PlaylistEditor.svelte`; reduced `CACHE_TTL_MS` in `youtube-api.ts`; simplified `fetchVideo` cache-hit logic in `video-service.ts`_

---

## [2.12.6] - 2026-06-30

### Added
- **Session-level metadata cache with negative caching** — video metadata fetches are now deduplicated within a browser session, and failed lookups are remembered for 60 minutes to prevent hammering APIs
  - _Technical: Added `_metadataSessionCache` Map in `youtube-api.ts` that stores results and `null` for failures; `clearMetadataSessionCache()` allows manual invalidation_
- You can now view and change the privacy status (Private/Unlisted/Public) of playlists in the Manage view
  - _Technical: Added `privacyStatus` field to `YtPlaylistInfo`, `ytUpdatePlaylistPrivacy` API function, and bulk action UI in `Manage.svelte`_

### Changed
- You can now mark any playlist as a Favorite and add videos to it with a single click from the popup
  - _Technical: Implemented `Favorite Playlist ⭐️` with automatic recreation if deleted, `[FAV]` tag in description, and visual gold highlighting in `Saved.svelte`_
- A new "Default Quick Add Target" setting lets you choose which playlist receives videos when using Quick Add
  - _Technical: Added `defaultQuickAddTarget` setting persisted in `browser.storage.local`, bound to popup dropdown in `Settings.svelte`_
- Settings and playlist manager now show a visual indicator when changes are auto-saved
- A new "Add to latest" position setting controls whether videos are added to the top or bottom of a playlist
- Full YouTube API integration with OAuth2 authentication — sign in with your Google account to create and manage playlists directly on YouTube
  - _Technical: Added `youtube-auth.js` and `youtube-api.js` services injected onto `window`, with token storage in `browser.storage.local`_
- A new "Max log lines" setting limits how many diagnostic entries are kept in the extension log
- A cloud sync icon now appears when playlists are being synchronised with YouTube
- Playlist creation now suggests a smart default title based on the source content
- Keyboard and screen reader accessibility improved across all interactive controls
  - _Technical: Added ARIA roles, labels, and keyboard event handlers to `ToggleSwitch`, dropdowns, and action buttons_
- Dynamic context menu items now update based on your current saved playlists — no restart needed
- Playlist opening now falls back gracefully for signed-in users when direct navigation fails

### Fixed
- **Eliminated non-stop Invidious console spam** — the batch metadata fetcher no longer retries the same failing videos multiple times per page load, and persistent negative cache prevents retrying across sessions for 60 minutes
  - _Technical: `ytFetchVideoDurations()` now checks session + persistent cache before any API calls; `video-service.ts` stores `lastFetchAttempt` timestamps and returns cached stubs for recently-failed lookups_
- Creating or resetting the Favorite Playlist no longer produces duplicates if triggered more than once
  - _Technical: Made `resetOrCreate` idempotent by checking for existing `[YPH][FAV]`-tagged playlists before creating_
- Favorite Playlist now persists correctly across browser sessions and works fully offline
- Favorite Playlist entry appears in the UI immediately after creation without requiring a page refresh
- The sort dropdown in the Saved view no longer gets clipped by the card container
- Confirmation dialogs now appear before destructive actions to prevent accidental data loss
- YouTube API error handling improved — invalid or overly long playlist titles now show a clear message

### Changed
- The popup has been redesigned with a consolidated Quick Add workflow — adding a video now takes fewer taps
  - _Technical: Merged separate "Add" and "Quick Add" paths into a single flow in `popup/`_
- Playlist card titles in the Saved view are now consistent in length and truncation style
- The Settings page layout now wraps dynamically based on screen width instead of using a fixed grid
- All playlists (both YPH-managed and unmanaged) are now shown in a single unified Saved view with a clear managed badge
  - _Technical: `Saved.svelte` unified view replaces the separate managed/all-playlists split; unmanaged playlists show a wrench badge_
- Offline playlists and YouTube-synced playlists are now kept in sync via a hybrid storage model
  - _Technical: `storage-service` now maintains a local cache with TTL and a YouTube-side source of truth, merged on load_
- The "close tabs after adding" setting has been renamed for clarity
- The standalone editor module has been removed in favour of the unified playlist view
  - _Technical: `editor/` route and module deleted; all editing now done via `PlaylistEditor.svelte` in the SPA_
- **CSS cross-browser cleanup** — removed non-standard bare `line-clamp` property and webkit-only pseudo-elements (`::-webkit-scrollbar`, `::-webkit-outer-spin-button:hover`) that caused Firefox console warnings; replaced with standard `scrollbar-color` / `scrollbar-width` properties

---

## [2.12.5] - 2026-06-06

### Added
- **Firefox for Android (Fenix) support** — the extension now runs on Fenix 121+ without modification
  - Added `gecko_android` key to the Firefox manifest to opt-in to Fenix compatibility
  - OAuth sign-in falls back to a tabs-based flow on Android (opens a Google sign-in tab, monitors redirect, extracts token) since `browser.identity.launchWebAuthFlow` is unavailable on Fenix
  - All `browser.contextMenus` calls are guarded with an `isAndroid()` check — right-click menus are silently skipped on Android where the API does not exist
  - `browser.notifications.create()` omits the `iconUrl` field on Android (unsupported by Fenix)
  - Removed unused `bookmarks` permission from the Firefox manifest (was never called in code; blocked Fenix installation)

### Added
- **Permanent installation support** (no developer-mode badge)
  - Chrome: enterprise policy file at `/etc/opt/chrome/policies/managed/yt-playlist-helper.json` force-installs the CRX on restart
  - Firefox / Firefox for Android: signed unlisted XPI via `web-ext sign --channel=unlisted`; installable from AMO or by drag-and-drop

### Changed
- `apps/browser-extension/manifest.firefox.json` version bumped to `2.12.5` for AMO submission

---

## [2.12.2] - 2023-11-22

### Fixed
- Converting a playlist to a queue no longer fails intermittently

---

## [2.12.1] - 2023-09-02

### Added
- Dark mode support for the popup

---

## [2.12.0] - 2023-09-02

### Added
- Full dark mode support across the extension UI
- Option to disable context menus from the settings page
- Redesigned options and settings page

### Changed
- Notification design updated across the editor and settings pages

### Removed
- Recent playlists panel removed (superseded by the Saved playlists view)

---

## [2.11.2] - 2023-08-19

### Added
- Upgraded to Svelte 4 for improved performance and future compatibility

### Changed
- Page size options and bookmark folder name handling improved

---

## [2.11.0] - 2023-08-06

### Added
- Sort and filter playlists in the Saved view
- Search playlists in the Saved view

---

## [2.10.0] - 2023-07-30

### Added
- Right-click context menu option to add a video directly to a saved playlist

---

## [2.9.0] - 2022-10-28

### Added
- Export, import, and delete saved playlists
- Remove duplicate videos from the playlist editor

---

## [2.7.0] - 2022-04-03

### Added
- Option to choose how a playlist is saved after creation
- Option to disable auto-opening the playlist builder after adding videos

### Fixed
- Page now reloads correctly after reversing a playlist

---

## [2.6.2] - 2022-01-02

### Fixed
- Playlist builder context menu now works correctly on Firefox

---

## [2.6.1] - 2022-01-02

### Added
- Support for YouTube queues (actions on the currently playing playlist)
- Option to open the editor after saving or creating a playlist
- Custom page size selector in the playlist editor
- Pagination support in the playlist editor

### Fixed
- Drag-and-drop reordering in the playlist editor now works reliably

---

## [2.5.2] - 2021-10-24

### Fixed
- YouTube URL pattern matching made more resilient

---

## [2.5.1] - 2021-10-23

### Fixed
- Creating playlists from bookmarks now works correctly on Firefox

---

## [2.4.1] - 2021-09-12

### Changed
- Video metadata is now fetched via noembed for better reliability

---

## [2.4.0] - 2021-08-26

### Added
- Scan the current browser tab for YouTube links and create a playlist from them
- Convert the current YouTube playlist tab into a YouTube queue

---

## [2.3.0] - 2021-07-31

### Added
- Option to choose which page the editor opens on at startup
- Option to disable thumbnail previews in the playlist editor and selector

### Fixed
- Duplicate videos no longer appear when saving a playlist from a queue
- Video data loading optimised using oEmbed to reduce API calls

---

## [2.2.0] - 2021-06-22

### Added
- Reverse playlist button in the playlist editor

### Changed
- Editor animations improved

---

## [2.1.2] - 2021-06-06

### Added
- Confirmation prompt before deleting a playlist

---

## [2.1.1] - 2021-05-23

### Fixed
- Playlist editor loading issue resolved
- Video data now loads only once per session for faster performance

---

## [2.1.0] - 2021-05-16

### Added
- Export and import videos to/from a playlist (JSON format)

---

## [2.0.0] - 2021-05-03

### Added
- Full playlist editor: create, edit, reorder, and delete videos
- Persistent playlist storage — playlists are saved across sessions

---

## [1.5.0] - 2021-03-08

### Added
- Combine all open YouTube tabs into a single playlist
- Option to automatically close tabs after a playlist is created

---

## [1.4.0] - 2021-02-19

### Changed
- Playlist tabs are now excluded by default when building playlists (option to include them still available)

---

## [1.3.0] - 2020-07-19

### Added
- Create a playlist from YouTube video thumbnails on the current page
- Automatically splits into multiple playlists when a playlist would exceed 50 videos

---

## [1.2.1] - 2020-07-04

### Fixed
- YouTube URL Regex fix for edge cases

---

## [1.2.0] - 2020-06-20

### Added
- Create a playlist from all currently open YouTube tabs

---

## [1.1.1] - 2020-05-09

### Fixed
- Settings page compatibility fix for Chrome

---

## [1.1.0] - 2020-05-08

### Added
- Settings page to customise the extension's default opening page

---

## [1.0.2] - 2020-04-23

### Changed
- Bookmark folders now list parent folders before children for clearer structure

---

## [1.0.1] - 2020-04-09

### Fixed
- Popup menu sizing improved for Firefox
