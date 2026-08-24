# AGENTS.md — AI Agent Guidance & Architecture Specification

> **Notice:** This repository is maintained primarily by AI agents. All agents working on this codebase MUST read and adhere to the architectural guidelines, storage rules, and build validation procedures outlined below.

---

## 🏛️ Architecture Overview

The codebase is split into two primary layers:

1. **`apps/browser-extension/playlist-manager/` (Frontend SPA Extension UI)**
   - Built with **Svelte 4 / 5 + TypeScript + Rollup**.
   - Compiles into `apps/browser-extension/editor/` (`main.js`, `bundle.css`, `index.html`).
   - Location of all UI views (`App.svelte`, `PlaylistEditor.svelte`, `Saved.svelte`, `Settings.svelte`, `History.svelte`, `Search.svelte`) and data services (`video-service.ts`, `youtube-api.ts`, `storage-service.ts`, `sync-service.ts`).

2. **`apps/web-portal/` (Official SaaS Portal & Interactive Dashboard)**
   - Built with **Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Lucide icons**.
   - High-converting marketing landing page, interactive extension simulator, and authenticated Supabase-ready cross-device dashboard.
   - Run `npm run web` (dev server on `localhost:3000`) or `npm run web:build` (production bundle).

3. **`apps/browser-extension/` (Extension Shell)**
   - Plain JavaScript WebExtension shell (MV3).
   - `background/index.js` — Module entry point that imports `background/background.js` (service worker for Chrome, background scripts for Firefox).
   - `content-scripts/` — Content script injectables (`watch-tracker.js`, and injectors for `getVideoMetadata.js`, `scrapeYouTubeLinks.js`, `getChannelVideoIds.js`, `getPlaylistVideoIds.js`).
   - `popup/` — Quick-add popup toolbar interface.
   - Manifest templates: `manifest.chrome.json` and `manifest.firefox.json`.

---

## ⚙️ Manifest V3 & Browser Differences

The project target platforms are **Google Chrome**, **Mozilla Firefox Desktop (140.0+)**, and **Firefox for Android / Fenix (142.0+)**.

### Critical Manifest Rules:
- **Chrome (`manifest.chrome.json`):** Uses `"service_worker": "background/index.js"`. Requires public `"key"` field to lock extension ID `lppdplclfhchgkgckfmkopomahlpfjok`.
- **Firefox (`manifest.firefox.json`):** Uses `"background": {"scripts": ["background/index.js"], "type": "module"}`. Must **NOT** contain a `"key"` field. Uses Gecko extension ID `independent-yt-playlist-manager@elmusleh.github.io`.
- **Never put `apps/browser-extension/manifest.json` in `apps/browser-extension/`!** Build scripts validate that only `manifest.chrome.json` and `manifest.firefox.json` exist in `apps/browser-extension/`. `npm run build` generates `dist/chrome/manifest.json` and `dist/firefox/manifest.json`.

---

## 💾 Storage, Normalization & Backup Architecture

### 1. Per-Video Metadata Storage & Transactional CRUD (`IndexedDB`)
- **Database & Store:** Dedicated database `yph_metadata_db_v2` with object store `metadata` managed natively via `apps/browser-extension/playlist-manager/src/services/db-service.ts` (zero external library conflicts, atomic batch transactions, memory fallback).
- **Key Pattern:** `yph:meta:<videoId>` managed via `db-service.ts` with exponential backoff retry.
- **Strict Normalization:** All metadata and playlist writes are sanitized and enforced through `apps/browser-extension/playlist-manager/src/services/schema-normalizer.ts` (`normalizeVideoMeta`, `normalizePlaylist`, `normalizeHistoryRecord`).
- **Rule for AI Agents:** NEVER store large arrays of video metadata in `browser.storage.local`. High-frequency video metadata MUST be queried and written via `db-service.ts` to utilize the multi-gigabyte `unlimitedStorage` IndexedDB capacity without item quota limits.

### 2. Playlist & App State (`browser.storage.local`)
- **Key Keys:**
  - `playlists` / `yph_local_playlists`: Array of local and saved playlist objects.
  - `local_yt_history`: Watch history timestamp records per video ID.
  - `yph_settings`: Global settings object (`autoFetchMetadata`, `metadataExecutionStrategy`, etc.).
  - `yph_sync_state`: Partial sync resume states across daily API quota limits.

### 3. Full Database Backup & Portability Pipeline (`backup-service.ts`)
- **Export (`exportFullDatabaseBackup`):** Generates portable JSON backup (`schemaVersion: 2`) capturing all playlists, complete IndexedDB video metadata cache, watch history, and settings.
- **Import (`importFullDatabaseBackup`):** Validates schema, resolves duplicates, and supports both non-destructive `merge` and clean `overwrite` restore modes.

### 4. Supabase Cloud Sync & Global Catalog Architecture (`supabase-client.ts`, `supabase-sync.ts`)
- **Authentication:** Supabase OAuth (`launchWebAuthFlow`) and Email/Password with session storage bridge to `browser.storage.local`.
- **Bidirectional Delta-Sync:** Background sync manager executing Last-Write-Wins (LWW) resolution and soft-delete tombstoning (`deleted_at`).
- **Global Video Catalog (`videos_catalog`):** Cross-user deduplicated metadata cache in PostgreSQL that resolves metadata before querying YouTube API quotas.
- **Alarm Housekeeping:** `supabase-cloud-sync` periodic background sync.

---

## 🔄 Video Metadata Fetching & Scraping Pipeline

Metadata fetching occurs in `apps/browser-extension/playlist-manager/src/services/video-service.ts` and `youtube-api.ts` configured via User Settings (`metadataExecutionStrategy: "free_first" | "api_first"`):

### Default Execution Order (Free / Zero-Quota First):
1. **IndexedDB Local Cache Hit:** Read `yph:meta:<videoId>` (24h valid TTL, 5min negative TTL).
2. **Tier 1 — Multi-Client Innertube Engine (Zero Quota):** Queries `https://www.youtube.com/youtubei/v1/player` using modern `MWEB` (`clientVersion: "2.20240801.01.00"`), `WEB`, and `TVHTML5_SIMPLY_EMBEDDED_PLAYER` client profiles (bypasses bot verification and PO tokens).
3. **Tier 2 — Embed Page Headless Scraper (Zero Quota):** Extracts `ytInitialPlayerResponse` JSON directly from `https://www.youtube.com/embed/{id}` HTML.
4. **Tier 3 — Official YouTube oEmbed (Zero Quota):** Queries `https://www.youtube.com/oembed?url=...` guaranteeing video title and channel name.
5. **Tier 4 — YouTube Data API v3 (Uses Quota):** Batch queries (`/videos?id=...`) when user is signed in with OAuth or has configured a custom API key (1 quota unit per 50 videos).
6. **Tier 5 — Dynamic Piped & Invidious Fallback:** Fallback across active Piped instances (`pipedapi.kavin.rocks`, `api.piped.private.coffee`), Invidious instances (`inv.nadeko.net`, `yewtu.be`), and user-configured custom URLs.
7. **Open Tab Scraping:** Direct metadata extraction from open tabs via `apps/browser-extension/content-packages/build-tools/injectors/getVideoMetadata.js`.

### Scraping Settings Keys (`browser.storage.sync` / `Settings`):
- `metadataExecutionStrategy`: `"free_first"` (default) or `"api_first"`.
- `enableInnertubeScraping`, `enableEmbedScraping`, `enableOEmbedScraping`, `enableInvidiousPiped`: Individual boolean engine toggles.
- `customInvidiousInstances`, `customPipedInstances`: Custom self-hosted instance URLs.

---

## 🛠️ Build & Validation Commands

All commands must be executed from the **repository root**:

```bash
# 1. Type-check Svelte SPA
cd apps/browser-extension/playlist-manager && npx svelte-check && cd ..

# 2. Complete production build (Compiles SPA -> apps/browser-extension/editor/, copies to dist/chrome/ and dist/firefox/, patches innerHTML, validates manifests)
npm run build

# 3. Web SaaS Portal & Dashboard Build
npm run web:build

# 4. Development watch mode
npm run watch
```

---

## 🚨 Guidelines & Rules for AI Agents

1. **Run Verification Commands:** Always run `npm run build` and `cd apps/browser-extension/playlist-manager && npx svelte-check` after making code modifications to ensure no compilation or manifest validation errors.
2. **Preserve Compatibility:** Maintain Android (Fenix) compatibility guard checks (`isAndroid()` user-agent detection) before using desktop-only extension APIs (`contextMenus`, `identity.launchWebAuthFlow`).
3. **Keep Manifests Clean:** Never add `apps/browser-extension/manifest.json`. Only edit `apps/browser-extension/manifest.chrome.json` and `apps/browser-extension/manifest.firefox.json`.
4. **Debounced Saves:** Ensure UI edits to playlists trigger the debounced autosave in `storage-service.ts`.