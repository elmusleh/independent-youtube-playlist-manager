# Automatic Handling & Background Sync

The YouTube Playlist Helper includes an "Offline-First" synchronization engine designed to keep local changes in sync with YouTube automatically, efficiently, and safely.

## 🚀 How it Works

### 1. Event-Driven Triggers

The extension does not just sync on a schedule; it reacts to user actions:

- **Login Sync**: Automatically pushes all pending local changes to YouTube as soon as you sign in.
- **Throttled Edit-Push**: After you finish editing a playlist, the extension waits for a configurable "Quiet Period" (default: 30s) before automatically syncing the changes to YouTube.
- **Startup Refresh**: When you first open your browser, the extension can perform a lightweight "Discovery Refresh" to see if any playlists were modified elsewhere.

### 2. The Sync Queue

To prevent overwhelming the YouTube API and to stay within your daily 10,000 unit quota, background sync tasks are executed sequentially:

1. **Identify Dirty Playlists**: Any playlist with local changes not yet on YouTube is marked as "Dirty."
2. **Minimalist Diffing**: Instead of re-uploading the whole list, YPH calculates the **minimum number of additions, deletions, and moves** required.
3. **Phase-by-Phase Execution**: Sync is performed in stages (Removals → Additions → Reordering) with a 150ms pacing delay between each request.

---

## 🛡️ Safety & Efficiency

### 🚥 Quota Shield

The extension monitors its own API usage:

- Pauses automatic background synchronization when approaching daily thresholds.
- Shows a "Quota Low" indicator on sync status icons.
- Requires manual sync for remaining changes until the quota resets at midnight Pacific Time.

### ⚡ Power Saving & Resource Conservation

- **Idle Worker Lifecycle**: Under Manifest V3, the background service worker/alarm only wakes up when a pending task exists, consuming 0% CPU when playlists are in sync.
- **Low-Impact Animation**: The "Spinning Icon" in the browser toolbar uses an optimized rendering loop limited to 10 frames per second to prevent unnecessary UI thread load.

### 🔒 Conflict Resolution

If you are editing a playlist in the **Playlist Editor** while a background sync is taking place, the Editor takes priority. The background task pauses gracefully to prevent split-brain state or overwriting active edits.

---

## ⚙️ Configuration

Fine-tune background behaviors in **Settings > Automatic Handling**:

- **Auto-Sync on Change**: Toggle immediate pushes.
- **Throttle Delay**: Adjust wait time after editing (15s to 5 mins).
- **Auto-Sync on Login**: High-priority push after authentication.
- **Show Progress**: Enable per-playlist percentage indicators.
