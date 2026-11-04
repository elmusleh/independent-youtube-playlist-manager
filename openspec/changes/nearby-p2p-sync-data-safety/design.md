# Design

## Context

See `proposal.md` and the two capability specs. The committed sync-v2 foundation at `f8bb053` stores encrypted per-record data through a relay RPC engine (`sync-engine.ts`, `sync-engine-adapters.ts`). Its relay cursor (`lastSeq`) has no meaning in a direct peer session. The current local backup is schema v2; `getSettings()` merges all browser storage areas, so backup export/import must filter that object. The legacy v1 relay table is not present on the checked hosted endpoint (read-only probe returned 404); the v2 tables deny direct anon reads (401, expected). This proves the old endpoint is unavailable, not whether its old rows contained user data or can be recovered from a database backup.

## Goals / Non-Goals

**Goals:**

- Provide an explicit, foreground-only nearby sync session with no internet dependency or silent cloud fallback.
- Reuse record encryption, record IDs, merge rules, tombstones, and durable storage paths already used by sync v2.
- Preserve existing local data and user preferences through extension upgrades and backup imports; prevent sync credentials from entering portable JSON backups.
- Make the v1 snapshot → v2 record-relay incompatibility an explicit recovery gate rather than silently treating it as an empty space.

**Non-Goals:**

- Background or always-on P2P, multi-user sharing, automatic device discovery, internet NAT traversal, STUN/TURN, media downloads, or replacing the hosted relay.
- Claiming that old remote v1 data is recoverable without a verified database backup or another device that still has the data.
- Bumping the full JSON backup schema or changing hosted relay SQL as part of Nearby sync.

## Decisions

### D1 — Separate nearby sessions from persistent backends

Keep `relay`, `supabase-byo`, and `file` as persistent backend choices. Add Nearby as a manual session surface, not as an enabled backend: it exists only while both devices are connected and the Sync page is foregrounded. This avoids treating a short-lived peer as a durable store or changing the relay's `lastSeq` cursor.

### D2 — Native WebRTC transport; QR only for signaling

Use browser-native `RTCPeerConnection` and `RTCDataChannel` with `iceServers: []`. Exchange the complete offer and answer out of band by a locally generated QR and a manual copy/paste fallback. The connection carries the sync protocol directly; no signaling server, STUN/TURN service, or hosted relay is contacted. Do not implement raw LAN discovery or install a native helper in this change.

### D3 — Two-way verification before secret/data transfer

The laptop creates an invitation; the phone scans it and returns an answer QR; the laptop scans the answer (with copy/paste fallback if no camera). Both sides derive the same short authentication phrase from the negotiated DTLS fingerprints/session nonce and require user confirmation. The invitation never includes the long-lived sync key. A device without a key may receive it only after both users confirm the phrase and the receiver explicitly accepts the key transfer.

### D4 — Versioned session protocol, inventory before records

After connection, exchange protocol/record versions, device IDs, a derived sync-space fingerprint, and content selections. Refuse mismatched or unsupported peers before mutation. Exchange per-record inventories and request only missing/changed records; encrypt payloads with the existing AES-GCM record codec. Reuse collection merge/apply logic, but do not invent a peer `seq` cursor. A record is acknowledged only after validation, decryption, merge, and durable local persistence succeed. A later session repeats inventory comparison, making retries idempotent after disconnects.

### D5 — Serialize with existing sync and preserve recovery points

Acquire the same single-flight sync operation guard before starting a peer session; refuse or wait if relay sync is already running. Create a local restore point before the first remote apply. Keep successful per-record writes if the session later drops, but leave unacknowledged records dirty so the next peer session retries them. Cancellation closes the data channel and discards only ephemeral invitation/session material.

### D6 — Local-only by construction

No WebRTC ICE servers are configured and no remote fallback exists. The extension exposes a bounded capability/error state: same reachable Wi-Fi/hotspot required; guest/AP-isolated networks may fail; both pages must stay open; mobile backgrounding can terminate the session. Any failure is visible and never triggers relay traffic.

### D7 — Treat format evolution as independent axes

Keep separate versions for local IndexedDB, backup JSON, encrypted record envelopes, nearby-session protocol, and relay SQL/RPC. Backup export/import uses a known user-preference allowlist; old backup versions use explicit migration functions; unknown/future versions fail before writes. IndexedDB migrations are additive and idempotent. Do not accept an old version merely because its number is lower unless a migration path exists.

### D8 — Legacy relay transition is a release gate, not a guessed migration

The current status document says the v1 `relay_snapshots` table was dropped, while the v2 bootstrap SQL says it should remain for one release. A read-only probe found `relay_snapshots` returns 404 and v2 tables return 401 to anon (expected direct-access denial). Without a verified retained legacy row or recoverable database backup, v1 remote-only data cannot be migrated by application code. The new client must detect a legacy sync configuration, stop before creating/claiming a new v2 space, preserve local data, and show a recovery warning. Public release remains NO-GO until the owner verifies recovery options and approves a user-facing migration path.

## Risks / Trade-offs

- **LAN blocks peer traffic / mDNS candidates fail** → fail closed with troubleshooting and no cloud fallback; test same Wi-Fi and hotspot on target browsers; document AP isolation and VPN caveats.
- **QR/copy invitation is inconvenient or photographed** → five-minute, one-use invitation; no durable key/data in it; short fingerprint confirmation; manual fallback is still available.
- **A local peer is malicious or buggy** → validate message type, size, record version, IDs and authenticated encryption; never persist before decrypt/normalization; no arbitrary settings keys; require matching sync-space identity.
- **Concurrent relay and nearby writes race** → share the sync single-flight guard; if a durable cross-context lease cannot be proven, refuse Nearby while another engine run is active.
- **P2P cannot rescue remote-only data after the old relay table was dropped** → maintain a release NO-GO gate and direct users to local backups/other still-installed devices; do not claim recovery without evidence.
- **Foreground mobile browser suspension** → show the limitation, keep progress/ack state durable, and allow safe retry after reopening.

## Migration Plan

1. Keep existing local stores, keys, backup schema v2, and relay behavior unchanged by default. Add only additive local sync configuration fields.
2. Before any peer apply, create/verify a local restore point. Do not change the server cursor from a Nearby session.
3. Add backup filtering and explicit v1→v2 backup migration. Keep old-version fixtures and test that unsupported versions cause zero writes.
4. Add the Nearby session as an opt-in action. Existing users do not enter it automatically; no data is moved until both peers are verified and the user starts the session.
5. Keep the v1→v2 hosted relay transition separately blocked until the owner verifies whether old remote data is recoverable and authorizes the migration/announcement. Do not drop or rewrite hosted tables from this task.
6. Rollback: disable the Nearby action; local records and existing relay state remain untouched. Keep protocol/version readers and invitation handling isolated so they can be disabled without changing backup data.

## Open Questions

- Whether a Supabase point-in-time backup contains the removed `relay_snapshots` table/data is an owner/hosted-ops question; no database mutation or credential-file access is authorized here.
- Real Chrome desktop ↔ Firefox Android pairing, camera permission, and hotspot behavior require manual device acceptance and remain pending until executed.
