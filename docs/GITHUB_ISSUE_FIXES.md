# GitHub issue and dependency fixes — October 25, 2026

These source changes are for the next release. They do not replace the 1.1.1
packages already submitted to Chrome and Firefox. No store upload, deployment,
Git push, issue comment/closure, or security-alert dismissal was performed.

## Issues

| Issue                                                                                                      | Resolution and evidence                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [#10](https://github.com/elmusleh/independent-youtube-playlist-manager/issues/10) Pagination               | Existing compact first/last windows, ellipses and previous/next arrows verified again, including navigation to the final page after import.                                                                                                                                                      |
| [#11](https://github.com/elmusleh/independent-youtube-playlist-manager/issues/11) Deleted-video thumbnails | Optional image-byte archive in a separate IndexedDB database. Shared previews use saved images with network blocked; images survive metadata refresh/deletion. Full backups include the archive, with raster-only validation and restore support.                                                |
| [#13](https://github.com/elmusleh/independent-youtube-playlist-manager/issues/13) White flash              | Render-blocking external theme bootstrap and initial background CSS run before the app. A synchronous local theme hint initializes the store. The build now preserves the canonical HTML template rather than replacing it with stale hard-coded markup. Tested with app initialization blocked. |
| [#14](https://github.com/elmusleh/independent-youtube-playlist-manager/issues/14) Import durations         | Title-only cached entries no longer count as complete. Imported partial entries remain eligible for enrichment. Normalized durationISO/seconds populate badges. Title-only oEmbed results no longer stop duration-capable fallback tiers.                                                        |

### Using thumbnail preservation

In Settings → Playlist Manager, enable **Keep thumbnail images on this device**
and grant the optional `https://i.ytimg.com/*` host access. Preview images are
saved as you view playlists, with four concurrent downloads, timeouts and image-size
limits. Existing archives are used without network access and are not overwritten
by later YouTube failures. Disable the option to stop new downloads; use **Delete
saved thumbnail images** to clear the archive. Full JSON backups carry saved images.
Older backups without images remain supported and do not erase an existing archive.

Images must be saved while still available: this cannot recover a thumbnail that
YouTube has already removed. Browser-data clearing/uninstalling can erase local
images; retain exported backups for portability. No images are uploaded to cloud sync.

## Dependabot

Read all **45 open alerts** through the authenticated GitHub API. Compared each
reported package/range against every matching package entry in its local lockfile:
**zero matching vulnerable versions remain**. Nothing was dismissed to hide an alert.

| Dependency/tree                                      | Local result                                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Root Next.js                                         | Removed unused leftover dependency/lock entries; the portal has its own Next.js installation.                               |
| Root Vitest / mocker                                 | 4.1.12                                                                                                                      |
| Root Vite                                            | 8.3.5                                                                                                                       |
| Root Undici                                          | 8.12.3                                                                                                                      |
| Portal Next.js                                       | 15.5.28 (already patched locally)                                                                                           |
| Portal Sharp                                         | 0.35.5 (already patched locally)                                                                                            |
| Portal selector parser                               | 7.1.7, with a narrow override under Tailwind 3; production build and browser layout checks passed. No Tailwind 4 migration. |
| Extension follow-redirects / devalue                 | 1.16.1 / 5.9.4 (already patched locally)                                                                                    |
| Both apps' source-map-js / js-yaml / brace-expansion | Patched versions verified against all corresponding alert ranges.                                                           |

Full `npm audit --audit-level=low` results: **zero vulnerabilities** at root,
extension editor and portal, including development dependencies. GitHub will
re-evaluate alerts after the corrected manifests/lockfiles reach the default branch.
The four issue records remain open until the fixes are pushed/merged and ready to
be confirmed against a published release.

## Verification

- Failing regressions reproduced before the duration/theme fixes; retained in tests.
- 130 unit tests; lint/format/type checks and CSS verification pass.
- Chrome/Firefox production builds and portal production build pass.
- Real Chromium: 90 route/viewport checks, six interaction groups, no runtime errors.
- Real Firefox 158.0.1: 90 route/window checks and four interaction groups.
- Firefox with Android user agent: another 90 checks and three interaction groups; not a physical device test.
- Focused loaded-extension checks: pre-app dark theme, offline archived image decoding,
  archive export, partial import duration badge and final-page navigation.
- Portal: six viewport sizes and rejected unconfigured/unauthorized sync requests.
- Mozilla web-ext lint: zero errors/warnings/notices.

Reports/screenshots are in `dist/verification`. Run the focused suite with
`node packages/build-tools/verify-github-issues.js`. Portal checks can point to an
isolated production server with `IYPM_PORTAL_URL=http://localhost:3051 npm run test:portal`.
No physical-phone test or real Google/Supabase account test was performed here.
