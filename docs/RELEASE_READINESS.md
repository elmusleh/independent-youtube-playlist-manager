# Release readiness — 1.1.1

## Scope and evidence

| Check                                  | Result                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Root lint, formatting, unit tests      | Passed; 120 tests                                                              |
| Svelte/TypeScript diagnostics          | Zero errors and warnings                                                       |
| Chrome and Firefox production packages | Built; generated entry files validated                                         |
| Mozilla web-ext 10.8.0 lint            | Zero errors, warnings, notices                                                 |
| Chromium real loaded extension         | 15 routes × 6 viewport sizes; six interaction groups; no runtime errors        |
| Firefox 158.0.1 real temporary add-on  | 15 routes × 6 requested window sizes; modal keyboard checks                    |
| Firefox with Android user agent        | Another 90 route/window checks; mobile platform code branches and modal checks |
| Web portal                             | Six viewport sizes; footer reachable; unconfigured/unauthorized sync rejected  |
| Extension dependencies                 | Full npm audit reports zero advisories                                         |
| Portal production dependencies         | npm audit --omit=dev reports zero advisories                                   |

Browser reports and screenshots are generated under `dist/verification`. Firefox
reports record actual inner viewport dimensions because browser window chrome can
constrain requested window sizes. Synthetic fixtures run only in disposable profiles.
External provider requests are excluded from deterministic Chromium UI checks.

## Reproducing verification

Use Node.js 22 or newer. Install root and extension dependencies with `npm ci`, run
`npm run check`, `npm run build`, then `npx playwright install chromium` and
`npm run test:extension`. For the real Firefox suite, install Selenium in a Python
virtual environment and run `packages/build-tools/verify-firefox.py`, then repeat
with `--android`. These use new isolated profiles, never the user's browsing profile.
The Firefox driver enables system access only inside its disposable test browser
so it can navigate to the installed test add-on; it does not change the user's Firefox.

For portal checks, install its dependencies, run `npm run web:build`, serve its
production build on port 3050, and run `npm run test:portal`.

## Limitations

- No physical Android phone was connected. Hardware keyboard/soft keyboard,
  browser-toolbar resizing, touch gestures, and OS-level file selection still need
  real-device coverage. Android user-agent tests are not device certification.
- The browser matrix exercises local/signed-out routes and synthetic playlists,
  history and metadata. Real Google account consent, YouTube quota exhaustion,
  authenticated Supabase sync/conflict behavior, and provider uptime were not tested
  against the user's accounts. OAuth parsing/redirect behavior has dedicated tests.
- Three moderate portal development dependency advisories remain in Tailwind's
  selector parser chain; removing them via npm's proposed fix requires a Tailwind 4
  migration. Production dependency audits are clean. No forced major upgrade was applied.
- Non-blocking build warnings remain for Rollup facade chunks and a Supabase SDK
  internal circular dependency. Unpacked Chrome builds now use the verified public
  key for the actual store ID; store updates retain their existing ID. Developers
  switching an older unpacked build to the stable ID should export their data first,
  since browser storage belongs to an extension ID.
- Portal source improvements are included in Git; this task does not deploy the website.
- No software release can guarantee that every user will encounter zero issues.

## Store submissions

The initial Firefox 1.1.0 candidate (version ID 6620498) was withdrawn/disabled
before approval to correct its data declarations. Version 1.1.1 replaces it with
accurate declarations and optional account/search consent gates. Chrome's existing
1.0.1 listing was taken down October 15, 2026 for the unused bookmarks permission;
the replacement removes it. Chrome's privacy draft has been saved with corrected
data categories and listing description.

On October 25, 2026, both replacement submissions were accepted for review:

- **Firefox 1.1.1:** version ID **6620554**, listed channel, **unreviewed**, not
  disabled, source archive uploaded, no approval timestamp. The authenticated API
  confirms the intended required and optional data categories.
  [Developer version page](https://addons.mozilla.org/en-US/developers/addon/iypm/versions/6620554).
- **Chrome 1.1.1:** dashboard confirmed **Your extension was submitted for review**,
  followed by **Pending review**. Automatic publication after approval is selected.
  The previous takedown is not evidence that the replacement has been approved.
  [Developer dashboard](https://chrome.google.com/webstore/devconsole/e070ead7-65ee-442e-8bc2-3a6a2b3c5f60/dapjjdcnolpmfcnobilphjfpkmmokgid/edit/status).

Final 1.1.1 verification: 120 unit tests, root check/build/pack, Chromium 90 checks,
Firefox desktop 90 checks, Firefox Android-UA 90 checks, portal six viewport checks,
and web-ext lint all passed. Native Firefox data-permission checks verified that
a persisted synthetic Google token cannot bypass absent optional consent.

Release source commit: `dff9c9c`; local annotated tag: `v1.1.1`. Source archive has
352 entries and excludes `.env` and the user's untracked `CHANGELOG.md`. Package
ZIP file lists match their built runtime directories exactly. SHA-256:

- Chrome: `898a50e19f0d5114bbc81c1a783cc3bc63cfe63534c4b0ab26c3c3f97dafa015`
- Firefox: `1294b54da6f7c2877927c5ff89d15b722009b02fb9a5e9d0e4ca42460bd030ff`

No Git push was performed, as required by repository instructions. The owner must
push main and the release tag so the source and updated public privacy document
become available on GitHub. Store review can still request changes; neither update
is confirmed approved/live at this handoff.
