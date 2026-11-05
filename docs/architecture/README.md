# Architecture & Data Flow Overview

This document provides a comprehensive technical overview of the Independent YouTube Playlist Manager (IYPM) core architecture, data contracts, and background synchronization engine.

---

## 🏛️ System Architecture

IYPM is structured as an offline-first, client-driven application designed to operate across multiple browser engines (Chromium, Firefox Gecko) and mobile touchpoints.

```
┌─────────────────────────────────────────────────────────────────┐
│                          User Interface                         │
│  (Svelte 4 SPA: Manage, PlaylistEditor, Saved, Settings, Sync)  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ reads & mutations
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Storage & Cache Subsystem                    │
│   • browser.storage.local (settings, playlists, sync flags)     │
│   • IndexedDB via idb-keyval (yph:meta:<videoId> per-video cache)│
└──────────────┬──────────────────────────────────┬───────────────┘
               │                                  │
               ▼                                  ▼
┌───────────────────────────────┐  ┌───────────────────────────────┐
│   Sync Engine & Scheduler     │  │   Video Metadata Pipeline     │
│  • Mutation Queue             │  │  • Batch size 50 (parallel)   │
│  • 3-Way Delta Computation    │  │  • Adaptive backoff pacing    │
│  • Quota Shield & Throttling  │  │  • YouTube API / Invidious    │
└──────────────┬────────────────┘  └───────────────────────────────┘
               │
       ┌───────┴────────────────────────┐
       ▼                                ▼
┌───────────────────────────┐    ┌───────────────────────────┐
│   Remote YouTube API      │    │  Cross-Device Relay (v2)  │
│  • OAuth 2.0 PKCE flow    │    │  • End-to-end encrypted   │
│  • 10k daily quota limits │    │  • Pluggable backend      │
└───────────────────────────┘    └───────────────────────────┘
```

---

## 🔄 Core Components & Interactions

### 1. Storage & State Authority (`src/services/storage-service.ts`)

- **Authority**: The local client is always the immediate source of truth.
- **Transactions**: Playlist operations (create, update, reorder, delete) commit immediately to local storage and update Svelte stores to provide zero-latency user feedback.
- **Dirty Tracking**: Modified playlists are tagged with updated timestamps and dirty flags for background synchronization.

### 2. Automatic Handling & Sync Engine (`src/services/sync-engine.ts`, `sync-schedule.ts`)

- **Event-Driven Execution**: Listens for authentication changes, edit completions (after a quiet period), and periodic alarms.
- **Delta Minimization**: Avoids full-list re-uploads by calculating the minimum set of additions, removals, and reorder operations.
- **Quota Shield**: Tracks cumulative YouTube Data API cost (10,000 units/day ceiling) and suspends automated background calls when safety thresholds are reached.
- **Reference**: [`AUTOMATIC_HANDLING.md`](AUTOMATIC_HANDLING.md)

### 3. Local-First & Offline Resilience (`docs/architecture/OFFLINE_FIRST_SYNC_ARCHITECTURE.md`)

- **3-Way Merging**: Compares remote snapshot, base state, and local dirty mutations to reconcile edits made on multiple devices.
- **Graceful Degradation**: Categorizes network and authentication failures (`login_cancelled`, `verification_required`, `quota_exceeded`) to prevent retry storms.
- **Reference**: [`OFFLINE_FIRST_SYNC_ARCHITECTURE.md`](OFFLINE_FIRST_SYNC_ARCHITECTURE.md)

### 4. Video Metadata Architecture (`docs/architecture/METADATA_ARCHITECTURE.md`)

- **Granular Storage**: Video details (title, channel, duration, privacy) are stored per video (`yph:meta:<videoId>`) rather than in a single monolithic JSON cache.
- **Adaptive Fetching**: Fetches up to 50 items in parallel; backs off adaptively only when failure rates spike.
- **Reference**: [`METADATA_ARCHITECTURE.md`](METADATA_ARCHITECTURE.md)

---

## 📚 Architectural Specifications Index

- **[Automatic Handling & Background Sync](AUTOMATIC_HANDLING.md)**: Details on queue pacing, idle workers, and low-impact animations.
- **[Offline-First Sync Architecture](OFFLINE_FIRST_SYNC_ARCHITECTURE.md)**: Delta calculations, error states, and conflict resolution.
- **[Video Metadata Architecture](METADATA_ARCHITECTURE.md)**: IndexedDB schema, migration strategies, and batch optimization.
- **[Encrypted Sync Plan](../ENCRYPTED_SYNC_PLAN.md)**: Zero-knowledge cross-device pairing and encrypted payload schemas.
- **[Platform Support](../PLATFORM_SUPPORT.md)**: WebExtension Manifest V3 runtime constraints and multi-browser differences.
