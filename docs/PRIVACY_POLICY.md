# Privacy Policy

**Last Updated:** August 23, 2026

Independent YouTube Playlist Manager ("YPH", "the extension") is a client-side, local-first browser extension. No data is collected, monitored, sold, or transmitted to servers operated by us — we operate no servers, analytics engines, or telemetry pipelines. This policy explains exactly what data the extension stores, which browser permissions it uses and why, and which external services it may contact on your behalf.

---

## 1. Data Stored Locally on Your Device

All of the following stays inside your browser and never leaves your device unless you explicitly export it or enable an optional sync feature:

- **Playlists:** Your custom playlists, ordering, tags, and edit state are stored in the browser's extension storage (`browser.storage.local`).
- **Video Metadata Cache:** Video titles, channel names, durations, and thumbnail URLs are cached in a local IndexedDB database (`yph_metadata_db_v2`) to avoid repeated network requests.
- **Local Watch History:** If you use the built-in history / resume-playback feature, per-video watch timestamps are recorded **locally only** (`local_yt_history`). This is independent of — and never reported to — your YouTube/Google watch history.
- **Settings:** Your preferences (theme, metadata fetching strategy, engine toggles, custom instance URLs, API keys you provide) are stored in extension storage.

---

## 2. Browser Permissions & Why They Are Needed

The extension manifest requests the following permissions:

- `storage` / `unlimitedStorage` — Save playlists, settings, and the local metadata cache without hitting storage quota limits.
- `tabs` — Power the "add all open YouTube tabs" feature: enumerate open tabs (across windows) so you can select which YouTube videos to add. Tab data is read on demand and never transmitted.
- `activeTab` / `scripting` — Extract video metadata or scrape video links from a page **only when you explicitly trigger it** (e.g., clicking the extension icon or a context-menu item).
- `contextMenus` — Provide the right-click "Add to Playlist Builder" menu item (desktop only).
- `bookmarks` — Import video links from your bookmarks when you use the bookmark import feature.
- `notifications` — Show local status notifications (e.g., sync or import results).
- `alarms` — Schedule periodic background housekeeping (e.g., cache cleanup, optional background sync).
- `identity` — Used **only** if you choose to sign in with Google OAuth for YouTube account sync. No sign-in is required to use the extension.

A content script runs only on `www.youtube.com/watch*` pages to support watch-progress tracking; it does not run on other websites.

---

## 3. Network Requests to Third Parties

The extension is fully functional offline for editing and managing playlists. When fetching video metadata (titles, durations, thumbnails) or playing videos, it may contact the following services **directly from your browser** — your IP address is visible to those services, as with any web request:

- **YouTube / Google** (`youtube.com`): Innertube player endpoint, embed pages, and the public oEmbed API for zero-quota metadata lookups; the YouTube Data API v3 when you sign in or provide your own API key; and normal video playback links.
- **Piped / Invidious instances** (optional fallback tier): Public privacy-frontend instances (e.g., `pipedapi.kavin.rocks`, `invidious.privacydev.net`) or custom instances you configure, used only as a metadata fallback. This tier can be disabled entirely in Settings.
- **Supabase (optional cloud sync):** If — and only if — you enable cloud sync and create an account, your playlists and settings are synced to a Supabase-hosted database to support cross-device use. This is opt-in; the extension never creates an account or uploads data without your action.

Each metadata engine (Innertube, embed scraping, oEmbed, Piped/Invidious) can be individually toggled off in Settings.

---

## 4. Authentication

- **No login is required** for core functionality (creating, editing, sorting, exporting playlists; watch history; metadata caching).
- If you optionally sign in with Google (OAuth via the YouTube Data API v3), authentication happens directly between your browser and Google using your own credentials. Tokens are stored locally in extension storage. We never see or store your Google password.
- If you optionally use Supabase cloud sync, session tokens are likewise stored locally in your browser.

---

## 5. Data Control & Portability

You maintain 100% control over your data:

- **Export:** Export your full database (playlists, metadata cache, watch history, settings) as JSON (Schema v2), or export playlists as CSV or M3U, at any time from Settings.
- **Import / Restore:** Restore a backup in non-destructive merge mode or clean overwrite mode.
- **Deletion:** Uninstalling the extension permanently deletes all locally stored data (playlists, IndexedDB cache, history, settings). **Local data is not backed up anywhere unless you exported it or enabled optional cloud sync.** If you used cloud sync, you can delete your synced data by deleting your account/data from the sync dashboard.

---

## 6. What We Do NOT Do

- No analytics, tracking pixels, fingerprinting, or telemetry.
- No advertising and no sale or sharing of data with third parties.
- No profiling: the extension builds no behavioral profile of you and requires no personalized account.

---

## 7. Licensing, Changes & Contact

Independent YouTube Playlist Manager is open-source software distributed under the [MIT License](LICENSE) — the complete codebase can be audited at [github.com/elmusleh/independent-youtube-playlist-manager](https://github.com/elmusleh/independent-youtube-playlist-manager).

Material changes to this policy will be reflected in this file (with an updated date) in the repository. For questions or bug reports, please open an issue on the repository.
