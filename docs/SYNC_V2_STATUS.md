# Sync v2 — Implementation Status

Branch: `feat/sync-hardening`. Last updated: 2026-11-03.

## Release gate — verified 2026-11-04

**Do not mark the relay ready for public release yet.** The relay applies a service-wide
limit of 100 new-space claims per minute, but it does not enforce a trusted per-client or
per-IP limit. That service-wide limit can be evaded over time by claiming unique spaces.
Before public launch, enforce rate limiting at a trusted gateway using trusted request
metadata; never trust client-supplied forwarding headers. This requirement is also called
out in `docs/migrations/0002_rate_limit_and_push_validation.sql` and remains an operations
gate, not something the local SQL fixture proves.

Local verification on 2026-11-04: `npm run test:sync:relay` passed 16/16 against the
repository's Postgres/PostgREST fixture with migration `0002` applied. This does not verify
that migration `0002` or gateway-level protections are active on the hosted relay. Manual
Chrome/Firefox/Fenix multi-device verification is still required.

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

## What still needs to be done

- **Relay SQL + encryption**: verified against live Postgres 16 (9/9 E2E pass).
- **Engine + adapters**: NOT verified end-to-end. No test runs `runOnce` or the adapters.
- **Deletion tombstones**: IMPLEMENTED. Local deletions now emit `deleted: true`
  tombstones and remote tombstones are applied (playlists/history/settings).
- **status-store.ts**: WIRED into `runOnce()` (restore points saved pre-sync).
- **Live payload cap**: migration `docs/migrations/0001_payload_cap.sql` must be
  applied to the production database.
- **Manual device verification**: real Chrome/Firefox/Fenix round-trip still needed.
- **E2E CI**: `docker-compose.test.yml` added for Postgres + PostgREST provisioning.

### Phase 3 follow-up (adapter wiring) — DONE

- `runOnce` now pulls via relay-transport, merges per collection (playlists,
  history, settings, devices), pushes dirty records, and updates lastSeq.
- Adapter pass extracted to `sync-engine-adapters.ts` (file-size gate).
- `storage.onChanged` triggers already wired in the engine (debounced push).
- `yph_sync_status` consumption by the UI is via the existing `getSyncStatus` path.

### Phase 4 — Sync Center UI (remaining)

- Split `Sync.svelte` into `components/sync/*`: `SyncHero`, `SyncCounters`,
  `SyncKeyCard`, `SyncContents`, `SyncActivity`, `SyncAdvanced` (DONE).
- `SyncStatusIndicator.svelte` (header) driven by `yph_sync_status` with a badge
  when changes are waiting or a run failed (DONE).

### Phase 5 — Extras (optional, DONE)

- Pairing link (`26a9dfb`): "Copy pairing link" button in `SyncKeyCard` (base64url
  key in `#/sync?join=...`); `Sync.svelte` imports & validates on mount, saves key,
  shows toast.
- Realtime nudge (`161fbf6`): `services/sync/realtime-nudge.ts` subscribes to
  `sync-<space>` broadcast channel (handles `nudge`/`sync-nudge`), debounced,
  triggers `pullNow()`; wired in `Sync.svelte` with cleanup.
- Key rotation (`4a3b60e`): "Rotate key (advanced)" button → confirm dialog →
  `rotate-key.ts` generates new key, pushes all data to new space, updates config,
  deletes old space; refreshes UI + resubscribes.

### Backend / ops (DONE)

- `docs/sync-relay-v2.sql` applied to hosted Supabase (`qvwitlpnetwthyhrobca`):
  tables `sync_spaces`, `sync_records`, RLS enabled, RPCs `sync_claim`,
  `sync_pull`, `sync_push`, `sync_delete_space` — all verified.
- v1 `relay_snapshots` table dropped.
- `PRIVACY_POLICY.md` updated to document encrypted v2 sync.

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
