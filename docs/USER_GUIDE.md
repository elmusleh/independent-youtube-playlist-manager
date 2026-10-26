# Independent YouTube Playlist Manager - Setup Guide

This guide describes how to install and configure the extension for Chrome, Microsoft Edge, and Firefox using Manifest V3 (MV3).

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

### Microsoft Edge

1. Open Edge and navigate to `edge://extensions/`.
2. Enable **Developer mode** (toggle in the left sidebar).
3. Click **Load unpacked** and select the `dist/edge/` folder of this project.
4. Edge assigns an extension ID to the unpacked build. It differs from Chrome's ID; use the ID shown on the Edge card for Edge-specific OAuth redirects.

### Mozilla Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `dist/firefox/manifest.json`.
4. The Extension ID is defined in `manifest.firefox.json` as `independent-yt-playlist-manager@elmusleh.github.io`.

---

## 2. Google Cloud Console Configuration

The extension works fully offline without any Google account. This section is **only required if you want YouTube account sync** (pushing playlists to your real YouTube account via the YouTube Data API v3).

### Create a Project

An OAuth Client ID (created below) is required for account sync. The API key is optional and is used only as a fallback for signed-out public metadata lookups.

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
   - **For Chrome:** `https://<YOUR_CHROME_ID>.chromiumapp.org/` (e.g. `https://lppdplclfhchgkgckfmkopomahlpfjok.chromiumapp.org/`).
   - **For Microsoft Edge:** `https://<YOUR_EDGE_ID>.chromiumapp.org/` (use the ID shown on `edge://extensions/`).
   - **For Firefox (Desktop/Android):** Copy the exact Firefox/Android redirect URI shown on the extension's **API Setup** page and add it here.
5. Click **Create**.
6. Copy the **Client ID**.

> If you use optional Supabase sync, add the equivalent `/supabase` redirect URL (for example, `https://<YOUR_EDGE_ID>.chromiumapp.org/supabase`) to your Supabase Auth redirect allow list for each browser you use.

---

## 3. Configure the Extension Credentials

1. Open the extension's **API Setup** page.
2. Paste your **OAuth Client ID** from Step 2.
3. Optionally paste an **API Key** from Step 2.
4. Click **Test Connection** to verify the credentials.

> The API key is not needed for OAuth-based account sync. It only helps signed-out metadata lookups use your own quota.

---

## 4. First-Time Login

1.  Click the extension icon and select **Open playlist editor**.
2.  If the Google login screen appears with a "Google hasn't verified this app" warning:
    - Click **Advanced**.
    - Click **Go to [App Name] (unsafe)**.
3.  Grant the requested permissions to manage your YouTube account.

---

## 5. YouTube API Quota Limitations

The extension uses the YouTube Data API v3 which has daily quota limits that affect large playlist syncs.

### Understanding the Limits

- **Default quota**: 10,000 units per day per Google Cloud project
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

## 6. Data Manager (metadata health)

Open **Data Manager** from the sidebar (the wand icon, at the bottom, with a badge
showing how many videos need attention) or from **Settings → Metadata → Open Data
Manager**.

### What it shows

The cards at the top count the cached metadata entries:

| Card              | Meaning                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| Cached entries    | Videos with a metadata row in the local database                                                      |
| Complete          | Resolved: title, channel and duration are present, or the video is known to be private/deleted/broken |
| Needs attention   | Everything that is not resolved — this is the number on the sidebar badge                             |
| Missing duration  | Has a title and channel but no usable duration                                                        |
| Live streams      | Explicitly reported as live, so a duration is not expected                                            |
| Private / deleted | Can never be fetched again; counted as resolved                                                       |

`Complete + Needs attention` always equals `Cached entries`.

### Fixing missing metadata

- **Refresh Missing Metadata** re-fetches every entry that needs attention, in
  batches of 50, with live progress.
- **Retry** on a single row re-fetches just that video.
- **Remove Incomplete Entries** deletes the incomplete rows so they are fetched again
  the next time a playlist containing them is opened.
- **Clear All Cache** wipes the metadata cache entirely.

Refreshing is non-destructive: a video that cannot be resolved keeps whatever was
already cached (its title and channel included). Only "Remove" and "Clear All Cache"
delete anything, and both ask for confirmation first.

### Extraction engines

The engine list shows which tiers are currently enabled and in what order they are
tried. Only **Innertube**, **Embed** and **Piped/Invidious** can return a duration;
**oEmbed** guarantees a title and channel but never a duration. If durations are
missing en masse, check that those three tiers are enabled in
**Settings → Metadata**.

### When to use it

- Playlists show "unknown length" or blank durations after an import.
- Videos were added while offline or while YouTube was rate-limiting.
- You changed metadata settings and want to re-check the cache.

The badge on the sidebar entry disappears once every cached entry is resolved.
