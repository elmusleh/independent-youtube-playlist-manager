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
11. Pre-pull local snapshot safety backup before first sync into a non-empty space.
    Priority 92% (Critical) [Security]. What: automatically save a one-slot local
    recovery snapshot in IndexedDB right before a newly paired browser pulls and
    merges records from an existing sync space for the first time. Why: protects a
    user's local playlists and watch history with a one-click local rollback if they
    paste the wrong sync key or pair an unintended profile. How: check when
    `lastSeq === 0` and remote pull count > 0 in `sync-engine.ts`, serialize current
    `playlists` + `local_yt_history` + syncable settings into an IndexedDB
    `yph_sync_pre_pair_backup` record, and expose a "Restore pre-sync backup" button
    in `SyncDangerZone.svelte`.
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

## Done

1. Fix the 5 pre-existing Prettier formatting violations so `npm run check`
   passes cleanly. [done] 2026-11-04
2. Update PRIVACY_POLICY.md to state the extension makes no GitHub API call.
   [done] 2026-11-04
3. Resolve the SyncHero.svelte 353-line file-size gate (limit 350). [done]
   2026-11-05
