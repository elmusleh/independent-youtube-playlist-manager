# Support & FAQ

## Reporting Bugs & Feature Requests

The fastest and most reliable way to reach us is through GitHub Issues:

- **Bug reports:** [github.com/elmusleh/independent-youtube-playlist-manager/issues](https://github.com/elmusleh/independent-youtube-playlist-manager/issues)
- **Feature requests:** use the same issue tracker and label your request as a feature/enhancement.

When reporting a bug, please include:

1. **Browser & version** (e.g., Chrome 126, Edge 126, Firefox 140).
2. **Extension version** (visible in Settings → System Info).
3. **Steps to reproduce** — what you did, what you expected, what happened.
4. **Screenshots** or error messages, if any.

## Platform Support Overview

See [`SYNC_COMPATIBILITY.md`](SYNC_COMPATIBILITY.md) for the full compatibility table and [`PLATFORM_SUPPORT.md`](PLATFORM_SUPPORT.md) for architecture and future platforms.

### Currently Supported

| Platform                | Extension | Sync                      | Notes            |
| ----------------------- | --------- | ------------------------- | ---------------- |
| Chrome Desktop          | ✅        | Supabase + File           | Full capture     |
| Edge Desktop            | ✅        | Supabase + File           | Full capture     |
| Firefox Desktop         | ✅        | Supabase + File (partial) | Full capture     |
| Firefox Android (Fenix) | ✅        | Supabase only             | No context menus |

### Coming Soon (Client-Only)

| Platform       | Target                            | Sync            | Playback                   | Status             |
| -------------- | --------------------------------- | --------------- | -------------------------- | ------------------ |
| Web Portal     | TV browsers, tablets, any browser | Supabase        | Deep-link → YouTube app    | Design complete    |
| Native Android | Phone, tablet, **Android TV**     | Supabase        | Deep-link → YouTube app    | Architecture ready |
| iOS / iPadOS   | iPhone, iPad                      | Supabase        | `youtube://` → YouTube app | Free with Android  |
| Tauri Desktop  | Windows, macOS, Linux             | Supabase + File | System browser             | Low priority       |

**Client-only =** View/play synced playlists only. No YouTube page capture, no context menus, no auto-fetch.

## Frequently Asked Questions

### The extension can't fetch video titles/durations (only thumbnails load)

This is usually a metadata-resolution issue. Check **Settings → Video Metadata & Scraping**:

- Ensure "Auto-fetch metadata" is enabled.
- Try switching the **Execution Strategy** to "Zero-Quota / Free First".
- Toggle on individual engines (Innertube, Embed, oEmbed, Piped/Invidious).
- If you use a VPN or strict network, some scraping endpoints may be blocked.

### YouTube sync says "API quota exceeded"

The YouTube Data API v3 has a daily quota (default 10,000 units). Large playlists (500+ videos) can take 2–3 days to fully sync. The extension saves progress and auto-retries after 24 hours. See [`USER_GUIDE.md`](USER_GUIDE.md) in the repository.

### Sign-in fails with "redirect_uri_mismatch"

Your Google Cloud OAuth client is missing the correct redirect URI. Open **Settings → API Setup**, copy the displayed redirect URI(s), and add them to your Google Cloud Console OAuth client under "Authorized redirect URIs". Changes may take a few minutes to propagate.

### Where is my data stored? Can I back it up?

All data is stored locally in your browser (`browser.storage.local` + IndexedDB). Use **Settings → Export** to save a JSON backup (Schema v2), CSV, or M3U. To restore, import the backup with merge or overwrite mode.

### I removed the extension — is my data gone?

Yes. Removing the extension permanently deletes all local data **unless** you exported a backup first. Always export before uninstalling.

### Does the extension work on Android?

Yes — Firefox for Android (Fenix) is supported. Chrome for Android does not support extensions. On Android, sign-in falls back to a tab-based OAuth flow automatically.

### The right-click "Add to Playlist Builder" menu doesn't appear

Context menus are desktop-only. On Android/Fenix they are skipped by design.

### Will there be a TV app / Android TV app / iOS app?

**Yes — they're planned as "client-only" companion apps.** See [`PLATFORM_SUPPORT.md`](PLATFORM_SUPPORT.md) for the full roadmap.

**Short version:**

- **Web Portal (TV browsers):** Opens `iypm.vercel.app` on your TV browser → pair via QR code from desktop → play playlists → opens YouTube app. **Design complete.**
- **Native Android TV app:** Capacitor wrapper around our Svelte UI → Play Store → same pairing → deep-links to YouTube app. **Architecture ready.**
- **iOS/iPadOS:** Same Capacitor build → App Store.
- **All are client-only:** They show your synced playlists and play them. They **cannot** capture from YouTube pages (no right-click menus, no auto-fetch). You manage playlists on desktop.

## Documentation

- **Setup & API configuration:** [`USER_GUIDE.md`](USER_GUIDE.md) in the repository.
- **Architecture & build:** [`AGENTS.md`](../AGENTS.md).
- **Release history:** [`RELEASE_NOTES.md`](RELEASE_NOTES.md).
- **Platform support & roadmap:** [`PLATFORM_SUPPORT.md`](PLATFORM_SUPPORT.md).
- **Sync compatibility:** [`SYNC_COMPATIBILITY.md`](SYNC_COMPATIBILITY.md).

## Still stuck?

Open a GitHub issue with the details above — we'll respond as quickly as possible.
