# Independent YouTube Playlist Manager

A browser extension for Firefox and Chrome that gives you a full playlist management experience on top of YouTube. Build, edit, and sync playlists without leaving your browser — no third-party service required.

> **Version:** 2.12.10 (Chrome) / 2.12.23 (Firefox) — Manifest V3 — Firefox 140+ / Chrome / Firefox for Android (Fenix) 142+
> **AI Agent Maintained:** This repository is maintained autonomously by AI agents. Refer to [AGENTS.md](AGENTS.md) for full context, architecture specifications, and agent execution guidelines.

---

## What it does

YouTube's native playlist tools are limited: you can't reorder in bulk, you can't build a queue from arbitrary links, and Watch Later is a black box. This extension replaces all of that with a proper editor.

**Playlist Editor**

- Add videos from URLs or IDs (paste multiple at once)
- Drag-and-drop reorder within a page; supports large playlists via pagination
- Bulk select and delete multiple videos at once
- Reverse order, remove duplicates, import from text / export to clipboard
- Debounced auto-save — changes persist without a manual save button

**Playlist Builder**

- Right-click any YouTube video on any page → "Add to Playlist Builder" (desktop only)
- Open the builder at any time to edit, play, or save the queued videos as a new playlist

**Saved Playlists**

- Offline-first: playlists are stored locally and optionally synced to your YouTube account
- Unified view of both extension-managed playlists and your existing YouTube playlists
- "Adopt" any YouTube playlist to bring it under extension management
- Real-time search and sort across all playlists

**Favorite Playlist**

- Pin any managed playlist as your ⭐️ Favorite
- Quick-add from the popup targets your Favorite, your Latest edited playlist, or a custom choice
- Self-healing: if the playlist is deleted, the extension recreates it automatically

**Quick Add Popup**

- Click the toolbar icon on any YouTube page to instantly add the current video to a playlist
- Targets Favorite, Latest, or any saved playlist — configurable in Settings

**Settings**

- Light / Dark / Device theme
- Per-page video count, cache duration, default privacy for synced playlists
- Toggle thumbnails off to save bandwidth
- Auto-remove duplicates on import

---

## Why not just use YouTube playlists?

A comprehensive comparison between **Independent YouTube Playlist Manager** (this extension) and **YouTube's native playlist system**:

| Capability | Independent YouTube Playlist Manager | Native YouTube Playlists |
|---|---|---|
| **Creating playlists** | ✅ Create **unlimited playlists** with a few clicks directly from the extension. Batch-add dozens of videos at once. | ⚠️ Every single video must be added one at a time — open the video, click **Save**, then pick the playlist. |
| **Adding open browser tabs** | ✅ Grab all open YouTube tabs from **multiple browser windows** at once, with flexible checkbox selection of exactly which tabs to include. | ❌ Not possible. There is no way to turn your open tabs into a playlist. |
| **HTML & text scraping** | ✅ Paste raw HTML source, text blocks, or URL collections — the extension automatically identifies and extracts every video ID. Also scrapes links from channels and existing playlists. | ❌ Not possible. Only manual per-video saving. |
| **Bulk editing (merge / split / combine / sort)** | ✅ Merge, split, divide, combine, sort, reverse, and de-duplicate playlists with **quick one-click buttons**. Bulk-select and delete any selection of videos instantly. | ❌ Very limited. Deleting a selection of videos is tedious (one at a time), and cleaning up **Watch Later** is notoriously painful. No merge/split tools at all. |
| **Works offline** | ✅ Fully offline. All editing, sorting, and management works with zero connectivity — data lives in your browser's local storage. | ❌ Requires an internet connection and a loaded YouTube session for every action. |
| **Account & privacy** | ✅ **No login required.** No personalized profile is built about you. Zero data collection — 100% client-side. | ⚠️ Requires a Google account. Your playlist activity feeds your YouTube profile and recommendation tracking. |
| **Watch history & resume playback** | ✅ **Built-in local history**: continue exactly where you left off in any playlist — without enabling YouTube watch history and without privacy concerns. | ⚠️ Resume depends on YouTube's watch history being enabled, which ties your viewing behavior to your Google profile. |
| **Playback limits** | ⚠️ In **offline/guest mode**, the generated YouTube link (`watch_videos`) is truncated by YouTube's servers to **~50 videos**. Signing in removes this limit (URL-length bound, supports thousands of IDs). | ✅ No per-playlist playback cap when signed in (native limit is 5,000 videos per playlist). |
| **Export & portability** | ✅ 1-click export to **JSON (Schema v2)**, **CSV** (Excel/Sheets), and **M3U** (VLC/media players). Full-database backup and restore with merge/overwrite modes. | ❌ No native export. Your playlists are locked into YouTube. |
| **Backup & data retention** | ⚠️ Data is stored **100% locally**. Exports are the **only backup** — **removing the extension permanently deletes all data** unless you exported first. | ✅ Stored on Google's servers, tied to your account. |

**Bottom line:** the extension trades cloud storage for speed, bulk power, privacy, and portability. Export regularly if you want a safety net.

---

## Getting Started

### 1. Clone the repository

```bash
# Clone with submodules (required for quality-checks/)
git clone --recurse-submodules https://github.com/el-musleh/youtube-playlist-helper.git

# Or if already cloned without submodules:
git submodule update --init --recursive
```

### 2. Install dependencies

Install dependencies from the repository root:

```bash
npm install
cd playlist-editor && npm install
```

### 3. Build and Development

| Command                       | What it does                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `npm run watch`       | **Recommended for development** — Starts Rollup watcher with production settings |
| `npm run build`       | One-shot production build → compiles Svelte and creates `dist/chrome/` + `dist/firefox/` |
| `npm run build-chrome`| Copy `src/` → `dist/chrome/` with the correct Chrome manifest                  |
| `npm run build-firefox`| Copy `src/` → `dist/firefox/` with the correct Firefox manifest               |
| `npm run cors`        | Local CORS proxy for development (required for YouTube API calls)             |
| `npm run web`         | Start the Next.js web portal dev server (`localhost:3000`)                    |
| `npm run web:build`   | Production build of the web portal (`web/`)                                   |

The compiled extension lives in `src/editor/` and is committed to the repo. To load the extension in a browser, run `npm run build` first to create the `dist/` folders.

> **Note:** All commands must be run from the **repository root** (`youtube-playlist-helper/`), not from `playlist-editor/`.

---

## Loading the extension manually

This extension uses **two separate manifest files** to avoid cross-browser warnings. The `dist/` folder contains ready-to-load versions for each browser.

```bash
npm run build
```

### Firefox (temporary — development only)

1. Run `npm run build` from the repo root.
2. Go to `about:debugging` — for detailed instructions on testing extensions, see the [official Firefox Source Docs](https://firefox-source-docs.mozilla.org/devtools-user/about_colon_debugging/index.html).
3. Click **This Firefox** → **Load Temporary Add-on**.
4. Select `dist/firefox/manifest.json`.
5. After rebuilding, click **Reload** next to the extension entry.

### Chrome (temporary — development only)

1. Run `npm run build` from the repo root.
2. Go to `chrome://extensions` → enable **Developer mode** (top-right).
3. Click **Load unpacked** → select the `dist/chrome/` directory.
4. After rebuilding, click the **↺** reload icon on the extension card.

> **Switching browsers?** Just run `npm run build` again — both `dist/chrome/` and `dist/firefox/` are rebuilt with the correct manifests.

---

## Permanent installation (no developer mode)

### Chrome — Enterprise Policy (local machine)

1. Build and package the CRX:
   ```bash
   npm run build
   google-chrome --pack-extension=dist/chrome --pack-extension-key=src.pem
   # Produces dist/chrome.crx (extension ID: lppdplclfhchgkgckfmkopomahlpfjok)
   ```
2. Create the policy file:
   ```bash
   sudo mkdir -p /etc/opt/chrome/policies/managed/
   sudo tee /etc/opt/chrome/policies/managed/yt-playlist-helper.json > /dev/null << 'EOF'
   {
     "ExtensionInstallForcelist": [
       "lppdplclfhchgkgckfmkopomahlpfjok;file:///path/to/dist/chrome.crx"
     ]
   }
   EOF
   ```
3. Fully quit and relaunch Chrome — the extension installs permanently without the developer mode badge.

> `src.pem` is the private key that locks the extension ID. Do not lose it or commit it to a public repo.

### Firefox — Signed XPI (local machine, no review wait)

```bash
npm run build
cd dist/firefox
web-ext sign --api-key=<JWT_ISSUER> --api-secret=<JWT_SECRET> --channel=unlisted
# Produces web-ext-artifacts/*.xpi — drag into Firefox to install permanently
```

Get AMO API credentials at: https://addons.mozilla.org/developers/addon/api/key/

### Firefox for Android (Fenix)

Install the signed XPI via the AMO unlisted channel (same file as desktop Firefox). The extension detects Android at runtime and switches to a tabs-based OAuth flow automatically.

> **Required:** Add `https://{790842fe-fecb-4375-a127-95c1c1d35d3e}.extensions.allizom.org/` as an authorized redirect URI in your Google Cloud Console OAuth client for sign-in to work on Android.

---

## Architecture overview

The project has three layers:

- **`src/`** — Plain JS extension shell (background service worker, popup, content scripts) and the compiled editor output. It does **not** contain a loadable `manifest.json` — use the `dist/` folders instead.
- **`playlist-editor/`** — Svelte 5 + TypeScript SPA that compiles into `src/editor/`. This is where all extension UI development happens.
- **`web/`** — Next.js 15 marketing portal and dashboard (`npm run web` for dev, `npm run web:build` for production).

For the detailed technical guide including storage architecture, the metadata fetching pipeline, and agent guidelines, see [AGENTS.md](AGENTS.md).

---

## Known Limitations

### "Play All" video count and guest users

The **Play All** button opens all videos from a playlist in a new YouTube tab. How many videos actually load depends on whether you're signed in:

- **Signed in:** All videos load into a single temporary playlist. There is no practical limit — the `&playlist=` URL parameter is constrained only by URL length, which supports thousands of video IDs.
- **Guest (not signed in):** YouTube's `watch_videos` endpoint silently truncates the video list to approximately **50 videos**. This is a hard server-side limit imposed by YouTube and cannot be bypassed by the extension. If your playlist has more than ~50 videos, only the first ~50 will play.

**Recommendation:** Sign in to your YouTube account to use Play All with large playlists without any truncation.

---

## Privacy

No data is collected. All playlist data is stored in your browser's local storage. YouTube sync uses your own OAuth credentials via the YouTube Data API v3. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for the full policy.
