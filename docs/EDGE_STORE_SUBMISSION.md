# Microsoft Edge Add-ons Submission Guide

This guide prepares the 1.1.1 package for Microsoft Edge Add-ons. The Edge build is
generated from the Chrome manifest; there is no separate Edge source manifest.

## Current Partner Center identity

| Field           | Value                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Extension name  | Independent YouTube Playlist Manager                                                                                |
| Version         | 1.2.1                                                                                                               |
| Status          | Draft / 1.1.1 package uploaded, never submitted for certification. 1.2.1 package ready to upload                    |
| Store ID        | `0RDCKFZCVDRK`                                                                                                      |
| CRX ID          | `ncmipojoamaoacinccopmdkflgocghno`                                                                                  |
| Product ID      | `20f9b17d-73e7-45f8-8692-796867b7ec80`                                                                              |
| Partner Center  | https://partner.microsoft.com/en-us/dashboard/microsoftedge/20f9b17d-73e7-45f8-8692-796867b7ec80/packages/dashboard |
| Public URL      | Not available until published                                                                                       |
| Package SHA-256 | `5bf1c87c173c5a81d41fce05fada4afa56e67c86b74098b80677a815cf133e46`                                                  |

The listing is still a **draft**. Uploading a package alone does not publish it;
certification and submission remain separate, explicit steps.

> **Note:** the draft currently holds the **1.1.1** package, which predates the
> first-run onboarding and still required an API key. The rebuilt package is
> **1.2.1** (`dist/independent-youtube-playlist-manager-edge.zip`, SHA-256 above).
> Upload it over the draft: Edge keeps one package per version, so a higher version
> is accepted and becomes the submitted one. The 1.1.1 package is never published.

## Prerequisites

- Microsoft account (or GitHub sign-in) for [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge).
- **Free** Edge developer registration. There is no `$19` fee.
- Public privacy policy and support URLs. These point at `main`; the local
  privacy-policy update has not been pushed yet, so push it (or use a URL that
  serves the current policy) before submitting.
- The built Edge ZIP: `dist/independent-youtube-playlist-manager-edge.zip`.

## 1. Build and Validate

From the repository root:

```bash
npm run check
npm run build
npm run pack:edge
```

Build the ZIP from the exact commit you intend to ship, not from a dirty working
tree. `1.2.1` is prepared on `next` but not yet tagged, and the working tree still
carries uncommitted UI-polish work, so commit what the package should contain and
rebuild from that clean commit before uploading. The SHA-256 recorded above is the
current working-tree build and will change after any further edit.

`npm run build` runs `validate-manifests.js`, which asserts that
`dist/edge/manifest.json` exactly matches the Chrome manifest minus `key` and
`browser_specific_settings`.

Inspect the ZIP before uploading:

```bash
unzip -p dist/independent-youtube-playlist-manager-edge.zip manifest.json
```

Confirm:

- `manifest_version` is `3`, version is `1.2.1`.
- No `key`.
- No `browser_specific_settings`.
- No `update_url`.
- The ZIP contains `editor/`, `background/`, `content-scripts/`, `popup/`, `shared/`, `assets/`.
- No `.map` files.

## 2. Listing Values

| Field                | Value                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Extension name       | `Independent YouTube Playlist Manager` (36 chars; from manifest, read-only)                                               |
| Short description    | `Manage YouTube playlists locally: create, edit, sync, and track history. Save videos to watch later. No login required.` |
| Category             | Productivity                                                                                                              |
| Language             | English (United States)                                                                                                   |
| Detailed description | Use the text in `docs/edge-release-metadata.json` (250–10,000 chars)                                                      |
| Privacy policy       | https://github.com/elmusleh/independent-youtube-playlist-manager/blob/main/docs/PRIVACY_POLICY.md                         |
| Support              | https://github.com/elmusleh/independent-youtube-playlist-manager/issues                                                   |
| Website              | https://iypm.vercel.app/                                                                                                  |
| Pricing              | Free                                                                                                                      |

The extension name and short description are read-only after upload because they
come from the manifest. Changing either requires a version bump and a new package.

Search terms (maximum 7; each ≤30 characters, ≤21 words total):

1. `youtube playlist manager`
2. `youtube playlists`
3. `playlist organizer`
4. `save youtube videos`
5. `watch later`
6. `playlist sync`
7. `privacy`

## 3. Store Assets

| Asset                  | Requirement                                   | Repository file                                  |
| ---------------------- | --------------------------------------------- | ------------------------------------------------ |
| Extension logo         | 1:1 PNG; 300×300 recommended; 128×128 minimum | `docs/assets/edge-store-logo-300x300.png`        |
| Small promotional tile | 440×280 PNG                                   | `docs/assets/small-promo-440x280.png`            |
| Large promotional tile | 1400×560 PNG                                  | `docs/assets/marquee-promo-1400x560.png`         |
| Screenshots            | Max 6; 1280×800 or 640×480                    | `docs/screenshots/screenshot-01-editor.png` etc. |

The six screenshots are already 1280×800. Upload the editor screenshot first; it
shows the core value most clearly.

## 4. Age Rating

Complete the IARC questionnaire. The extension has no mature content, no ads, no
in-app purchases, no user-generated content, and no gambling. It stores data
locally and only contacts Google/Supabase when the user opts into those optional
features.

## 5. Certification Notes

Paste the following into the certification notes field:

> No account is required to test the extension. Open any YouTube watch page, click
> the toolbar icon, add the video to a playlist, then open the playlist editor to
> create, reorder, export, and import playlists. Optional Google sign-in and
> Supabase sync are disabled unless configured and require explicit user consent.
> The package contains no remote code and no telemetry. Chrome-specific manifest
> fields (key and browser_specific_settings) are removed from the Edge build. All
> data is stored locally unless the user opts into sync.

## 6. Submit

1. Sign in to [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge)
   and open the existing draft (Product ID
   `20f9b17d-73e7-45f8-8692-796867b7ec80`). Do not create a second listing — that
   would split installs and reviews.
2. In **Packages**, upload `dist/independent-youtube-playlist-manager-edge.zip`
   (1.2.1). Wait for validation to finish; a failed validation must be fixed before
   the listing can be submitted.
3. Complete **Store listing**: short description, detailed description, 7 search
   terms, logo, small and large promotional tiles, 6 screenshots, category,
   language.
4. Complete **Privacy**: privacy policy URL, and declare the single purpose plus the
   data the extension handles (local-only by default; optional Google/Supabase use).
5. Complete the IARC age-rating questionnaire.
6. Paste the certification notes above into **Notes for certification**.
7. **Publish / Submit for certification.** Review typically takes up to 7 business
   days; answer reviewer questions promptly or the submission is failed.

## 7. After Approval

1. Copy the Product ID / final store URL. The URL format is
   `https://microsoftedge.microsoft.com/addons/detail/<slug>/<product-id>`.
2. Set the portal environment variable and redeploy:

   ```bash
   NEXT_PUBLIC_EDGE_STORE_URL=https://microsoftedge.microsoft.com/addons/detail/<slug>/<product-id>
   ```

3. Add the Edge store badge/link to `README.md` and the portal.
4. Record the Product ID and submission date in `docs/edge-release-metadata.json`.
5. If optional sign-in/sync is used, add the Edge redirect URIs:
   - `https://ncmipojoamaoacinccopmdkflgocghno.chromiumapp.org/`
   - `https://ncmipojoamaoacinccopmdkflgocghno.chromiumapp.org/supabase`

   These are the redirect URIs for store-installed Edge builds. Unpacked builds use
   the ID shown in `edge://extensions`, so add that ID separately when testing
   unpacked.

## 8. Manual Smoke Test

Edge is installed on this machine (`/usr/bin/microsoft-edge`), so the store package can
be tested in the real browser rather than another Chromium build. Use a throwaway
profile so the test never touches your browsing profile:

```bash
cd ~/dev/independent-youtube-playlist-manager
microsoft-edge \
  --user-data-dir="$HOME/.hermes/cache/scratch/edge-smoke" \
  --load-extension="$PWD/dist/edge" \
  about:blank
```

Then check `edge://extensions` shows the unpacked build, and verify:

- Toolbar popup opens on the first click and can add the current video.
- Playlist editor loads all views and persists changes after reload.
- YouTube content script and context menus work on a watch page.
- Export/import backup works.
- Optional Google/Supabase flows show consent and fail safely when unconfigured.
- No uncaught errors in the service worker or extension pages.

Signing in to the store listing is not involved in this step; it only proves the
package works in Edge's runtime.

## Common Rejection Risks

- Claiming Edge availability before the listing is approved (the portal button is
  hidden until `NEXT_PUBLIC_EDGE_STORE_URL` is set).
- Submitting a package whose version differs from `package.json`.
- Leaving the Chrome `key` or Firefox `browser_specific_settings` in the Edge ZIP.
- Missing or non-public privacy/support URLs.
- Detailed description under 250 characters.
- Screenshots with the wrong dimensions.
- Using a store logo that is not square.
