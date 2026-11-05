# Multi-Device Sync Verification Checklist

Run this checklist on real devices after the hosted migration (0002 + 0003) is applied.
Use the same sync key on all devices. Test with Chrome, Firefox Desktop, and Firefox for Android (Fenix).

## Prerequisites

- [ ] Hosted migration 0002 + 0003 applied (run `scripts/verify-hosted-relay.sh` → all pass)
- [ ] Extension installed on Device A (Chrome), Device B (Firefox), Device C (Fenix)
- [ ] Same 20-char sync key configured on all devices
- [ ] `npm run build` + packed ZIP installed (not dev mode)

## Test Matrix

### 1. Basic round-trip

- [ ] Device A: Add playlist "Test A" with 3 videos → Sync now
- [ ] Device B: Sync now → "Test A" appears with 3 videos
- [ ] Device B: Add video to "Test A" → Sync now
- [ ] Device A: Sync now → new video appears
- [ ] Verify fingerprint matches on both devices (Sync → Key card)

### 2. Offline → retry

- [ ] Device A: Go offline (airplane mode or disable network)
- [ ] Device A: Edit playlist (add video) → Sync now → should show "offline" or "error" status
- [ ] Device A: Go online → Sync now → edit syncs to Device B
- [ ] Verify no data loss (all edits present on both devices)

### 3. Concurrent edits (conflict resolution)

- [ ] Device A + B: Both offline
- [ ] Device A: Rename playlist to "Renamed by A"
- [ ] Device B: Rename playlist to "Renamed by B"
- [ ] Both go online → Sync both
- [ ] Verify: one name wins (LWW), no crash, no data corruption
- [ ] Check Sync view → Activity log shows conflict resolution

### 4. Deletion tombstones

- [ ] Device A: Delete a video from a playlist → Sync now
- [ ] Device B: Sync now → video removed
- [ ] Device B: Verify video doesn't reappear on next sync
- [ ] Device A: Delete entire playlist → Sync now
- [ ] Device B: Sync now → playlist removed (tombstone applied)

### 5. Service worker restart

- [ ] Device A: Sync now (ensure sync in progress)
- [ ] Device A: Kill service worker (chrome://serviceworker-internals or about:debugging)
- [ ] Device A: Reopen extension → Sync status should recover (not stuck in "syncing")
- [ ] Device A: Sync now → completes successfully
- [ ] Verify lastSeq persisted (no full re-sync)

### 6. Key rotation

- [ ] Device A: Rotate sync key (Sync → Advanced → Rotate key)
- [ ] Device A: Verify new key shown, old space deleted
- [ ] Device B: Update to new key → Sync now → all data present
- [ ] Verify old key no longer works (sync with old key fails)

### 7. Disabled collections

- [ ] Device A: Disable "History" sync in settings
- [ ] Device A: Watch a video (adds to history)
- [ ] Device A: Sync now → history NOT uploaded
- [ ] Device B: Sync now → Device A's history change not reflected
- [ ] Re-enable history → Sync → history syncs

### 8. Android (Fenix) specific

- [ ] Fenix: Full-screen popup mode works (no 420px width)
- [ ] Fenix: Watch history records correctly (m.youtube.com)
- [ ] Fenix: Sync works in background (alarm fires)
- [ ] Fenix: No crashes on service worker restart

## Pass/Fail Criteria

- All items checked ✅ → relay is ready for public release
- Any item fails → document the failure, fix, re-test
- Performance: sync of 50 playlists × 100 videos completes in < 30s on 3G

## After completion

- Update `docs/SYNC_V2_STATUS.md` with "Manual device verification: PASSED"
- Update `.ai-sync/PROGRESS.md` to mark multi-device gate as done
- Consider merging next → main for release
