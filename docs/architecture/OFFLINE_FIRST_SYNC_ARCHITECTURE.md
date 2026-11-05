# Offline-First Sync Architecture & Transition Spec

This document details the transition from direct live-API manipulation to a resilient local-first, offline-first storage and synchronization model for the YouTube Playlist Helper.

---

## 1. Architectural Principles

1. **Local-First Authority**:
   - The user's device (`browser.storage.local` and IndexedDB via `idb-keyval`) is the immediate source of truth for all UI operations.
   - Any create, edit, reorder, or delete operation commits to local storage first, enabling instant UI response with 0ms network latency.

2. **Decoupled Synchronization**:
   - Synchronization with remote targets (YouTube Data API or Encrypted Supabase Relay) occurs asynchronously via a durable mutation queue.
   - Offline actions are queued and replayed once network or quota availability is restored.

3. **Quota-Aware Rate Limiting**:
   - YouTube Data API operates under a strict daily quota (10,000 units/day).
   - Video additions cost 50 units; deletions cost 50 units. Diff calculations ensure only delta operations are dispatched.

---

## 2. Component Roles

| Component            | Responsibility                                                          |
| -------------------- | ----------------------------------------------------------------------- |
| `storage-service.ts` | Local persistence layer, snapshot creation, and migration abstractions. |
| `sync-engine.ts`     | Orchestrates delta computation, queue drain, and remote write-back.     |
| `sync-schedule.ts`   | Alarms and event listeners for idle-time and throttled sync triggers.   |
| `youtube-auth.ts`    | Handles OAuth token lifecycle and classified error detection.           |

---

## 3. Error Classification & Recovery

Authentication and network interactions are categorized to prevent endless retry loops:

- `login_cancelled`: User closed the auth dialog without completing sign-in. Treated as silent no-op.
- `verification_required`: Unverified OAuth app limit reached. Surfaces guidance linking to Google Cloud Console consent configuration.
- `invalid_credentials` / `token_expired`: Discards cached access tokens and prompts re-authentication.
- `quota_exceeded`: Trips the Quota Shield, halting automated queue execution until quota window reset.

---

## 4. Conflict Resolution Strategy

- **Local vs Remote Diffs**: A 3-way merge model compares base snapshot, current local state, and remote playlist contents.
- **Active Editing Safety**: Background sync yields immediately if user interaction is detected on the active playlist view to prevent state races.
