# Sync v2 — Implementation Status

Branch: `next` (latest sync commit: `1601fec`). Last updated: 2026-11-05.

## Release gate — 2026-11-05

- **Hosted relay (`pfydngsbcmuhsqqjbcte.supabase.co`): VERIFIED ✅**
  - `docs/sync-relay-v2.sql` + migrations `0002` (RLS, regex validation, service-wide rate limit) and `0003` (trusted IP rate limit via PostgREST `db_pre_request` hook) active.
  - Gateway `cf-connecting-ip` ownership verified; direct anon reads on `sync_spaces` / `sync_records` rejected (HTTP 401).
  - Foreign Supabase project `qvwitlpnetwthyhrobca.supabase.co` (`mawqiei.net`) purged from extension manifests and runtime config migrations (`migrateSyncConfig`).
- **Desktop multi-device verification (Firefox MV3 ↔ Chrome MV3): OWNER-VERIFIED ✅ (2026-11-05)**
  - Real 25-playlist (2,523 videos) + watch-history + pinned-favorites library synced end-to-end between desktop Firefox and desktop Chrome over `pfydngsbcmuhsqqjbcte.supabase.co`.
- **Automated engine, adapter & relay suites: VERIFIED ✅**
  - `npm run check`: 87 test files / 777 tests passing (including `sync-engine.integration.test.ts`, `sync-engine.firefox-merge.test.ts`, `sync-safety-backup.test.ts`, `host-permissions.test.ts`, `sync-config.compatibility.test.ts`, `sync-engine-registration.test.ts`).
- **Remaining manual checks before stable `main` cut:**
  - Real-device Firefox for Android (Fenix) sync smoke check (`docs/MULTI_DEVICE_SYNC_TEST.md`).
  - Legacy v1 `relay_snapshots` notice remains active (`needsV2RelayAcknowledgement`) so any pre-v2 config pauses safely until acknowledged.

## Legacy v1 relay recovery — release blocker

The former `relay_snapshots` snapshot table is not present at the hosted endpoint (read-only
request returned HTTP 404 on 2026-11-04). The v2 `sync_spaces` and `sync_records` tables
reject direct anon reads (401), as intended. The table's absence does not reveal whether it
contained user data before removal or whether Supabase PITR can recover it. V1 uses a
single encrypted snapshot and PBKDF2; v2 uses per-record envelopes and HKDF-derived keys.
No client-side v1→v2 migration is currently implemented. Do not claim old remote data was
migrated, and do not mark release 1.3 data-safe for previously synced users until the owner
checks recoverable backups and approves the recovery path. Existing local data must remain
untouched while this is unresolved.

This document supersedes `SYNC_HARDENING_PLAN.md` for the v2 work. The original
diagnosis lives in the Antigravity implementation plan
(`~/.gemini/antigravity/brain/17ee57d2-9794-466b-bfff-1e542baa6784/implementation_plan.md`).

## What is done

### Phase 0 — Legacy v1 client behavior (hosted availability no longer assumed)

- Historical v1 code used `docs/sync-relay.sql` and `relay_snapshots(payload)`.
- The current hosted project returns 404 for that table; old clients using the v1 endpoint cannot be assumed to sync today.
- No migration from a v1 snapshot to v2 records is implemented. Preserve local data and require backup/recovery guidance before enabling v2 for an older configuration.
- Key acceptance tests cover lowercase input and handwritten O/I/L glyphs.

### Phase 1 — Protocol core (pure, unit-tested)

- `services/sync/keys.ts`: HKDF-SHA256 derives encryption/record-id/auth keys from the
  20-char sync key; `computeRecordId`, `computeAuthToken`, `computeStorageAddress`.
- `services/sync/fingerprint.ts` + `fingerprint-emoji.ts` + `fingerprint-words.ts`:
  human-friendly key verification.
- `services/sync/record-codec.ts`: AES-256-GCM record envelopes with AAD binding
  (`collection|recordId`); tamper and slot-confusion rejected.
- `services/sync/hlc.ts`: Hybrid Logical Clock (tuple comparison to avoid 32-bit overflow).
- `services/sync/merge/playlists.ts`: 3-way merge (title LWW, video add/remove merge,
  delete-vs-edit conflict).
- `services/sync/merge/history.ts`: per-video LWW with tombstones.
- `services/sync/merge/settings.ts`: per-key LWW with allowlist.
- `services/sync/shadow-store.ts`: IndexedDB base-copy tracking for dirty detection.
- Unit tests for all of the above (731 tests total, all green).

### Phase 2 — Relay v2 and transport

- `docs/sync-relay-v2.sql`: `sync_spaces` + `sync_records`, RPCs `sync_claim`,
  `sync_pull`, `sync_push` (per-record `ok | conflict`), `sync_delete_space`.
  Anon has no direct table access.
- `services/sync/relay-transport.ts`: plain `fetch` RPC client (claim, pull since seq,
  push batches of 50, delete space). Works in SW and pages.
- `services/sync/fake-relay.ts`: in-memory implementation of the same contract for tests.

### Phase 3 — Background engine (skeleton)

- `services/sync-engine.ts`: state machine (`idle → pulling → merging → pushing → idle |
error | offline | paused`), single-flight guard, exponential backoff, status persistence
  to `yph_sync_status`, `scheduleRun`/`pause`/`resume`, message commands
  (`sync-now`, `sync-pause`, `sync-status`).
- Wired into `background/index.js`: `yph-sync-periodic` alarm (5 min), `runtime.onStartup`,
  `storage.onChanged` → debounced push.
- `services/sync/status-store.ts`: run history (last 50) + rolling restore points (last 5).
- `services/sync/adapters/playlists.ts`: playlists collection adapter (dirty detection,
  push, pull + merge + apply via `mutateLibrary`, shadow update).
- Rollup entry added (`sync-engine`).

### Phase 3 follow-up — Adapter wiring (DONE)

- `runOnce` now pulls via relay-transport, merges per collection (playlists,
  history, settings, devices), pushes dirty records, updates lastSeq.
- Adapter pass extracted to `sync-engine-adapters.ts`.
- Devices adapter added (`services/sync/adapters/devices.ts`).
- `storage.onChanged` triggers already wired (debounced push).

### Phase 4 — Sync Center UI (DONE)

- `Sync.svelte` split into `components/sync/*`: `SyncHero`, `SyncCounters`,
  `SyncKeyCard`, `SyncContents`, `SyncActivity`, `SyncAdvanced`.
- `SyncStatusIndicator.svelte` (header) driven by `yph_sync_status` with a badge
  when changes are waiting or a run failed.

### Phase 5 — Extras (DONE)

- Pairing link: "Copy pairing link" button + auto-import on mount.
- Realtime nudge: `services/sync/realtime-nudge.ts` subscribes to broadcast channel.
- Key rotation: "Rotate key (advanced)" flow.

### Bug fixes (discovered during this work)

- Service worker did not load at all: `background/index.js` imported
  `enqueuePlaylistMutation`/`getPlaylistsRevision` from `capture-controller.js` (they live in
  `mutation-queue.js`) and `refreshMenu` from `context-menus.js` (never exported). Fixed.
- Sync view overflow at 320px: fixed min-widths on key/value/input containers.
- `Sync.svelte` smoke label in `verify-extension.js` updated to match configured relay state.
- `agent-lock.js`: CLI `release` clears a stale (dead-owner) marker without `--force`.
- HLC combined value overflowed the 32-bit bitwise range; ordering now uses the
  `(wall, counter, deviceHash)` tuple.

### 2026-11-05 Cross-Browser Root Causes & Hardening (`cfdef5e`, `156f7c5`, `1405024`, `1601fec`)

1. **Firefox SpiderMonkey getter-only `window` crash (`1601fec`):** Firefox MV3 runs background scripts in a hidden `Window` (`_generated_background_page.html`) where `window` is a getter-only accessor (`set: undefined`). `sync-engine-registration.ts` previously assigned `(globalThis as any).window = ...` unconditionally in strict mode, throwing `TypeError: setting getter-only property "window"` on module load in both the background page and `#/sync`'s dynamic `import()` fallback. Guarded with `if (typeof (globalThis as any).window === "undefined")` and skipped duplicate listener registration inside `/editor/index.html` and `/popup/popup.html`.
2. **Firefox MV3 `runtime.onMessage` Promise contract (`1405024`):** Returned native `Promise`s directly when `browser.runtime.getBrowserInfo` exists, plus in-page `runOnce()` fallback and `catch` error surfacing in `Sync.svelte`.
3. **Firefox MV3 host-permission user-gesture loss (`156f7c5`):** Removed `await permissions.contains(...)` before `browser.permissions.request(...)` in `host-permissions.ts` so Firefox's transient click gesture is preserved when requesting `https://pfydngsbcmuhsqqjbcte.supabase.co/*`.
4. **Stale `relayUrl` override & unbound IndexedDB shadows (`cfdef5e`, `1405024`):** Purged stale foreign `*.supabase.co` `relayUrl` overrides in `migrateSyncConfig` and bound `yph_sync_shadow_v1` to `space|relayUrl` (`ensureShadowBinding`) so changing Sync Keys or relay endpoints automatically resets local dirty-tracking shadows and cursors.
5. **Data model & storage bridges (`cfdef5e`, `1601fec`):**
   - Added 3-way `string[]` video ID array merging (`merge/playlist-videos.ts`) instead of object-spread corruption.
   - Added background-safe `storage.local` + `storage.sync` settings reader/writer (`adapter-storage-io.ts`) filtered by `SYNCABLE_SETTING_KEYS` (including `favoritePlaylistIds` and `watchLaterPlaylistId`), plus proxy-stripping and `{ ok: false, error }` handling in `mutateLibrary`.
   - Normalized `local_yt_history` `.videoId` and `lastWatchedAt` fields (`adapters/history.ts`).
   - Cached a single shared `IDBDatabase` connection in `shadow-store.ts` (`openDb()`).
6. **Transparency, BYO Supabase UX & Zero-Data-Loss Safeguards (`156f7c5`, `1405024`):**
   - Added `SyncReportModal.svelte` (`sync-report.ts`), unified `SyncCounters.svelte` pre-first-sync summary (`Will sync: Playlists · History · Settings & Pinned`), and 4-emoji + 4-word `SyncKeyCard.svelte` fingerprint badge.
   - Moved `Test connection` into `RelayCard.svelte` and `SupabaseCard.svelte` with `404`/`PGRST202` missing-schema detection and inline `docs/sync-relay-v2.sql` setup instructions.
   - Added `sync-safety-backup.ts` + `SyncSafetyCard.svelte` (rolling pre-sync local snapshots + JSON export/restore), anti-mass-wipe guard (`adapters/playlists.ts`), and forward-compatible unknown-field/future-version preservation (`merge/playlists.ts`, `sync-engine-adapters.ts`).

## Test status

- `npm run check`: exit 0 (`87` Vitest files / `777` tests, `svelte-check` 0 errors, `verify-file-size` 333 files within limits, visual baselines verified).
- `npm run test:sync:relay`: 18/18 with migrations 0002 and 0003.
- `npm run build`: exit 0 (`dist/chrome`, `dist/firefox`, `dist/edge` all within bundle budgets).
- Desktop Firefox ↔ Chrome live sync round-trip: verified by owner on 2026-11-05.

## Open questions (from the original plan)

1. Relay schema change — SQL written; owner must run it on the hosted project.
2. File / Syncthing backend — propose removing from live sync, keep Export/Import.
3. Account-based `supabase-sync.ts` — propose detaching from sync flow.
4. History scope — default on, cap at last 5,000 / 180 days?
5. Phase 0 hotfix — shipped.
6. QR / pairing link — in scope for Phase 5.
