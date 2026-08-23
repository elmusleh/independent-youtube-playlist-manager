# Independent YouTube Playlist Manager - Setup Guide

This guide describes how to install and configure the extension for both Chrome and Firefox using Manifest V3 (MV3).

## 1. Browser Installation

Before loading the extension in any browser, build the project output first from the root directory:

```bash
npm run build
```

### Google Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top right).
3. Click **Load unpacked** and select the `dist/chrome/` folder of this project.
4. Copy the **Extension ID** displayed on the extension's card (e.g., `lppdplclfhchgkgckfmkopomahlpfjok`).

### Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `dist/firefox/manifest.json`.
4. The Extension ID is defined in `manifest.firefox.json` as `{790842fe-fecb-4375-a127-95c1c1d35d3e}`.

---

## 2. Google Cloud Console Configuration

The extension works fully offline without any Google account. This section is **only required if you want YouTube account sync** (pushing playlists to your real YouTube account via the YouTube Data API v3).

### Create a Project & API Key
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., "Independent YouTube Playlist Manager").
3. Go to **APIs & Services > Library**.
4. Search for **YouTube Data API v3** and click **ENABLE**.

### Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Select **User Type: External** and click **Create**.
3. Fill in the mandatory fields: **App name**, **User support email**, and **Developer contact information**.
4. Click **Save and Continue** until you reach the **Test users** section.
5. Add your Gmail address as a test user.

### Create OAuth 2.0 Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **CREATE CREDENTIALS > OAuth client ID**.
3. Select **Application type: Web application**.
4. Add the following **Authorized redirect URIs**:
    * **For Chrome:** `https://<YOUR_CHROME_ID>.chromiumapp.org/` (e.g. `https://lppdplclfhchgkgckfmkopomahlpfjok.chromiumapp.org/`).
    * **For Firefox (Desktop/Android):** `https://{790842fe-fecb-4375-a127-95c1c1d35d3e}.extensions.allizom.org/`
5. Click **Create**.
6. Copy the **Client ID**.

---

## 3. Update the Extension Credentials
1. Open `apps/browser-extension/apps/browser-extension/playlist-editor/apps/browser-extension/services/youtube-auth.ts`.
2. Update the `CLIENT_ID` constant with your new **Client ID** from Step 2.
3. Run `npm run build` and **Reload** the extension in your browser.

---

## 4. First-Time Login
1.  Click the extension icon and select **Open playlist editor**.
2.  If the Google login screen appears with a "Google hasn't verified this app" warning:
    *   Click **Advanced**.
    *   Click **Go to [App Name] (unsafe)**.
3.  Grant the requested permissions to manage your YouTube account.

---

## 5. YouTube API Quota Limitations

The extension uses the YouTube Data API v3 which has daily quota limits that affect large playlist syncs.

### Understanding the Limits
- **Default quota**: 10,000 units per day per user
- **Cost per video addition**: 50 units (`playlistItems.insert`)
- **Maximum videos per day**: ~200 videos (10,000 ÷ 50)

### Multi-Day Sync Support
When syncing large playlists (e.g., 800+ videos), the extension now supports **automatic resume**:

1. **Progress Tracking**: The extension saves sync progress after each video
2. **Resume Capability**: If you hit the quota limit, you can resume syncing the next day
3. **Auto-Retry**: The extension automatically schedules a retry after 24 hours
4. **No Duplicates**: The extension detects existing partial syncs and asks whether to resume or start fresh

### What Happens When Quota is Exceeded
- Current progress is saved automatically
- You'll see a message: "API quota exceeded (148/800 videos synced). 652 videos remaining."
- The extension schedules an automatic retry in 24 hours
- You can also manually click "Sync" at any time to resume

### Tips for Large Playlists
- Large playlists (500+ videos) will take 2-3 days to fully sync
- You don't need to keep the extension open - progress persists
- Both local and YouTube copies are kept after sync (safe by default)
- You can cancel auto-retry from the playlist if needed
