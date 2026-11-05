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
    api.github.com. Priority 60% (High value) [Testing]. What: extend
    verify-extension or add a unit test checking no fetch to GitHub. Why: guards
    against re-introducing the removed request. How: add assertion in
    packages/build-tools/verify-extension.js network audit.
11. Pre-pull local snapshot safety backup before first sync into a non-empty space. [done] 2026-11-05
12. Add a CI manifest domain allowlist check blocking non-IYPM Supabase projects.
    Priority 86% (High value) [Security]. What: add an automated build-tools check
    that fails CI if `manifest.chrome.json` or `manifest.firefox.json` declares any
    `*.supabase.co` host other than `pfydngsbcmuhsqqjbcte.supabase.co`. Why:
    prevents accidental cross-project relay contamination (such as `mawqiei.net`)
    from ever re-entering extension permissions. How: extend
    `packages/build-tools/verify-extension.js` to parse `permissions` and
    `optional_host_permissions` across built manifests and assert only approved
    hosts appear.
13. Implement the interactive Manual Conflict Review Queue modal on `#/sync`.
    Priority 78% (High value) [Professionalism]. What: turn the "Manual review queue
    (Coming soon)" option in `SyncConflictCard.svelte` into an interactive diff
    drawer where users can pick local, remote, or merged values when both devices
    edited the same playlist or setting offline. Why: gives power users full control
    over ambiguous edits instead of silently resolving ties by timestamp. How: store
    unresolved `{ collection, id, local, remote, base }` records in
    `yph_sync_conflict_queue`, show a badge count on `SyncConflictCard.svelte`, and
    apply the chosen winner via existing adapter write helpers.
14. Add chunked batch pagination to `sync_push` and `sync_pull` for very large
    libraries. Priority 74% (High value) [Best practices]. What: split initial sync
    pushes and pulls into batches of 100 encrypted records with incremental progress
    updates. Why: users with thousands of watch-history items or hundreds of
    playlists avoid hitting PostgREST request-body limits or service-worker timeouts
    on slow mobile connections. How: chunk `dirtyRecords` in `sync-engine.ts` into
    slices of 100 before calling `transport.push()`, and loop `transport.pull()`
    while a batch returns the page limit.
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
17. Retire legacy unwired `supabase-sync.ts` and `supabase-client.ts` once Sync v2
    is signed off. Priority 45% (Nice to have) [Best practices]. What: remove the
    legacy 389-line plaintext `supabase-sync.ts` and `supabase-client.ts` files (and
    shrink the `verify-file-size.js` allowlist by one entry) after confirming no
    caller imports them. Why: eliminates dead code, shrinks the file-size debt
    allowlist, and removes confusion between the old prototype and the zero-knowledge
    Sync v2 engine. How: grep for imports across `apps/browser-extension`, delete
    both files plus unused types, remove `supabase-sync.ts` from
    `packages/build-tools/verify-file-size.js`, and run `npm run check`.
18. Persist the last `SyncRunReport` in `chrome.storage.local` across page reloads.
    Priority 84% (High value) [Professionalism]. What: save the most recent
    `SyncRunReport` object (`yph_last_sync_report`) in `storage.local` from both
    manual and background scheduled sync runs so the "Sync report" button on
    `#/sync` works even after closing and reopening the tab. Why: lets users inspect
    what a background or startup sync changed earlier in the day without having to
    trigger another manual sync. How: write `yph_last_sync_report` at the end of
    `runOnce()` in `sync-engine.ts` and hydrate `lastSyncReport` inside `refresh()`
    in `Sync.svelte`.
19. Listen to `browser.permissions.onAdded` / `onRemoved` for live permission updates.
    Priority 79% (High value) [Best practices]. What: subscribe to WebExtension
    `permissions.onAdded` and `permissions.onRemoved` events in `Sync.svelte` so
    toggling relay permissions in `about:addons` updates the Sync banner immediately
    without even switching focus. Why: prevents stale "permission needed" warnings if
    a Firefox user grants or revokes host access in a side-by-side `about:addons`
    window. How: register `permissions.onAdded.addListener(refreshPermissionState)`
    and `permissions.onRemoved.addListener(refreshPermissionState)` inside `onMount`
    with cleanup on unmount.
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
23. Add a one-click "Copy SQL schema" button directly inside `SupabaseCard.svelte`.
    Priority 82% (High value) [Professionalism]. What: bundle a minified copy or raw
    import of `docs/sync-relay-v2.sql` so self-hosting users can copy the entire
    bootstrap SQL into their clipboard with one click without leaving the extension.
    Why: eliminates copy-paste mistakes or version skew when users set up their own
    Supabase project. How: import `docs/sync-relay-v2.sql?raw` (or expose a helper)
    and add a "Copy SQL bootstrap" button next to the setup guide in
    `SupabaseCard.svelte`.
24. Add "Import safety backup JSON" file picker to `SyncSafetyCard.svelte`.
    Priority 80% (High value) [Security]. What: let users upload a previously
    downloaded `iypm-safety-backup-*.json` file directly into `SyncSafetyCard.svelte`
    to restore playlists, watch history, and settings even after reinstalling the
    browser or OS. Why: completes the disaster-recovery loop so exported safety
    snapshots work even if `browser.storage.local` is completely wiped. How: add a
    hidden `<input type="file" accept=".json">` in `SyncSafetyCard.svelte`, validate
    `schema === "iypm-sync-safety-backup-v1"`, and pass it to the restore helper in
    `sync-safety-backup.ts`.
25. Add optional passphrase-encrypted JSON export for local safety snapshots.
    Priority 76% (High value) [Security]. What: offer an optional password prompt
    when downloading a safety snapshot JSON so the exported file on disk is
    encrypted with PBKDF2 + AES-256-GCM. Why: protects exported playlist and watch
    history files if a user saves them to a shared downloads folder or unencrypted
    cloud drive. How: derive an AES-GCM key via WebCrypto `PBKDF2` (600,000
    iterations) over a random 16-byte salt and wrap `serializeSafetyBackupJson` in
    an encrypted envelope.
26. Add an interactive "Approve empty-library wipe" override dialog when the
    anti-mass-wipe guard triggers. Priority 71% (High value) [Professionalism].
    What: surface a dedicated confirmation action on `#/sync` when
    `adapters/playlists.ts` blocks a remote mass-tombstone wipe, letting the user
    either restore their playlists back to the cloud or explicitly confirm the wipe
    once. Why: handles the rare legitimate case where a user intentionally deleted
    every playlist on another device while keeping accidental wipes 100% blocked by
    default. How: detect `"playlists safety guard"` in `lastError` and show two clear
    actions: "Keep local & re-upload" vs "Confirm delete all locally" (setting
    `allowEmptyLibrarySync: true` for one run).
27. Add a schema version health check RPC (`sync_info`) to `sync-relay-v2.sql`.
    Priority 63% (Nice to have) [Best practices]. What: add a lightweight read-only
    `public.sync_info()` SQL function returning `{ schema_version: 2, migrations:
[2, 3] }` so `Test connection` on a self-hosted Supabase project can verify not
    just `sync_claim` existence, but also whether hardening migrations were applied.
    Why: prevents subtle rate-limit or role-permission mismatches on older
    user-hosted Supabase databases. How: add `sync_info()` in a new migration under
    `docs/migrations/` and call it optionally inside `verifyRelayConnection`.
28. Move `yph_sync_safety_backups` payloads to IndexedDB with `gzip` `CompressionStream`.
    Priority 54% (Nice to have) [Best practices]. What: compress rolling safety
    snapshots using the browser's built-in `CompressionStream("gzip")` API and store
    them in IndexedDB instead of `storage.local`. Why: reduces local storage
    footprint by ~80% for power users with hundreds of playlists and thousands of
    watch-history entries. How: pipe `serializeSafetyBackupJson` through
    `new CompressionStream("gzip")` and store the `Uint8Array` in an IndexedDB
    object store with automatic fallback to `storage.local` in unit tests.
29. Add an ESLint `no-restricted-syntax` rule banning unguarded `.window =` assignments.
    Priority 88% (High value) [Best practices]. What: add a lint rule that blocks
    direct assignments to `globalThis.window` or `self.window` unless guarded for
    getter-only `Window` environments. Why: prevents SpiderMonkey strict-mode
    `TypeError: setting getter-only property "window"` crashes from ever recurring in
    Firefox MV3 background event pages or extension tabs. How: add a
    `no-restricted-syntax` AST selector in `eslint.config.mjs` targeting
    `AssignmentExpression[left.property.name='window']` and centralize the
    `typeof globalThis.window === "undefined"` polyfill in `background/init.js`.
30. Add an automated Playwright Firefox background-bundle boot smoke check in CI.
    Priority 83% (High value) [Best practices]. What: execute the built
    `dist/firefox/background/index.js` bundle inside a real headless Firefox
    (SpiderMonkey) browser context during `npm run test:extension` and verify
    `sync-status` and `sync-now` respond without module-evaluation errors. Why:
    catches Gecko-only WebExtension differences (getter-only `Window` globals,
    Promise-returning `onMessage` listeners, structured-clone quirks) automatically
    before manual testing. How: add a small Playwright `firefox.launch()` verification
    step in `packages/build-tools/` that stubs `browser.*` on a Gecko `Window`,
    loads `dist/firefox/background/index.js`, and asserts zero `pageerror` events.
31. Validate `sender.id === browser.runtime.id` on privileged internal `runtime.onMessage` commands.
    Priority 77% (High value) [Security]. What: verify in
    `sync-engine-registration.ts` and `background/library-mutations.js` that
    internal commands (`sync-now`, `sync-pause`, `sync-test-connection`, and
    `mutate-library` `replace`) come from the extension's own runtime ID and not an
    external or untrusted frame. Why: strengthens defense-in-depth so content scripts
    or web frames cannot spoof internal editor/sync commands over the extension
    message bus. How: check `if (sender?.id && runtimeId && sender.id !== runtimeId) return undefined;`
    at the top of the `onMessage` handlers and require `!sender?.tab` for editor-only
    commands.
32. Show a live "Background sync worker: Ready" health indicator in `#/sync` diagnostics.
    Priority 65% (Nice to have) [Professionalism]. What: ping `{ cmd: "sync-status" }`
    when opening `#/sync` and display whether the background sync worker answered
    directly or whether `#/sync` is using the in-page fallback. Why: makes background
    worker or event-page startup issues immediately transparent to users and
    developers without opening `about:debugging`. How: record whether
    `runtime.sendMessage({ cmd: "sync-status" })` returned a non-undefined status in
    `Sync.svelte` and render a compact status badge in the Sync activity card header.
33. Add a per-record payload size preflight guard before `sync_push`.
    Priority 58% (Nice to have) [Security]. What: check each encrypted record's byte
    length against a safe maximum (e.g., 512 KiB) before sending a `sync_push` batch,
    skipping any oversized record with a clear warning while uploading the rest of
    the library. Why: prevents one unusually huge playlist from triggering an opaque
    HTTP 413 payload error that blocks all other playlists from syncing. How: check
    `candidate.record.payload.length` in `sync-engine-adapters.ts` before pushing and
    append a human-readable playlist warning to `failed` if exceeded.
34. Format connected device names ("Firefox · Linux", "Chrome · Linux") in `SyncCounters.svelte`.
    Priority 46% (Nice to have) [Professionalism]. What: turn the already-synced
    `DeviceRecord.userAgent` and `platform` metadata into readable browser/OS labels
    in a tooltip or inline list next to `"2 devices connected"`. Why: lets users
    confirm at a glance that both Firefox and Chrome are paired to the same Sync Key
    space instead of seeing only a raw count. How: add a pure `formatDeviceLabel`
    helper in `src/services/sync/` and pass the formatted labels from `Sync.svelte`
    into `SyncCounters.svelte`.
35. Pause automatic periodic background sync while the device reports offline (`navigator.onLine === false`) or on metered connections.
    Priority 81% (High value) [Best practices]. What: add an optional "Pause
    automatic sync on metered / mobile-hotspot networks" toggle in
    `SyncScheduleCard.svelte` using `navigator.connection?.saveData` /
    `navigator.onLine`, and automatically resume once connectivity returns. Why:
    prevents wasted wakeups, battery drain, and failed-sync error badges on laptops
    tethered to mobile data or temporarily offline. How: check `navigator.onLine`
    and `navigator.connection?.saveData` before periodic alarm runs in
    `sync-engine-registration.ts` and listen to `online` events to trigger a single
    catch-up sync.
36. Add configurable debounce delay (`3s`, `15s`, `60s`) for "Sync automatically after local edits".
    Priority 69% (Nice to have) [Professionalism]. What: let power users who reorder
    or curate playlists heavily choose a `15s` or `60s` batching window instead of
    the fixed `3s` post-edit delay. Why: coalesces rapid multi-video drag-and-drop
    edits into a single encrypted relay push, saving bandwidth and relay rate-limit
    tokens. How: add `autoSyncDebounceSeconds?: number` (`3 | 15 | 60`, default `3`)
    to `SyncConfig` and read it when scheduling `debounceTimer` in
    `sync-engine-registration.ts`.
37. Add a temporary "Snooze automatic sync for 1 hour" quick action in the header `SyncStatusIndicator`.
    Priority 62% (Nice to have) [Professionalism]. What: let users temporarily pause
    background sync for 1 hour during bulk playlist imports or cleanup without
    losing their saved `Sync Frequency` schedule. Why: avoids partial mid-cleanup
    pushes without forcing users to switch to `Manual only` and remember to turn
    their schedule back on later. How: store `snoozeUntil?: number` in `SyncConfig`,
    skip automatic runs while `Date.now() < snoozeUntil`, and arm a one-shot
    `browser.alarms` wakeup at `snoozeUntil`.
38. Enforce strict bounds validation on `autoSyncOnChange` / `syncIntervalMinutes` inside `saveSyncConfig`.
    Priority 57% (Nice to have) [Security]. What: run `clampSyncIntervalMinutes`
    inside `saveSyncConfig()` on write (in addition to `migrateSyncConfig()` on
    read) so malformed or tampered DevTools writes can never pass `NaN` or `< 1`
    fractional values to `browser.alarms.create`. Why: guarantees Chrome and Firefox
    never throw or silently clamp sub-minute alarm periods if config is mutated
    outside `SyncScheduleCard.svelte`. How: normalize `plain.syncIntervalMinutes = clampSyncIntervalMinutes(plain.syncIntervalMinutes)`
    before `storageArea().set(KEY, plain)` in `sync-config.ts`.
39. Add a Playwright interaction test for `SyncScheduleCard.svelte` preset + custom duration switching.
    Priority 75% (High value) [Best practices]. What: extend `verify-extension.js`
    to click `Manual only`, enter a custom `2 Hours` interval, click `Set`, and
    assert `yph_sync_config.syncIntervalMinutes === 120` and active alarm creation
    in Chromium. Why: guards the live UI-to-service-worker alarm bridge end-to-end
    beyond unit tests. How: add a `#/sync` interaction step in
    `packages/build-tools/verify-extension.js` asserting both storage persistence
    and `chrome.alarms.get("yph-sync-periodic")`.

## Done

1. Fix the 5 pre-existing Prettier formatting violations so `npm run check`
   passes cleanly. [done] 2026-11-04
2. Update PRIVACY_POLICY.md to state the extension makes no GitHub API call.
   [done] 2026-11-04
3. Resolve the SyncHero.svelte 353-line file-size gate (limit 350). [done]
   2026-11-05
