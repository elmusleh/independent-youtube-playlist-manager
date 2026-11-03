# Sync — What Works on Your Browser & Device

> Plain-English guide to what sync can do on each browser and device. Keep this
> accurate — it is the honest "will it work for me?" answer shown in the app.

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

## Compatibility table

| Browser / device                | Can I install it? | Supabase sync | File / Syncthing                   |
| ------------------------------- | ----------------- | ------------- | ---------------------------------- |
| **Chrome** (desktop)            | ✅ Yes            | ✅ Works      | ✅ Works                           |
| **Edge** (desktop)              | ✅ Yes            | ✅ Works      | ✅ Works                           |
| **Firefox** (desktop)           | ✅ Yes            | ✅ Works      | ⚠️ Partial (Downloads folder only) |
| **Firefox for Android** (phone) | ✅ Yes            | ✅ Works      | ❌ Not available                   |
| **Chrome** (Android phone)      | ❌ No             | —             | —                                  |
| **Safari** (iPhone / Mac)       | ❌ Not available  | —             | —                                  |

---

## What each row means

### ✅ Works

The feature is fully available on that browser/device.

### ⚠️ Partial

Works with limits. For example, Firefox desktop can save and load a sync file through
its Downloads folder, but it cannot let you pick any folder on your disk (the browser
does not allow it), so the Syncthing "watch this folder" flow does not work there.

### ❌ Not available

The browser does not allow the extension to do this. There is no workaround.

---

## Important things to know

### 1. Phones = Firefox for Android (and Supabase)

If you want to sync a phone with your computer:

- **Chrome for Android does not run extensions.** You cannot install this extension
  there. This is a Chrome limitation, not ours.
- **Firefox for Android does run extensions** (since version 120). Install the
  extension there.
- On a phone, the **only** sync option is **Supabase**, because phone browsers do not
  let extensions read or write your files.

So the phone path is: **Firefox for Android + Supabase**.

### 2. Safari is not supported

There is no Safari version of this extension. If you use an iPhone or Mac and only
Safari, sync is not available to you yet.

### 3. Your data stays yours

Whatever method you choose, your playlists are **encrypted on your device with a key
only you have**. The server or the sync tool never sees your data — only scrambled
bytes.

### 4. "Lose the key = lose the data"

Because everything is encrypted and there is no account to reset, the **sync key** is
the only way to decrypt your data. If you lose it, the data cannot be recovered. Write
it down and store it safely. This is deliberate — it is what keeps your data private.

---

## Which method should I choose?

| You want…                            | Choose                  | Works on            |
| ------------------------------------ | ----------------------- | ------------------- |
| Easiest phone + computer sync        | Supabase (free project) | All browsers        |
| Total privacy, no account, no server | File / Syncthing        | Desktop Chrome/Edge |
| Sync two desktop computers privately | File / Syncthing        | Desktop Chrome/Edge |
| Sync across many devices incl. phone | Supabase                | All browsers        |

---

## Number of steps

| Path                            | Steps | One-time setup?        |
| ------------------------------- | ----- | ---------------------- |
| Supabase (free project) + phone | ~5    | Supabase project: once |
| File / Syncthing (desktop only) | ~3    | Syncthing: once        |
