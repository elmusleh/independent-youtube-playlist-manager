# Whiteboard — AMO Form Scratchpad

Use this file to jot down notes, temporary values, or copy-paste buffers while filling in the AMO forms.

---

## Filled Fields (check off as you go)

- [x] **Name:** Independent YouTube Playlist Manager
- [x] **Summary:** YouTube playlist editor and generator
- [x] **Description:** Filled — see plan at `~/.windsurf/plans/amo-listed-submission-guide-762ce1.md`
- [ ] **Categories:**
  - Primary:
  - Secondary:
- [x] **Tags:** `youtube`, `playlist`, `video`, `manager`, `editor`, `tool`, `productivity`, `helper`
- [x] **Homepage:** `https://github.com/el-musleh/independent-youtube-playlist-manager`
- [x] **Support URL:** `https://github.com/el-musleh/independent-youtube-playlist-manager/issues`
- [x] **Privacy Policy URL:** `https://github.com/el-musleh/independent-youtube-playlist-manager/blob/master/PRIVACY_POLICY.md`
- [x] **License:** MIT (standard open-source — do NOT use the custom EULA field)
- [x] **Icon:** uploaded
- [ ] **Screenshots:** NOT uploaded (required for Listed)
- [x] **Version Notes:** Filled for 2.12.7
- [x] **Technical Details:** (see `technical-details.md`)
- [x] **Notes for Reviewers:** (see `amo-form-fill.txt`)
- [ ] **Source Code:** generate and upload the local source ZIP (see `amo-form-fill.txt`); do not commit it
- [ ] **Channel switched:** Unlisted → Listed — AMO UI does NOT expose this toggle for existing add-ons
- [x] **Version uploaded:** 2.12.7 approved, 2.12.12 ready to upload
- **Editor white page bug:** FIXED — `patch-innerhtml.js` returned `DocumentFragment` instead of `HTMLTemplateElement`, causing Svelte's `importNode` to crash with `undefined`
- [ ] **Source code uploaded:** yes / no
- [ ] **Submitted for review:**

---

## Code Changes Made (to fix AMO validation warnings)

### 1. popup.js — Replaced 5x `.innerHTML` with DOM-safe `setIcon()`

File: `src/popup/popup.js`

```js
function setIcon(element, className) {
  element.textContent = "";
  const i = document.createElement("i");
  i.className = className;
  element.appendChild(i);
}
```

Replaced at lines 574, 592, 604, 628, 664 (all `btnExecute.innerHTML` assignments).

**Result:** 0 innerHTML warnings in `popup/popup.js` after rebuild.

### 2. manifest.firefox.json — `data_collection_permissions` catch-22

**AMO Validator Rules:**
| Config | Desktop Warnings | Android Warnings | Compatibility |
|--------|-----------------|-----------------|---------------|
| No `data_collection_permissions` | 1 warning | 0 warnings | Desktop 121+, Android 121+ |
| `data_collection_permissions` + min 121 | 2 warnings | 2 warnings | Desktop 121+, Android 121+ |
| `data_collection_permissions` + min 140 | **0 warnings** | **0 warnings** | Desktop 140+, Android 121+ |

**Final decision:** Keep `data_collection_permissions` with `strict_min_version: 140.0` for desktop (Firefox 140+ required), `121.0` for Android. Trade-off: older desktop Firefox users (121–139) cannot install, but zero warnings on AMO.

**File:** `src/manifest.firefox.json:51-62`

---

## AMO Issues Encountered

1. **"Version already exists"** → Bumped manifest version each time (2.12.5 → 2.12.6 → 2.12.7 → 2.12.8 → 2.12.9 → 2.12.10)
2. **"Duplicate add-on ID"** → Must use **"Upload New Version"** on existing add-on, NOT "Submit New Add-on"
3. **Cannot switch Unlisted → Listed in UI** → AMO does not expose this toggle for existing unlisted add-ons
4. **Workaround:** Contact AMO support (`amo-admins@mozilla.org`) or keep Unlisted and share direct link

---

## Current State

- **Source code:** Fixed (`src/popup/popup.js`, `src/editor/main.js`, `src/manifest.firefox.json`, `scripts/patch-innerhtml.js`)
- **Built:** `dist/firefox/` contains clean v2.12.12 with 0 validation errors
- **Editor white page:** FIXED — `patch-innerhtml.js` now returns `HTMLTemplateElement` with `.content` populated via `DOMParser`
- **Signed:** `web-ext sign` timed out (AMO API slow); try running manually or upload source zip directly
- **AMO:** Existing Unlisted add-on is live at `https://addons.mozilla.org/…/0d99f33ccb0d4147a65b`

---

## Next Steps

1. Run `web-ext sign` in `dist/firefox/` to get signed XPI (or upload source zip directly to AMO)
2. On AMO: use **"Upload New Version"** (not "Submit New Add-on") on existing add-on
3. Upload signed XPI or source zip
4. Submit for review — approval in 1–3 business days
5. To go Listed: email AMO support or share Unlisted link

