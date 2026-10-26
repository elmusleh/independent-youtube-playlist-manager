# Version 1.2.0

A feature release. First version with a fully enforced CI, a real end-to-end suite,
and release notes that generate themselves.

## Highlights

- **Data Manager** (`#/metadata`) — shows how many cached videos are missing a title,
  channel or duration, and repairs them: Re-scan, Refresh Missing Metadata, Remove
  Incomplete Entries, Clear All Cache, per-entry Retry. Reachable from the sidebar
  (with a gap badge) and from Metadata settings.
- **Metadata correctness** — a forced refresh no longer deletes cached rows before
  fetching. An entry that only lacked a duration used to lose its title and channel
  when the refetch failed; ids are now tracked in memory and failures leave the
  previous entry untouched.
- **Microsoft Edge support** — derived MV3 manifest, store ZIP, portal install button
  and submission guide.
- **UI system** — one modal system, theme picker, shared sticky headers; the Manage
  page's bulk actions work again.

## Reliability and infrastructure

The parts users will not see but will feel:

- The extension E2E suite now actually runs. It had never executed a single assertion —
  the fixture resolved the extension to `apps/dist/chrome` while the build writes to
  `<repo>/dist/chrome`, so Chromium hung on a missing `--load-extension` path until the
  fixture timeout.
- `main` requires three passing checks (quality, extension diagnostics, E2E) with admin
  enforcement and required conversation resolution.
- The build installs with `npm ci`; `npm install` under npm 11 pruned a lockfile entry
  npm 10 needs and silently broke CI.
- In-app release notes are generated from `CHANGELOG.md` rather than hand-copied — the
  old copy had drifted into showing a 2020 entry for 1.2.0.

## Store status

- Chrome Web Store: 1.1.1 in review (auto-publish on approval); 1.2.0 package ready.
- Firefox AMO: 1.1.1 listed; 1.2.0 package ready.
- Edge Add-ons: 1.2.0 package ready; Partner Center listing pending.

See [release readiness](RELEASE_READINESS.md) for store validation history and
[the release process](RELEASING.md) for how this version was cut.
