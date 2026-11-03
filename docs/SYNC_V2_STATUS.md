# Sync v2 — Implementation Status

Branch: `feat/sync-hardening`. Last updated: 2026-11-03.

This document supersedes `SYNC_HARDENING_PLAN.md` for the v2 work. The original
diagnosis lives in the Antigravity implementation plan
(`~/.gemini/antigravity/brain/17ee57d2-9794-466b-bfff-1e542baa6784/implementation_plan.md`).

## What is done

### Phase 0 — Hotfix (so v1 works today)

- Sync view: `setupHint` defined, 20-character Crockford key validation, "Generate key" button.
- "Sync now" button passes its class via `className` (SimpleButton prop).
- Polling + one pull start when the editor opens (`App.svelte`), not only on the Sync page.
- `docs/sync-relay.sql` and `docs/SYNC_RELAY_SETUP.md` create `relay_snapshots(payload)`,
  matching `encrypted-sync-service.ts`.
- Key-acceptance test for lowercase and handwritten O/I/L input.

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

### Bug fixes (discovered during this work)

- Service worker did not load at all: `background/index.js` imported
  `enqueuePlaylistMutation`/`getPlaylistsRevision` from `capture-controller.js` (they live in
  `mutation-queue.js`) and `refreshMenu` from `context-menus.js` (never exported). Fixed.
- Sync view overflow at 320px: fixed min-widths on key/value/input containers.
- `Sync.svelte` smoke label in `verify-extension.js` updated to match configured relay state.
- `agent-lock.js`: CLI `release` clears a stale (dead-owner) marker without `--force`.
- HLC combined value overflowed the 32-bit bitwise range; ordering now uses the
  `(wall, counter, deviceHash)` tuple.

## What still needs to be done

### Phase 3 follow-up (adapter wiring)

- Wire `runOnce` to the per-collection adapters (playlists done; history, settings,
  devices still to do) using `relay-transport` + `merge/*` + `shadow-store`.
- Add `storage.onChanged` triggers in the engine (debounced push on local edit).
- Expose `yph_sync_status` consumption by the UI.

### Phase 4 — Sync Center UI

- Split `Sync.svelte` (1054 lines) into `components/sync/*`:
  `SyncHero`, `SyncCounters`, `DeviceList`, `SyncContents`, `PairingCard`,
  `SyncActivity`, `SyncAdvanced`.
- Drive `SyncStatusIndicator.svelte` (header) from `yph_sync_status` with a badge when
  changes are waiting or a run failed.

### Phase 5 — Extras (optional)

- QR / pairing link (needs a small portal page + content-script handoff for Firefox Android).
- Supabase Realtime _broadcast_ nudge while a page is open (no data, only "pull now").
- Key rotation that moves data to a new space.

### Backend / ops

- Run `docs/sync-relay-v2.sql` on the hosted Supabase project (`qvwitlpnetwthyhrobca`).
- Drop the v1 `relay_snapshots` table after migration.
- Update `PRIVACY_POLICY.md` (device name + platform stored encrypted).

## Test status

- `npm run check`: exit 0 (78 files / 731 tests).
- `npm run build`: exit 0 (all budgets pass).
- `npm run test:extension`: exit 0.
- `npm run test`: 731 passed.

## Open questions (from the original plan)

1. Relay schema change — SQL written; owner must run it on the hosted project.
2. File / Syncthing backend — propose removing from live sync, keep Export/Import.
3. Account-based `supabase-sync.ts` — propose detaching from sync flow.
4. History scope — default on, cap at last 5,000 / 180 days?
5. Phase 0 hotfix — shipped.
6. QR / pairing link — in scope for Phase 5.
