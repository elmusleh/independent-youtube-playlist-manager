# Suggestions Ledger

Every improvement/next-step suggestion offered to the owner is recorded here so
it is never repeated. After each implementation, append the new suggestions
(see `~/dev/AGENTS.md` § Post-Implementation Suggestions) and tag each:
`[done]` once implemented, `[skip]` if declined, `[accepted]` if queued.

## Pending

1. Migrate the remaining `global.css` form-element base styles to tokens —
   `input/button/select/textarea` still uses `0.4em` / `2px` magic values that
   ignore `--space-*` / `--radius-*`. (Best practices)
2. Add the `/playlist` editor route to the visual snapshot matrix — the
   EditorToolbar isn't snapshotted, so a toolbar regression has no pixel guard. (Testing)
3. Assert the `.is-stuck` elevation in the sticky test — the "floating nav"
   shadow isn't asserted, only the pin geometry is. (Testing)
4. Add a 60-second demo GIF/video at the top of README showing right-click → save
   to playlist; README hero currently has no visual. Priority 85% (High value)
   [Professionalism]. What: embed a short screen recording in the README hero.
   Why: visitors decide to star in ~3 seconds; text alone under-converts.
   How: record with asciinema/ffmpeg, host in repo or asciinema.org, add
   `![demo](...)` above the badges.
5. Submit the existing Chrome build to Opera/Brave/Vivaldi stores (zero code
   change, store listings only). Priority 70% (High value) [Best practices].
   What: publish the already-built Chrome ZIP to additional Chromium stores.
   Why: multiplies discoverability at near-zero engineering cost.
   How: create dev accounts, upload dist/chrome ZIP, reuse Chrome listing copy.
6. Add GitHub topics/tags (`youtube`, `playlist-manager`, `browser-extension`,
   `webextension`, `svelte`, `firefox-android`) and a Discussions tab. Priority
   60% (Nice to have) [Professionalism].
7. Ship Microsoft Edge via Partner Center (build already generates dist/edge).
   Priority 80% (High value) [Best practices]. How: upload dist/edge ZIP, fill
   listing, submit; flip README 🚧→✅ when approved.
8. Add partial i18n (de, ar, es) to multiply addressable audience. Priority
   55% (Nice to have) [Best practices].
9. Enable GitHub Discussions for feature requests; keep Issues for bugs. Priority
   50% (Nice to have) [Professionalism].

10. Add a test asserting the extension makes no outbound request to
    api.github.com. [done] 2026-11-05
11. Pre-pull local snapshot safety backup before first sync into a non-empty space. [done] 2026-11-05
12. Add a CI manifest domain allowlist check blocking non-IYPM Supabase projects. [done] 2026-11-05
13. Implement the interactive Manual Conflict Review Queue modal on `#/sync`.
    Priority 78% (High value) [Professionalism]. What: turn the "Manual review queue
    (Coming soon)" option in `SyncConflictCard.svelte` into an interactive diff
    drawer where users can pick local, remote, or merged values when both devices
    edited the same playlist or setting offline. Why: gives power users full control
    over ambiguous edits instead of silently resolving ties by timestamp. How: store
    unresolved `{ collection, id, local, remote, base }` records in
    `yph_sync_conflict_queue`, show a badge count on `SyncConflictCard.svelte`, and
    apply the chosen winner via existing adapter write helpers.
14. Add chunked batch pagination to `sync_push` and `sync_pull` for very large libraries. [done] 2026-11-05
15. Add per-device "Revoke / Remove stale device" tombstones in `SyncDevicesCard`.
    Priority 64% (Nice to have) [Professionalism]. What: allow removing old or
    reinstalled browser profiles from the Synced Devices list on `#/sync` without
    wiping the entire cloud space. Why: reinstalling or testing unpacked profiles
    accumulates orphaned device entries that inflate the synced-device count. How:
    write a `deleted: true` tombstone record in `adapters/devices.ts`, filter
    tombstoned devices out of `yph_sync_devices`, and prompt active revoked devices
    to re-pair or rotate the sync key.
16. Add a dedicated `[SYNC]` filter pill in System Logs (`#/logs`). Priority 52%
    (Nice to have) [Professionalism]. What: add a one-click "Sync only" filter chip
    on `#/logs` that filters `yph_system_logs` to `[SYNC]` entries and offers "Copy
    redacted sync diagnostics". Why: makes troubleshooting cross-device sync fast
    for non-technical users without scrolling past unrelated scraper or YouTube API
    logs. How: add a category chip in the Logs view header that filters
    `entry.message.startsWith("[SYNC]")` and strips any hex IDs before copying to
    clipboard.
17. Retire legacy unwired `supabase-sync.ts` and `supabase-client.ts` once Sync v2 is signed off. [done] 2026-11-05
18. Persist the last `SyncRunReport` in `chrome.storage.local` across page reloads. [done] 2026-11-05
19. Listen to `browser.permissions.onAdded` / `onRemoved` for live permission updates. [done] 2026-11-05
20. Add a pre-sync "Dry-run preview" option before first sync on a second device.
    Priority 72% (High value) [Security]. What: add a read-only "Preview incoming
    changes" button that decrypts remote record headers in memory and shows how many
    playlists, videos, and settings will be added or merged before writing anything
    locally. Why: gives hesitant users 100% confidence when pairing a second browser
    with an existing library for the first time. How: reuse `pullAll` +
    `decryptRecord` in a read-only helper without calling adapter `save*` methods,
    and render the diff summary inside `SyncReportModal.svelte`.
21. Split `Sync.svelte` orchestration state into `sync-controller.svelte.ts` to drop
    `Sync.svelte` under 350 lines. Priority 66% (Nice to have) [Best practices].
    What: move the reactive sync state, permission helpers, and polling timers out
    of the 490-line `Sync.svelte` view into a dedicated Svelte 5 rune controller
    module (`sync-controller.svelte.ts`) and remove `Sync.svelte` from the legacy
    `verify-file-size.js` allowlist. Why: keeps the view declarative, makes
    controller state unit-testable without mounting DOM components, and pays down
    another allowlisted legacy file. How: extract state + action methods into a
    factory class/function under `src/services/sync/`, keep both files ≤ 300 lines,
    and delete `Sync.svelte` from `legacyAllowlist`.
22. Add a one-click "Copy Sync Report" button inside `SyncReportModal.svelte`.
    Priority 48% (Nice to have) [Professionalism]. What: add a "Copy summary" action
    in the Sync Status Report dialog footer that copies the plain-text category
    table, duration, and status (with zero keys or sensitive IDs) to the clipboard.
    Why: makes sharing bug reports or verifying multi-device test runs effortless.
    How: format `report.rows` + `report.summary` into a short markdown/text block
    and pass it to `navigator.clipboard.writeText` with a confirmation toast.
23. Add a one-click "Copy SQL schema" button directly inside `SupabaseCard.svelte`. [done] 2026-11-05
24. Add "Import safety backup JSON" file picker to `SyncSafetyCard.svelte`. [done] 2026-11-05
25. Add optional passphrase-encrypted JSON export for local safety snapshots.
    Priority 76% (High value) [Security]. What: offer an optional password prompt
    when downloading a safety snapshot JSON so the exported file on disk is
    encrypted with PBKDF2 + AES-256-GCM. Why: protects exported playlist and watch
    history files if a user saves them to a shared downloads folder or unencrypted
    cloud drive. How: derive an AES-GCM key via WebCrypto `PBKDF2` (600,000
    iterations) over a random 16-byte salt and wrap `serializeSafetyBackupJson` in
    an encrypted envelope.
26. Add an interactive "Approve empty-library wipe" override dialog when the anti-mass-wipe guard triggers. [done] 2026-11-05
27. Add a schema version health check RPC (`sync_info`) to `sync-relay-v2.sql`.
    Priority 63% (Nice to have) [Best practices]. What: add a lightweight read-only
    `public.sync_info()` SQL function returning `{ schema_version: 2, migrations:
[2, 3] }` so `Test connection` on a self-hosted Supabase project can verify not
    just `sync_claim` existence, but also whether hardening migrations were applied.
    Why: prevents subtle rate-limit or role-permission mismatches on older
    user-hosted Supabase databases. How: add `sync_info()` in a new migration under
    `docs/migrations/` and call it optionally inside `verifyRelayConnection`.
    28: Move `yph_sync_safety_backups` payloads to IndexedDB with `gzip` `CompressionStream`.
    Priority 54% (Nice to have) [Best practices]. What: compress rolling safety
    snapshots using the browser's built-in `CompressionStream("gzip")` API and store
    them in IndexedDB instead of `storage.local`. Why: reduces local storage
    footprint by ~80% for power users with hundreds of playlists and thousands of
    watch-history entries. How: pipe `serializeSafetyBackupJson` through
    `new CompressionStream("gzip")` and store the `Uint8Array` in an IndexedDB
    object store with automatic fallback to `storage.local` in unit tests.
28. Add an ESLint `no-restricted-syntax` rule banning unguarded `.window =` assignments. [done] 2026-11-05
29. Add an automated Playwright Firefox background-bundle boot smoke check in CI. [done] 2026-11-05
30. Validate `sender.id === browser.runtime.id` on privileged internal `runtime.onMessage` commands. [done] 2026-11-05
31. Show a live "Background sync worker: Ready" health indicator in `#/sync` diagnostics.
    Priority 65% (Nice to have) [Professionalism]. What: ping `{ cmd: "sync-status" }`
    when opening `#/sync` and display whether the background sync worker answered
    directly or whether `#/sync` is using the in-page fallback. Why: makes background
    worker or event-page startup issues immediately transparent to users and
    developers without opening `about:debugging`. How: record whether
    `runtime.sendMessage({ cmd: "sync-status" })` returned a non-undefined status in
    `Sync.svelte` and render a compact status badge in the Sync activity card header.
32. Add a per-record payload size preflight guard before `sync_push`. [done] 2026-11-05
33. Format connected device names ("Firefox · Linux", "Chrome · Linux") in `SyncCounters.svelte`.
    Priority 46% (Nice to have) [Professionalism]. What: turn the already-synced
    `DeviceRecord.userAgent` and `platform` metadata into readable browser/OS labels
    in a tooltip or inline list next to `"2 devices connected"`. Why: lets users
    confirm at a glance that both Firefox and Chrome are paired to the same Sync Key
    space instead of seeing only a raw count. How: add a pure `formatDeviceLabel`
    helper in `src/services/sync/` and pass the formatted labels from `Sync.svelte`
    into `SyncCounters.svelte`.
34. Pause automatic periodic background sync while the device reports offline (`navigator.onLine === false`) or on metered connections. [done] 2026-11-05
35. Add configurable debounce delay (`3s`, `15s`, `60s`) for "Sync automatically after local edits".
    Priority 69% (Nice to have) [Professionalism]. What: let power users who reorder
    or curate playlists heavily choose a `15s` or `60s` batching window instead of
    the fixed `3s` post-edit delay. Why: coalesces rapid multi-video drag-and-drop
    edits into a single encrypted relay push, saving bandwidth and relay rate-limit
    tokens. How: add `autoSyncDebounceSeconds?: number` (`3 | 15 | 60`, default `3`)
    to `SyncConfig` and read it when scheduling `debounceTimer` in
    `sync-engine-registration.ts`.
36. Add a temporary "Snooze automatic sync for 1 hour" quick action in the header `SyncStatusIndicator`.
    Priority 62% (Nice to have) [Professionalism]. What: let users temporarily pause
    background sync for 1 hour during bulk playlist imports or cleanup without
    losing their saved `Sync Frequency` schedule. Why: avoids partial mid-cleanup
    pushes without forcing users to switch to `Manual only` and remember to turn
    their schedule back on later. How: store `snoozeUntil?: number` in `SyncConfig`,
    skip automatic runs while `Date.now() < snoozeUntil`, and arm a one-shot
    `browser.alarms` wakeup at `snoozeUntil`.
37. Enforce strict bounds validation on `autoSyncOnChange` / `syncIntervalMinutes` inside `saveSyncConfig`. [done] 2026-11-05
38. Add a Playwright interaction test for `SyncScheduleCard.svelte` preset + custom duration switching. [done] 2026-11-05
39. Add End-to-End Encryption Verification Indicator (Badge) in `SyncHero.svelte`. [done] 2026-11-05
40. Add "Download Safety Backup" Prompt Before Disconnecting Sync Key. [done] 2026-11-05
41. Add Network Bandwidth / Payload Size Tracking to `SyncRunReport`. [done] 2026-11-05
42. Add Visual "Last Synced Time" Humanized Auto-Refresh Timer. [done] 2026-11-05
43. Expose Schema Version Validation in Custom Supabase Connection Test. [done] 2026-11-05

## Done

1. Fix the 5 pre-existing Prettier formatting violations so `npm run check`
   passes cleanly. [done] 2026-11-04
2. Update PRIVACY_POLICY.md to state the extension makes no GitHub API call.
   [done] 2026-11-04
3. Resolve the SyncHero.svelte 353-line file-size gate (limit 350). [done]
   2026-11-05
