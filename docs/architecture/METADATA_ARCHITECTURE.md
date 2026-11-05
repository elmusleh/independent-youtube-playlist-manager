# Video Metadata Architecture: Current State, Alternatives, and Roadmap

A living document that records how the YouTube Playlist Helper fetches, stores, and refreshes video metadata (title, channel, duration, privacy status, etc.), along with evaluated alternatives and a phased future roadmap.

---

## 1. History & Changelog

### Pre-Refactor (before June 30, 2026)

- **Storage:** All metadata stored in a single monolithic object under `yph_video_metadata_cache` in `browser.storage.local`.
- **Reads/Writes:** O(n) — every cache read or write loaded and saved the entire object. Performance degraded as the cache grew.
- **Batches:** Innertube and Invidious APIs fetched only **10 videos at a time** with fixed 200–500ms delays between batches.
- **Refetch Behavior:** `ensureMetadataLoaded` performed a first pass (batch size 50), then manually cleared caches and did a second retry pass (batch size 10). Videos that failed all APIs silently dropped out, forcing users to run "Refetch from Source" 3–4 times to converge (e.g. 115 → 40 → 11 missing).
- **Auto-Fetch UX:** `loadPageVideos` only showed a passive toast telling the user to manually use Clean → Refetch Metadata.

### Post-Refactor (June 30, 2026)

- **Storage:** Migrated to per-video IndexedDB entries via `idb-keyval` (`yph:meta:<videoId>`). O(1) reads/writes, no monolithic object growth.
- **Batches:** Increased to **50 videos per batch** with parallel `Promise.all` per batch.
- **Pacing:** Removed fixed delays. Added **adaptive pacing** — only backs off when >50% of a batch fails, with a capped delay (max 1500–2000ms).
- **Refetch Behavior:** Single-pass fetch. No persistent cache wipe on normal fetches. Reports exact unavailable video IDs after one run.
- **Auto-Fetch UX:** Added **opt-in** `autoFetchMetadata` setting (default `false`). When enabled, silently fetches missing metadata on page load. When disabled, shows an info toast with guidance.
- **Migration:** Transparent one-time migration from legacy `yph_video_metadata_cache` monolith to per-video IndexedDB entries.

---

## 2. Current Architecture (June 30, 2026)

### 2.1 Storage Layer

```
Key format:   yph:meta:<videoId>
Backend:      IndexedDB (via idb-keyval)
TTL:          24 hours for valid entries
Negative TTL: 5 minutes for failed fetches
Operations:   getMany / setMany for batch efficiency
```

**Why IndexedDB + idb-keyval:**

- Zero configuration, no schema migration headaches.
- `getMany` / `setMany` give batch efficiency without O(n) overhead.
- Quota is effectively unlimited in extensions (storage is scoped to the extension origin).
- Works in all browsers that support Manifest V3.

### 2.2 Fetch Pipeline

```
1. Session cache check (_metadataSessionCache)
   → Hit: return immediately
   → In-flight: await existing promise (deduplication)

2. Persistent cache check (idb-keyval via videoService.shouldSkipFetch)
   → Valid + fresh (< 24h): skip
   → Negative cache fresh (< 5min): skip
   → Otherwise: proceed to fetch

3. Innertube API (primary, no auth required)
   → Batch size: 50 videos, parallel per-video requests
   → Adaptive delay only on repeated batch failures

4. Invidious API (fallback)
   → Same batch size and adaptive pacing
   → Tries multiple public instances in rotation

5. Cache failures as null in session cache (skip for remainder of session)
6. Write successes to idb-keyval with lastCachedAt timestamp
```

### 2.3 Editor Integration

| Trigger                            | Behavior                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Playlist open / page change        | If `autoFetchMetadata` is ON and page has missing titles → silent background fetch. If OFF → info toast only. |
| Clean → Refetch Metadata (missing) | Single-pass fetch for missing videos only. No cache wipe. Reports unavailable IDs.                            |
| Clean → Refetch Metadata (force)   | Clears session + persistent cache for all videos, then single-pass fetch. Reports unavailable IDs.            |

---

## 3. Storage Backend Alternatives (Evaluated)

| Option                                | Pros                                                                                 | Cons                                                                           | Verdict                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------- |
| **IndexedDB + idb-keyval** (current)  | Simple, zero-config, batch getMany/setMany, unlimited quota in MV3, widely supported | No SQL querying, no indexing beyond keys, async-only                           | **Best fit for key-value metadata**           |
| **OPFS (Origin Private File System)** | Unlimited quota, fast streaming reads, file-like API                                 | Chromium 86+ only, no Firefox/Safari, more boilerplate, no batch atomic writes | **Overkill for small JSON blobs**             |
| **SQLite via sql.js / wa-sqlite**     | Full SQL, indexes, complex queries, relational integrity                             | WASM bloat (~1MB+), more code, needs persistence wrapper, slower startup       | **Not worth it for simple key-value lookups** |
| **browser.storage.local** (legacy)    | Simple synchronous-feel object API                                                   | 5–10MB total quota, O(n) on large objects, slow with big caches                | **Avoided by current refactor**               |
| **Extension localStorage**            | Synchronous API                                                                      | 5MB limit, string-only, blocking main thread                                   | **Avoid**                                     |
| **Cache API (Service Worker)**        | Fast, supports streaming                                                             | Not available in extension content/popup contexts, complex lifecycle           | **Not applicable**                            |

**Recommendation:** Stay with IndexedDB + idb-keyval. If future needs require querying metadata by channel, duration range, etc., consider adding a lightweight index in a separate IndexedDB object store — not SQLite.

---

## 4. Fetching Strategy Alternatives (Evaluated)

| Option                              | Pros                                                          | Cons                                                                    | Verdict                              |
| ----------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| **TTL Cache (current)**             | Fast repeated loads, minimal API load, configurable expiry    | Stale data for recently deleted/privatized videos                       | **Best balance for large playlists** |
| **Always-Fresh (no cache)**         | Guaranteed accuracy, no stale data                            | Massive API load, very slow UX, rate limits, unusable for 500+ videos   | **Unusable**                         |
| **Stale-While-Revalidate (SWR)**    | Instant display + background refresh, always fresh eventually | More complex state management, risk of UI flicker on update             | **Good candidate for Phase 2**       |
| **YouTube Data API v3 (batch)**     | Official, reliable, rich metadata, no HTML scraping           | Requires OAuth + quota, 10k units/day limit, 50 videos max per call     | **Best when user is signed in**      |
| **Innertube + Invidious (current)** | No auth, no quota, works offline-ish                          | Unofficial APIs, can break without warning, instance reliability varies | **Best for guest/offline mode**      |

**Recommendation:** Keep the dual-strategy pipeline (Innertube → Invidious) for the guest/offline path. Add YouTube Data API v3 as an **optional primary tier** when the user is signed in and has quota available. This gives the best of both worlds: official data when possible, fallback resilience always.

---

## 5. Future Roadmap

### Phase 2 — Signed-in Primary Path + Stale-While-Revalidate

1. **YouTube Data API v3 as primary tier:**
   - When `isSignedIn === true`, use `videos?part=snippet,contentDetails,status` with `id=<comma-separated IDs>`.
   - Batch up to 50 IDs per call (API limit). This is one official HTTPS call per 50 videos vs. 50 parallel unofficial calls.
   - Fall back to Innertube/Invidious only on quota exhaustion or 403 errors.

2. **Stale-While-Revalidate (SWR):**
   - On playlist open: show cached data instantly.
   - Fire a background refresh that compares fetched data to cached data.
   - Only re-render if a value actually changed (avoids flicker).
   - Update `lastCachedAt` on successful refresh.

3. **Per-playlist metadata TTL:**
   - Allow overriding the global 24h TTL per playlist (e.g. "Always fresh" for active playlists, "7 days" for archived ones).

### Phase 3 — Background Pre-Fetching

1. **Service Worker metadata fetch:**
   - Move the fetch pipeline from the editor page into the extension's service worker (`background-worker.js`).
   - Pre-fetch metadata while the user is browsing YouTube (detected via `webNavigation` or content script messages).
   - When the user opens a playlist in the editor, metadata is already warm in the cache.

2. **Channel-level metadata subscription:**
   - If a playlist contains many videos from the same channel, batch-fetch channel metadata once and share across videos.
   - Useful for playlists created from a single creator.

### Phase 4 — Advanced Storage (If Needed)

1. **OPFS migration:**
   - Only if metadata grows beyond ~50,000 videos or includes large blobs (thumbnails, descriptions).
   - OPFS gives streaming reads and no quota anxiety in Chromium.
   - Keep a compatibility layer for Firefox (stay on IndexedDB there).

2. **Compression:**
   - Use `CompressionStream` / `DecompressionStream` for cached metadata JSON before writing to IndexedDB.
   - Reduces storage footprint by ~60–70% for repetitive keys.

---

## 6. Decision Log

| Date       | Decision                                                                | Rationale                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-30 | Migrate from `browser.storage.local` monolith to `idb-keyval` per-video | O(n) reads/writes were causing slowdowns. Per-video gives O(1) and removes quota risk.                                                        |
| 2026-06-30 | Increase batch size from 10 → 50                                        | 500-video playlists spent 10–25s in artificial delays alone. Parallel fetching is safe because Innertube/Invidious are stateless per-request. |
| 2026-06-30 | Remove fixed inter-batch delays, add adaptive pacing                    | Fixed delays punished fast networks. Adaptive pacing only slows down when the API is actually struggling.                                     |
| 2026-06-30 | Single-pass refetch with no persistent cache wipe                       | Wiping cache before fetching forced full re-fetches. Now only force-refetch clears cache; normal fetches respect TTL.                         |
| 2026-06-30 | Make background auto-fetch opt-in (default OFF)                         | User feedback: automatic network calls on page load should be explicit, not implicit.                                                         |
| 2026-06-30 | Transparent one-time migration on load                                  | Avoids data loss for existing users. Flag prevents re-running migration.                                                                      |

---

## 7. Related Files

| File                                                   | Responsibility                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `playlist-editor/src/services/video-service.ts`        | IndexedDB cache read/write, individual video fetch (noembed, history, tabs, URL preview) |
| `playlist-editor/src/services/youtube-api.ts`          | Batch metadata fetch via Innertube + Invidious, session dedup, adaptive pacing           |
| `playlist-editor/src/components/PlaylistEditor.svelte` | UI integration: opt-in auto-fetch, single-pass `ensureMetadataLoaded`, progress modal    |
| `playlist-editor/src/services/storage-service.ts`      | Settings defaults, legacy cache migration                                                |
| `playlist-editor/src/types/model.d.ts`                 | `Settings` interface definition                                                          |
