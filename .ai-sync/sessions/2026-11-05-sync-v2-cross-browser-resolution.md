# Session Record — Sync v2 Cross-Browser Diagnosis, Hardening & Verification (Firefox MV3 ↔ Chrome MV3)

- **Date:** 2026-11-05
- **Branch:** `next`
- **Commits:** `cfdef5e`, `156f7c5`, `1405024`, `1601fec`
- **Hosted Relay Verified:** `independent-youtube-playlist-manager` (`https://pfydngsbcmuhsqqjbcte.supabase.co`)
- **Outcome:** Owner-confirmed end-to-end sync working across Firefox MV3 (25 existing playlists / 2,523 videos + watch history + pinned settings) and Chrome MV3.

---

## 1. Executive Summary of Findings

Sync v2 had strong cryptographic and SQL primitives (`HKDF-SHA256`, `AES-256-GCM` with `collection|rid` AAD binding, HLC ordering, and `SECURITY DEFINER` RPCs on `pfydngsbcmuhsqqjbcte.supabase.co`), but failed in real multi-browser usage due to **nine compounding runtime, WebExtension-platform, and data-shape bugs** spanning Firefox SpiderMonkey, MV3 permission gestures, stale storage migrations, IndexedDB shadow binding, and schema mismatches between the background worker and foreground UI.

---

## 2. Forensic Root Causes & Resolutions

### RC-1: SpiderMonkey Strict-Mode Crash on `globalThis.window = ...` (`1601fec`)

- **Symptom:** Firefox `#/sync` stayed stuck on `Last full sync: Never (ready for first sync)` (`Will sync: Playlists (25) · History (1)`), `yph_sync_shadow_v1` had `0` rows, `yph_sync_status` remained `phase: "idle", lastRunAt: null`, and clicking **Sync now** silently exited without uploading anything.
- **Evidence:**
  - Chrome MV3 runs `background/index.js` inside a `ServiceWorkerGlobalScope` where `window` does not natively exist; `background/init.js` (`if (typeof globalThis.window === "undefined")`) defines a writable property.
  - Firefox MV3 runs `"background": { "scripts": ["background/index.js"], "type": "module" }` inside a hidden `Window` (`_generated_background_page.html`), where `window` is a **non-writable getter-only accessor property** (`get: window, set: undefined`).
  - `sync-engine-registration.ts:28` unconditionally executed `(globalThis as any).window = (globalThis as any).window || globalThis` in ES-module strict mode, throwing **`TypeError: setting getter-only property "window"`** before registering `runtime.onMessage`, `storage.onChanged`, or `alarms.onAlarm`.
  - When `Sync.svelte`'s `triggerSyncNow()` received `undefined` from `runtime.sendMessage({ cmd: "sync-now" })` and dynamically imported `../services/sync-engine.js` inside `/editor/index.html` (also a Firefox `Window`), it hit the **exact same `TypeError`**, and `syncNow()` lacked a `catch` block.
- **Fix:** Guarded `if (typeof (globalThis as any).window === "undefined")` in `sync-engine-registration.ts`, attached `syncEngine` to `const host = (globalThis as any).window || globalThis`, skipped background listener registration inside `/editor/index.html` and `/popup/popup.html`, and added `catch (err)` error surfacing in `Sync.svelte` `syncNow()`.

### RC-2: Firefox MV3 `browser.permissions.request()` User-Gesture Expiry (`156f7c5`)

- **Symptom:** Chrome prompted to allow `pfydngsbcmuhsqqjbcte.supabase.co`, whereas Firefox immediately failed with `"Allow secure access to the IYPM sync relay before syncing."` without showing any permission dialog.
- **Evidence:** `requestSyncHostPermission()` in `host-permissions.ts` awaited `permissions.contains(...)` before calling `permissions.request(...)`. In Firefox WebExtensions, any `await` before `browser.permissions.request()` expires the transient user-input activation and rejects without prompting.
- **Fix:** Invoked `permissions.request({ origins })` **synchronously on line 1** of the click/toggle handler before any `await`, added passive `checkSyncHostPermission()` state badges, and added a 1-click **"Allow relay access"** button in `SyncHero.svelte` and `RelayCard.svelte`.

### RC-3: Firefox MV3 `runtime.onMessage` Native `Promise` Contract (`1405024`)

- **Symptom:** `sendResponse(...)` + `return true` inside `sync-engine-registration.ts` is the Chrome callback convention, whereas Firefox's native `browser.runtime.onMessage` expects listeners to return a `Promise` directly for async responses.
- **Fix:** Checked `typeof browserObj?.runtime?.getBrowserInfo === "function"` in `sync-engine-registration.ts` and returned native `Promise`s directly in Firefox MV3, with an in-page `runOnce()` fallback in `Sync.svelte`.

### RC-4: Stale Foreign `relayUrl` Persisted in `yph_sync_config` (`cfdef5e`, `1405024`)

- **Symptom:** Earlier sessions had written `relayUrl: "https://qvwitlpnetwthyhrobca.supabase.co"` (`mawqiei.net`, a separate non-IYPM Supabase project) into `yph_sync_config` and browser manifests, routing Firefox pushes to the wrong project while Chrome talked to `pfydngsbcmuhsqqjbcte.supabase.co`.
- **Fix:** Removed `qvwitlpnetwthyhrobca.supabase.co` from both `manifest.chrome.json` and `manifest.firefox.json`, and updated `migrateSyncConfig` in `sync-config.ts` to strip any persisted `*.supabase.co` `relayUrl`/`relayAnonKey` override not matching `RELAY_SUPABASE_URL` (while keeping `https://relay.test` working for unit tests).

### RC-5: Unbound IndexedDB Shadow Store (`yph_sync_shadow_v1`) (`cfdef5e`)

- **Symptom:** Switching Sync Keys or relay endpoints left old `baseHash` records in IndexedDB `yph_sync_shadow_v1`, causing `isDirty()` to return `false` and skip initial uploads to a fresh cloud space.
- **Fix:** Added `sync-state-reset.ts` (`ensureShadowBinding(space, relayUrl)`, `resetSyncConfigCursors`, `clearLocalSyncRuntimeState`) to bind shadows to `${space}|${relayUrl}` and automatically clear shadows + cursors whenever the key or endpoint changes, while filtering `__meta__` rows out of `getShadowCounts()`.

### RC-6: `string[]` Playlist Video Array Corruption in 3-Way Merge (`cfdef5e`)

- **Symptom:** Production playlists store `videos` as `string[]` (11-character YouTube video IDs, e.g. `["dQw4w9WgXcQ"]`), whereas `merge/playlists.ts` originally assumed `VideoEntry[]` objects and ran `{ ...l }`, turning strings into `{ "0": "d", "1": "Q", ... }`.
- **Fix:** Extracted `merge/playlist-videos.ts` to natively 3-way merge `string[]` video ID arrays while preserving order, handling ISO `updatedAt` timestamps, honouring `"merge" | "lww"` conflict strategies, and preserving unknown future playlist fields (`{ ...local, ...(remoteIsNewer ? remote : {}) }`).

### RC-7: Background Worker Settings Blindness & Broken 3-Way Settings Tie-Break (`cfdef5e`, `1601fec`)

- **Symptom:** Background service workers lack `window.getSettings` and `window.storeObject`, so settings never synced in background runs; additionally, `mergeSingleSetting` returned `local` even when `local === base` and `remote !== base`.
- **Fix:** Created `adapter-storage-io.ts` to read/write syncable settings directly via `storage.local` + `storage.sync` filtered by `SYNCABLE_SETTING_KEYS` (including `favoritePlaylistIds` and `watchLaterPlaylistId`), fixed `mergeSingleSetting` 3-way semantics + additive `favoritePlaylistIds` union, and hardened `mutateLibrary` to strip proxies and throw on `{ ok: false, error }`.

### RC-8: `local_yt_history` `.videoId` & `lastWatchedAt` Normalization (`cfdef5e`, `1601fec`)

- **Symptom:** `background/history.js` stores `local_yt_history` as `{ [videoId]: { title, channel, timestamp, duration, isCompleted, lastWatchedAt } }` without an inner `.videoId` property, causing `collectDirtyHistory` and `applyRemoteHistory` to reject records; legacy/imported items using `watchedAt` also failed `Number.isFinite(data?.lastWatchedAt)`.
- **Fix:** Injected `.videoId` in `adapter-storage-io.ts` and normalized both `.videoId` and `.lastWatchedAt` in `adapters/history.ts`.

### RC-9: Stuck `Math.min` Collection Cursors & Unclosed `IDBDatabase` Handles (`cfdef5e`, `1601fec`)

- **Symptom:** Taking `Math.min` across `lastSeqByCollection` pinned `sinceSeq` to `0` forever whenever an unchanged collection (such as `devices`) had no new rows in a pull; meanwhile `openDb()` in `shadow-store.ts` opened ~245 unclosed `IDBDatabase` connections during a 25-playlist sync.
- **Fix:** Advanced `lastSeqByCollection` across all enabled collections after a clean pull, skipped storage writes when `r.version <= shadow.remoteVersion`, and cached a single shared `IDBDatabase` connection per `indexedDB` factory in `shadow-store.ts`.

---

## 3. UX, BYO Supabase & Zero-Data-Loss Enhancements Shipped

1. **Unified Pre/Post-Sync Summary (`SyncCounters.svelte`) & Sync Status Report Modal (`SyncReportModal.svelte`, `sync-report.ts`):**
   - Renders `Last full sync` + connected device count + `Will sync: Playlists (N) · History (N) · Settings & Pinned` consistently across Firefox and Chrome even before the first sync, locks `Syncing…` throughout manual syncs, and opens a detailed report dialog on completion.
2. **Per-Backend `Test connection` & Self-Hosted Supabase Guidance (`RelayCard.svelte`, `SupabaseCard.svelte`, `sync-diagnostics.ts`):**
   - Moved `Test connection` out of `SyncKeyCard.svelte` into `RelayCard.svelte` (`IYPM hosted`) and `SupabaseCard.svelte` (`Your own Supabase project`), displaying latency, `space #xxxxxxxx`, encrypted record counts per collection, and automatic `404`/`PGRST202` detection pointing to `docs/sync-relay-v2.sql`.
3. **Key Verification Badge (`SyncKeyCard.svelte`):**
   - Displays the deterministic 4-emoji + 4-word `generateKeyFingerprint` check so users can verify identical Sync Keys across browsers at a glance.
4. **Zero-Data-Loss Protections (`sync-safety-backup.ts`, `SyncSafetyCard.svelte`, `adapters/playlists.ts`, `sync-engine-adapters.ts`):**
   - Automatic rolling local restore points (`yph_sync_safety_backups`, up to 3 snapshots) captured before full syncs or remote playlist merges, plus manual snapshot creation, JSON download, and 1-click local restore.
   - Anti-mass-wipe guard refusing automatic deletion if remote tombstones would wipe `>= 3` local playlists down to `0` without explicit opt-in.
   - Forward-compatible deferral (`cursorBlocked = true`) for unknown future collections or `v > RECORD_VERSION` envelopes so older extension builds never corrupt or skip newer cloud data.

---

## 4. Verification Receipts

- `npm run build` → exit `0` (`dist/chrome`, `dist/firefox`, `dist/edge` built; 49 runtime modules verified; all bundle budgets green).
- `npm run check` → exit `0` (`lint`, `format:check`, `87` Vitest files / `777` tests, `contracts:check`, `verify-file-size` [333 files], `verify-visual-baselines`, `svelte-check` [0 errors], CSS/Vercel/assets/lockfile/release-notes gates).
- Owner live verification (`2026-11-05`): Firefox (25 playlists) ↔ Chrome (1 playlist) synced cleanly over `pfydngsbcmuhsqqjbcte.supabase.co`.
