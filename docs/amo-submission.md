# Firefox AMO & Chrome Web Store Submission Guide (AI Agent Optimized)

This document is the consolidated single point of truth for submitting the **Independent YouTube Playlist Manager** (IYPM) extension to the Firefox Add-ons (AMO) directory and the Chrome Web Store. It contains all forms, copy-paste fields, reviewer notes, licensing details, and technical documentation.

---

## 📋 1. Extension Store Information & Metadata

Copy-paste these fields into the AMO **"Describe Add-on"** and **"Additional Details"** forms:

- **App Name**: Independent YouTube Playlist Manager
- **Gecko Extension ID**: `independent-yt-playlist-manager@elmusleh.github.io`
- **Gecko Min Version**: Desktop `140.0`+, Android `142.0`+ (prevents validator warnings)
- **Manifest Target**: [`manifest.firefox.json`](../apps/browser-extension/manifest.firefox.json)
- **Homepage**: `https://github.com/el-musleh/independent-youtube-playlist-manager`
- **Support URL**: `https://github.com/el-musleh/independent-youtube-playlist-manager/issues`
- **Summary (US English)** (max 250 chars): YouTube playlist editor and manager. Build, edit, and sync playlists directly in your browser with local storage and optional YouTube sync.
- **Description (US English)**:
  Independent YouTube Playlist Manager gives you a full playlist management experience on top of YouTube. Build, edit, and sync playlists without leaving your browser — no third-party service required.

  Features:
  - Playlist Editor: add videos from URLs/IDs, drag-and-drop reorder, bulk select & delete, reverse order, remove duplicates, import/export
  - Playlist Builder: right-click any YouTube video to queue it for a new playlist
  - Saved Playlists: offline-first local storage with optional YouTube sync; adopt existing playlists and manage them in one place
  - Favorite Playlist: pin a playlist for instant quick-add from the toolbar popup
  - Quick Add Popup: one-click add of the current video to Favorite, Latest, or any saved playlist
  - Settings: light/dark/device theme, per-page video count, cache duration, thumbnail toggle, auto-remove duplicates

  No data is collected. All playlist data stays in your browser's local storage. YouTube sync uses your own OAuth credentials via the YouTube Data API v3.

- **Tags**: `youtube`, `playlist`, `video`, `manager`, `editor`, `tool`, `productivity`, `helper`

---

## 🎛️ 2. AMO Form Checkboxes & Choices

During the multi-step AMO submission form, configure these options exactly:

### Step A: Submit a New Version / Add-on

- **Distribution Channel**: Choose **"On this site (Listed)"** to make the extension discoverable in search results on AMO.
- **Upload Package**: Upload the compiled Firefox zip file: `dist/independent-youtube-playlist-manager-firefox.zip`.

### Step B: Source Code Upload (Mandatory)

- **Question**: _"Does your add-on contain compiled, minified or obfuscated source code?"_
- **Choice**: Select **Yes**. (The Svelte options page compiles into a minified bundle).
- **Upload Source**: Generate and upload a clean ZIP of the repository source code (excluding `node_modules` and builds):
  ```bash
  # Generate the clean source code ZIP from git
  git archive -o source-code.zip HEAD
  ```
  Upload the generated `source-code.zip` file directly.

### Step C: Details & Experience

- **License**: Choose **MIT License**. (See the MIT license text below).
- **EULA**: **Do NOT check** the _"This add-on has an End-User License Agreement"_ box.
- **Privacy Policy**: **DO check** the _"This add-on has a Privacy Policy"_ box.
  - **Privacy Policy URL**: Use the following link:
    `https://github.com/elmusleh/independent-youtube-playlist-manager/blob/main/docs/PRIVACY_POLICY.md`
- **Categories**:
  - _Primary_: `Photos, Music & Videos`
  - _Secondary_: `Productivity`
- **Screenshots**: Upload the 6 generated screenshots located in [`docs/screenshots/`](screenshots/).
- **Promo Banners**: Upload the promotional banners from [`docs/assets/`](assets/):
  - _Small Promo_: `small-promo-440x280.png`
  - _Marquee_: `marquee-promo-1400x560.png`

---

## 📝 3. Copy-Paste Version Notes & Reviewer Fields

### Version Notes / What's New in this Version? (v1.0.0)

Paste this into the **"Version Notes"** field:

```text
First official release of the rebranded Independent YouTube Playlist Manager (v1.0.0). Upgraded extension UI to Svelte 5 and TypeScript. Implemented a zero-quota-first 5-tier video metadata fetcher (MWEB Innertube, Embed Page Headless, oEmbed, API v3, Piped/Invidious) and added a Next.js 15 Web Portal dashboard with Supabase cloud backup sync support.
```

### Notes for Reviewers

Paste this into the **"Notes for Reviewers"** field on AMO (explains compilation and permissions):

```text
Technical Overview:
- Authentication: The extension uses browser.identity.launchWebAuthFlow for YouTube OAuth 2.0 authentication.
- Data Storage: All playlist data is stored locally in browser.storage.local. No data is transmitted to any third-party server except Google's YouTube Data API v3 for sync features.
- API Calls: The extension calls the YouTube Data API v3 (https://www.googleapis.com/) only when the user explicitly triggers a sync operation.
- Source Code: Full source code is available at https://github.com/elmusleh/independent-youtube-playlist-manager
- Permissions: The extension requests identity, storage, tabs, activeTab, contextMenus, scripting, unlimitedStorage, alarms, and notifications — all used exclusively for playlist management and YouTube sync functionality.
- Data Collection: No personally identifiable information is collected. See docs/PRIVACY_POLICY.md in the repository root.

Build Instructions (for source review):
npm install
cd apps/browser-extension/playlist-manager && npm install && npm run build && cd ..
npm run build-firefox

The built Firefox extension will be in dist/firefox/.

Artifacts:
- Extension ZIP: dist/independent-youtube-playlist-manager-firefox.zip
- Source ZIP: local source archive generated for this AMO submission (do not commit it)
- Signed XPI: dist/firefox/web-ext-artifacts/*.xpi
```

---

## 🔒 4. Technical Details (Permissions, Storage & Background Scripts)

If asked about specific permission usage, host parameters, or background code during submission:

### Permissions and Why They Are Needed

| Permission         | Purpose                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| `tabs`             | Read the active tab URL to detect YouTube videos and extract video IDs             |
| `storage`          | Persist playlists, settings, and OAuth tokens in `browser.storage.local`           |
| `unlimitedStorage` | Remove quota limits so large playlists with many videos can be stored locally      |
| `activeTab`        | Allow the popup to read the current YouTube video when the toolbar icon is clicked |
| `contextMenus`     | Add a "Add to playlist" item to the right-click menu on YouTube video links        |
| `identity`         | Launch the OAuth 2.0 consent flow for YouTube Data API v3 authentication           |
| `scripting`        | Execute helper scripts in the YouTube tab to scrape video metadata                 |
| `notifications`    | Show toast notifications when videos are added to playlists                        |
| `alarms`           | Schedule periodic background tasks for playlist sync reminders                     |

### Host Permissions

| Host                          | Purpose                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `*://www.youtube.com/watch*`  | Inject a content script to track the currently playing video                                       |
| `<all_urls>`                  | Allow context-menu actions and tab-reading on any page (needed for adding arbitrary YouTube links) |
| `https://www.googleapis.com/` | Call the YouTube Data API v3 for syncing playlists to/from YouTube                                 |

### Data Storage & Privacy Details

All data is stored **locally** in `browser.storage.local`:

- Saved playlists (video IDs, titles, order)
- User settings (theme, per-page count, cache duration, etc.)
- OAuth access/refresh tokens for YouTube sync
- Cached video metadata (thumbnails, titles, channel names)

No data is transmitted to any server except Google's YouTube Data API v3 when the user explicitly triggers a sync.

### Remote API Usage

- **YouTube Data API v3** (`https://www.googleapis.com/youtube/v3/*`):
  - Called only when the user initiates a sync operation.
  - Used to: insert videos into YouTube playlists, read existing playlists, update playlist metadata.
  - All requests include the user's own OAuth token; no server-side proxying.

### Content Scripts

- `watch-tracker.js` runs on `*://www.youtube.com/watch*`:
  - Detects video changes and updates the internal "latest watched" video ID.
  - Does not modify page content; read-only.

### Background Script

- `background/index.js` (module entry point):
  - Handles context-menu clicks.
  - Manages alarms for periodic sync.
  - Routes messages between popup, content script, and editor.

### No Remote Code Execution

The extension does not load or execute code from remote URLs. All code is bundled in the extension package.

---

## 📜 5. Copy-Paste MIT License Text

If needed to copy-paste during listing:

```text
MIT License

Copyright (c) 2024-2026 Mohammad El-Musleh <elmusleh.mohammad@gmail.com> and contributors
Portions Copyright (c) 2020 Soufiane Sakhi (original upstream repository)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
