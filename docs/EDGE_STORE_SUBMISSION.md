# Microsoft Edge Add-ons Submission Guide

This guide prepares the package for Microsoft Edge Add-ons. The Edge build is
generated from the Chrome manifest; there is no separate Edge source manifest.

## Current Partner Center identity

| Field           | Value                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Extension name  | Independent YouTube Playlist Manager                                                                                |
| Version         | 1.2.0 (from `main` / tag `v1.2.0`)                                                                                  |
| Status          | Draft / 1.1.1 package uploaded, never submitted for certification. 1.2.0 package ready to upload                    |
| Store ID        | `0RDCKFZCVDRK`                                                                                                      |
| CRX ID          | `ncmipojoamaoacinccopmdkflgocghno`                                                                                  |
| Product ID      | `20f9b17d-73e7-45f8-8692-796867b7ec80`                                                                              |
| Partner Center  | https://partner.microsoft.com/en-us/dashboard/microsoftedge/20f9b17d-73e7-45f8-8692-796867b7ec80/packages/dashboard |
| Public URL      | Not available until published                                                                                       |
| Package SHA-256 | `fecc3b7a1f2009dec8115450e6087801b19f646bdeaa03add21e459f66ca064d`                                                  |

The listing is still a **draft**. Uploading a package alone does not publish it;
certification and submission remain separate, explicit steps.

> **Note:** the draft currently holds the **1.1.1** package, which predates the
> first-run onboarding and still required an API key. Build the **1.2.0** package
> from tag `v1.2.0` and upload it: Edge keeps one package per version, so a higher
> version is accepted and becomes the submitted one. The 1.1.1 package is never
> published.

## Prerequisites

- Microsoft account (or GitHub sign-in) for [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge).
- **Free** Edge developer registration. There is no `$19` fee.
- Public privacy policy and support URLs. These point at `main`; the local
  privacy-policy update has not been pushed yet, so push it (or use a URL that
  serves the current policy) before submitting.
- The built Edge ZIP: `dist/independent-youtube-playlist-manager-edge.zip`.

### For automated future releases (Edge Publish API v1.1)

After the **first manual submission** (1.2.0), subsequent releases can be
published via API without visiting Partner Center. One-time setup:

1. In Partner Center → your extension → **Publish API** → _Enable the new experience_ → **Create API credentials**.
   Record:
   - `EDGE_CLIENT_ID`
   - `EDGE_API_KEY`
2. Store them as **GitHub repository secrets** (not in the repo):
   - `EDGE_CLIENT_ID`
   - `EDGE_API_KEY`
   - `EDGE_PRODUCT_ID` = `20f9b17d-73e7-45f8-8692-796867b7ec80` (can be a variable)
3. The CI workflow will then:
   - Upload package: `POST /v1/products/{productId}/submissions/draft/package`
   - Poll operation status
   - Submit: `POST /v1/products/{productId}/submissions` with notes
   - Poll publish status

OAuth redirect URIs for store-installed Edge builds (add to Google Cloud Console after approval):

- `https://ncmipojoamaoacinccopmdkflgocghno.chromiumapp.org/`
- `https://ncmipojoamaoacinccopmdkflgocghno.chromiumapp.org/supabase`

Public key (for reference / redirect URI construction):

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA+niPZKflMsMNjpY9Em9D
AlD7HSBnTFaUZiYUvljoaCcVtPKs9QkRNyPVwVGWoMoeMFnm9awxAVVxmaIAyOUO
sv6Hj9B5cUpkudhsExuT9gXNLXxCkviXZ9A3Q5fdtbhnQ+pHYikRYkqHWxpd1AVx
GSw3Uqq06q8l8G3W1VsOQKwKG24NVcXDPWMkNg6n91O2xYoITEwTKKvVk3534RxW
ghcWURAqsyhHeSQR3F5e4BUn4DM1Y7n69x5WVis7tAoUBE6g1YAeY/2qfxFlnKl3
hIvrPnCED8bQZ2cTOTtraYKG7ccwPiNBaznS9PfPL0CzSPsG48J6lpodX8KdM7fB
xQIDAQAB
-----END PUBLIC KEY-----
```

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
rebuild from that clean commit before uploading. The ZIP in `dist/` is **gitignored
and drifts between sessions** — a leftover ZIP can be stale even when `dist/edge/`
is fresh (its manifest disagrees with source). Always rebuild **and** repackage
immediately before uploading:

```bash
npm run build && npm run pack:edge
npm run test:extension   # runs verify-edge-package.js
```

Do not upload a ZIP that fails `verify-edge-package.js`. The guard asserts the ZIP's
manifest matches `dist/edge/manifest.json` (version, `short_name` ≤ 12 chars,
name, permissions, forbidden fields, required directories, no `.map` files).

`npm run build` runs `validate-manifests.js`, which asserts that
`dist/edge/manifest.json` exactly matches the Chrome manifest minus `key` and
`browser_specific_settings`.

Inspect the ZIP before uploading:

```bash
unzip -p dist/independent-youtube-playlist-manager-edge.zip manifest.json
```

Confirm:

- `manifest_version` is `3`, version is `1.2.1`.
- `short_name` is `IYPM` (4 chars — Edge's hard maximum is 12; longer values are
  rejected with "The string … has exceeded the maximum length of 12").
- No `key`.
- No `browser_specific_settings`.
- No `update_url`.
- The ZIP contains `editor/`, `background/`, `content-scripts/`, `popup/`, `shared/`, `assets/`.
- No `.map` files.

Record the resulting SHA-256 in `docs/edge-release-metadata.json` (`packageSha256`)
after the rebuild; do not reuse a hash from an earlier build.

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
   (1.2.0). Wait for validation to finish; a failed validation must be fixed before
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

## 7. After Approval (1.2.0)

1. Copy the final store URL. The URL format is
   `https://microsoftedge.microsoft.com/addons/detail/<slug>/20f9b17d-73e7-45f8-8692-796867b7ec80`.
   The `<slug>` is generated by Edge upon publication.
2. Set the portal environment variable in Vercel and redeploy:

   ```bash
   NEXT_PUBLIC_EDGE_STORE_URL=https://microsoftedge.microsoft.com/addons/detail/<slug>/20f9b17d-73e7-45f8-8692-796867b7ec80
   ```

   The **Add to Edge** button on the landing page (`page.tsx`) will appear
   automatically once this variable is set — no code change needed.

3. Update the **Store URL** in `docs/edge-release-metadata.json` (`storeUrl` field).
4. If optional sign-in/sync is used, add the Edge redirect URIs to Google Cloud Console:
   - `https://ncmipojoamaoacinccopmdkflgocghno.chromiumapp.org/`
   - `https://ncmipojoamaoacinccopmdkflgocghno.chromiumapp.org/supabase`

   These are the redirect URIs for store-installed Edge builds (CRX ID
   `ncmipojoamaoacinccopmdkflgocghno`). Unpacked builds use the ID shown in
   `edge://extensions` — add that separately when testing unpacked.

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
