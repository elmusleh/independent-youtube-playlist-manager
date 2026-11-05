# Sync Hardening Plan — Zero-Knowledge Cross-Device Sync

**Status:** Implementation in progress on branch `feat/sync-hardening` (off `next` @ `40849fa`).
**Goal:** Make the encrypted cross-device sync robust and bullet-proof for the owner's test
scenario (Chrome desktop + Firefox desktop + Firefox Android, one device at a time, async
sync via "Sync now" or periodic interval), then harden against concurrency, partial
failure, and silent-error cases.

## Scope

This plan covers the **encrypted cross-device sync** feature (`sync-manager.ts`,
`encrypted-sync-service.ts`, `file-sync-service.ts`, `snapshot-codec.ts`, etc.).
It does **not** touch the unrelated `sync-state-service.ts` (playlist upload-to-YouTube
progress tracking).

## Backend infrastructure (provisioned)

A dedicated Supabase project now backs the "Recommended (IYPM hosted)" relay:

- **Project:** `mawqiei.net` (org `el-musleh's projects`), region `eu-west-1`, status `ACTIVE_HEALTHY`.
- **Table:** `public.relay_snapshots` (`address text PK`, `payload text`, `revision bigint`,
  `device_id text`, `updated_at timestamptz`), RLS enabled with anon read/insert/update/delete.
- **URL:** `https://qvwitlpnetwthyhrobca.supabase.co`
- **Key:** publishable `sb_publishable_HV50FQtJrkoNcKLsFk5BHQ_KUU2GeKb`
- **Compiled into:** `sync-config.ts` `RELAY_SUPABASE_URL` / `RELAY_SUPABASE_ANON_KEY`.

The relay is a dumb encrypted blob store keyed by a SHA-256 address derived from the sync
key. The payload is AES-256-GCM ciphertext, so anon access is acceptable (data is
unreadable without the key).

## The 6 risks (from the review) and their fixes

### R1 — File-sync overwrite race (P0)

`file-sync-service.ts` `upload()` does read → compare → write as separate operations.
Two devices can both read "rev 0", both write, second clobbers first.

**Fix:** move to immutable, uniquely-named snapshot files with ancestry metadata:

- Filename: `iypm-sync-<address>-<revision>-<deviceId>.bin` (never overwrite).
- Add `parentRevision` to `snapshot-codec.ts`.
- On read: list all files, build revision DAG; on a fork (two snapshots with same
  parent, different writers), report a conflict and preserve both.
- Keep reading the legacy single-file format for migration.
- No auto-pruning until a safe retention rule exists.

**Status:** Documented. File transport is secondary (relay is the primary path for the
owner's test, which includes Firefox Android). Full implementation deferred to a
follow-up; the immutable-file design is specified here for that pass.

### R2 — Category selection non-destructive (P0)

When a device has a category disabled, its push drops that category from the snapshot,
erasing what another device wrote.

**Fix:** merge-on-write. In the push path, enabled categories come from local; disabled
categories are copied from the newest remote snapshot. Explicit deletion (empty value)
still propagates because `includedCategories` distinguishes "excluded" from "empty".

**Implementation:** `sync-manager.ts` push branch merges disabled categories from
`newestRemote` before building the payload.

### R3 — Report read failures accurately (P1)

`download()` in both transports returns `null` for missing, permission, corrupt, and
decrypt failures alike, which surfaces as "Already up to date."

**Fix:** return a discriminated `DownloadResult`:
`ok | missing | permission | corrupt | decrypt | conflict`. Surface each as a distinct
`lastError` / `lastSyncSummary`.

### R4 — Avoid marking partial work as synced (P1)

`applyRemote()` silently skips categories it can't apply, yet `syncRevision` advances.

**Fix:** `applyRemote()` returns a per-category `{ applied, skipped, failed }` report;
advance `syncRevision` only when all intended categories applied. Keep the pre-import
backup.

### R5 — Test failure paths deterministically (P1)

Add tests for interleaved concurrent uploads, divergent snapshots, missing vs
unreadable/corrupt files, and cross-device category selection. Preserve and extend the
Supabase conditional-write test.

### R6 — Verify before release (process)

Run `npm run check` + `npm run build` + `npm run test:extension`, then a two-device
File/Syncthing acceptance test. Do not merge into `next` if it publishes another beta
without explicit authorization.

## Additional options (beyond the review)

1. **Background service-worker sync** (high value) — move polling out of the page so
   sync works when the editor is closed. Critical for "create on laptop, continue on
   phone later."
2. **Conflict resolution UI** — show both branches on a fork, let the user pick.
3. **QR-code key transfer** — scan-to-pair removes key-typing friction.
4. **Device revocation list** — see paired devices, revoke one.
5. **Key backup phrase** (BIP39-style) — recovery path for lost keys.
6. **Retry with backoff + offline queue** — queue local changes, retry on reconnect.
7. **Dropbox/Drive native backends** — first-party folder access (Chromium FS Access).
8. **WebRTC peer-to-peer** — direct device-to-device, no server (needs signaling).
9. **Per-playlist selection** — sync a subset of playlists.

## Implementation sequence

- Phase A (safety core): R2 + R4 + R3.
- Phase B (experience): background SW sync.
- Phase C (confidence): R5 tests + R6 verification.
- Phase D (future): R1 immutable files, conflict UI, QR pairing, etc.

## Two sync systems (do not conflate)

- `sync-manager.ts` / `encrypted-sync-service.ts` / `file-sync-service.ts` —
  **cross-device encrypted sync** (this plan).
- `sync-state-service.ts` — **playlist upload to YouTube** (different feature, untouched).
