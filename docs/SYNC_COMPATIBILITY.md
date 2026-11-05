# Sync — What Works on Your Browser & Device

> Plain-English guide to what sync can do on each browser and device. Keep this
> accurate — it is the honest "will it work for me?" answer shown in the app.
>
> **See also:** [`PLATFORM_SUPPORT.md`](PLATFORM_SUPPORT.md) for the full architecture, future platforms, and technical details.

---

## The short version

Sync moves your playlists between devices automatically. It works two ways:

1. **Supabase (cloud)** — an encrypted copy is stored online. You supply your own
   free Supabase project. **Works on every browser that runs the extension.**
2. **File / Syncthing (your own files)** — an encrypted file is written to a folder
   you choose, and a tool _you_ run (Syncthing, free file sync, Dropbox) moves it
   between devices. **Desktop Chrome/Edge only.**

Your playlists are **always encrypted** before they leave your device. No cloud server
— yours or anyone else's — can read them.

---

## Current Compatibility (Production)

| Browser / Device                | Install? | Supabase Sync | File / Syncthing                   | Capture & Inject |
| ------------------------------- | -------- | ------------- | ---------------------------------- | ---------------- |
| **Chrome** (desktop)            | ✅ Yes   | ✅ Works      | ✅ Works                           | ✅ Full          |
| **Edge** (desktop)              | ✅ Yes   | ✅ Works      | ✅ Works                           | ✅ Full          |
| **Firefox** (desktop)           | ✅ Yes   | ✅ Works      | ⚠️ Partial (Downloads folder only) | ✅ Full          |
| **Firefox for Android** (phone) | ✅ Yes   | ✅ Works      | ❌ Not available                   | ⚠️ No menus      |
| **Chrome** (Android phone)      | ❌ No    | —             | —                                  | —                |
| **Safari** (iPhone / Mac)       | ❌ No    | —             | —                                  | —                |

---

## What Each Row Means

### ✅ Works

The feature is fully available on that browser/device.

### ⚠️ Partial

Works with limits. For example, Firefox desktop can save and load a sync file through
its Downloads folder, but it cannot let you pick any folder on your disk (the browser
does not allow it), so the Syncthing "watch this folder" flow does not work there.
Firefox Android has no context menus or keyboard shortcuts.

### ❌ Not Available

The browser/platform does not allow the extension to do this. There is no workaround.

---

## Important Things to Know

### 1. Phones = Firefox for Android (and Supabase)

If you want to sync a phone with your computer:

- **Chrome for Android does not run extensions.** You cannot install this extension
  there. This is a Chrome limitation, not ours.
- **Firefox for Android does run extensions** (since version 120). Install the
  extension there.
- On a phone, the **only** sync option is **Supabase**, because phone browsers do not
  let extensions read or write your files.

So the phone path is: **Firefox for Android + Supabase**.

### 2. Safari Is Not Supported

There is no Safari version of this extension. If you use an iPhone or Mac and only
Safari, sync is not available to you yet.

### 3. Your Data Stays Yours

Whatever method you choose, your playlists are **encrypted on your device with a key
only you have**. The server or the sync tool never sees your data — only scrambled
bytes.

### 4. "Lose the Key = Lose the Data"

Because everything is encrypted and there is no account to reset, the **sync key** is
the only way to decrypt your data. If you lose it, the data cannot be recovered. Write
it down and store it safely. This is deliberate — it is what keeps your data private.

---

## Which Method Should I Choose?

| You want…                            | Choose                  | Works on            |
| ------------------------------------ | ----------------------- | ------------------- |
| Easiest phone + computer sync        | Supabase (free project) | All browsers        |
| Total privacy, no account, no server | File / Syncthing        | Desktop Chrome/Edge |
| Sync two desktop computers privately | File / Syncthing        | Desktop Chrome/Edge |
| Sync across many devices incl. phone | Supabase                | All browsers        |

---

## Number of Steps

| Path                            | Steps | One-time setup?        |
| ------------------------------- | ----- | ---------------------- |
| Supabase (free project) + phone | ~5    | Supabase project: once |
| File / Syncthing (desktop only) | ~3    | Syncthing: once        |

---

## 🔮 Coming Soon — Future Platforms (Client-Only)

> These platforms are **planned or in design**. They appear in the app as **blurred/disabled cards** with "Coming Soon" badges.
>
> **Key limitation:** They are **client-only** — they **consume** your synced playlists but **cannot capture** from YouTube pages (no right-click menus, no auto-fetch, no history tracking). You create/manage playlists on desktop, then watch them on these platforms.

| Platform                      | Target Devices                                                | Sync Method     | Playback                   | Status                  |
| ----------------------------- | ------------------------------------------------------------- | --------------- | -------------------------- | ----------------------- |
| **Web Portal (TV & Tablet)**  | Smart TV browsers, tablets, any browser                       | Supabase        | Deep-link → YouTube app    | **Design complete**     |
| **Native Android App**        | Android phones, tablets, **Android TV / Google TV / Fire TV** | Supabase        | Deep-link → YouTube app    | **Architecture ready**  |
| **iOS / iPadOS App**          | iPhone, iPad                                                  | Supabase        | `youtube://` → YouTube app | Free with Android build |
| **Desktop Companion (Tauri)** | Windows, macOS, Linux (native app)                            | Supabase / File | System browser             | Low priority            |

### What "Client-Only" Means for These Platforms

| ✅ WILL HAVE                                   | ❌ WILL NOT HAVE                          |
| ---------------------------------------------- | ----------------------------------------- |
| View all synced playlists                      | Right-click "Add to Playlist" on YouTube  |
| Sort by name/date/count                        | Auto-capture watch history                |
| Search/filter playlists                        | Auto-fetch metadata while browsing        |
| Play playlist → opens YouTube app              | "Import from this page" popup             |
| Manual sync trigger (pull-to-refresh)          | Keyboard shortcuts                        |
| See sync status (last synced, devices)         | Content script injection                  |
| Pair new device (QR / code)                    | Background auto-sync (varies by platform) |
| Choose what syncs (playlists/settings/history) |                                           |

### How Pairing Works (No Typing on TV Remote!)

```
1. Desktop Extension → Sync → "Pair New Device" → Shows QR code + 6-digit code
2. On TV/Tablet/Phone → Open Web Portal or Native App → "Pair Device"
3. Scan QR with phone camera OR enter 6-digit code on phone
4. Phone sends encrypted sync key to TV/app via secure channel
5. Done — playlists appear automatically
```

**You never type the 25-character sync key on a TV remote.**

---

## Related Documents

| Document                                               | Purpose                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| [`PLATFORM_SUPPORT.md`](PLATFORM_SUPPORT.md)           | Full architecture, technical details, developer guide       |
| [`SYNC_AND_CLOUD_DESIGN.md`](SYNC_AND_CLOUD_DESIGN.md) | Sync architecture, transport models, user flows             |
| [`SYNC_PROTOCOL.md`](SYNC_PROTOCOL.md)                 | Technical protocol spec (collections, encryption, HLC, LWW) |
| [`SYNC_RELAY_SETUP.md`](SYNC_RELAY_SETUP.md)           | Supabase project setup for sync relay                       |
| [`USER_GUIDE.md`](USER_GUIDE.md)                       | End-user setup and usage guide                              |
