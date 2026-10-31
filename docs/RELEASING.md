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

## 5. Land the release prep on `next`

The version bump and changelog land on `next` like any other change — they do not carry
code, so they get their own small PR rather than a long-lived release branch.

```bash
git switch next && git pull origin next
git switch -c chore/release-1.3.0
npm run check && npm run build
git commit -am "chore(release): 1.3.0 version and changelog"
git push -u origin chore/release-1.3.0
gh pr create --base next --head chore/release-1.3.0 --title "chore(release): 1.3.0"
gh pr merge --squash --delete-branch
```

Requirements on both `next` and `main`: the three checks (Quality & Security, Extension
CI, Web & Extension E2E) plus every review thread resolved. `strict` is off, so no rebase.

## 6. Release PR: `next` → `main`

This is the moment `main` moves. Open it, let the checks run, then **squash** it — `main`
takes exactly one commit per release.

```bash
gh pr create --base main --head next --title "release: v1.3.0" --body-file release-notes.md
gh pr merge --squash
```

Then tag that commit and push the tag:

```bash
git switch main && git pull --ff-only
git tag -a v1.3.0 -m "Release 1.3.0"
git push origin v1.3.0
```

The tag is pushed, never created on the `next` head — the workflow builds whatever the
tag points at.

## 6b. Sync `main` back into `next`

Do this immediately after every release, or the next release PR will re-show shipped work.

```bash
git switch next && git pull --ff-only
git merge origin/main          # empty merge commit: it only moves the merge-base
git push
```

Squash merges mean `next` and `main` hold the same content but share no commits after a
release, so GitHub's merge-base is stale and the next `next → main` diff includes
already-released changes. The empty merge commit fixes the comparison.

This is the **only** direct push allowed on `next`. It has to be one: the change is a
merge commit, so a PR cannot carry it (the diff is empty). That is why `next` runs
without `enforce_admins` while `main` runs with it.

## 7. Let the release workflow do the rest

`.github/workflows/release.yml` triggers on `v*` and:

1. syncs versions from the tag,
2. runs `npm run check`,
3. packages Chrome, Firefox and Edge ZIPs (`npm run pack`),
4. verifies the built extension loads (`npm run test:extension`),
5. uploads the ZIPs as artifacts,
6. creates the GitHub Release with the **changelog section for that tag** as its body
   and the ZIPs attached.

## Beta releases — testing `next` before an official release

`.github/workflows/beta-release.yml` runs on **every push to `next`** (and manual
`workflow_dispatch`) and is fully independent of the official release flow above. It
builds the extension and cuts a public **GitHub Prerelease** so builds can be tested
before they ship.

- **Version, derived and never committed.** The beta tag is `vX.Y.Z-beta.N`, where
  `X.Y.Z` is the canonical version in `manifest.chrome.json` and `N` is the number of
  commits since the last **official** `v*` tag (beta tags are excluded so `N` keeps
  growing across successive betas instead of resetting). Inside the throwaway CI checkout only, the version is
  patched to the numeric build `X.Y.Z.N` (Chrome's manifest accepts numeric versions
  only) via `sync-version.mjs --set X.Y.Z.N`; nothing is committed, so `next` keeps its
  `x.y.z` version and never churns version files or lockfiles. `main` and the official
  release flow are untouched.
- **Assets.** The same `npm run pack` Chrome/Edge/Firefox ZIPs plus a source-code ZIP,
  attached to the prerelease and also kept as workflow artifacts for 30 days.
- **Promotion rule.** A beta manifest build `X.Y.Z.N` is numerically _higher_ than its
  base `X.Y.Z`. When you promote tested betas to an official release, ship the official
  at a strictly higher version (e.g. betas on `1.2.1.N` → release the official at
  `1.2.2` or later). Otherwise Chrome/Edge treat the official `1.2.1` as a downgrade and
  beta users will not receive it as an auto-update.

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
[ ] CHANGELOG: [Unreleased] renamed to [X.Y.Z] - date, fresh [Unreleased] added
[ ] npm run release-notes run (in-app notes regenerate)
[ ] docs/RELEASE_X.Y.Z.md written
[ ] README Current Status updated
[ ] HANDOFF updated
[ ] npm run check && npm run build green
[ ] release prep PR squash-merged into next
[ ] release PR next -> main squash-merged with all checks passing
[ ] annotated tag vX.Y.Z pushed from main
[ ] release workflow green, 4 assets, body from changelog
[ ] main merged back into next (merge-base refreshed)
[ ] store uploads done, store status updated
```

## Known debt

- The Release Notes modal used to hold a hand-written history (30 sections, several
  from the 2020 upstream project, including a conflicting `[1.2.0]` entry). It now
  renders generated data, so that history is gone: the modal only shows versions present
  in `CHANGELOG.md`. Anything earlier lives in git history.
- The release workflow's ZIP names are fixed by `iypm.sh pack`; renaming them breaks the
  store guides and `docs/firefox-release-metadata.json`.
