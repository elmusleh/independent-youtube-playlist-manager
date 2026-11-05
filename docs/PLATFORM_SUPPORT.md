# Platform Support & Architecture

> **Status:** Living document — updated as platform support evolves.
> Last updated: 2026-11-05

---

## 1. Architecture Overview (Why Platform Support Works the Way It Does)

### The Core Insight

**Your playlists are not tied to any single app.** They live in an **encrypted sync layer** (Supabase) that any client can read/write — provided it holds your sync key.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYNC BACKEND (Supabase/PostgREST)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ playlists   │  │ history     │  │ settings    │  │ devices     │        │
│  │ collection  │  │ collection  │  │ collection  │  │ collection  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│         ▲               ▲               ▲               ▲                   │
│         │               │               │               │                   │
│         │    Sync Protocol (AES-256-GCM, HLC versioning, LWW conflicts)    │
│         │               │               │               │                   │
└─────────┼───────────────┼───────────────┼───────────────┼───────────────────┘
          │               │               │               │
    ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
    │  Desktop  │   │  Firefox  │   │  Web      │   │  Future   │
    │  Extension│   │  Android  │   │  Portal   │   │  Clients  │
    │  (MV3)    │   │  (Fenix)  │   │  (Next.js)│   │  (Native) │
    └───────────┘   └───────────┘   └───────────┘   └───────────┘
```

**Every client speaks the same protocol.** The backend doesn't care what the client is — it only sees encrypted blobs.

---

## 2. What "WebExtension Runtime" Means (and Why You Don't Need It for Companion Apps)

### What It Is

The **WebExtension Runtime** is the browser's built-in MV3 execution environment that provides privileged APIs:

| API                                            | What It Enables                                 |
| ---------------------------------------------- | ----------------------------------------------- |
| `browser.tabs`                                 | Query, create, update browser tabs              |
| `browser.storage`                              | Persistent, synced storage (local/sync/managed) |
| `browser.contextMenus`                         | Right-click menus on pages                      |
| `browser.webRequest` / `declarativeNetRequest` | Intercept/modify network requests               |
| `browser.scripting`                            | Inject scripts into web pages (content scripts) |
| `browser.alarms`                               | Background timers for periodic work             |
| `browser.runtime`                              | Message passing between extension parts         |
| `browser.identity`                             | OAuth flows (Google, etc.)                      |

### Your Extension Uses These For

| Feature                                   | WebExtension API Used                 |
| ----------------------------------------- | ------------------------------------- |
| Capture video metadata from YouTube pages | `browser.scripting` + content scripts |
| Right-click "Add to Playlist"             | `browser.contextMenus`                |
| Auto-sync in background                   | `browser.alarms` + service worker     |
| Store playlists/settings locally          | `browser.storage.local`               |
| OAuth sign-in for YouTube API             | `browser.identity.launchWebAuthFlow`  |
| Open playlist in new tab                  | `browser.tabs.create`                 |

### Why Companion Apps Don't Need It

| Companion App Task                     | WebExtension API                  | Companion App Equivalent                                         |
| -------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| **Read synced playlists**              | `browser.storage.local.get`       | `supabase.rpc('sync_pull')` + decrypt                            |
| **Sort/filter playlists**              | JS in sidebar                     | JS in React/Svelte/Vue component                                 |
| **Play playlist**                      | `browser.tabs.create({url: ...})` | `window.open('vnd.youtube://...')` or `https://youtube.com/...`  |
| **Background sync**                    | `browser.alarms` + service worker | `setInterval` / Service Worker / WorkManager / native background |
| **Store sync key**                     | `browser.storage.local.set`       | `localStorage` / `AsyncStorage` / Keychain / Keystore            |
| **Crypto (AES-256-GCM, PBKDF2, HKDF)** | `crypto.subtle` (Web Crypto)      | **Same `crypto.subtle`** — works everywhere                      |

**The crypto is pure Web Crypto API — it runs in any modern JavaScript environment.**

---

## 3. Current Platform Support Matrix

### Fully Supported (Production)

| Platform                    | Extension Install? | Sync Method           | Playback | Capture/Inject      | Status         |
| --------------------------- | ------------------ | --------------------- | -------- | ------------------- | -------------- |
| **Chrome Desktop**          | ✅ Yes             | Supabase ✅ / File ✅ | ✅ Tab   | ✅ Full             | **Production** |
| **Edge Desktop**            | ✅ Yes             | Supabase ✅ / File ✅ | ✅ Tab   | ✅ Full             | **Production** |
| **Firefox Desktop**         | ✅ Yes             | Supabase ✅ / File ⚠️ | ✅ Tab   | ✅ Full             | **Production** |
| **Firefox Android (Fenix)** | ✅ Yes (v120+)     | Supabase ✅ only      | ✅ Tab   | ⚠️ No context menus | **Production** |

### Not Supported (Browser Limitations)

| Platform           | Extension Install? | Reason                                              |
| ------------------ | ------------------ | --------------------------------------------------- |
| **Chrome Android** | ❌ No              | Google blocks extensions on mobile Chrome           |
| **Safari iOS**     | ❌ No              | No WebExtension support; different extension system |
| **Safari macOS**   | ❌ Not built       | Requires separate Safari WebExtension build         |

---

## 4. Future Platforms — "Coming Soon" (Planned / In Design)

> **Visual indicator in UI:** These platforms show as **blurred/disabled cards** with "Coming Soon" badges.
> They are **client-only** — they **consume** synced data but **do not capture** from YouTube pages.

### 4.1 Web Portal — TV / Tablet / Any Browser (Highest Priority)

| Aspect          | Detail                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Target**      | Smart TV browsers, tablets, phones (any browser), desktop browsers without extension                                                                                |
| **Tech**        | Next.js 15 (App Router) + Tailwind + shadcn/ui — already exists at `apps/web-portal/`                                                                               |
| **Route**       | `/tv` (TV-optimized), `/dashboard` (full management)                                                                                                                |
| **Sync**        | Supabase only (same protocol, client-side crypto)                                                                                                                   |
| **Playback**    | `vnd.youtube://playlist?list=...` deep-link → opens YouTube app on Android TV / Google TV / Fire TV                                                                 |
| **Pairing**     | QR code / 6-digit code → enter on phone → phone pushes sync key to TV                                                                                               |
| **Limitations** | **Client only** — no content scripts, no YouTube page injection, no auto-capture, no context menus. Background sync via Service Worker (unreliable on TV browsers). |
| **Status**      | **Design complete, implementation ready to start**                                                                                                                  |

**UI Card (Blurred):**

```
┌─────────────────────────────────────────┐
│  📺  Web Portal (TV & Tablet)           │
│  ████████████████████████████████████   │  ← Blurred preview
│  ████████  Coming Soon  █████████████   │
│  ████████████████████████████████████   │
│  ✅ View playlists  ✅ Play on YouTube  │
│  ❌ No capture  ❌ No context menu      │
│  [Notify Me]                              │
└─────────────────────────────────────────┘
```

### 4.2 Native Android App (Phone + Android TV)

| Aspect              | Detail                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **Target**          | Android phones, tablets, **Android TV / Google TV / Fire TV**                                  |
| **Tech**            | **Capacitor** wrapping existing Svelte SPA (`apps/browser-extension/playlist-manager/editor/`) |
| **Sync**            | Supabase (same protocol) — native HTTP + `crypto.subtle` polyfill                              |
| **Playback**        | `vnd.youtube://` deep-link → YouTube app; fallback to embedded YouTube Player API              |
| **Storage**         | EncryptedSharedPreferences (sync key), Room/SQLite (cache)                                     |
| **Background Sync** | `WorkManager` (reliable, battery-aware)                                                        |
| **Limitations**     | **Client only** — no YouTube page injection, no context menus. Play Store review required.     |
| **Status**          | **Architecture designed, Capacitor config ready**                                              |

**UI Card (Blurred):**

```
┌─────────────────────────────────────────┐
│  📱  Native Android App (Phone + TV)    │
│  ████████████████████████████████████   │
│  ████████  Coming Soon  █████████████   │
│  ████████████████████████████████████   │
│  ✅ Offline cache  ✅ Background sync   │
│  ✅ Play on YouTube app                 │
│  ❌ No capture  ❌ No context menu      │
│  [Join Beta Waitlist]                   │
└─────────────────────────────────────────┘
```

### 4.3 iOS / iPadOS App

| Aspect          | Detail                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| **Target**      | iPhone, iPad, Apple TV (tvOS)                                                                          |
| **Tech**        | Same Capacitor project → iOS target; or Tauri mobile (future)                                          |
| **Sync**        | Supabase (same protocol)                                                                               |
| **Playback**    | `youtube://` URL scheme → YouTube app; or `https://youtube.com/...`                                    |
| **Limitations** | **Client only**. Apple TV (tvOS) has no YouTube app deep-link — must use web player. App Store review. |
| **Status**      | **Free with Capacitor Android build** (same codebase)                                                  |

### 4.4 Desktop Companion App (Tauri)

| Aspect          | Detail                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Target**      | Windows, macOS, Linux (native app, not browser extension)                                |
| **Tech**        | **Tauri** (Rust backend + your Svelte frontend)                                          |
| **Sync**        | Supabase + optional File/Syncthing transport (native file access)                        |
| **Playback**    | System default browser → `https://youtube.com/playlist?list=...`                         |
| **Advantages**  | System tray, global shortcuts, native notifications, better OS integration               |
| **Limitations** | **Client only** — no YouTube page injection (unless using WebView + injection, complex). |
| **Status**      | **Low priority** — extension already works well on desktop                               |

---

## 5. Platform Capability Comparison

| Capability                 | Desktop Extension         | Firefox Android | Web Portal (TV)      | Native Android       | iOS App              | Tauri Desktop   |
| -------------------------- | ------------------------- | --------------- | -------------------- | -------------------- | -------------------- | --------------- |
| **Install method**         | Chrome/Edge/Firefox store | Fenix addons    | URL (bookmark)       | Play Store           | App Store            | GitHub releases |
| **Sync backend**           | Supabase / File           | Supabase only   | Supabase only        | Supabase only        | Supabase only        | Supabase / File |
| **Zero-knowledge crypto**  | ✅                        | ✅              | ✅                   | ✅                   | ✅                   | ✅              |
| **View playlists**         | ✅                        | ✅              | ✅                   | ✅                   | ✅                   | ✅              |
| **Sort/filter/search**     | ✅                        | ✅              | ✅                   | ✅                   | ✅                   | ✅              |
| **Play on YouTube**        | Tab                       | Tab             | Deep-link → App      | Deep-link → App      | Deep-link → App      | Browser         |
| **Background sync**        | Service Worker            | Service Worker  | Service Worker ⚠️    | WorkManager ✅       | Background Tasks     | Native thread   |
| **Offline cache**          | IndexedDB                 | IndexedDB       | IndexedDB            | Room/SQLite          | CoreData/SQLite      | SQLite          |
| **Capture from YouTube**   | ✅ Content scripts        | ❌ No           | ❌ No                | ❌ No                | ❌ No                | ❌ No           |
| **Context menu "Add to"**  | ✅                        | ❌ No           | ❌ No                | ❌ No                | ❌ No                | ❌ No           |
| **Auto-fetch metadata**    | ✅                        | ❌ No           | ❌ No                | ❌ No                | ❌ No                | ❌ No           |
| **Watch history tracking** | ✅                        | ❌ No           | ❌ No                | ❌ No                | ❌ No                | ❌ No           |
| **Pairing UX**             | Settings page             | Settings page   | QR / code from phone | QR / code from phone | QR / code from phone | Settings page   |

---

## 6. What "Client-Only" Means (Limitations by Design)

### These Platforms Will **Never** Have

| Feature                                          | Why Not                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| **Right-click "Add to Playlist" on YouTube**     | Requires `browser.contextMenus` — only in WebExtension runtime        |
| **Auto-capture watch history from YouTube tabs** | Requires content scripts + `browser.tabs` + background service worker |
| **Auto-fetch metadata while browsing YouTube**   | Requires content script injection into `youtube.com`                  |
| **"Import from this page" popup**                | Requires `browser.scripting` + active tab access                      |
| **Keyboard shortcuts (global)**                  | Requires `browser.commands` — WebExtension only                       |

### These Platforms **Will** Have

| Feature                               | How                                                              |
| ------------------------------------- | ---------------------------------------------------------------- |
| **View all synced playlists**         | Pull from Supabase → decrypt → render                            |
| **Sort by name/date/count**           | Client-side sort                                                 |
| **Search playlists**                  | Client-side filter (or Supabase full-text if indexed)            |
| **Play playlist → opens YouTube app** | `vnd.youtube://playlist?list=...` / `youtube://` / `https://...` |
| **Manual sync trigger**               | Pull-to-refresh / sync button                                    |
| **See sync status**                   | Last synced timestamp, device count, errors                      |
| **Pair new device**                   | QR code / pairing code flow                                      |
| **Manage what syncs**                 | Checkboxes for playlists/settings/history                        |

---

## 7. Sync Key — The Universal Credential

```
┌─────────────────────────────────────────────────────────────┐
│  Your Sync Key:  ABCDE-FGHJK-MNPQR-STVWX                   │
│                                                              │
│  This ONE key works on:                                     │
│  ✅ Chrome Desktop Extension                                │
│  ✅ Edge Desktop Extension                                  │
│  ✅ Firefox Desktop Extension                               │
│  ✅ Firefox Android (Fenix) Extension                       │
│  ✅ Web Portal (iypm.vercel.app)                            │
│  ✅ Native Android App (coming soon)                        │
│  ✅ iOS App (coming soon)                                   │
│  ✅ Tauri Desktop App (future)                              │
│                                                              │
│  🔐 Zero-knowledge: key never leaves your device.           │
│  ⚠️  Lose the key = lose the data. Write it down.           │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Implementation Roadmap

| Phase | Target                          | Effort              | Dependencies                       |
| ----- | ------------------------------- | ------------------- | ---------------------------------- |
| **0** | Firefox Android polish          | 1 week              | Test on real Fenix, fix CSS        |
| **1** | Web Portal `/tv` + `/dashboard` | 2-3 weeks           | Supabase client, shared crypto pkg |
| **2** | Pairing flow (QR / code)        | 1 week              | WebRTC or Supabase Realtime        |
| **3** | Capacitor Android app           | 3-4 weeks           | Capacitor config, Play Store setup |
| **4** | Android TV variant              | 1 week              | Leanback launcher, banner assets   |
| **5** | iOS / iPadOS                    | Free with Capacitor | App Store setup                    |
| **6** | Tauri Desktop                   | 2 weeks             | Rust toolchain, Tauri config       |

---

## 9. For Developers — Adding a New Client

### Shared Crypto Package (Extract First)

```bash
# Create shared package
mkdir -p packages/sync-crypto/src
# Move from extension:
# apps/browser-extension/playlist-manager/src/services/sync/*.ts
# → packages/sync-crypto/src/
```

**Exports needed:**

- `deriveKeys(syncKey)` → `{ encryptionKey, spaceAddress, authHash }`
- `encryptEnvelope(key, envelope)` → `{ nonce, ciphertext }`
- `decryptEnvelope(key, envelope)` → plaintext
- `encodeSnapshot(data)` / `decodeSnapshot(json)` — HLC versioning, LWW

### New Client Checklist

- [ ] Add `packages/sync-crypto` as dependency
- [ ] Implement `SyncTransport` interface (`push` / `pull`)
- [ ] Store sync key securely (Keychain/Keystore/EncryptedSharedPreferences)
- [ ] Implement background sync (WorkManager / Service Worker / native thread)
- [ ] Build TV-optimized UI (large text, D-pad focus, 10ft UI)
- [ ] Implement `vnd.youtube://` / `youtube://` deep-link handling
- [ ] Add pairing flow (QR generation / code entry)
- [ ] Test on real target device (TV, phone, tablet)

---

## 10. FAQ for Users

### "Why can't I just install the extension on my Samsung TV?"

**Samsung TVs run Tizen OS — no WebExtension runtime exists.** The browser on Tizen doesn't support Chrome/Firefox extensions. The web portal works in the TV browser instead.

### "Will the Android TV app let me add videos from YouTube?"

**No — it's a client-only app.** It shows playlists you created on desktop. To add videos, use the desktop extension (right-click → "Add to Playlist") or the web portal dashboard.

### "Does the web portal work on my Fire TV?"

**Yes — Fire TV has a browser (Silk).** Open `iypm.vercel.app`, pair with your sync key, play playlists. Deep-link opens the YouTube app on Fire TV.

### "Is my data less secure on the web portal?"

**No — same zero-knowledge encryption.** The sync key is entered in your browser, crypto runs client-side (`crypto.subtle`), only encrypted blobs touch Supabase. The web portal code is open source and auditable.

### "When will iOS/Apple TV work?"

**iOS/iPadOS: same timeline as Android app** (Capacitor builds both). **Apple TV (tvOS):** YouTube doesn't provide a deep-link scheme for tvOS — playback would open the YouTube web player in the TV browser.

---

## 11. Visual Design for "Coming Soon" Cards

### CSS Pattern (for web portal / extension UI)

```css
.platform-card.coming-soon {
  position: relative;
  overflow: hidden;
  filter: grayscale(0.6) blur(1px);
  pointer-events: none;
  opacity: 0.7;
}

.platform-card.coming-soon::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.3) 0%,
    transparent 50%,
    rgba(255, 255, 255, 0.1) 100%
  );
  pointer-events: none;
}

.platform-card.coming-soon .badge {
  position: relative;
  z-index: 1;
  pointer-events: auto;
  background: var(--brand-primary);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

### Svelte Component (for extension UI)

```svelte
<!-- components/PlatformCard.svelte -->
<script>
  export let platform: {
    name: string;
    icon: string;
    status: "available" | "coming-soon" | "unsupported";
    capabilities: string[];
    limitations: string[];
    cta?: { label: string; href: string };
  };
</script>

<div class="platform-card {platform.status === 'coming-soon' ? 'coming-soon' : ''}">
  <div class="icon">{platform.icon}</div>
  <h3>{platform.name}</h3>

  {#if platform.status === "coming-soon"}
    <span class="badge">Coming Soon</span>
  {/if}

  <ul class="capabilities">
    {#each platform.capabilities as cap}
      <li>✅ {cap}</li>
    {/each}
  </ul>

  <ul class="limitations">
    {#each platform.limitation as lim}
      <li>❌ {lim}</li>
    {/each}
  </ul>

  {#if platform.cta}
    <a href={platform.cta.href} class="cta">{platform.cta.label}</a>
  {/if}
</div>
```

---

## 12. Related Documents

| Document                                               | Purpose                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| [`SYNC_COMPATIBILITY.md`](SYNC_COMPATIBILITY.md)       | User-facing compatibility table (what works on my browser?) |
| [`SYNC_AND_CLOUD_DESIGN.md`](SYNC_AND_CLOUD_DESIGN.md) | Full sync architecture, transport models, user flows        |
| [`SYNC_PROTOCOL.md`](SYNC_PROTOCOL.md)                 | Technical protocol spec (collections, encryption, HLC, LWW) |
| [`SYNC_RELAY_SETUP.md`](SYNC_RELAY_SETUP.md)           | Supabase project setup for sync relay                       |
| [`RESPONSIVE_UI_PLAN.md`](RESPONSIVE_UI_PLAN.md)       | Mobile/TV UI considerations for the extension               |
| [`POPUP_MOBILE_PLAN.md`](POPUP_MOBILE_PLAN.md)         | Firefox Android popup implementation details                |

---

_This document is the single source of truth for platform support decisions. Update it when platform capabilities change or new targets are added._
