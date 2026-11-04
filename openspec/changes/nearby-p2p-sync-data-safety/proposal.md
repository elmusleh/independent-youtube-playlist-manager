# Proposal

## Why

IYPM needs an optional way to sync while two supported devices are together, without relying on internet, cloud storage, or a signaling service. At the same time, the v1-to-v2 relay transition and broad backup settings export create compatibility and recovery risks that must be explicit before a release can promise existing users safety.

## What Changes

- Add an on-demand **Nearby sync** mode using a direct WebRTC data channel over the same Wi-Fi network or a phone hotspot. Both Sync pages stay open; no STUN, TURN, relay, or cloud fallback is permitted.
- Pair with an expiring, one-use offer/answer exchanged by QR or a manual copy/paste fallback. Keep the durable sync key out of invitations and URLs; compare a short session fingerprint before any key transfer or data apply.
- Reuse the existing encrypted record codec, per-record merge rules, and syncable-collection policy. Add a peer inventory/exchange protocol that has no server sequence cursor and acknowledges records only after durable local apply.
- Make JSON backup export/import use an explicit user-preference allowlist, excluding sync credentials and unrelated extension storage. Keep backup schema version 2 unless a payload change requires a migration.
- Define explicit migrations for supported old backup/snapshot versions; reject unsupported newer formats before any local mutation. Document and test the independent versions for local storage, backup JSON, encrypted records, and relay SQL/RPCs.
- Resolve and document the old snapshot-relay versus v2 record-relay transition. Do not silently treat an unavailable legacy relay as an empty new sync space; preserve the old path or provide a verified client-side migration, and keep public release blocked until the hosted state is confirmed.

## Capabilities

### New Capabilities

- `nearby-peer-sync`: secure, foreground-only, local-network peer pairing and bidirectional encrypted record exchange.
- `data-compatibility`: versioned local/backup/sync formats, explicit migrations, credential-safe backups, and safe mixed-version behavior.

### Modified Capabilities

None. `openspec/specs/` has no accepted capabilities yet; this change adds the first durable requirements for these behaviors.

## Impact

- Extension Sync UI, sync service/adapter path, QR invitation flow, and capability messaging.
- Backup export/import and IndexedDB migration handling.
- Sync format/relay compatibility documentation and regression tests.
- The current branch depends on the committed sync-v2 foundation at `f8bb053` (PR #88). It must be rebased onto `next` after that prerequisite is integrated; no hosted migration, PR publication, release, or deployment is authorized by this proposal.
