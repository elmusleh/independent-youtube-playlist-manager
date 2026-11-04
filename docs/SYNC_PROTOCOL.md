# Sync Protocol v2

## Overview

The sync system uses a relay-based architecture where multiple devices
share encrypted data through a Supabase/PostgREST backend. Each device
has a unique identity and syncs through a shared "space" identified by
a 64-hex-character space ID and a 64-hex-character auth hash.

## Architecture

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Device A │     │ Device B │     │ Device C │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
              ┌──────┴──────┐
              │   Relay     │
              │ (PostgREST) │
              └─────────────┘
```

## Data Flow

### 1. Claim Space
Device calls `sync_claim(space, auth_hash)` to register. If the space
doesn't exist, it's created. If it exists, the auth hash must match.

### 2. Pull
Device calls `sync_pull(space, auth_hash, since_seq, limit)` to get
records with `seq > since_seq`. Returns up to `limit` records ordered
by `seq`.

### 3. Push
Device calls `sync_push(space, auth_hash, records)` to upload dirty
records. Each record has:
- `collection`: "playlists" | "history" | "settings" | "devices"
- `rid`: unique record ID within the collection
- `version`: HLC timestamp (numeric)
- `payload`: encrypted envelope (AES-256-GCM)
- `deleted`: soft-delete flag

### 4. Cursor Advancement
After a successful pull+apply, the device advances `lastSeq` to the
max `seq` of applied records. On failure, `lastSeq` stays unchanged
so failed records are re-pulled.

## Encryption

All payloads are encrypted client-side using AES-256-GCM before upload.
The relay stores only opaque ciphertext. The encryption key is derived
from the sync key using HKDF-SHA256.

### Envelope Format
```json
{
  "v": 2,
  "collection": "playlists",
  "id": "<record-id>",
  "hlc": 1700000000000,
  "deleted": false,
  "data": { ... }
}
```

The envelope is then encrypted:
```json
{
  "v": 2,
  "collection": "playlists",
  "id": "<record-id>",
  "nonce": "<base64>",
  "ciphertext": "<base64>"
}
```

## Versioning (HLC)

Versions use Hybrid Logical Clocks (HLC) to handle clock skew and
same-millisecond collisions. Each record gets a monotonically increasing
HLC value within a sync cycle. HLCs are shared across adapters within
a single sync run for global monotonicity.

## Conflict Resolution

Last-Write-Wins (LWW) based on HLC version. The record with the higher
version wins. The server rejects pushes with versions older than the
stored version.

## Rate Limiting

Per-space rate limiting: 100 requests per minute per space. Exceeding
this returns HTTP 429.

## Payload Limits

- Client-side guard: 150,000 bytes per record
- Server-side cap: 200,000 bytes per record
- Far-future version cap: 24 hours

## Space Limits

- Maximum 100,000 spaces per relay instance
- Claim returns error when cap is reached

## Auth

Authentication uses a 64-hex-character auth hash derived from the sync
key via SHA-256(HMAC(syncKey, "auth")). The hash is stored in the
relay and compared on every request.

## Realtime Nudge

After a successful push, the device broadcasts a Realtime message to
notify peers. Peers receiving the nudge trigger an immediate sync.
The nudge contains no data — just a signal.
