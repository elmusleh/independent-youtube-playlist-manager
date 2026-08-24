# Support & FAQ

## Reporting Bugs & Feature Requests

The fastest and most reliable way to reach us is through GitHub Issues:

- **Bug reports:** [github.com/elmusleh/independent-youtube-playlist-manager/issues](https://github.com/elmusleh/independent-youtube-playlist-manager/issues)
- **Feature requests:** use the same issue tracker and label your request as a feature/enhancement.

When reporting a bug, please include:

1. **Browser & version** (e.g., Chrome 126, Firefox 140).
2. **Extension version** (visible in Settings → System Info).
3. **Steps to reproduce** — what you did, what you expected, what happened.
4. **Screenshots** or error messages, if any.

## Frequently Asked Questions

### The extension can't fetch video titles/durations (only thumbnails load)

This is usually a metadata-resolution issue. Check **Settings → Video Metadata & Scraping**:

- Ensure "Auto-fetch metadata" is enabled.
- Try switching the **Execution Strategy** to "Zero-Quota / Free First".
- Toggle on individual engines (Innertube, Embed, oEmbed, Piped/Invidious).
- If you use a VPN or strict network, some scraping endpoints may be blocked.

### YouTube sync says "API quota exceeded"

The YouTube Data API v3 has a daily quota (default 10,000 units). Large playlists (500+ videos) can take 2–3 days to fully sync. The extension saves progress and auto-retries after 24 hours. See `USER_GUIDE.md` in the repository.

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

## Documentation

- **Setup & API configuration:** `USER_GUIDE.md` in the repository.
- **Architecture & build:** `AGENTS.md`.
- **Release history:** `RELEASE_NOTES.md`.

## Still stuck?

Open a GitHub issue with the details above — we'll respond as quickly as possible.
