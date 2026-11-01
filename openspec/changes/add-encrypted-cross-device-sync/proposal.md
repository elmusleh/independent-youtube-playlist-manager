# Proposal

## Why

The extension's data is local-only today: the only cross-device paths are manual JSON
export/import per change (tedious) and an unwired plaintext Supabase delta engine
(`supabase-sync.ts` / `supabase-client.ts`) that requires email authentication and would
make the project a data custodian. The owner wants a comfortable, automatic, daily-driver
sync between phone and laptop that is zero-knowledge and privacy-first — a Mullvad-style
sync key as the only credential, end-to-end encrypted payloads nobody else can read, and
"build it and forget it" operation — plus a module/plugin system so optional features
such as API Setup can be toggled on and off.

## What Changes

- New **end-to-end encrypted snapshot sync engine**: sync-key-only identity, automatic
  background triggers (debounced push, startup pull, manual "Sync now"), last-write-wins
  conflict resolution, and an automatic local pre-import backup safety net.
- **Pluggable storage backends** behind one uniform interface: File (manual), Supabase
  (bring-your-own project URL + key), and Google Drive (`appDataFolder`, reusing the
  existing Google sign-in).
- **Granular sync-content selection**: playlists, video metadata, thumbnails, watch
  history, and settings, each independently included or excluded from the snapshot.
- **Module/feature registry** with a new Plugins (Connections) screen in the sidebar
  footer; API Setup becomes a toggleable module whose nav entry and route are hidden
  when disabled.
- Retire the unwired plaintext delta-sync engine after the new engine passes acceptance
  (it is dead code today; no user-facing change).

No manifest permission changes, no new release authorization, no video/media download
features. This proposal records the agreed direction from the 2026-11-01 planning
discussion (see `docs/ENCRYPTED_SYNC_PLAN.md`).

## Capabilities

### New Capabilities

- `encrypted-device-sync`: zero-knowledge sync-key identity, end-to-end encrypted
  snapshots, automatic sync triggers, conflict policy and recovery safety.
- `sync-backends`: the uniform storage-backend contract and its File, Supabase
  bring-your-own and Google Drive implementations.
- `feature-modules`: the module registry, Plugins screen and enable/disable behavior
  for optional features, including API Setup.

### Modified Capabilities

None — `openspec/specs/` holds no existing capabilities; these are the first formal
specs for these behaviors.

## Impact

- Extension SPA: new sync services, views/routes, settings keys and background triggers;
  reuses the existing `backup-service` payload shape, `thumbnail-archive`, storage
  settings store and `data-consent` gating.
- New repo assets: Supabase migration/deploy instructions and the plan document
  `docs/ENCRYPTED_SYNC_PLAN.md`.
- Web portal, extension manifests, permissions and releases: unchanged in this change.
- Implementation is deferred until the owner approves this plan; this pass creates
  planning artifacts only.
