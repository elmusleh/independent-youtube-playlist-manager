# Design

## Context

The extension already owns: a portable full-database backup payload
(`backup-service.ts`, schemaVersion 2), an archived-thumbnail store
(`thumbnail-archive.ts`), a settings store (`storage-service.ts`), a Google OAuth flow
(`youtube-auth.ts`), a consent gate (`utils/data-consent.ts`) and an unwired plaintext
Supabase delta engine (`supabase-client.ts`, `supabase-sync.ts`). The SPA is Svelte 5 +
TypeScript + Rollup; shared CSS must be imported in `main.ts`; no file may exceed 350
lines; background logic lives in the MV3 service worker (Firefox Android has no
`chrome.identity` OAuth popup). See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- A sync engine that is backend-agnostic, testable without network, and composed of
  single-responsibility services (SOLID, below).
- Zero-knowledge: the sync key is the only credential; payloads are encrypted before
  they leave the device; no PII is ever transmitted.
- Comfortable operation: automatic debounced push, startup pull, manual "Sync now",
  and a local pre-import backup so no sync action can destroy data.

**Non-Goals:**

- No live/continuous delta sync, no per-record conflict UI, no multi-user sharing.
- No video/audio content download or storage (ToS risk and storage blow-up).
- No changes to the web portal, manifests, permissions or release process.

## Decisions

### D1 — Encrypted whole-state snapshot instead of live delta sync

The sync unit is an encrypted snapshot of the selected data categories, not the
per-record LWW delta engine already in `supabase-sync.ts`.

- **Rationale:** zero-knowledge is achievable only when the plaintext never leaves the
  device; whole-state snapshots make conflicts trivial (one monotonic revision);
  personal-scale data is small; the existing delta engine is unwired and plaintext.
- **Alternative:** continue with plaintext delta sync — rejected: email auth, server
  sees data, per-record merge complexity, custodian liability.
- **Consequence:** merge is coarse (newer snapshot wins). The pre-import backup is the
  safety net that makes coarse merge acceptable.

### D2 — Sync key is the only credential; no email, no recovery

Identity, storage addressing and encryption are all derived from one secret the user
writes down (Mullvad-style). Lost key = unrecoverable data, disclosed up front.

- **Alternative:** email/password with recovery — rejected by owner: reintroduces the
  custodian role and PII.

### D3 — Key derivation: WebCrypto PBKDF2-SHA256 + SHA-256, zero new dependencies

`PBKDF2-SHA256(syncKey, salt, high iterations)` → AES-256-GCM key; a second
domain-separated `SHA-256` derivation → the storage address. Both via `crypto.subtle`
(no `@noble/hashes` dependency in v1).

- **Alternative:** scrypt/Argon2 via `@noble/hashes` — stronger memory-hardness, but a
  new dependency; documented as a later upgrade without changing the spec.

### D4 — Storage address = one-way hash, not backend accounts

Backends address the snapshot by `sync/<hex(hash)>` (Supabase object path, Drive file
name). No Supabase anonymous auth, no user row.

- **Rationale:** anonymous auth mints a random user id that cannot be recovered from
  the sync key on a second device; the hash keeps "sync key is the only credential"
  pure and makes all backends behave identically. Confidentiality comes from
  encryption, not from path secrecy.

### D5 — Backend contract (3 methods) + metadata descriptor

`SyncBackend` interface: `getRevision(): Promise<number|null>`,
`getLatest(): Promise<EncryptedSnapshot|null>`, `put(snapshot: EncryptedSnapshot):
Promise<void>`. Each backend also exports a `SyncBackendDescriptor` (id, label, setup
fields, consent key) that the Plugins screen renders generically.

- **Rationale:** OCP — a new backend is one new file plus registry entry; the engine
  never changes. LSP — the engine treats every backend interchangeably.

### D6 — Version guard before write

Before `put`, re-read `getRevision()` and refuse to overwrite a newer remote revision
(compare-and-swap semantics). Two devices racing on the same snapshot cannot silently
clobber each other.

### D7 — Automatic triggers

Debounced push (~30s after last local change), pull on SPA startup, manual "Sync now",
optional daily alarm. Crypto and network run in the SPA page context (WebCrypto is
reliably available there, including Firefox Android); the service worker only schedules
alarms. No realtime subscription.

### D8 — Pre-import backup

Before applying any remote snapshot, the current local payload is written to a dated
local backup slot (reusing the backup payload shape). Failed imports leave local state
intact; the Data Manager can restore from the slot.

### D9 — SOLID module map

All new code under `src/services/sync/` plus two UI additions:

| Module                         | Responsibility (SRP)                                          | Notes                                                                        |
| ------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `sync-key.ts`                  | generate/validate/format the sync key                         | no crypto, no storage                                                        |
| `key-derivation.ts`            | PBKDF2 encryption key + SHA-256 storage address               | pure functions, injectable                                                   |
| `snapshot-codec.ts`            | payload ↔ bytes; schemaVersion, revision, deviceId, updatedAt | extends backup payload                                                       |
| `encryption-service.ts`        | AES-256-GCM encrypt/decrypt                                   | depends on injected key                                                      |
| `content-selector.ts`          | build payload from selected categories                        | OCP: categories extend                                                       |
| `sync-backend.ts`              | `SyncBackend` + `SyncBackendDescriptor` types (ISP)           | the seam                                                                     |
| `backends/file-backend.ts`     | file export/import                                            | reuses backup flow                                                           |
| `backends/supabase-backend.ts` | BYO Storage bucket, CAS revision guard                        | unwired client is replaced                                                   |
| `backends/drive-backend.ts`    | `appDataFolder` via Google OAuth                              | reuses `youtube-auth.ts`                                                     |
| `sync-engine.ts`               | orchestrate triggers, conflict policy, pre-import backup      | DIP: depends on `SyncBackend` + injected crypto/codec/clock, not concretions |
| `sync-settings.ts`             | settings keys, backend configs, content toggles               | reuses settings store                                                        |
| `views/Plugins.svelte`         | module registry + backend picker + sync status                | renders `SyncBackendDescriptor`s                                             |

- **DIP:** `sync-engine.ts` receives `SyncBackend`, codec, crypto and a clock through
  its constructor; tests inject fakes — no network, no real storage.
- **ISP:** `SyncBackend` stays at three methods; crypto, addressing and selection are
  separate small interfaces, not one god-service.
- **SRP:** key handling, derivation, serialization, encryption, storage and
  orchestration each live in one module with one reason to change.

### D10 — Module registry backs the Plugins screen

A declarative registry of modules (`api-setup`, `data-manager`, and one entry per sync
backend) with `{ id, label, description, icon, defaultEnabled, setupView? }`. Toggles
persist through the existing settings store; nav rendering and the `svelte-spa-router`
guard consult the registry. This replaces the ad-hoc `settings.enableX` checks for the
new modules only; existing YouTube feature flags are not migrated in this change.

### D11 — Consent and settings

Enabling any cloud backend first runs the existing `data-consent` gate for account data;
disabling revokes traffic. Supabase live credentials live in the settings store
(user's own keys, clearly labeled as such).

## Risks / Trade-offs

- **Lost sync key = permanent data loss** → disclosed at generation; file backend can
  export the encrypted snapshot as a secondary copy the user controls.
- **Concurrent multi-device edits clobber** → CAS version guard + LWW + pre-import
  backup.
- **Crypto availability on Firefox Android / MV3 worker** → crypto runs in SPA context;
  worker only schedules; test matrix includes Firefox Android.
- **Drive `appDataFolder` size limit (~1 GB)** → size guard before upload with a clear
  warning; thumbnails are optional.
- **BYO Supabase friction for non-experts** → one-click deploy button + migration file
  in `supabase/migrations/`.
- **Honest privacy claims** → backends still see timing/IP/size metadata; UI copy
  promises only "contents are encrypted", never "no metadata".
- **Legacy plaintext engine drift** → retired only after new engine acceptance; until
  then both remain unwired from UI.

## Migration Plan

1. Land sync core + file backend (no network) behind module toggles, default off.
2. Land Supabase BYO backend; add `supabase/migrations/` + deploy instructions.
3. Land Drive backend reusing the Google OAuth client.
4. After acceptance: remove unwired `supabase-sync.ts`/`supabase-client.ts` in a
   dedicated cleanup task.
5. Rollback at any stage = disable the module; local data is never migrated or touched.

## Open Questions

None that would change the specs or the task breakdown. Deferrable details (PBKDF2
iteration count, Drive file layout) are implementation choices recorded in tasks.
