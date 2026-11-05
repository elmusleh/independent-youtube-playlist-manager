# Topic Clusters Analysis — IYPM Project

**Generated**: 2026-11-04 14:00 CET (Wednesday, Week 45)
**Methodology**: Analyzed Obsidian vault (`~/Notebooks/Projects/iypm/` + `~/Notebooks/Projects/Businesses/iypm/`) and codebase (`/home/steve/dev/independent-youtube-playlist-manager/`) for topic co-occurrence, architectural dependencies, and cross-references. Minimum 3 connections required per cluster.

---

## 📊 Executive Summary

| Metric                              | Value                                          |
| ----------------------------------- | ---------------------------------------------- |
| **Total Topics Identified**         | 20                                             |
| **Clusters Found (≥3 connections)** | 8                                              |
| **Vault Files Analyzed**            | 22 (4 daily analyses + 18 legacy)              |
| **Codebase Files Scanned**          | ~150+ TS/JS/Svelte/MD files                    |
| **Cross-Reference Density**         | High (Sync v2, Metadata, UI, Capture dominate) |

**Key Insight**: The project's knowledge graph is dominated by **Sync v2 (encrypted cross-device sync)** — the largest in-flight feature spanning protocol, relay, engine, UI, and crypto. The **Video Metadata Pipeline** and **Playlist Management** form the second-tier core. A critical structural issue: **two disconnected IYPM workspaces** in the vault (`Projects/iypm/` vs `Projects/Businesses/iypm/`) with 11 completely isolated notes.

---

## 🎯 Topic Clusters (Min 3 Connections)

### Cluster 1: **Encrypted Cross-Device Sync (Sync v2)** — _Central Hub_

**Connections**: 14 | **Status**: Active Implementation (Phases 0–3 done, 3 follow-up + 4–5 pending)

| Connected Topic                        | Connection Type        | Evidence                                                                          |
| -------------------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| Encryption/Crypto (HKDF, AES-GCM, HLC) | Core dependency        | `services/sync/keys.ts`, `record-codec.ts`, `hlc.ts`                              |
| Supabase/Cloud Sync                    | Transport backend      | `relay-transport.ts`, `sync-relay-v2.sql`, hosted Supabase `qvwitlpnetwthyhrobca` |
| Storage Architecture                   | Data source/target     | IndexedDB shadow store, `browser.storage.local` playlists/settings/history        |
| UI/Responsive Design                   | Sync Center UI         | 9 new `components/sync/*` (`SyncHero`, `SyncKeyCard`, `SyncContents`, etc.)       |
| Settings/Configuration                 | Sync content selection | `content-selector.ts` (playlists, metadata, thumbnails, history, settings)        |
| Authentication/OAuth                   | Supabase auth          | `launchWebAuthFlow`, email/password, session bridge                               |
| Testing & CI                           | E2E verification       | `docker-compose.test.yml`, Postgres+PostgREST, 9/9 E2E pass                       |
| Release/Deployment                     | Relay SQL deployment   | `docs/sync-relay-v2.sql` must run on hosted project                               |
| Background Extension Architecture      | Service worker wiring  | `yph-sync-periodic` alarm, `storage.onChanged` triggers, `runtime.onStartup`      |
| Video Metadata Pipeline                | Syncable content       | Metadata cache included in encrypted snapshots                                    |
| Watch History/Playback                 | Syncable content       | `local_yt_history` in sync payload                                                |
| Project Workflow/Process               | OpenSpec tracking      | `openspec/changes/add-encrypted-cross-device-sync/`                               |
| Firefox Android/Mobile                 | Sync target            | Phone sync = Supabase only (Firefox Android)                                      |
| Data Manager/Metadata Repair           | Syncable content       | Metadata completeness affects sync payload size                                   |

**Key Files**: `docs/SYNC_V2_STATUS.md`, `docs/SYNC_PROTOCOL.md`, `docs/ENCRYPTED_SYNC_PLAN.md`, `services/sync/*`, `components/sync/*`, `openspec/changes/add-encrypted-cross-device-sync/`

---

### Cluster 2: **Video Metadata Pipeline** — _Core Engine_

**Connections**: 9 | **Status**: Mature, Multi-tier (7 tiers), Zero-quota-first

| Connected Topic                   | Connection Type          | Evidence                                                                    |
| --------------------------------- | ------------------------ | --------------------------------------------------------------------------- |
| Storage Architecture              | IndexedDB backend        | `db-service.ts` → `yph_metadata_db_v2`, `yph:meta:<videoId>` keys           |
| Encrypted Cross-Device Sync       | Syncable content         | Metadata cache exported in full backup, synced via encrypted snapshots      |
| Playlist Management               | Enrichment target        | Playlist videos need titles/channels/durations for UI                       |
| Background Extension Architecture | Content script injectors | `getVideoMetadata.js`, `scrapeYouTubeLinks.js`, `watch-tracker.js`          |
| Settings/Configuration            | Strategy toggle          | `metadataExecutionStrategy: "free_first" \| "api_first"`, engine toggles    |
| Data Manager/Metadata Repair      | Repair UI                | `#/metadata` view: Re-scan, Refresh Missing, Remove Incomplete, Clear Cache |
| Testing & CI                      | Regression suites        | Metadata fallback, video metadata regression, thumbnail archive tests       |
| Supabase/Cloud Sync               | Global catalog           | `videos_catalog` cross-user deduplicated cache in PostgreSQL                |
| Firefox Android/Mobile            | Scraping target          | Mobile YouTube DOM differs; title/channel selectors fixed                   |

**Key Files**: `services/video-service.ts`, `services/youtube-api.ts`, `services/db-service.ts`, `services/schema-normalizer.ts`, `services/metadata-engines.test.ts`, `content-scripts/injectors/*`, `views/MetadataManager.svelte`

---

### Cluster 3: **Playlist Management** — _User-Facing Core_

**Connections**: 8 | **Status**: Feature-rich (CRUD, merge, split, search, favorites, pinned)

| Connected Topic             | Connection Type       | Evidence                                                                                |
| --------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| Video Metadata Pipeline     | Enrichment dependency | Videos need metadata for display/sorting                                                |
| Storage Architecture        | Primary data model    | `playlists` / `yph_local_playlists` in `browser.storage.local`                          |
| Encrypted Cross-Device Sync | Syncable collection   | Playlists adapter (`adapters/playlists.ts`), 3-way merge, tombstones                    |
| UI/Responsive Design        | Editor/Manager views  | `PlaylistEditor.svelte` (1930 lines), `Manage.svelte` (2137 lines) — **need splitting** |
| Settings/Configuration      | Favorites/pinned      | `favoritePlaylistIds`, `watchLaterPlaylistId`, `maxVisibleFavorites`                    |
| Context Menu/Capture Flow   | Capture destination   | Quick-add → playlist builder → save to playlist                                         |
| Toolbar Popup               | Quick-add entry       | Popup scopes → playlist builder → destinations                                          |
| Watch History/Playback      | Resume target         | Watch history resumes into playlist videos                                              |

**Key Files**: `views/PlaylistEditor.svelte`, `views/Manage.svelte`, `views/Saved.svelte`, `views/Pinned.svelte`, `components/PlaylistCard.svelte`, `services/playlist-actions.ts`, `services/favorites.ts`, `services/storage-service.ts`

---

### Cluster 4: **UI / Responsive Design System** — _Cross-Cutting Concern_

**Connections**: 7 | **Status**: Design tokens consolidated, Phase 4 verification in progress

| Connected Topic             | Connection Type               | Evidence                                                                   |
| --------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| Playlist Management         | View implementations          | Editor, Manager, Saved, Pinned, History, Search, Settings views            |
| Encrypted Cross-Device Sync | Sync Center UI                | 9 `components/sync/*` split from `Sync.svelte` (358 lines)                 |
| Toolbar Popup               | Mobile sizing/instant-open    | `popup/mode.js` (`ui-popup`/`ui-page`), 420px desktop, full-screen Fenix   |
| Firefox Android/Mobile      | Touch targets, breakpoints    | `--touch-target-min: 44px`, breakpoints 320/360/390/430/768/1024/1440      |
| Modal/Dialog System         | Shared `Modal.svelte`         | Backdrop dismissal, focus restoration, drawer sizing (320px)               |
| Settings/Configuration      | Theme, density, sync contents | `Settings.svelte`, `ThemePicker.svelte`, `SyncContents.svelte`             |
| Testing & CI                | Visual regression             | 96 route/viewport checks, 6 viewports, Playwright trace, screenshot naming |

**Key Files**: `src/css/design-tokens.css`, `src/css/view-layout.css`, `src/css/settings.css`, `src/css/responsive.css`, `components/common/ViewLayout.svelte`, `components/Modal.svelte`, `docs/RESPONSIVE_UI_PLAN.md`, `docs/POPUP_MOBILE_PLAN.md`

---

### Cluster 5: **Context Menu / Capture Flow** — _Extension Entry Point_

**Connections**: 6 | **Status**: Automated gates pass; native/device acceptance pending

| Connected Topic                   | Connection Type           | Evidence                                                                                   |
| --------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| Playlist Management               | Capture destination       | 7 tab scopes → playlist builder / local playlists / YouTube playlists                      |
| Toolbar Popup                     | Shared quick-add logic    | `popup/quick-add.js` scopes, destinations, insertion rules                                 |
| Background Extension Architecture | Service worker authority  | `library-mutations.js` serialized writer, `capture-controller.js`, `capture-jobs.js`       |
| Storage Architecture              | Atomic revisions          | `playlists` revision guards, `yph:saved`/`yph:scopes`/`yph:link` reconciliation            |
| UI/Responsive Design              | Chooser/dialog components | `Capture.svelte`, `ChooseDestination.svelte`, `CaptureOptions.svelte`                      |
| Testing & CI                      | Mutation safety           | 4/4 mutations caught (private-tab exclusion, URL scheme, atomic revision, durable storage) |

**Key Files**: `background/library-mutations.js`, `background/capture-controller.js`, `background/capture-jobs.js`, `shared/tab-selection.js`, `shared/quick-add.js`, `views/Capture.svelte`, `docs/CONTEXT_MENU_PLAN.md`, `openspec/changes/complete-context-menu-acceptance/`

---

### Cluster 6: **Watch History / Playback Resume** — _Mobile-Critical_

**Connections**: 5 | **Status**: Fixed on `m.youtube.com` (Fenix), hardening ongoing

| Connected Topic                   | Connection Type          | Evidence                                                               |
| --------------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| Firefox Android/Mobile            | Primary platform         | `m.youtube.com` redirect, Gecko DOM, Shorts, SPA navigation            |
| Background Extension Architecture | Content script tracker   | `watch-tracker.js` periodic save, MutationObserver, video-id poller    |
| Storage Architecture              | Local history store      | `local_yt_history` in `browser.storage.local`, per-video timestamps    |
| Encrypted Cross-Device Sync       | Syncable collection      | History adapter (`adapters/history.ts`), per-video LWW with tombstones |
| Video Metadata Pipeline           | Title/channel enrichment | Mobile DOM selectors (`.ytVideoMetadataViewModelSubtitleContainer`)    |

**Key Files**: `content-scripts/watch-tracker.js`, `manifest.chrome.json`/`manifest.firefox.json` (matches `*.youtube.com/watch*`), `views/History.svelte`, `docs/testing/HERMES_CONTEXT_MENU_VERIFICATION.md` (Firefox Android acceptance)

---

### Cluster 7: **Storage Architecture** — _Foundation Layer_

**Connections**: 9 | **Status**: Dual-layer (IndexedDB + browser.storage.local), normalized

| Connected Topic             | Connection Type           | Evidence                                                                |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| Video Metadata Pipeline     | IndexedDB metadata        | `yph_metadata_db_v2`, `db-service.ts`, atomic batch transactions        |
| Playlist Management         | `browser.storage.local`   | `playlists`, `yph_local_playlists`, `yph_settings`, `local_yt_history`  |
| Encrypted Cross-Device Sync | Shadow store + sync state | `shadow-store.ts` (base-copy hash), `yph_sync_state`, `yph_sync_status` |
| Backup/Export               | Full DB backup            | `backup-service.ts` export/import (schema v2), JSON/CSV/M3U             |
| Settings/Configuration      | Settings persistence      | `yph_settings` with migration (`migrateSettings`), `DEFAULT_SETTINGS`   |
| Context Menu/Capture Flow   | Saved destinations        | `yph:saved`, `yph:scopes`, `yph:link`, `yph:destination` reconciliation |
| UI/Responsive Design        | Theme persistence         | `themeChoice` synced, retry on startup read                             |
| Testing & CI                | Test fixtures             | Extension fixtures, offline verification, isolated Chromium             |
| Supabase/Cloud Sync         | Session bridge            | Supabase OAuth session → `browser.storage.local`                        |

**Key Files**: `services/db-service.ts`, `services/storage-service.ts` (1230 lines — **needs splitting**), `services/backup-service.ts`, `services/schema-normalizer.ts`, `services/sync/shadow-store.ts`, `services/sync/status-store.ts`

---

### Cluster 8: **Project Workflow / Process & Tooling** — _Meta-Layer_

**Connections**: 7 | **Status**: AGENTS.md-governed, OpenSpec-tracked, worktree-coordinated

| Connected Topic                   | Connection Type        | Evidence                                                                                                               |
| --------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Encrypted Cross-Device Sync       | OpenSpec change        | `openspec/changes/add-encrypted-cross-device-sync/` (proposal, specs, design, tasks)                                   |
| Context Menu/Capture Flow         | OpenSpec change        | `openspec/changes/complete-context-menu-acceptance/`                                                                   |
| Testing & CI                      | Verification gates     | `npm run check` (lint, format, test, contracts, file-size, css-bundle, vercel-config, tooling-versions, release-notes) |
| Release/Deployment                | Branch workflow        | `next` integrates, `main` releases; squash merge; tag triggers release workflow                                        |
| Dependency Management             | Toolchain upgrades     | Next.js 15→16, React 19, Rollup 4, Svelte-check 4.7, minimatch 11.0.4                                                  |
| Background Extension Architecture | Agent lock / worktrees | `agent-lock.js`, `AGENT_WORKFLOW.md`, worktree isolation                                                               |
| Settings/Configuration            | AGENTS.md rules        | 350-line limit, CSS @import ban, manifest rules, branch discipline                                                     |

**Key Files**: `AGENTS.md`, `.ai-sync/HANDOFF.md`, `.ai-sync/PLAN.md`, `.ai-sync/PROGRESS.md`, `.ai-sync/AGENT_WORKFLOW.md`, `openspec/config.yaml`, `docs/AI_ORCHESTRATION.md`, `packages/build-tools/agent-lock.js`

---

## 🔗 Cross-Cluster Connection Matrix

|                   | Sync v2 | Metadata | Playlists | UI/Responsive | Capture | Watch History | Storage | Workflow |
| ----------------- | ------- | -------- | --------- | ------------- | ------- | ------------- | ------- | -------- |
| **Sync v2**       | —       | ✅       | ✅        | ✅            | —       | ✅            | ✅      | ✅       |
| **Metadata**      | ✅      | —        | ✅        | —             | —       | —             | ✅      | —        |
| **Playlists**     | ✅      | ✅       | —         | ✅            | ✅      | ✅            | ✅      | —        |
| **UI/Responsive** | ✅      | —        | ✅        | —             | ✅      | —             | ✅      | —        |
| **Capture**       | —       | —        | ✅        | ✅            | —       | —             | ✅      | —        |
| **Watch History** | ✅      | —        | ✅        | —             | —       | —             | ✅      | —        |
| **Storage**       | ✅      | ✅       | ✅        | ✅            | ✅      | ✅            | —       | ✅       |
| **Workflow**      | ✅      | —        | —         | —             | ✅      | —             | ✅      | —        |

**Legend**: ✅ = ≥3 direct connections (code imports, shared data, architectural dependency, or documented linkage)

---

## 📍 Orphaned / Isolated Topics (Vault-Only)

Per `orphans-2026-11-02.md`, **11 completely isolated notes** (no incoming/outgoing links):

| File                                              | Workspace               | Topic                           | Why It Matters                                                     |
| ------------------------------------------------- | ----------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `AUTO_HANDLING.md`                                | `Businesses/iypm/`      | Background sync automation spec | Complete feature spec for quota shield, conflict resolution        |
| `DETAILED-DIFFS.md`                               | `Businesses/iypm/`      | UI refactoring diff             | Design tokens, 8 components, animations, dark mode, reduced-motion |
| `TODO.md`                                         | `Businesses/iypm/`      | Quota exhaustion analysis       | 4-tier fix plan (manual → code fix → better UX → chunked sync)     |
| `metadata-architecture.md`                        | `Businesses/iypm/docs/` | Metadata storage arch           | Referenced by codebase but not linked in vault                     |
| `YouTube API - Testing to Production.md`          | `Businesses/iypm/docs/` | API migration guide             | Technical guide for API migration                                  |
| `phase4-verification-checklist.md`                | `Businesses/iypm/`      | Phase 4 responsive UI           | Referenced by 3 weekly reviews as plain text (no wikilinks)        |
| `weekly-review-2026-W44.md`                       | `Businesses/iypm/`      | Weekly review                   | References checklist but no incoming links                         |
| `productivity-2026-W44.md`                        | `Businesses/iypm/`      | Productivity report             | References checklist but no incoming links                         |
| `workflow-analysis-2026-W43.md`                   | `Businesses/iypm/`      | Previous workflow analysis      | References HANDOFF/PROGRESS but no incoming links                  |
| `daily-analysis-2026-11-01.md`                    | `Projects/iypm/`        | First analysis file             | References repo docs via absolute paths, no internal links         |
| `Implementing Offline-First Sync Architecture.md` | `Businesses/iypm/`      | Deep architecture               | 10 external Gemini/Git references, no vault links                  |

**Critical Structural Issue**: Two IYPM workspaces exist:

- `Projects/iypm/` — New workspace (4 daily analyses)
- `Projects/Businesses/iypm/` — Legacy workspace (18 files, 11 isolated)

**Recommendation**: Unify into single workspace; convert external `file://` refs to vault links; create `Projects/iypm/INDEX.md` as canonical entry point.

---

## 🎯 Actionable Recommendations

### Immediate (This Week)

1. **Run `npm run format`** → fixes 5 files with Prettier drift (blocks `npm run check`)
2. **Add fetch mock for `fake.supabase.test`** in `vitest.setup.mjs` → unblocks 10 failing relay E2E tests
3. **Push `feat/sync-hardening` to origin** and open PR against `next` (73 commits local-only)
4. **Create `Projects/iypm/INDEX.md`** linking all daily analyses, orphans report, and key repo docs

### Short-term (Next 1–2 Sessions)

5. **Run relay v2 SQL** on hosted Supabase (`qvwitlpnetwthyhrobca`) — `docs/sync-relay-v2.sql`
6. **Complete Phase 3 follow-up**: wire `storage.onChanged` triggers for history/settings/devices adapters
7. **Split oversized files** per AGENTS.md: `Sync.svelte` (358), `merge/playlists.ts` (344), `sync-engine.ts` (320), `shadow-store.ts` (313), `storage-service.ts` (1230), `youtube-api.ts` (1770), `Manage.svelte` (2137), `PlaylistEditor.svelte` (1930)
8. **Unify IYPM vault workspaces** — migrate `Projects/Businesses/iypm/` content to `Projects/iypm/` with proper wikilinks

### Medium-term

9. **Phase 4 completion**: Finish Sync Center UI split (remaining components, routing)
10. **Phase 5**: QR pairing, Realtime nudge, key rotation
11. **Context-menu acceptance**: Complete native/device evidence (OpenSpec 3.2–3.5)
12. **Release decision**: Version bump, tag, store submissions (Edge draft still holds 1.1.1)

---

## 📈 Topic Evolution Timeline (Last 7 Days)

| Date       | Dominant Topics                                         | Key Events                                                               |
| ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| 2026-10-31 | Context Menu, UI/Responsive, Workflow                   | Hermes verification, orchestration pilot PR #52, popup mobile fix        |
| 2026-11-01 | Metadata, Playlists, Encrypted Sync, Watch History      | PR #63/#71 merged, encrypted sync formalized, Data Manager repair queue  |
| 2026-11-02 | Watch History (Mobile), Popup, Pinned Favorites         | PR #83/#84 merged (Fenix), PR #81 open (pin button), m.youtube.com fixed |
| 2026-11-03 | **Sync v2** (Phases 0–3), Dependency Modernization      | `feat/sync-hardening` branch, Next.js 16, React 19, Rollup 4             |
| 2026-11-04 | **Sync v2** (Phases 2–3 implementation), Edge Packaging | Relay v2 SQL + transport, fake relay, background engine, stale ZIP trap  |

**Trend**: Sync v2 has absorbed >60% of implementation bandwidth since 2026-11-01. Metadata/Playlists stabilized. Mobile/Fenix fixes completed. Workflow/tooling matured (agent lock, worktrees, OpenSpec).

---

## 🗂️ Output Location

`~/Notebooks/Projects/iypm/topic-clusters-2026-W45.md`

_Next scheduled run: Friday weekly review. Run `/workflow cluster:topics --project iypm --min-connections 3` again after addressing blockers to track cluster evolution._
