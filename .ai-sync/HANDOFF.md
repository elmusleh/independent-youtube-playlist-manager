# Handoff — current state

> **Read this first.** It describes the repo as of 2026-10-26, not as of whenever it was
> written. Everything here was verified with a command at the time of writing; if something
> looks wrong, trust the repo and fix this file.

## Where we are

|                | Value                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `main`         | **v1.2.0** — tagged, GitHub Release published (4 assets), production deployed. Head moves only on a release.         |
| `next`         | Ahead of `main`, **nothing user-facing yet**, so no release is scheduled. Head moves on every merge — do not pin it. |
| Version        | `1.2.0` in `package.json` and `apps/browser-extension/manifest.chrome.json`                                          |
| Open PRs       | none                                                                                                                 |
| Branches       | `main`, `next` only. One worktree (the primary). Clean tree.                                                         |
| Tests          | 195 passing across 22 files (`npm run test`)                                                                         |
| Default branch | **`next`** — new PRs, clones and Dependabot all target it                                                            |

`main` holds releases only. `next` absorbs everything else. A release is a squash-merged PR
from `next` → `main`, tagged, and then `main` is merged back into `next` (see _Traps_ #5).

### Re-verify this file in three commands

```bash
git fetch --prune --all
git log --oneline main..next     # what is unreleased, and whether it is user-facing
gh pr list --state open          # anything in flight
```

Numbers and SHAs go stale within a merge; these three commands do not. If a figure below
disagrees with them, the command wins and the figure needs updating.

## What is unreleased on `next`

| PR  | Summary                                                                     |
| --- | --------------------------------------------------------------------------- |
| #40 | changelog records the branch model and the Vercel fix                       |
| #41 | branch lifecycle rules: `fetch --prune` first, delete branches on merge     |
| #42 | `ignoreCommand`: extension/docs-only pushes skip the portal build           |
| #43 | DEPLOYMENT docs for the skip behaviour                                      |
| #44 | Dependabot monitors all three npm trees                                     |
| #45 | CI autofix workflows (owner-supplied, gated behind `AUTOFIX_AUTO_MERGE`)    |
| #46 | Playwright version-skew guard + CI installs browsers for both trees         |
| #47 | generic page import restored in the popup (rescued from an unmerged branch) |

## Next actions, in order

1. **Do not cut a release yet.** `next` has no user-facing change. Wait for a real fix or
   feature, then follow `docs/RELEASING.md`.
2. **Store uploads for 1.2.0 are manual** — Chrome Web Store, Edge Partner Center, Firefox
   AMO (`docs/RELEASING.md` step 9). Nothing in the repo can confirm they happened.
3. **Old tags are local-only.** `v1.0.0`, `v1.0.2`, `v1.1.0`, `v1.1.1` were never pushed to
   the remote; only `v1.0.1` and `v1.2.0` exist there. Pushing them fires `release.yml`
   once per tag, building and publishing 8-week-old code. Owner decision, not an agent's.
4. **`VideoService.clearCache()` has no callers** (`services/video-service.ts:200`). Either
   delete it or keep it with a test. Two lines of work, but decide rather than leaving it.
5. **Playwright bumps must touch both trees.** When Dependabot proposes one, bump root and
   `apps/web-portal` together — `verify-tooling-versions.js` fails the PR otherwise. That
   failure is correct, not a bug to work around.

## Traps — each of these cost real time once

1. **npm 10 vs npm 11 lockfile war.** npm 11 prunes the nested `picomatch@4.0.7` that npm 10
   (CI) requires, silently breaking `npm ci`. Never run bare `npm install` in
   `apps/browser-extension/playlist-manager`; the root `build` script uses `npm ci` for this
   reason. If you must regenerate a lockfile, use `npx npm@10.8.2 install --package-lock-only`.
2. **Node versions.** CI is Node 22 + npm 10; local may be newer. `undici@8.12.3` needs Node
   ≥ 22.19 — Node 20 fails deep inside the decompress interceptor with
   `Cannot read properties of undefined (reading 'bind')`.
3. **jsdom + localStorage.** On Node ≥ 22.4 `globalThis.localStorage` exists but is
   `undefined`, and Vitest skips populating global keys Node defines. `vitest.setup.mjs`
   re-points it at `jsdom.window.localStorage`. Don't remove it.
4. **One Playwright browser cache, two trees.** Browsers live in
   `~/.cache/ms-playwright` keyed by version. CI now installs for both trees and
   `verify-tooling-versions.js` keeps the versions aligned; a mismatch otherwise surfaces as
   _"Executable doesn't exist at …chromium-1248…"_, which reads like a flake.
5. **Squash merges strand the merge-base.** After a release, `next` and `main` have identical
   content but no shared commits, so the next release PR re-displays shipped work. Fix:
   `git switch next && git merge origin/main && git push`. This is the only direct push
   allowed on `next`, and the reason `next` runs without `enforce_admins`.
6. **`gh pr edit` is broken here** (GraphQL Projects deprecation). Use
   `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -F "body=@file"`.
7. **Unresolved review threads block merges** on both branches. Reply with the fix commit,
   then resolve the thread — a reply alone does not unblock.
8. **`gh pr merge --delete-branch` deletes both local and remote.** Don't also delete by hand;
   a leftover remote gone already yields `HTTP 404: Reference does not exist`.
9. **Never `npm version`.** It edits `package.json` only and `sync-version.mjs` rewrites it.
   Use `node packages/build-tools/sync-version.mjs --set X.Y.Z`, then run it bare to verify.
10. **350-line file limit** (`verify-file-size.js`) with a fixed allowlist. Don't grow the
    allowlist to fit new code — split the file.
11. **E2E resolves the repo root, not the cwd.** The fixture loads the built extension from
    `<repo>/dist/chrome`; a wrong path times out after 60s with a misleading message.
12. **`grep -r` will match `apps/browser-extension/editor/main.js`**, a 370 KB built bundle
    that is checked in. Scope greps with `--include` and paths, or you will flood your context.
13. **Generated files must be Prettier-formatted by the generator.** `format:check` and
    `gen-release-notes.mjs --check` both run in CI, so a hand-edited generated file fails.

## How work happens here

Branch from `next`, PR into `next`, squash merge, delete the branch. Full rules in
`AGENTS.md` → _Git Workflow_. Short version:

```bash
git fetch --prune --all
git switch next && git pull --ff-only
git switch -c fix/short-slug
# ... change, and add a bullet under [Unreleased] in CHANGELOG.md ...
npm run check && npm run build
gh pr create --base next --fill
gh pr merge --squash --delete-branch
```

## Where everything lives

| Need                                 | File                   |
| ------------------------------------ | ---------------------- |
| Rules, architecture, code standards  | `AGENTS.md`            |
| **Current state (this file)**        | `.ai-sync/HANDOFF.md`  |
| What is being built next             | `.ai-sync/PLAN.md`     |
| Open work, with acceptance criteria  | `.ai-sync/PROGRESS.md` |
| Documentation index                  | `docs/INDEX.md`        |
| Release runbook                      | `docs/RELEASING.md`    |
| Deployment (Vercel + root directory) | `docs/DEPLOYMENT.md`   |
| User-facing change history           | `CHANGELOG.md`         |
| Past sessions, frozen                | `.ai-sync/HISTORY.md`  |

## If you are asked to cut a release

Read `docs/RELEASING.md` and follow it exactly. The three steps people skip:

1. Rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` **and** open a fresh empty
   `## [Unreleased]` above it, then `npm run release-notes`.
2. The release PR is `next` → `main`, **squash**-merged; tag `main` afterwards, never the PR
   head.
3. Merge `main` back into `next` immediately. Skipping this corrupts the next release diff.

Then verify the GitHub Release: 4 assets, and the Chrome ZIP's manifest reports the new
version.
