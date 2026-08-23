# AMO Listed Submission Checklist

Follow these steps on the [AMO Developer Hub](https://addons.mozilla.org/en-US/developers/) to switch the extension from Unlisted to Listed.

## Pre-flight

- [ ] Extension ZIP is current (`dist/independent-youtube-playlist-manager-firefox.zip` matches the manifest version)
- [ ] Source ZIP is generated locally for AMO and has not been committed
- [ ] Signed XPI exists: `dist/firefox/web-ext-artifacts/*.xpi`
- [ ] `PRIVACY_POLICY.md` is present in the repo root
- [ ] Screenshots are captured (see `screenshots/README.md`)

---

## 1. Switch Channel from Unlisted to Listed

1. Go to the [Independent YouTube Playlist Manager developer page](https://addons.mozilla.org/en-US/developers/addon/independent-youtube-playlist-manager/).
2. Navigate to **"Edit Product Page"** or the version management area.
3. Find the **"Channel"** or **"Distribution"** section.
4. Change from **Unlisted** to **Listed**.
5. Save the changes.

> **Current Unlisted Upload UUID:** `0379b5d80cc941c289548955e9dc9d5d`

---

## 2. Fill in Metadata

Open `metadata.md` and copy-paste each field into the corresponding AMO form.

- [ ] Summary (English US)
- [ ] Description (English US)
- [ ] Tags
- [ ] Homepage URL
- [ ] Support / Contributions URL
- [ ] Privacy Policy URL

---

## 3. Upload Screenshots

AMO requires **at least one screenshot**. Recommended uploads (see `screenshots/README.md` for specs):

- [ ] Main editor view (playlist with videos)
- [ ] Saved playlists grid
- [ ] Quick Add popup
- [ ] Settings page
- [ ] Dark mode view

Format: **PNG or JPG**, **1280×800** or **640×400** recommended.

---

## 4. Add Technical Details

Open `technical-details.md` and paste the contents into the **"Technical Details"** field.

---

## 5. Add Notes for Reviewers

Open `reviewer-notes.md` and paste the contents into the **"Notes for Reviewers"** field.

---

## 6. Upload Version & Submit for Review

1. Upload the extension ZIP (`dist/independent-youtube-playlist-manager-firefox.zip`) **or** the signed XPI.
2. If the code is minified/bundled, upload the locally generated source ZIP as well. Do not commit generated ZIPs to the repository.
3. Wait for automated validation (a few seconds).
4. Click **"Submit for Review"**.

---

## 7. Review Timeline

| Type | Typical Duration |
|------|----------------|
| Simple updates | A few hours |
| New submissions | 1–3 business days |
| Complex extensions / first-time devs | Up to a week |

---

## 8. After Approval

- [ ] Extension appears publicly on `addons.mozilla.org`
- [ ] Users can install directly — no developer mode required
- [ ] Data survives restarts (fully persistent)

---

## 9. Future Updates

### Quick Release (one-shot)

1. Bump version in `src/manifest.firefox.json`
2. `npm run build` — builds both Chrome and Firefox
3. `npm run sign-firefox` — signs the XPI using credentials from `.env`
4. The signed XPI will be at `dist/firefox/web-ext-artifacts/*.xpi`

> **Note:** AMO credentials live in `.env` (gitignored). Generate new keys at https://addons.mozilla.org/developers/addon/api/key/

### Manual Steps (if `web-ext sign` fails)

1. `cd dist/firefox && zip -r ../independent-youtube-playlist-manager-firefox.zip .`
2. Upload the ZIP to AMO manually
3. Submit for review (usually faster for established add-ons)
