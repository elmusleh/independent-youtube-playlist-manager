# Privacy Policy

**Last Updated:** October 25, 2026

Independent YouTube Playlist Manager ("YPH", "the extension") is a client-side, local-first browser extension. No data is collected, monitored, sold, or transmitted to servers operated by us — we operate no servers, analytics engines, or telemetry pipelines. This policy explains exactly what data the extension stores, which browser permissions it uses and why, and which external services it may contact on your behalf.

---

## 1. Data Stored Locally on Your Device

The extension stores the following locally. Metadata lookups send video identifiers to the services in section 3; optional account features transmit the data described there. Exported backup files can contain sensitive settings and account configuration, so keep them private.

- **Playlists:** Your custom playlists, ordering, tags, and edit state are stored in the browser's extension storage (`browser.storage.local`).
- **Video Metadata Cache:** Video titles, channel names, durations, and thumbnail URLs are cached in a local IndexedDB database (`yph_metadata_db_v2`) to avoid repeated network requests.
- **Optional saved thumbnails:** When you enable "Keep thumbnail images on this device", the extension requests optional access to `https://i.ytimg.com/*` and saves available preview image bytes as you view playlists. These images are kept in a separate local IndexedDB archive without automatic expiration, survive metadata refreshes, and are included in full JSON backups. You can disable new downloads or delete saved images in Settings. Already missing images cannot be recovered; uninstalling or clearing browser data removes local copies.
- **Local Watch History:** If you use the built-in history / resume-playback feature, per-video watch timestamps are recorded **locally only** (`local_yt_history`). This is independent of — and never reported to — your YouTube/Google watch history.
- **Settings:** Your preferences (theme, metadata fetching strategy, engine toggles, custom instance URLs, API keys you provide) are stored in extension storage.
- **Account information:** Optional sign-in stores account profile information (such as name and email) and authentication/session tokens locally. Supabase email/password sign-in sends the entered credentials to your configured Supabase project; Google authentication happens through Google.
- **Local activity and diagnostics:** YouTube watch progress and operational logs support playback resume and troubleshooting. There is no remote analytics reporting. Local search/filter text stays local; YouTube Search sends your query to Google when you submit it.

---

## 2. Browser Permissions & Why They Are Needed

The extension manifest requests the following permissions:

- `storage` / `unlimitedStorage` — Save playlists, settings, and the local metadata cache without hitting storage quota limits.
- `tabs` — Power the "add all open YouTube tabs" feature: enumerate open tabs (across windows) so you can select which YouTube videos to add. Tab data is read on demand and never transmitted.
- `activeTab` / `scripting` — Extract video metadata or scrape video links from a page **only when you explicitly trigger it** (e.g., clicking the extension icon or a context-menu item).
- `contextMenus` — Provide the right-click "Add to Playlist Builder" menu item (desktop only).
- `notifications` — Show local status notifications (e.g., sync or import results).
- `alarms` — Schedule periodic background housekeeping (e.g., cache cleanup, optional background sync).
- `identity` — Used **only** if you choose to sign in with Google OAuth for YouTube account sync. No sign-in is required to use the extension.

A content script runs on `www.youtube.com/watch*` and `m.youtube.com/watch*` pages to support watch-progress tracking. Host access is limited to `https://*.youtube.com/*`.

---

## 3. Network Requests to Third Parties

The extension is fully functional offline for editing and managing playlists. When fetching video metadata (titles, durations, thumbnails) or playing videos, it may contact the following services **directly from your browser** — your IP address is visible to those services, as with any web request:

- **YouTube / Google** (`youtube.com`): Innertube player endpoint, embed pages, and the public oEmbed API for zero-quota metadata lookups; the YouTube Data API v3 when you sign in or provide your own API key; and normal video playback links.
- **Piped / Invidious instances** (optional fallback tier): Public privacy-frontend instances (e.g., `pipedapi.kavin.rocks`, `invidious.privacydev.net`) or custom instances you configure, used only as a metadata fallback. This tier can be disabled entirely in Settings.
- **Supabase (optional cloud sync):** When you configure a project and sign in, account credentials and tokens are exchanged with that project. Cloud sync transmits playlist names, video IDs, ordering and video metadata. The shared video catalog can expose public video metadata to other users of that configured project. Local watch-progress logs are not uploaded by this sync service.

Each metadata engine (Innertube, embed scraping, oEmbed, Piped/Invidious) can be individually toggled off in Settings.

Firefox declares browsing activity and website content for video links and metadata requests during installation/update. Optional account features request authentication and identifying-information consent when you sign in; YouTube Search separately requests search-term consent. Denying those optional requests leaves local playlist management available. You can revoke optional consent in Firefox's extension settings. Chrome's store disclosures also cover data handled locally, including account information, web history, local activity and website content.

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
- **Deletion:** Uninstalling the extension deletes its local browser storage. Exported files and cloud data are separate copies. If you enabled optional cloud sync, manage deletion through your configured Supabase project/provider; uninstalling does not delete that remote data.

---

## 6. What We Do NOT Do

- No analytics, tracking pixels, fingerprinting, or telemetry.
- No advertising or sale of data. Third-party requests are limited to the features and services described above.
- No profiling: the extension builds no behavioral profile of you and requires no personalized account.

---

## 7. Licensing, Changes & Contact

Independent YouTube Playlist Manager is open-source software distributed under the [MIT License](LICENSE) — the complete codebase can be audited at [github.com/elmusleh/independent-youtube-playlist-manager](https://github.com/elmusleh/independent-youtube-playlist-manager).

Material changes to this policy will be reflected in this file (with an updated date) in the repository. For questions or bug reports, please open an issue on the repository.
