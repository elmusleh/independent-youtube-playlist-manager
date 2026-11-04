# Tasks

## 1. Backup and local-format safety

- [x] 1.1 Add a pure settings allowlist for backup export/import; test that `yph_sync_config`, endpoint keys, sync status/cursors, unknown keys, and tokens are excluded while user preferences survive round-trip.
- [x] 1.2 Add explicit backup migration functions for each supported schema version; test legacy playlist-array, schema v1, schema v2, future-version rejection, and no writes on invalid input.
- [x] 1.3 Correct `docs/DATA_COMPATIBILITY.md` to distinguish additive reads from unsafe mixed-version writes, document every current storage key/version, and state the exact tests required for a format bump; validate Markdown with Prettier.
- [x] 1.4 Add a failure-path test proving unsupported backup input is rejected before metadata, playlists, history, thumbnails, or settings are mutated.

## 2. Legacy sync transition guard

- [ ] 2.1 Add a versioned sync-config migration marker and a pure detector for previously synced v1 configurations; test new, migrated, partially configured, and already-v2 configs.
- [ ] 2.2 Block automatic v2 claim/push for detected legacy configs until the user acknowledges the legacy-data recovery notice; test zero relay requests and unchanged local state before acknowledgement.
- [ ] 2.3 Add Sync UI recovery guidance that tells users the hosted v1 snapshot table is unavailable, recommends exporting each still-installed device before continuing, and never claims remote recovery; test warning visibility and explicit acknowledgement flow.
- [x] 2.4 Reconcile the v1/v2 table-retention statements in `docs/sync-relay-v2.sql`, `docs/SYNC_V2_STATUS.md`, and `docs/SYNC_RELAY_SETUP.md`; record the read-only hosted probe (v1 table 404; v2 direct-table access 401) without claiming inaccessible row contents or applying hosted changes.
- [ ] 2.5 **Release blocker:** prevent `claimSpace`/background sync from creating a new empty v2 space for any config that may have previously used v1 relay. The detector and gate must exist in code, not only docs, before release. Test startup and periodic triggers against legacy and partially-configured configs.

## 3. Nearby connection and pairing

- [ ] 3.1 Define a versioned, size-bounded Nearby message protocol with tests for valid/invalid HELLO, inventory, request, record, acknowledgement, timeout, and cancellation messages.
- [ ] 3.2 Implement local-only WebRTC offer/answer setup with no ICE servers, complete ICE gathering before out-of-band transfer, five-minute/one-use invitations, and tests proving no external signaling requests or fallback.
- [ ] 3.3 Implement client-side QR encode/decode with a small audited OSS dependency loaded only when needed, plus copy/paste fallback; test malformed, expired, replayed, and oversized invitation payloads.
- [ ] 3.4 Add DTLS-fingerprint/session-transcript verification phrases; test both peers derive the same phrase and that changed offer/answer data changes it.
- [ ] 3.5 Keep the durable sync key out of invitations; require phrase confirmation and receiver consent before sending it over the data channel; test refusal and key mismatch leave local data untouched.

## 4. Bidirectional peer record exchange

- [ ] 4.1 Add inventory builders for the currently supported sync collections (playlists, settings, history, devices), including tombstones and HLC versions; test stable record IDs and content-selection behavior.
- [ ] 4.2 Implement peer inventory comparison and missing/changed-record requests without using relay `lastSeq`; test first-time transfer, one-sided edits, concurrent edits, deletions, and repeat-session idempotency.
- [ ] 4.3 Reuse record encryption and collection merge/apply adapters; test captured messages contain no plaintext titles, invalid ciphertext is rejected, and unsupported record versions are not applied.
- [ ] 4.4 Acknowledge a record only after durable local apply; test storage failures and connection loss leave records retryable and do not advance relay cursors or shadow baselines.
- [ ] 4.5 Serialize Nearby with the background relay engine and create a local restore point before first peer apply; test simultaneous sync is refused safely and an interrupted session can be retried.

## 5. Sync UI and user feedback

- [ ] 5.1 Add an opt-in Nearby section to Sync with Create session / Join session, same-network and foreground requirements, camera-permission explanation, manual-code fallback, and no-cloud-fallback wording.
- [ ] 5.2 Show peer verification, negotiated collections, transfer progress, success/partial/error states, cancellation, and actionable AP-isolation/VPN troubleshooting; test narrow layouts and state transitions.
- [ ] 5.3 Ensure no new manifest host permission or persistent backend setting is required; test the complete built-extension flow in Chromium with two in-page peers and assert zero relay/STUN/TURN requests.

## 6. Verification and release gates

- [ ] 6.1 Run focused backup, migration, pairing, protocol, merge, and engine tests; run `npm run check`, `npm run build`, and `npm run test:extension`, recording exact exit codes on the feature head.
- [ ] 6.2 Verify the extension bundle includes the QR assets and no unexpected dependencies/permissions; run file-size, bundle, and dependency audits.
- [ ] 6.3 Owner performs real laptop ↔ Firefox Android Nearby acceptance on same Wi-Fi and hotspot with internet disabled, including cancel, wrong key, AP isolation, and interrupted-transfer recovery; leave unchecked until evidence exists.
- [ ] 6.4 Owner verifies whether any recoverable hosted v1 snapshot backup exists and decides the user-facing v1→v2 recovery/migration path; leave unchecked until authoritative evidence exists.
- [ ] 6.5 Do not call release 1.3 data-safe or enable v2 for previously synced users until 6.4 is resolved; keep the gate documented if recovery is impossible.

## Workflow follow-up

- Rebase this dependent branch onto `origin/next` only after prerequisite PR #88 is integrated; refresh all affected checks.
- Publish a PR targeting `next` only when its diff no longer contains PR #88's commits; do not merge or release without the required owner authorization.
- Archive this change only after implementation, owner device acceptance, and the legacy relay recovery decision are recorded.
