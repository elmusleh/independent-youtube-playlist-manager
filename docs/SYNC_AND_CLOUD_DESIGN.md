# Cross-Device Sync — Design & Discussion Document

> **Status:** Living document — the single source of truth for the sync feature's direction.
> Update this file as decisions are made; do not let it go stale.
> Last updated: 2026-11-02 (added grounded browser-capability matrix + simple/advanced flows).

---

## 1. The Core Question

> **What problem does this feature solve?**

Users maintain playlists on multiple devices (desktop Chrome/Firefox, Android/Fenix,
another computer). Today the only way to move playlists between devices is the
**manual export → transfer file → import** flow. That is slow, error-prone, and
silently loses data when the user forgets to do it.

The goal is **automatic, encrypted sync between devices** so a playlist added on one
device appears on the others without manual steps.

---

## 2. What "Sync" Must Mean (Non-Negotiable Principles)

1. **Zero-knowledge.** The sync backend must never be able to read the user's
   playlists. Data is encrypted on-device with a key only the user holds.
2. **Sync-key-only identity.** The only credential is a human-readable sync key.
   No email, no password, no account, no recovery. **Lose the key = lose the data**
   is the accepted tradeoff. This is the single path — no email/password recovery
   path is to be added later.
3. **Automatic, not manual.** Once paired, sync happens in the background on data
   change. No export/import ritual.
4. **Bring-your-own-backend (BYO).** The user must be able to use _their own_ sync
   transport — self-hosted Supabase, Syncthing, free file sync, WebDAV, a shared
   folder — not be locked into a single cloud provider.
5. **Lossless.** Conflict resolution must never silently drop data. Revision-based
   Last-Write-Wins with strict "newer wins, ties keep local" is the agreed model.

---

## 3. Browser & Device Compatibility (GROUNDED — verified 2026-11-02)

This is the section that answers "will it work on _my_ browser/device?". It is based
on current browser capabilities, not assumption, and it drives every transport decision.

### 3.1 The facts

**File System Access API pickers** (`showOpenFilePicker` / `showSaveFilePicker` /
`showDirectoryPicker`) — the thing that lets a page/extension read & write a
user-chosen file or folder:

- **Chromium only** (Chrome/Edge desktop since 86, Chrome Android since 132).
- **Firefox: does not implement them** (Mozilla standards position: _negative_).
- **Safari: does not implement them** (WebKit standards position: _oppose_).

Firefox's only file access is the **`downloads` API** (save a file into the Downloads
folder — no arbitrary read, no folder picker) plus reading files the user explicitly
drops or selects via `<input type="file">`.

**Firefox for Android (Fenix):** supports WebExtensions since v120, but NOT `commands`,
`omnibox`, `bookmarks`, `history`, `sessions`, `devtools.*`, native messaging, or the
managed storage area — and no file-system access.

**Chrome for Android:** no extension support at all. The extension cannot be installed
there.

**Safari (iOS or macOS):** not a target — the project ships Chrome/Firefox/Edge
manifests only; there is no Safari build.

### 3.2 The compatibility matrix (what the UI must show the user)

| Platform                        | Extension installs? | Supabase (encrypted blob) | File / Syncthing transport                           |
| ------------------------------- | ------------------- | ------------------------- | ---------------------------------------------------- |
| **Chrome / Edge** desktop       | ✅ Yes              | ✅ Works                  | ✅ Works (folder picker)                             |
| **Firefox** desktop             | ✅ Yes              | ✅ Works                  | ⚠️ Partial — downloads-folder only, no folder picker |
| **Firefox for Android** (Fenix) | ✅ Yes (v120+)      | ✅ Works                  | ❌ No file access                                    |
| **Chrome** for Android          | ❌ Cannot install   | —                         | —                                                    |
| **Safari** iOS / macOS          | ❌ Not built        | —                         | —                                                    |

**Key consequences:**

1. **The only transport that works everywhere the extension runs is Supabase.**
   If a user wants to sync a phone, Supabase is the _only_ option (Firefox Android has
   no file access, and Chrome Android has no extensions at all).
2. **File/Syncthing is a desktop-Chromium feature.** It is the "advanced / privacy
   maximalist" path: no account, no server, but only on Chrome/Edge desktop (and, in
   a degraded download-only form, Firefox desktop).
3. **The UI must detect the running browser/device and show an honest
   ✅ works / ⚠️ partial / ❌ not available badge per option** — not a flat list.

---

## 4. The Backend Transport Question (the big one)

The user explicitly asked whether we can support **"the user's own sync method —
Syncthing, free file sync, etc."** The answer is **yes, as one of two transports**.

### Model A — Supabase BYO (hosted, encrypted)

The extension uploads an encrypted blob to a Supabase project the user supplies (their
own URL + anon key). Zero-knowledge holds: Supabase only sees ciphertext. Free tier
works. Works on **all** extension-capable platforms including Firefox Android.

### Model B — File / Syncthing (self-hosted, encrypted)

The extension writes an encrypted blob into a user-chosen folder (File System Access
API). A _separate_ tool — Syncthing, free file sync, Dropbox, a USB stick — moves that
file between devices. The extension watches for a newer incoming blob and merges it.
**Chromium desktop only** (see §3).

Both share the same crypto + snapshot codec; the transport is a thin pluggable
interface:

```
interface SyncTransport {
  push(address, encryptedBlob, revision): Promise<{ pushed: boolean }>;
  pull(address): Promise<{ blob, revision } | null>;
}

SupabaseTransport  // Model A — timer-driven push/pull
FileTransport      // Model B — read/write an encrypted file at a chosen path
```

### The "truly simple person" gap (open product decision)

For a **non-technical user** to sync their phone with **zero** backend setup, the
developer would have to **host a sync relay** (a Supabase/cloud endpoint the extension
talks to by default). That:

- Costs money to operate, and
- Changes the privacy story slightly (still zero-knowledge/encrypted, but the
  developer runs the server).

Without that, "simple" still means the user creates a **free Supabase project** (one-time,
~5 minutes) — which we can smooth with a guided wizard. This is a business decision the
owner must make; it is **not** a technical blocker.

---

## 5. Current State (What Exists Today)

### 5.1 Service Layer — COMPLETE & TESTED

| Module           | File                             | Purpose                                                                            | Tests |
| ---------------- | -------------------------------- | ---------------------------------------------------------------------------------- | ----- |
| Sync key         | `sync/sync-key.ts`               | Generate/validate/format 100-bit Crockford base32 keys (`ABCDE-FGHJK-MNPQR-STVWX`) | ✅    |
| Key derivation   | `sync/key-derivation.ts`         | PBKDF2 (600k iter) → AES key + SHA-256 storage address                             | ✅    |
| Encryption       | `sync/encryption-service.ts`     | AES-256-GCM authenticated encrypt/decrypt                                          | ✅    |
| Snapshot codec   | `sync/snapshot-codec.ts`         | Encode/decode + revision comparison (LWW)                                          | ✅    |
| Content selector | `sync/content-selector.ts`       | Granular selection of what to sync                                                 | ✅    |
| Supabase service | `sync/encrypted-sync-service.ts` | Upload/download/sync with atomic LWW revision guard                                | ✅    |

These are solid, tested, and merged (PR #71, #78).

### 5.2 UI Layer — INCOMPLETE & PROBLEMATIC

| Piece                    | File                             | Status   | Problems                                                   |
| ------------------------ | -------------------------------- | -------- | ---------------------------------------------------------- |
| "Plugins" sidebar button | `Sidebar.svelte`                 | ✅ added | **Wrong name** — "Plugins" is unclear                      |
| Plugins view             | `views/Plugins.svelte`           | ✅ added | **Amateur visual**, unclear purpose, wrong toggle-first UX |
| Sync settings            | `components/SyncSettings.svelte` | ✅ added | Works but buried in Settings, no pairing narrative         |
| Auto-sync manager        | `services/sync-manager.ts`       | ✅ added | Uses localStorage, no backend config                       |
| Supabase BYO config      | _(missing)_                      | ❌       | No UI to point at a user's own Supabase                    |
| File transport           | _(missing)_                      | ❌       | No Syncthing/file path                                     |
| Capability badges        | _(missing)_                      | ❌       | No per-browser ✅/⚠️/❌ indicator                          |
| Sync status              | _(missing)_                      | ❌       | No "last synced / errors / device count"                   |

### 5.3 Confirmed Defects

1. **"Plugins" naming** — ambiguous. Rename to **"Sync"**.
2. **Visual quality** — flat card grid, doesn't match the polished web-portal aesthetic
   or the extension's own design tokens.
3. **Toggle-first UX** — user must flip "Enabled" _before_ seeing config. Wrong order.
4. **"Configure →" dead link** — points at `/settings` and `/api-setup`, neither is a
   real config surface; clicking yields a blank/error page.
5. **localStorage misuse** — sync credentials in `localStorage` (ephemeral) instead of
   `browser.storage.local` (durable). Browser cleanup silently unpairs devices.

---

## 6. Proposed Redesign

### 6.1 Sidebar

Rename the footer button **"Plugins" → "Sync"** (icon `faArrowsRotate`). Keep it in the
footer near Settings.

### 6.2 The Sync view (replaces `Plugins.svelte`)

Purpose-first, no toggle gate, capability-aware, matching the web portal's card/typography
feel and the extension's `design-tokens.css`:

```
┌─────────────────────────────────────────────┐
│  Sync                                       │
│  Keep your playlists in sync across devices │  ← one-line purpose
├─────────────────────────────────────────────┤
│  ● Device pairing                           │
│    [ Generate key ]   [ I have a key ]      │
│    key: ABCDE-FGHJK-MNPQR-STVWX  [Copy]     │
│    Status: ● Paired on 2 devices            │
│                                             │
│  ● How your data travels (backend)          │
│    (•) Supabase  ✅ works on this browser    │
│        [ URL ______ ] [ anon key ________ ] │
│    ( ) File / Syncthing  ⚠️ desktop Chrome   │
│        [ Choose folder ]                    │
│                                             │
│  ● What to sync                             │
│    [x] Playlists   [ ] Settings   [ ] History│
│                                             │
│  ● Status                                   │
│    Last synced: 2 min ago  ●  No errors     │
└─────────────────────────────────────────────┘
```

Key changes vs today:

- **Purpose first** — a subtitle explains what sync is in one sentence.
- **No toggle gate** — everything visible; entering a key + backend = enabled.
- **Capability badges** — each backend shows ✅/⚠️/❌ for _this_ browser/device.
- **Backend explicit** — the user chooses how data travels (the "own sync method" ask).
- **Status always visible** — "last synced / errors / device count".

### 6.3 Visual language

Use the extension's `design-tokens.css` (brand primary `#065fd4`, radius tokens,
spacing scale, Inter typeface) and match the web portal's card/typography feel.
**No bespoke hex values** (`#ddd`, `#f9f9f9`) — always `var(--...)`. Reuse existing
`ViewHeader`, `SimpleButton`, and settings-card patterns for consistency.

---

## 7. User Flows (Simple vs Advanced)

### 7.1 Simple person — sync their phone with their computer

**The mobile reality first:** a phone can only run **Firefox for Android (Fenix)** —
Chrome Android has no extensions, Safari has no build. And Fenix has no file access,
so the phone side **must** use Supabase. Therefore the "simple" flow is Supabase-based.

**With a developer-hosted relay (if the owner opts to host one):**

1. Desktop: open **Sync** → tap **"Start syncing"** → a QR code + key appears. _(1 step)_
2. Phone: install the extension → **Sync** → **"Pair with another device"** → scan the QR. _(1 step)_
3. Done. Playlists now sync automatically in both directions.

Total: **~3 steps**, zero backend setup.

**Without a hosted relay (Supabase BYO, free tier):**

1. Desktop: open **Sync** → **"Start syncing"** → **"Connect Supabase"**.
2. A guided wizard walks the user through creating a _free_ Supabase project and
   pasting two values (URL + anon key). _(one-time, ~5 min)_
3. Desktop now shows a sync key + QR code.
4. Phone: install the extension → **Sync** → **"I have a key"** → scan the QR.
5. Done.

Total: **~5 steps, one-time**, then automatic.

> The hosted-relay decision is the single thing that separates "~3 steps" from
> "~5 steps + a Supabase account". Both are far better than today's export/import.

### 7.2 Advanced person — File / Syncthing (privacy maximalist, desktop)

1. Install **Syncthing** (or use free file sync / Dropbox) on both computers and share
   a folder between them.
2. In the extension: **Sync → How your data travels → File / Syncthing → Choose folder**.
3. The extension writes an encrypted blob into that folder; Syncthing moves it; the
   other device reads and merges it automatically.

Total: **3 steps**, no account, no server, fully private. **Chromium desktop only.**

---

## 8. Task Breakdown (Proposed Order)

| #   | Task                                                                   | Priority | Notes                               |
| --- | ---------------------------------------------------------------------- | -------- | ----------------------------------- |
| 1   | Move sync key + backend config to `browser.storage.local`              | **P0**   | Correctness; stops data loss        |
| 2   | Rename "Plugins" → "Sync" (sidebar + view + route)                     | **P0**   | Clarity                             |
| 3   | Rebuild Sync view (purpose-first, no toggle gate, professional design) | **P0**   | UX fix                              |
| 4   | Add capability detection + per-browser ✅/⚠️/❌ badges                 | **P0**   | Answers the compatibility ask       |
| 5   | Add backend chooser (Supabase BYO + File/Syncthing)                    | **P0**   | Answers BYO requirement             |
| 6   | Implement `FileTransport` (Chromium File System Access)                | **P0**   | The Syncthing path                  |
| 7   | Add sync status ("last synced", errors, device count)                  | **P1**   | Trust/visibility                    |
| 8   | Add "what to sync" checkboxes wired to `content-selector`              | **P1**   | Granularity                         |
| 9   | QR code for key (optional)                                             | **P2**   | Android convenience                 |
| 10  | User-facing compatibility guide (`docs/SYNC_COMPATIBILITY.md`)         | **P0**   | The "clear information" deliverable |

---

## 9. Open Decisions for the Owner

1. **Naming** — "Sync" (recommended) vs "Device Sync" vs "Cloud Sync".
2. **Hosted relay?** — Ship a developer-hosted relay for the ~3-step simple path
   (costs money, we run a server), or keep it Supabase-BYO-only (~5 steps, free)?
   This is the one genuine business decision. Both are built on the same code.
3. **File transport on Firefox desktop** — offer the degraded "save to Downloads /
   load from a file" fallback, or show File/Syncthing as Chromium-only? (Recommendation:
   show ⚠️ "partial" with an honest note, ship the degraded path later.)
4. **API Setup** — keep it as the existing `DeveloperSetup` settings card (it is
   unrelated to sync), or fold it into the Sync page? (Recommendation: leave it
   separate; it is not a sync feature.)

---

## 10. Decisions Log

| Date       | Decision                                                  | Rationale                                       |
| ---------- | --------------------------------------------------------- | ----------------------------------------------- |
| (earlier)  | Sync-key-only identity, no email/password recovery        | Zero-knowledge; "lose key = lose data" accepted |
| (earlier)  | AES-256-GCM + PBKDF2(600k)                                | Standard, reviewed crypto                       |
| (earlier)  | Revision-based LWW (newer wins, ties keep local)          | Lossless, deterministic                         |
| 2026-11-02 | "Plugins" framing rejected                                | Unclear, wrong UX (toggle-first)                |
| 2026-11-02 | Backend must be BYO (Supabase + File/Syncthing)           | User wants own sync method                      |
| 2026-11-02 | Mobile = Firefox Android only; phone sync = Supabase only | Grounded in browser capabilities                |
| 2026-11-02 | File/Syncthing = Chromium desktop only                    | File System Access pickers are Chromium-only    |
| 2026-11-02 | UI must show per-browser ✅/⚠️/❌ capability badges       | User asked for honest "will it work" info       |
