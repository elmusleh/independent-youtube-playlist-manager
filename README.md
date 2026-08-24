<p align="center"><a href="https://github.com/elmusleh/independent-youtube-playlist-manager" target="_blank" rel="noreferrer noopener"><img width="128" alt="IYPM logo" src="https://raw.githubusercontent.com/elmusleh/independent-youtube-playlist-manager/main/apps/web-portal/public/icon.png"></a></p>
<p align="center">Independent YouTube Playlist Manager (IYPM) <strong>organizes</strong> and <strong>manages</strong> YouTube playlists client-side with <strong>privacy by default</strong>.</p>
<br/>
<p align="center">
  <a rel="noreferrer noopener" href="https://chromewebstore.google.com/"><img alt="Chrome Web Store" src="https://img.shields.io/badge/Chrome-141e24.svg?&style=for-the-badge&logo=google-chrome&logoColor=white"></a>
  <a rel="noreferrer noopener" href="https://addons.mozilla.org/firefox/addon/independent-youtube-playlist-manager/"><img alt="Firefox Add-ons" src="https://img.shields.io/badge/Firefox-141e24.svg?&style=for-the-badge&logo=firefox-browser&logoColor=white"></a>
  <a rel="noreferrer noopener" href="https://microsoftedge.microsoft.com/"><img alt="Edge Addons" src="https://img.shields.io/badge/Edge-141e24.svg?&style=for-the-badge&logo=microsoft-edge&logoColor=white"></a>
  <img alt="Brave" src="https://img.shields.io/badge/Brave-141e24.svg?&style=for-the-badge&logo=brave&logoColor=white">
  <img alt="Opera" src="https://img.shields.io/badge/Opera-141e24.svg?&style=for-the-badge&logo=opera&logoColor=white">
  <img alt="Vivaldi" src="https://img.shields.io/badge/Vivaldi-141e24.svg?&style=for-the-badge&logo=vivaldi&logoColor=white">
</p>

<h2 align="center">Independent YouTube Playlist Manager (IYPM)</h2>
<br/>
<p align="center">IYPM is an <strong>open-source</strong>, privacy-first <strong>browser extension</strong> designed to replace and enhance YouTube's native playlist management. It operates entirely <strong>client-side</strong>, storing your data locally and syncing on-demand to your YouTube account without any intermediate third-party servers.</p>
<br/>
<br/>

## Questions & Discussions

Most questions can be answered by reading the [Support & FAQ](docs/SUPPORT.md) page or the [User Guide](docs/USER_GUIDE.md).
If you have other questions, open a new [discussion](https://github.com/elmusleh/independent-youtube-playlist-manager/discussions) or submit an [issue](https://github.com/elmusleh/independent-youtube-playlist-manager/issues).

## Supported Browsers

IYPM is fully compatible with all modern web browsers:

*   **Google Chrome:** Install directly from the Chrome Web Store.
*   **Mozilla Firefox:** Install from Firefox Add-ons (desktop & Android/Fenix).
*   **Chromium-based browsers (Edge, Brave, Opera, Vivaldi, etc.):** 
    *   Fully supported using the Chrome package (`dist/chrome`).
    *   Install directly from the Chrome Web Store or Microsoft Edge Add-ons store.
*   **Apple Safari:**
    *   Safari support is experimental. You can compile the extension for Safari using Xcode's converter:
        ```bash
        xcrun safari-web-extension-converter dist/chrome
        ```

---

## Features

*   **Offline-first:** Edit, reorder, merge, split, and search your playlists without internet connection.
*   **Bulk Editing:** Drag-and-drop, pagination support, bulk-select and delete, duplicates removal, and reverse sorting.
*   **Tab Harvester:** Import all open YouTube tabs from active browser windows with a single click.
*   **Flexible Import/Export:** Backup database to **JSON (Schema v2)**, or export to **CSV** and **M3U** playlists.
*   **Zero Data Collection:** Fully client-side. No user profiles, tracker links, or telemetry.

### Comparison: IYPM vs Native YouTube Playlists

| Capability | Independent YouTube Playlist Manager (IYPM) | Native YouTube Playlists |
|---|---|---|
| **Creating playlists** | ✅ Create **unlimited playlists** with a few clicks. Batch-add dozens of videos. | ⚠️ Add videos one by one manually (very slow). |
| **Adding open browser tabs** | ✅ Harvester grabs open YouTube tabs from **all browser windows** automatically. | ❌ Not possible. |
| **Text & HTML Scraping** | ✅ Extract video IDs from raw HTML source, clipboard paste, or text blocks. | ❌ Not possible. |
| **Bulk Edit Tools** | ✅ Merge, split, reverse, sort, and de-duplicate. Bulk select and delete. | ❌ Manual per-video deletion only. No merge/split tools. |
| **Works Offline** | ✅ Yes, data is stored in IndexedDB and local storage. | ❌ Requires active connection and YouTube session. |
| **Data Portability** | ✅ 1-click export to **JSON**, **CSV**, and **M3U** (VLC). | ❌ Locked into Google ecosystem. |

---

## How to contribute

Read more about contributing to IYPM, code guidelines, and submission checklists in [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Building for use

Building IYPM requires a JavaScript runtime. We recommend **Node.js** (LTS or higher).

### 1. Download the source code
```bash
# Clone with submodules (required for validation assets)
git clone --recurse-submodules https://github.com/elmusleh/independent-youtube-playlist-manager.git
cd independent-youtube-playlist-manager
```

### 2. Install dependencies
```bash
npm install
cd apps/browser-extension/playlist-editor && npm install
cd ..
```

### 3. Build the extension
```bash
npm run build
```
This compiles the Svelte 5 application and bundles the extension into:
*   **`dist/chrome/`** — Ready to load in Chrome, Edge, Brave, Opera, Vivaldi.
*   **`dist/firefox/`** — Ready to load in Firefox and Firefox for Android.

To create release ZIP packages for browser stores, run:
```bash
npm run pack
# Generates zip files: independent-youtube-playlist-manager-chrome.zip and independent-youtube-playlist-manager-firefox.zip
```

---

## Loading the extension manually (Developer Mode)

### Chromium (Chrome, Edge, Brave, Opera, Vivaldi)
1. Build the extension: `npm run build`
2. Open `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer mode** (toggle in top-right).
4. Click **Load unpacked** and select the **`dist/chrome/`** folder.

### Firefox (Desktop)
1. Build the extension: `npm run build`
2. Open `about:debugging` in the address bar.
3. Click **This Firefox** (or **This Thunderbird**).
4. Click **Load Temporary Add-on...** and select the **`dist/firefox/manifest.json`** file.

---

## Privacy Policy

No data is collected. All playlist data is stored in your browser's local storage and IndexedDB. YouTube sync uses your own Google OAuth credentials via the YouTube Data API v3. 

See [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md) for the complete policy statement.
