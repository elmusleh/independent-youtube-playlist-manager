# Sync v2 review — `feat/sync-hardening` (pinned at `8aed191`)

Scope: deep review of the encrypted cross-device sync v2 work on this branch
(40+ commits ahead of `origin/next`, open PR #88). Read-only with respect to the
repo: no product code was changed. Evidence harness lives outside the repo at
`~/.hermes/cache/scratch/iypm-sync-audit/`.

## Verdict

**Do not ship or merge v2 in its current state.** The relay SQL is sound at the
access-control level, and the crypto primitives are well built, but the engine
that ties them together is not wired correctly. The most serious problems:

1. Uploaded playlists and watch history are **plaintext** while the privacy policy
   says they are encrypted (a false public claim).
2. The background engine **never syncs** (configuration read is broken), so nothing
   the user sees as "sync works" is backed by the v2 engine.
3. When it is fixed, the engine **loops** (one sync → four runs in 12 s, forever).
4. Playlist sync **cannot push** real playlists (ISO-timestamp version rejected by
   the database), and one bad record fails the whole batch.
5. A routine sync pass **wipes local watch history** (adapter reads the wrong store).
6. Edits to already-synced records **never reach** devices that already pulled them.

Items marked **Proven** were confirmed by running the real code against a real
Postgres 16 and PostgREST (or the real adapters/engine under vitest). Items with no
label are **static** findings from code reading and grep, not executed; treat them as
strong leads to verify, not settled facts.

## Evidence method

- Pinned analysis to committed HEAD `8aed191` via `git archive` (the branch moved
  three times during the review; a concurrent session is committing).
- Real relay SQL (`docs/sync-relay-v2.sql`) applied to Postgres 16.15.
- Served by PostgREST with a signed anon JWT, the same shape Supabase uses.
- Real `relay-transport.ts` client called against it (`e2e-relay.test.ts`).
- Real playlists / history / settings / devices adapters and the real
  `sync-engine.ts` run under vitest with `fake-indexeddb` and a mocked browser API.
- Every bug check is `it.fails` and carries a _guard_ that proves the failing path
  actually executed. A bug only counts when its guard passes.
- Final stable run: 2 consecutive runs, 6 files, 4 tests pass (3 controls plus the
  loop-attribution test), 10 known-bug checks reproduce, identical both times.

## Findings (severity order)

### CRITICAL

**C1. Plaintext upload contradicts the privacy policy.** _Proven._
The adapters send `JSON.stringify(...)` directly. `encryptRecord`/`decryptRecord`
exist in `record-codec.ts` and are tested, but have **zero production callers**.
Captured wire payload for one playlist:
`{"id":"local-1","title":"SECRET-PLAYLIST-NAME","videos":["abc123def45"],...}`.
`docs/PRIVACY_POLICY.md` line 46 states the data is "encrypted on-device with
AES-256-GCM before upload… No plaintext data leaves your device." The relay schema
also documents `payload` as "AES-256-GCM ciphertext". This is the single most
important item: it is a false public claim about user data.
_Fix:_ call `encryptRecord` in each adapter before `RelayRecord.payload`, and
decrypt on the pull side. Add a test that fails if plaintext title appears on the
wire (the BUG-7 check already does this).

**C2. The background v2 engine never runs.** _Proven._
`sync-engine.ts` `runOnce` calls `storage.get("yph_sync_config")` on the raw
`browser.storage.local`, which returns `{ yph_sync_config: {...} }`. So `cfg.syncKey`
is always `undefined`, and every run returns "Offline mode (sync disabled)" with
**zero network calls**, even for a fully configured device. The same file's
`persistStatus()` correctly uses a wrapped `getStorage()`, so the inconsistency is
local and easy to miss. _Fix:_ one line: read the keyed value (the scratch fix
used for the loop measurement, `audit/fixed-engine/sync-engine.ts`, shows the exact
change). Use the wrapped storage helper everywhere.

**C3. Edits to already-pulled records are invisible.** _Proven._
`sync_records.seq` is a `generated always as identity`. The `sync_push` UPDATE
branch does not reassign `seq`, so an updated record keeps its original cursor.
A device with `lastSeq` past the first insert never sees a later edit. Measured:
`edit visible to cursor 14 -> []`. Consequence: two devices silently diverge after
the first sync. _Fix:_ in `sync_push`'s update path set `seq = nextval(...)`, or
keep a separate monotonic `change_seq` column updated on every write.

**C4. Playlists cannot be pushed at all (ISO version).** _Proven, end-to-end._
`adapters/playlists.ts` sends `version: p.updatedAt`. Real playlists store
`updatedAt` as an ISO string (`library-mutations.js:172`). The SQL casts `version`
to `bigint`, so the RPC returns `22P02 invalid input syntax for type bigint`. The
real `relay-transport` surfaces that error on the exact wire record. _Fix:_ send a
numeric HLC (or `Date.parse(updatedAt)`), and make `sync_push` validate and reject
per-record instead of raising for the whole batch.

### HIGH

**H1. One bad record blocks the whole batch.** _Proven._ A single bad `version` in
`sync_push` raises an exception, so the transaction rolls back. The good records in
the same call (settings, in the test) are not stored: `records stored after batch: 0`.
_Fix:_ validate each record in the loop, return `status:"error"` per record, never
raise for one record.

**H2. Local watch history is wiped on routine sync.** _Proven at adapter level,
mechanism confirmed in code._
The history adapter's local view comes from `getSyncSnapshot("history")`, which
reads `yph_sync_snapshots`. That key is **never written anywhere**, and it returns
`string[]`, not a history map. So local history is always empty, and the adapter
persists the merge result (`[]` when nothing is remote) into `local_yt_history`
unconditionally on every pass. Measured: 2 local entries in, `persisted after: 0`.
This is the most destructive finding for the user. _Fix:_ read the real
`local_yt_history` object; never write history when the merge has fewer entries than
local without an explicit delete; add a guard test.

**H3. The engine re-triggers itself forever.** _Proven (measured)._ `onChanged`
does not filter `yph_sync_status`, and `runOnce` writes that key. Measured with C2
fixed: one user sync → 4 runs in 12 s, attributed by storage key to
`yph_sync_status` every time (`loop-mechanism.test.ts`). Fix: ignore changes to
`yph_sync_status` (and `yph_sync_config` where appropriate) in the listener, or
move status to a non-watched key.

**H4. A failed local apply is recorded as synced (silent loss).** _Proven._
`applyRemotePlaylists` records a `failed` entry when `mutateLibrary` throws, but it
still writes the shadow base for the **merged** records, and `runOnce` still
advances `lastSeq`. So the remote edit is never re-pulled. Test: `data-loss.test.ts`.
Fix: write shadow and advance the cursor only for records that actually applied.

**H5. `mutateLibrary` is never reachable from the engine.** _Proven in code._
The adapter prefers `window.mutateLibrary`, which is **never assigned** in source.
Its fallback sends `runtime.sendMessage({cmd:"mutate-library"})`, but
`library-mutations.js` only exposes `globalThis.yphMutateLibrary` and registers the
`onMessage` handler for the UI. Inside the worker, the engine has no working write
path to the library. _Fix:_ call `yphMutateLibrary` directly from the engine (it is
in the same worker), and delete the message fallback.

### MEDIUM

**M1. The realtime nudge is half-built.** _Static (grep)._ `broadcastSyncNudge` exists but has **no
callers**, so devices never notify each other; they only listen. The Realtime
subscription is therefore dead weight for now. _Fix:_ call it after a successful
push, or drop the feature until it is wired.

**M2. Version semantics are not causal.** Settings use `Date.now()`, devices use
`lastSeen = Date.now()`, history uses `lastWatchedAt`. The HLC module
(`hlc.ts`, tuple ordering, well tested) is **dead code** outside its own tests. A
device with a fast clock or a far-future version can freeze a record for others
(BUG-4 reproduced: honest push returns `conflict`). _Fix:_ wire HLC into record
versions; it already exists.

**M3. Devices are re-pushed every run.** _Static._ `devices` uses `lastSeen = Date.now()`, so
`isDirty` is always true and every sync re-uploads the device record. Minor cost,
but it also makes "nothing changed" never true. _Fix:_ only bump `lastSeen` at a
coarse interval (e.g., hourly).

**M4. No payload cap in the database.** _Proven._ A 5 MB record was accepted
(BUG-5). The client documents a 150 KB limit that nothing enforces. A malicious or
buggy client can fill storage. _Fix:_ a `check (octet_length(payload) <= 200000)`
constraint plus a client-side guard.

**M5. Anyone can create unlimited spaces.** _Proven._ Anon `sync_claim` created 500
spaces with no rate limit or quota (`T9`). With no cost guard this is an abuse and
cost vector on your hosted project. _Fix:_ a per-IP or per-space quota, or require a
proof-of-work/captcha on first claim, plus a periodic cleanup of unclaimed spaces.

**M6. Pairing link puts the sync key in the URL.** `#/sync?join=<key>` lands in
browser history and any screenshot of the address bar. The key is the only
credential. _Fix:_ clear the hash immediately after import (it does
`history.replaceState`, which is good), and warn the user not to share the link
publicly. Consider a QR-only flow for the phone case.

### PROCESS / GOVERNANCE

**P1. The green suite is what let these ship.** `vitest` on `services/sync` passes
109/109 across 17 files, and lint has 0 errors. Yet **none** of the engine,
adapters, `relay-transport`, `rotate-key`, `realtime-nudge` or `status-store` have a
test file (verified). The existing tests cover pure helpers. The gate is green for
the wrong reason. _Fix:_ a real integration test that runs `runOnce` end-to-end
against `fake-relay`, plus the audit's E2E harness promoted into the repo.

**P2. Two sync engines are live at once.** _Static (grep, call-graph read)._ The UI calls v1 (`sync-manager.ts`,
`performSync`, `triggerSyncNow`, `pullNow`), which uses the **dropped**
`relay_snapshots` table, while the v2 engine is wired to alarms but is never driven
by the UI. The `sync-now` message is only handled by the SW and is never sent by the
UI. Result: the user-visible "Sync now" uses the broken v1 path. _Fix:_ point the UI
at the v2 engine (`runOnce` via message), and delete v1 (`sync-manager.ts`,
`encrypted-sync-service.ts`, `file-sync-service.ts`) in the same PR.

**P3. v1 is broken in production.** _Proven (live read-only probe)._ `relay_snapshots`
returns HTTP 404 `PGRST205` from the live project. Any user on the v1 path fails on
every sync. Key rotation also goes through v1 `upload()` to `relay_snapshots`, so it
fails at the first write, before the config is saved. Nothing is lost, but rotation
does not work either. _Static._

**P4. File-size gate allowlisting.** `sync-manager.ts` (448 lines) and `Sync.svelte`
were **added to the allowlist** in this branch. `AGENTS.md` says "No file over 350
lines unless allowlisted" _and_ "split instead" (the golden rule). Adding allowlist
entries is the exact anti-pattern the project forbids. _Fix:_ delete `sync-manager.ts`
with v1 (P2); split `Sync.svelte` (364 lines) below 350.

**P5. Docs overstate the state.** `SYNC_V2_STATUS.md` says "Nothing — all phases
(0–5) and backend ops are complete" and "relay v2 SQL applied… all verified." The
live probe confirms the v2 RPCs exist and the v1 table is gone, which is consistent.
But the engine is not functional (C2) and the data is not encrypted (C1), so the
"complete" wording is not supported. `PROGRESS.md` and `HANDOFF.md` repeat it.
_Fix:_ mark v2 as "schema deployed; engine not functional" until C1–C4 pass.

**P6. Parts of the design are dead code.** HLC (M2), `encryptRecord` (C1),
`broadcastSyncNudge` (M1) and `mutateLibrary` (H5) all exist, are tested or typed,
and are not on the real path. This is the pattern behind most of the findings:
modules were built and unit-tested in isolation, then never connected.

## What is working (keep it)

- **Key derivation / access control design is sound.** HKDF-separated keys, a
  one-way storage address, an HMAC auth token, and RLS with `revoke all` for anon.
  Wrong-auth pulls are rejected (`unauthorized`), and a claimed space cannot be
  taken over by a different auth hash (`T10`, control test).
- **The SQL is idempotent and safely uses `security definer` with `search_path`.**
  It applied cleanly to Postgres 16 on the first try.
- **Crypto primitives are well tested** (`record-codec` tamper, wrong-key, AAD
  slot-confusion tests; `hlc`, `shadow-store`, `keys` tests). The problem is wiring,
  not the primitives.
- **Pairing link and fingerprint verification** are thoughtful UX for key transfer.
- **Lint and file-size gates are green for the sync code** (0 lint errors).

## Recommended plan (ordered)

Do these in order. Each step ends with a verifiable check.

1. **Stop the bleeding (today).** Do not promote or describe v2 as working. Either
   keep it behind a dev flag, or leave v1 as the user-facing path only until C1 is
   fixed. Correct the privacy-policy sentence **before** any release, because it is
   currently false. _Check:_ the privacy text matches what the code does.
2. **Make the engine real (fix C2, H5, H3).** Read keyed config, call
   `yphMutateLibrary` directly, ignore `yph_sync_status` in the listener.
   _Check:_ the loop-mechanism test shows one run per user change, and the
   loop-after-fix test passes.
3. **Make it correct on the wire (fix C4, H1, C3, M4).** Numeric HLC versions,
   per-record validation in `sync_push`, a monotonic `change_seq`, payload size
   constraint. _Check:_ e2e-relay BUG-1/2/3/5 flip green.
4. **Make it private (fix C1).** Encrypt in the adapters, decrypt on pull, add the
   plaintext-on-wire regression test. _Check:_ BUG-7 and BUG-7b flip green, and the
   wire payload dump shows ciphertext only.
5. **Stop data loss (fix H2, H4).** Read real history, guard destructive writes,
   advance the cursor only for applied records. _Check:_ BUG-9 and BUG-10 flip green.
6. **Retire v1 (P2, P3, P4).** Delete `sync-manager.ts` and the v1 services, point
   "Sync now" at v2, fix rotate-key to the v2 RPCs. _Check:_ no reference to
   `relay_snapshots` remains (`grep`), and the file-size allowlist shrinks.
7. **Put the audit into the repo (P1).** Promote the Postgres/PostgREST E2E and the
   engine guards into the test suite (or a dedicated `test:sync-integration` gate) so
   a regression of any of the 10 findings fails CI.
8. **Then** decide on the optional items (M1 nudge, M2 HLC, M5 quota, M6 QR pairing).

The fastest safe path is: steps 1 → 2 → 3 → 4 in one focused branch with the
audit tests as the acceptance gate, then steps 5–7 as separate reviewed commits.

## Reproduce

```bash
# start real backend (scratch only; does not touch the repo)
docker network create iypm-audit-net
docker run -d --name iypm-audit-pg --network iypm-audit-net -e POSTGRES_PASSWORD=audit \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
docker cp docs/sync-relay-v2.sql iypm-audit-pg:/tmp/relay.sql
docker exec iypm-audit-pg psql -U postgres -c "create role anon nologin; grant usage on schema public to anon;"
docker exec iypm-audit-pg psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/relay.sql
docker run -d --name iypm-audit-rest --network iypm-audit-net -p 127.0.0.1:3311:3000 \
  -e PGRST_DB_URI="postgres://postgres:audit@iypm-audit-pg:5432/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="audit-local-jwt-secret-0123456789abcdef0123456789" postgrest/postgrest:latest
# then, in the scratch harness:
node_modules/.bin/vitest run --config audit.config.mjs audit/
```

Expected: controls pass; each `it.fails` bug check passes (= bug reproduced); the
loop test is red by design until H3 is fixed.

## Not verified (honest limits)

- No real browser / real Chrome or Firefox runtime: the SW was exercised with a
  mocked `browser` API, not a live extension. Device-level behaviour (Firefox
  Android, real `storage.onChanged` ordering) is unverified.
- The live Supabase project was probed read-only (GET, and an intentionally
  invalid RPC call). No data was written to the hosted project.
- Rotate-key and the realtime path were reviewed statically, not executed.
- The Edge/Chrome/Firefox packages were not rebuilt for this review.
- Open PR #88 was noted, not reviewed line-by-line against this HEAD.
