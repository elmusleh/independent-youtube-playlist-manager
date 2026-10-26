# Releasing

How to cut a version of IYPM. Follow this every time; the cost of skipping a step is
usually a store submission that has to be withdrawn or a release page that contradicts
the changelog.

`CHANGELOG.md` is the single source of truth for what changed. The in-app Release Notes
modal is generated from it — never edit the modal by hand.

## 1. Decide the version

Semantic versioning, tagged `vX.Y.Z`:

| Change                                                                 | Version                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| Breaking data or UI behaviour (e.g. the Svelte `@import` ban in 1.2.0) | minor/major bump + a **BREAKING** line in the changelog |
| New user-visible feature                                               | minor bump                                              |
| Fixes only                                                             | patch bump                                              |

## 2. Bump the version everywhere

`apps/browser-extension/manifest.chrome.json` is canonical; the script propagates it to
`package.json`, `manifest.firefox.json` and the portal. The Edge manifest is generated at
build time.

```bash
node packages/build-tools/sync-version.mjs --set 1.2.0
node packages/build-tools/sync-version.mjs          # verify everything agrees
```

CI also enforces version sync in the _Extension CI_ job.

## 3. Write the changelog, then regenerate the notes

Add a `## [X.Y.Z] - YYYY-MM-DD` section with `### Added` / `### Changed` / `### Fixed`
under `[Unreleased]`. Write for users, then add the detail underneath if it matters.

```bash
npm run release-notes        # regenerates src/generated/release-notes.ts
```

`npm run check` fails if the generated file is stale, so this cannot be forgotten
silently.

## 4. Update the docs that carry the version

- `docs/RELEASE_X.Y.Z.md` — a short page in the style of `RELEASE_1.1.1.md`: what the
  release is, highlights, store status.
- `README.md` — the **Current Status** block (version, store review state, test counts).
- `HANDOFF.md` — what shipped and what is next.

## 5. Open the release PR

```bash
git switch -c release/1.2.0
npm run check && npm run build
git commit -am "release: 1.2.0"
git push -u origin release/1.2.0
gh pr create --base main --head release/1.2.0 --title "release: 1.2.0"
```

`main` is protected: three checks must pass (Quality & Security, Extension CI, Web &
Extension E2E), and every review thread must be resolved. `strict` is off, so no rebase
is needed first.

## 6. Tag after the merge

Tag the merge commit on `main` — never a branch head, never before the checks pass.

```bash
git switch main && git pull --ff-only
git tag -a v1.2.0 -m "Release 1.2.0"
git push origin v1.2.0
```

## 7. Let the release workflow do the rest

`.github/workflows/release.yml` triggers on `v*` and:

1. syncs versions from the tag,
2. runs `npm run check`,
3. packages Chrome, Firefox and Edge ZIPs (`npm run pack`),
4. verifies the built extension loads (`npm run test:extension`),
5. uploads the ZIPs as artifacts,
6. creates the GitHub Release with the **changelog section for that tag** as its body
   and the ZIPs attached.

## 8. Verify the release

```bash
gh release view v1.2.0
gh run list --workflow release.yml --limit 1
```

Check: four assets (`chrome`, `firefox`, `edge`, `source-code`), the body matches the
changelog, and the workflow is green. A release with no assets is a broken release —
delete it (`gh release delete v1.2.0`) and re-push the tag after fixing the workflow.

## 9. Store submission

Upload the ZIPs from the release assets:

- **Chrome** — `independent-youtube-playlist-manager-chrome.zip`
- **Edge** — `independent-youtube-playlist-manager-edge.zip` (Partner Center; see
  `docs/EDGE_STORE_SUBMISSION.md`)
- **Firefox** — `independent-youtube-playlist-manager-firefox.zip` (AMO; the version must
  also be recorded in `docs/firefox-release-metadata.json`)

Then update the store status lines in `README.md` and `docs/RELEASE_X.Y.Z.md` once each
listing reflects the new version.

## Checklist

```
[ ] version decided and BREAKING noted if applicable
[ ] sync-version --set X.Y.Z
[ ] CHANGELOG section written, npm run release-notes run
[ ] docs/RELEASE_X.Y.Z.md written
[ ] README Current Status updated
[ ] HANDOFF updated
[ ] npm run check && npm run build green
[ ] release PR merged with all checks passing
[ ] annotated tag vX.Y.Z pushed from main
[ ] release workflow green, 4 assets, body from changelog
[ ] store uploads done, store status updated
```

## Known debt

- The Release Notes modal used to hold a hand-written history (30 sections, several
  from the 2020 upstream project, including a conflicting `[1.2.0]` entry). It now
  renders generated data, so that history is gone: the modal only shows versions present
  in `CHANGELOG.md`. Anything earlier lives in git history.
- The release workflow's ZIP names are fixed by `iypm.sh pack`; renaming them breaks the
  store guides and `docs/firefox-release-metadata.json`.
