# Edge Browser Support — Implementation Plan & Status

## Overview

Add Microsoft Edge (Chromium) support to the IYPM extension and prepare a Microsoft Edge Add-ons submission. Edge uses Chromium MV3, so it shares the Chrome runtime and requires no feature rewrite.

## Design Decisions

- **Derive the Edge manifest from Chrome.** `apps/browser-extension/manifest.chrome.json` is the source of truth. The build removes `key` and `browser_specific_settings`, then writes `dist/edge/manifest.json`. There is no static `manifest.edge.json`.
- **No Edge-specific extension ID lock.** Edge assigns its own ID after store publication; the unpacked ID is path-dependent.
- **Free developer registration.** Microsoft Edge Add-ons registration is free; there is no `$19` fee.
- **No `browser_specific_settings.edge`.** That field is not valid for Edge Chromium. Edge requires no `strict_min_version` block.
- **Hide the portal install button until live.** The Edge CTA renders only when `NEXT_PUBLIC_EDGE_STORE_URL` is set, preventing a broken placeholder link.
- **No runtime UI changes in 1.1.1.** The `DeveloperSetup` redirect-URI label still says Chrome. Changing extension text would alter the pending 1.1.1 packages; fold that into the next version bump.

## Completed

- [x] Add `edge` target to `packages/build-tools/build-extension.js` (derived manifest).
- [x] Delete the static `apps/browser-extension/manifest.edge.json`.
- [x] Add Edge equality validation to `packages/build-tools/validate-manifests.js`.
- [x] Add `package-edge-store.js` with key/browser-specific-field guards.
- [x] Add `build-edge`, `pack:edge`, and Edge to `build`/`pack` in `package.json`.
- [x] Include `dist/edge` in the CSS bundle verification.
- [x] Add Edge to `iypm.sh` build/pack/status commands and completions.
- [x] Replace the placeholder portal icon with the official Microsoft Edge logo.
- [x] Gate the portal Edge button behind `NEXT_PUBLIC_EDGE_STORE_URL`.
- [x] Update portal copy for Edge support.
- [x] Update AGENTS.md, README, USER_GUIDE, RELEASE_SPEC, SUPPORT, USAGE_EXAMPLES, PRIVACY_POLICY, release readiness, and changelog.
- [x] Build, validate, and ZIP the Edge package locally.

## Remaining External Steps

- [ ] Register or sign in at Microsoft Partner Center (free).
- [ ] Create the Edge Add-ons listing and upload `dist/independent-youtube-playlist-manager-edge.zip`.
- [ ] Complete listing metadata, privacy policy, support URL, and IARC questionnaire.
- [ ] Submit for certification and wait for review (typically up to 7 business days).
- [ ] After approval, copy the Product ID / store URL into `NEXT_PUBLIC_EDGE_STORE_URL`.
- [ ] Add the Edge store badge/link to README and the portal.
- [ ] Add the Edge redirect URIs to Google Cloud and Supabase if optional sign-in/sync is used.
- [ ] Smoke-test the published package in Microsoft Edge on Windows/macOS.

## Commands

```bash
npm run build-edge   # Generate dist/edge from the Chrome manifest
npm run pack:edge    # Create dist/independent-youtube-playlist-manager-edge.zip
npm run build        # Build Chrome, Firefox, and Edge
npm run check        # Lint, format, tests, svelte-check, CSS gate
```

## Store Submission

See `docs/EDGE_STORE_SUBMISSION.md` for the listing fields, assets, privacy/support URLs, certification notes, and post-approval wiring.

## Verification Notes

- `validate-manifests.js` asserts `dist/edge/manifest.json` deep-equals the Chrome manifest minus `key` and `browser_specific_settings`.
- The Edge ZIP is built from a clean copy of `dist/edge` and contains no source maps.
- Chromium runtime coverage applies to Edge; a real Edge smoke test is still recommended before submission.
- Do not submit the package while the portal Edge URL is a placeholder or while the version differs from `package.json`.
