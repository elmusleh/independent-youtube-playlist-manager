# Encrypted Cross-Device Sync — Plan

Status: **planning approved 2026-11-01; no code written yet.** Formal tracking lives in
`openspec/changes/add-encrypted-cross-device-sync/` (proposal, specs, design, tasks).

## Vision

A comfortable, automatic, daily-driver sync between devices (phone ↔ laptop) that is
zero-knowledge and privacy-first: a Mullvad-style **sync key** is the only credential,
payloads are **end-to-end encrypted** before they leave the device, and the project
stores no user data it can read. "Build it and forget it" — for the owner first, and as
a privacy selling point for everyone else.

## What we decided (2026-11-01 discussion)

| Decision        | Choice                                                             | Rejected alternative                                                 |
| --------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Sync unit       | Encrypted whole-state **snapshot** (monotonic revision)            | Live per-record delta sync (plaintext, complex, custodian liability) |
| Identity        | **Sync key only** — no email, no password, no recovery             | Email/password with reset                                            |
| Key loss        | Disclosed up front: **lose the key = lose the data**               | (none — owner requirement)                                           |
| Crypto          | WebCrypto AES-256-GCM + PBKDF2-SHA256; SHA-256 storage address     | scrypt/Argon2 (possible later upgrade)                               |
| Storage address | One-way hash of sync key; no PII anywhere                          | Supabase anonymous auth (unrecoverable user id)                      |
| Backends        | **File + Supabase (bring-your-own) + Google Drive** — all planned  | One fixed backend                                                    |
| Operation       | Automatic: debounced push, startup pull, manual "Sync now"         | Manual export/import per change (rejected: too much work)            |
| Conflicts       | Newer revision wins + automatic **pre-import local backup**        | Per-record merge UI                                                  |
| Sync contents   | Selectable: playlists, metadata, thumbnails, history, settings     | All-or-nothing                                                       |
| Features        | Module registry + **Plugins** screen; API Setup becomes toggleable | Ad-hoc per-feature flags                                             |
| Media           | Thumbnails in; **mp3/mp4 download out** (ToS + storage blow-up)    | —                                                                    |

## Architecture

```
sync key ──PBKDF2──► AES-256-GCM encryption key
   └─────SHA-256──► storage address (the "account"; no email, no PII)
                        │
        encrypted snapshot { revision, deviceId, updatedAt, payload }
                        │
      ┌─────────────────┼──────────────────┐
      ▼                 ▼                  ▼
 File backend      Supabase backend    Drive backend
 (manual, done)    (BYO URL + key,     (appDataFolder,
                   private bucket)     reuses Google login)
```

The engine is backend-agnostic: backends implement one 3-method interface
(`getRevision` / `getLatest` / `put`), so a new backend is a new file plus a registry
entry — the engine never changes.

## SOLID architecture

All new code under `src/services/sync/`, one responsibility per module:

| Module                                      | Responsibility                                  |
| ------------------------------------------- | ----------------------------------------------- |
| `sync-key.ts`                               | generate / validate / format the sync key       |
| `key-derivation.ts`                         | derive encryption key + storage address         |
| `snapshot-codec.ts`                         | payload ↔ bytes, revision/device/time envelope  |
| `encryption-service.ts`                     | AES-256-GCM encrypt / decrypt                   |
| `content-selector.ts`                       | build payload from selected categories          |
| `sync-backend.ts`                           | the `SyncBackend` interface + descriptor types  |
| `backends/{file,supabase,drive}-backend.ts` | one adapter each                                |
| `sync-engine.ts`                            | triggers, conflict policy, pre-import backup    |
| `sync-settings.ts`                          | settings keys, backend configs, content toggles |
| `views/Plugins.svelte`                      | module registry + backend picker + sync status  |

- **SRP** — key handling, derivation, serialization, encryption, storage and
  orchestration each live in one module with one reason to change.
- **OCP** — extend with new backends / content categories without touching the engine.
- **LSP** — the engine treats every backend interchangeably.
- **ISP** — `SyncBackend` stays at three methods; crypto and selection are separate
  small interfaces.
- **DIP** — `sync-engine.ts` depends on injected interfaces (backend, codec, crypto,
  clock); tests run with fakes — no network, no real storage.

## Phases

1. **Sync core + File backend** (no network): key, crypto, codec, engine, safety net —
   proves the full loop locally.
2. **Supabase bring-your-own backend**: migration in `supabase/migrations/`, one-click
   deploy, private bucket, revision-guarded writes.
3. **Google Drive backend**: `appDataFolder` via the existing Google OAuth, size guard.
4. **Plugins / Connections screen**: module toggles (API Setup, Data Manager, sync
   backends), backend picker, "Sync now", last-synced status, consent gates.
5. **Retirement**: after acceptance, remove the unwired plaintext
   `supabase-sync.ts` / `supabase-client.ts`.

Acceptance: `npm run check` + `npm run build` + `npm run test:extension` with recorded
exit codes (Hermes executes), plus a real two-device pass (phone ↔ laptop) and a
Firefox Android pass — see the change's `tasks.md`.

## Explicitly excluded

- mp3/mp4 downloads and any video/audio content storage.
- Multi-user sharing, realtime push, per-record conflict UI.
- Web-portal, manifest, permission and release changes.

## Links

- OpenSpec change: `openspec/changes/add-encrypted-cross-device-sync/`
- Current state and open tasks: `.ai-sync/HANDOFF.md`, `.ai-sync/PROGRESS.md`
- Related existing code: `backup-service.ts`, `thumbnail-archive.ts`,
  `youtube-auth.ts`, `data-consent.ts`, `packages/database/schema.sql`
