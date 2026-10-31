# AGENTS.md — AI Agent Guidance & Architecture Specification

> **Notice:** This repository is maintained primarily by AI agents. All agents working on this codebase MUST read and adhere to the architectural guidelines, storage rules, and build validation procedures outlined below.

---

## 📍 Start here — reading order

Read in this order, and stop when you have what you need:

| #   | File                   | Why                                                                                                                  |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | `.ai-sync/HANDOFF.md`  | Current state: branches, SHAs, what is pending, known traps. **Verified facts — trust it until the repo disagrees.** |
| 2   | `.ai-sync/PLAN.md`     | What is being built next, and the sequencing rules.                                                                  |
| 3   | `.ai-sync/PROGRESS.md` | Open tasks and what "done" means for each.                                                                           |
| 4   | `docs/INDEX.md`        | Map of every other document.                                                                                         |
| 5   | `.ai-sync/HISTORY.md`  | Only when you need the reasoning behind an old decision. Frozen.                                                     |

**The repo is the truth, not these files.** If a document disagrees with code, tests or
`git log`, the document is stale: fix it in the same PR rather than working around it.

**On stop, update `.ai-sync/HANDOFF.md`** — state, not narrative — and tick off
`PROGRESS.md`. Append to `HISTORY.md` only when retiring detail from `HANDOFF.md`.

## Shared workflow across agents

OpenSpec is configured for Codex and Hermes. Read `openspec/README.md` and
`openspec/config.yaml` for the workflow. Active change:
`openspec/changes/complete-context-menu-acceptance/`. Planning artifacts do not prove
acceptance; keep its tasks pending until their evidence exists.

Read [`.ai-sync/AGENT_WORKFLOW.md`](.ai-sync/AGENT_WORKFLOW.md) for the shared task,
review, evidence and handoff standard. Blank templates live in `.ai-sync/templates/`;
copy them to session files, never overwrite current state with an empty template.
Use `.ai-sync/START_HERE.md` when switching agents. The owner's current instructions,
including delegation of test execution, take precedence over the default commands below.

## Relevant skills

Before starting a task, inspect the available skill catalog and load the skills directly
relevant to the requested work. Reassess when the scope changes. For follow-up prompts
in the same task, reuse loaded guidance unless it changed or a new skill becomes relevant.

Use the smallest useful set. Do not load unrelated skills or several overlapping skills
without a clear reason. Read each selected SKILL.md before applying it, then load only
its supporting references needed for the task. Briefly name the skills used and their
purpose; record the names and source paths in the session record.

Follow the owner's instructions and project rules when applying skills. If a required
skill is unavailable, report the limitation. Use an appropriate fallback when possible;
ask for input only when the missing skill prevents authorized work. If none fits, proceed
using project guidance and record that no relevant skill was available or needed.

Skill instructions do not authorize additional scope, override delegated verification,
or permit merging, publishing or destructive actions. Resolve conflicts using the
applicable instruction hierarchy. A skill's presence does not prove it was loaded or
followed, and it does not guarantee a correct result.

## Parallel implementation orchestration

Follow `docs/AI_ORCHESTRATION.md` for assigned feature worktrees, coordinator/worker
roles and the push-then-PR lifecycle. Runtime orchestration is not implemented yet;
its plan is `openspec/changes/orchestrate-parallel-implementations/`. Use manual
handoffs when an agent cannot launch another agent. Start with two independent jobs.

Merge mode is manual by default. Guarded automatic merging needs explicit per-job
owner opt-in plus current required checks/review, resolved threads, manual acceptance
and effective server protections. Conflict-free status is not merge authority. This
policy qualifies the older Git workflow examples below; those are not instructions to
switch another worker's checkout or merge the current unfinished feature.

## Worktree coordination

Follow `.ai-sync/AGENT_WORKFLOW.md` for independent implementation worktrees and
cross-agent handoffs. Reuse a suitable worktree for the same change; keep one writer
per worktree, and verify prerequisites exist in its starting commit. Uncommitted and
untracked work does not transfer automatically. Record the absolute path/branch/base
and owners in the templates; reviewers and Hermes must use that exact checkout.
Use app-managed worktree creation/archive tools where available. Preserve existing
edits, configure dependencies/skills/ports for each checkout, and do not force removal
or interpret worktree isolation as permission to merge/release.

### One editor per tree

Two agents editing the same checkout produced a duplicated import and a duplicated
object key that only surfaced later. Take the editing lock before writing:

```bash
node packages/build-tools/agent-lock.js status            # exit 3 means a live owner
node packages/build-tools/agent-lock.js run -- npm test    # lock, run, always release
node packages/build-tools/agent-lock.js acquire --agent hermes --branch <branch>
node packages/build-tools/agent-lock.js release [--force]
```

The marker is `.agents/EDITING` (git-ignored) and records pid, agent, branch and start
time. A marker whose owner process is gone is stale and may be taken over; a live owner
is never overridden. Release refuses a foreign pid unless `--force` is explicit.

## ⚡ Quick Reference (first 30 seconds of any session)

```bash
git fetch --prune --all   # ALWAYS first. Drops refs to branches deleted on the remote.
npm run check          # ALWAYS run this first. Lint → format:check → test → file-size → svelte-check. All clear? Proceed.
npm run format         # Auto-format everything before committing.
npm run lint:fix       # ESLint auto-fix (handles unused-var prefix, console cleanup).
npm run build          # Full production build (SPA → editor → dist/chrome + dist/firefox + dist/edge).
npm run watch          # Dev watch mode for the Svelte SPA.
npm run web            # Web portal dev server (localhost:3000).
```

### File Map

| Path                                           | Contains                         | Notes                                                                                                                                                                                               |
| ---------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/browser-extension/background/`           | Service worker entry point       | `index.js` → imports modules: `background.js` (~300 lines), `utils.js`, `context-menus.js`, `history.js`, `sync.js`, `init.js`                                                                      |
| `apps/browser-extension/content-scripts/`      | Page-injected scripts            | `watch-tracker.js`, `injectors/` (5 small files)                                                                                                                                                    |
| `apps/browser-extension/popup/`                | Quick-add popup toolbar          | ES modules: `popup.js` (~346 lines entry), `utils.js`, `tabs.js`, `state.js`, `target.js`, `channel.js`, `quick-add.js`                                                                             |
| `apps/browser-extension/playlist-manager/src/` | Svelte SPA (TypeScript)          | `App.svelte`, `components/` (~38 files), `services/` (17 files), `views/`, `stores/`, `types/`                                                                                                      |
| `apps/web-portal/`                             | Next.js 15 marketing + dashboard | App Router, Tailwind, shadcn/ui, Playwright e2e                                                                                                                                                     |
| `packages/build-tools/`                        | Build/CI scripts (Node.js)       | Build + package scripts, and the guards wired into `npm run check`: `verify-file-size.js`, `verify-css-bundle.js`, `verify-vercel-config.js`, `verify-tooling-versions.js`, `gen-release-notes.mjs` |
| `docs/`                                        | Documentation + screenshots      | Start at `docs/INDEX.md` — it maps every document. `RELEASING.md` is the release runbook.                                                                                                           |
| Root                                           | Lint, format, test config        | `eslint.config.mjs`, `.prettierrc`, `vitest.config.mjs`, `jsconfig.json`. **No root `vercel.json`** — see `docs/DEPLOYMENT.md`.                                                                     |

---

## 🧩 Module Structure Guidelines (AI Agent Code Standards)

This repository is maintained exclusively by AI agents. Every file must be instantly grokkable without loading a monolith.

### The Golden Rule: No file over 350 lines

When any JavaScript file crosses 350 lines, it MUST be split. The AI agent doing the work is responsible for the split — don't defer it. The split is part of the task.

### How to split a monolith

Follow the pattern established in `popup/` and `background/`:

| Module type                  | Convention                                                                                                        | Example                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Entry point**              | Kept in the original file. Imports from sibling modules, wires onclick handlers, calls init(). No business logic. | `popup.js` (~346 lines), `background.js` (~300 lines)                           |
| **Utils / constants**        | Pure helpers, shared constants, platform detection. No side effects beyond `export`.                              | `utils.js` — `getById`, `setIcon`, `getErrorMessage`, `alert`, `log`            |
| **Feature module**           | One concern per file. Named after what it does. All related functions live together.                              | `tabs.js` — `getActiveTab`, `isYoutubeTab`, `getVideoTabsInWindow`              |
| **Shared state**             | Mutable state that multiple modules read/write. Single source of truth.                                           | `state.js` — `activeTargetMode`, `selectedPlaylistId`                           |
| **Side-effect registration** | Top-level `browser.*.addListener(...)` calls that must run once. Imported for their side effects.                 | `context-menus.js` — `onClicked.addListener`, `sync.js` — `onAlarm.addListener` |

### Splitting checklist

```
1. Read the full file end-to-end (never split from partial read)
2. Group functions by concern on paper, name each group
3. Create one module per group, copy functions with their JSDoc
4. Write the import chain top-down (no circular imports)
5. Keep the entry point: import modules, wire onclick handlers, call init()
6. npm run check         ← MUST pass before declaring done
7. npm run build         ← MUST pass (verifies dist/ picks up new modules)
8. Commit with message: "refactor: split <file> (N lines) into M ES modules"
```

### Anti-patterns

- ❌ Splitting mid-function or breaking a function's internal logic across files
- ❌ Circular imports between sibling modules (use a `state.js` buffer)
- ❌ Leaving dead imports after a split (`no-unused-vars` will catch this)
- ❌ Splitting TypeScript Rollup entry points without verifying the bundle output (those have complex dependency chains — do them in a focused session)
- ❌ Skipping the build step — `dist/` must include the new modules

### When NOT to split

- Rollup entry points in `src/services/` (e.g., `youtube-api.ts`, `storage-service.ts`) — these have complex internal deps visible only in the compiled bundle. Split these in dedicated sessions after studying the dependency graph.
- Files under 150 lines that already do one thing well
- Test files — they're already granular by nature

---

## 🎨 CSS & Component Styling Rules (CRITICAL — NEVER VIOLATE)

Rollup uses `rollup-plugin-css-only` to bundle all CSS into `editor/bundle.css`. This pipeline has strict behaviors that all AI agents MUST observe:

1. **NEVER use `<style> @import "..." </style>` inside Svelte components.**
   - Rollup does NOT inline CSS `@import` statements inside Svelte `<style>` blocks.
   - It outputs `@import` verbatim mid-bundle in `bundle.css`. Browsers strictly ignore mid-bundle `@import` rules (CSS spec), causing styles to silently fail and components to render unstyled.
   - Component `<style>` tags must ONLY contain local, scoped CSS.

2. **Global / Shared View CSS MUST be imported in `src/main.ts`.**
   - Styles shared across views or child components (such as `design-tokens.css`, `view-layout.css`, and `settings.css`) must be imported via JavaScript in `apps/browser-extension/playlist-manager/src/main.ts`.
   - Rollup will properly bundle and inline them into `bundle.css`.

3. **Automated Enforcement:**
   - Both `npm run check` and `npm run build` run `packages/build-tools/verify-css-bundle.js`.
   - Any component containing `@import` or any build resulting in stray `@import` in `bundle.css` will trigger a **hard build failure**.

---

## 🏛️ Architecture Overview

The codebase is split into three layers:

1. **`apps/browser-extension/playlist-manager/` (Frontend SPA Extension UI)**
   - Built with **Svelte 5 + TypeScript + Rollup**.
   - Compiles into `apps/browser-extension/editor/` (`main.js`, `bundle.css`, `index.html`).
   - Location of all UI views (`App.svelte`, `PlaylistEditor.svelte`, `Saved.svelte`, `Settings.svelte`, `History.svelte`, `Search.svelte`) and data services (`video-service.ts`, `youtube-api.ts`, `storage-service.ts`, `playlist-actions.ts`).

2. **`apps/web-portal/` (Official SaaS Portal & Interactive Dashboard)**
   - Built with **Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Lucide icons**.
   - High-converting marketing landing page, interactive extension simulator, and authenticated Supabase-ready cross-device dashboard.
   - Run `npm run web` (dev server on `localhost:3000`) or `npm run web:build` (production bundle).

3. **`apps/browser-extension/` (Extension Shell)**
   - Plain JavaScript WebExtension shell (MV3).
   - `background/index.js` — Module entry point that imports `background/background.js` (service worker for Chrome, background scripts for Firefox).
   - `content-scripts/` — Content script injectables (`watch-tracker.js`, and injectors for `getVideoMetadata.js`, `scrapeYouTubeLinks.js`, `getChannelVideoIds.js`, `getPlaylistVideoIds.js`).
   - `popup/` — Quick-add popup toolbar interface.
   - Manifest sources: `manifest.chrome.json` and `manifest.firefox.json`. The Edge manifest is generated from the Chrome manifest at build time.

---

## ⚙️ Manifest V3 & Browser Differences

The project target platforms are **Google Chrome**, **Microsoft Edge**, **Mozilla Firefox Desktop (140.0+)**, and **Firefox for Android / Fenix (142.0+)**.

### Critical Manifest Rules:

- **Chrome (`manifest.chrome.json`):** Uses `"service_worker": "background/index.js"`. Requires the public `"key"` copied from the existing Chrome Web Store listing to lock extension ID `dapjjdcnolpmfcnobilphjfpkmmokgid` (verified against the dashboard public key). The store ZIP strips this development key; the installed store ID stays the same.
- **Firefox (`manifest.firefox.json`):** Uses `"background": {"scripts": ["background/index.js"], "type": "module"}`. Must **NOT** contain a `"key"` field. Uses Gecko extension ID `independent-yt-playlist-manager@elmusleh.github.io`.
- **Edge (generated, no source file):** Edge is Chromium-based and shares Chrome's MV3 runtime. `build-extension.js edge` reads `manifest.chrome.json`, removes `key` and any `browser_specific_settings`, and writes `dist/edge/manifest.json`. Do **not** add a static `manifest.edge.json`; `validate-manifests.js` enforces that the Edge manifest exactly matches the Chrome manifest minus those fields.
- **Never put `apps/browser-extension/manifest.json` in `apps/browser-extension/`!** `npm run build` generates `dist/chrome/manifest.json`, `dist/firefox/manifest.json`, and `dist/edge/manifest.json`. Only the Chrome and Firefox source manifests belong in `apps/browser-extension/`.

---

## 💾 Storage, Normalization & Backup Architecture

### 1. Per-Video Metadata Storage & Transactional CRUD (`IndexedDB`)

- **Database & Store:** Dedicated database `yph_metadata_db_v2` with object store `metadata` managed natively via `apps/browser-extension/playlist-manager/src/services/db-service.ts` (zero external library conflicts, atomic batch transactions, memory fallback).
- **Key Pattern:** `yph:meta:<videoId>` managed via `db-service.ts` with exponential backoff retry.
- **Strict Normalization:** All metadata and playlist writes are sanitized and enforced through `apps/browser-extension/playlist-manager/src/services/schema-normalizer.ts` (`normalizeVideoMeta`, `normalizePlaylist`, `normalizeHistoryRecord`).
- **Rule for AI Agents:** NEVER store large arrays of video metadata in `browser.storage.local`. High-frequency video metadata MUST be queried and written via `db-service.ts` to utilize the multi-gigabyte `unlimitedStorage` IndexedDB capacity without item quota limits.

### 2. Playlist & App State (`browser.storage.local`)

- **Key Keys:**
  - `playlists` / `yph_local_playlists`: Array of local and saved playlist objects.
  - `local_yt_history`: Watch history timestamp records per video ID.
  - `yph_settings`: Global settings object (`autoFetchMetadata`, `metadataExecutionStrategy`, etc.).
  - `yph_sync_state`: Partial sync resume states across daily API quota limits.

### 3. Full Database Backup & Portability Pipeline (`backup-service.ts`)

- **Export (`exportFullDatabaseBackup`):** Generates portable JSON backup (`schemaVersion: 2`) capturing all playlists, complete IndexedDB video metadata cache, watch history, and settings.
- **Import (`importFullDatabaseBackup`):** Validates schema, resolves duplicates, and supports both non-destructive `merge` and clean `overwrite` restore modes.

### 4. Supabase Cloud Sync & Global Catalog Architecture (`supabase-client.ts`, `supabase-sync.ts`)

- **Authentication:** Supabase OAuth (`launchWebAuthFlow`) and Email/Password with session storage bridge to `browser.storage.local`.
- **Bidirectional Delta-Sync:** Background sync manager executing Last-Write-Wins (LWW) resolution and soft-delete tombstoning (`deleted_at`).
- **Global Video Catalog (`videos_catalog`):** Cross-user deduplicated metadata cache in PostgreSQL that resolves metadata before querying YouTube API quotas.
- **Alarm Housekeeping:** `supabase-cloud-sync` periodic background sync.

---

## 🔄 Video Metadata Fetching & Scraping Pipeline

Metadata fetching occurs in `apps/browser-extension/playlist-manager/src/services/video-service.ts` and `youtube-api.ts` configured via User Settings (`metadataExecutionStrategy: "free_first" | "api_first"`):

### Default Execution Order (Free / Zero-Quota First):

1. **IndexedDB Local Cache Hit:** Read `yph:meta:<videoId>` (24h valid TTL, 5min negative TTL).
2. **Tier 1 — Multi-Client Innertube Engine (Zero Quota):** Queries `https://www.youtube.com/youtubei/v1/player` using modern `MWEB` (`clientVersion: "2.20240801.01.00"`), `WEB`, and `TVHTML5_SIMPLY_EMBEDDED_PLAYER` client profiles (bypasses bot verification and PO tokens).
3. **Tier 2 — Embed Page Headless Scraper (Zero Quota):** Extracts `ytInitialPlayerResponse` JSON directly from `https://www.youtube.com/embed/{id}` HTML.
4. **Tier 3 — Official YouTube oEmbed (Zero Quota):** Queries `https://www.youtube.com/oembed?url=...` guaranteeing video title and channel name.
5. **Tier 4 — YouTube Data API v3 (Uses Quota):** Batch queries (`/videos?id=...`) when user is signed in with OAuth or has configured a custom API key (1 quota unit per 50 videos).
6. **Tier 5 — Dynamic Piped & Invidious Fallback:** Fallback across active Piped instances (`pipedapi.kavin.rocks`, `api.piped.private.coffee`), Invidious instances (`inv.nadeko.net`, `yewtu.be`), and user-configured custom URLs.
7. **Open Tab Scraping:** Direct metadata extraction from open tabs via `apps/browser-extension/content-packages/build-tools/injectors/getVideoMetadata.js`.

### Scraping Settings Keys (`browser.storage.sync` / `Settings`):

- `metadataExecutionStrategy`: `"free_first"` (default) or `"api_first"`.
- `enableInnertubeScraping`, `enableEmbedScraping`, `enableOEmbedScraping`, `enableInvidiousPiped`: Individual boolean engine toggles.
- `customInvidiousInstances`, `customPipedInstances`: Custom self-hosted instance URLs.

---

## 🛠️ Build & Validation Commands

All commands must be executed from the **repository root**:

```bash
# PRIMARY: One-shot verify (lint → format:check → test → svelte-check)
npm run check

# Individual steps (run check instead unless debugging a specific step)
npm run lint            # ESLint on extension JS + build tools
npm run lint:fix        # ESLint auto-fix (safe: unused vars get _ prefix, console gets commented)
npm run format          # Prettier --write everything
npm run format:check    # Prettier dry-run (part of check)
npm run test            # Vitest unit tests (passWithNoTests: true)

# Builds
npm run build           # Full production build (SPA → editor → dist/chrome + dist/firefox)
npm run watch           # Dev watch mode
npm run web             # Web portal dev server (localhost:3000)
npm run web:build       # Web portal production build
```

### Shared toolchain versions (Playwright)

There are no npm workspaces: root, `apps/web-portal` and the playlist manager each install
their own tree. **Playwright does not follow that rule** — its browsers live in one cache
(`~/.cache/ms-playwright`) keyed by version, so whichever tree installed them is the only
one that can launch a browser.

Bump `playwright` and `@playwright/test` in **every** tree in the same PR, then `npm ci` in
each so the lockfiles agree. `verify-tooling-versions.js` (part of `npm run check`) fails
with this instruction if the trees drift apart. Skipping it produces this, fifteen minutes
later, in E2E — which reads like a flake and is not one:

```
browserType.launchPersistentContext: Executable doesn't exist at
/home/runner/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome
```

CI installs browsers for both trees so a drift cannot break the build either, but the guard
is what keeps a single browser version to debug against.

---

## 🤖 AI Agent Workflow (mandatory)

### Pre-Edit

```
1. npm run check          # Verify clean baseline — do NOT edit anything if this fails
2. Read the file(s)       # Always read_file before editing
3. Search for usages      # search_files on the symbol/import you're about to change
```

### Post-Edit

```
4. Make the edit          # Use patch tool (not terminal sed/awk)
5. npm run check          # MUST pass. Fix any failures before continuing.
6. npm run build          # MUST pass. Full production build verification.
```

### Commit

```
7. git switch next && git pull origin next   # always start from the integration branch
8. git switch -c <type>/<slug>               # never commit on next or main
9. git add <changed files>                   # stage explicitly, never `git add -A`
10. git commit -m "<type>(<scope>): <subject>"
11. git push -u origin <branch>
12. gh pr create --base next --fill          # PRs target next, not main
13. add a `[Unreleased]` bullet to CHANGELOG.md in the same PR
```

**Critical rule:** Never skip step 5. Every edit must pass `npm run check` before you declare it done. If the check fails, it's still your problem.

---

## 🌳 Git Workflow — `next` integrates, `main` releases

Two long-lived branches, one rule each:

| Branch | Holds                 | What reaches it                                  |
| ------ | --------------------- | ------------------------------------------------ |
| `next` | everything in flight  | every feature, fix, chore and doc change, via PR |
| `main` | shipped releases only | one PR per release, from `next`                  |

Followers see `main`: one commit per release, never the micro-commits. That is the whole
point of the split — `next` absorbs churn, `main` stays a clean list of milestones.

**Merge method everywhere: squash.** A PR is one commit on its target branch. The repo
has merge commits and rebase merges disabled, and `main` additionally requires linear
history.

### Branch naming

```
<type>/<short-slug>

feat/data-manager          new user-visible capability
fix/duration-zero-length   bug fix
refactor/split-youtube-api internal restructuring, no behaviour change
chore/ci-node-22           tooling, deps, CI
docs/user-guide-refresh    documentation only
```

One logical change per branch. If the branch name needs an "and", split it.

### Feature / fix loop

```
git switch next && git pull origin next
git switch -c fix/duration-zero-length

# ... make the change, and add a bullet under [Unreleased] in CHANGELOG.md ...

npm run check && npm run build          # evidence, not assertion
git add <changed files>
git commit -m "fix(metadata): treat zero-length durations as missing"
git push -u origin fix/duration-zero-length
gh pr create --base next --fill
```

Apply the merge authority and gates in `docs/AI_ORCHESTRATION.md` before merging.
Green checks alone do not enable default automatic merging. Squash keeps `next` readable and makes reverting a change a single-commit operation.

### Release loop

`next` → `main`, one PR, one commit.

```
# 1. changelog: rename the section, open a new empty one
#    ## [Unreleased]  ->  ## [1.3.0] - 2026-11-02  (and a fresh ## [Unreleased] above)
node packages/build-tools/sync-version.mjs --set 1.3.0
npm run release-notes

# 2. release PR
gh pr create --base main --head next --title "release: v1.3.0"

# 3. after the squash merge, tag that commit and push the tag
git switch main && git pull --ff-only
git tag -a v1.3.0 -m "Release 1.3.0"
git push origin v1.3.0

# 4. sync main back into next — see below, this one is not optional
git switch next && git merge origin/main && git push
```

The tag triggers `.github/workflows/release.yml`: version sync from the tag, checks,
store ZIPs, and a GitHub Release whose body is that changelog section.

**Step 4 exists because squash rewrites history.** After a release, `next` and `main`
hold identical content but no shared commits, so the merge-base is stale and the next
release PR would re-display work that has already shipped. `git merge origin/main` on
`next` creates an empty merge commit whose only job is to move the merge-base forward.

That sync is the **one** direct push allowed on `next`, and the reason `next` does not
use `enforce_admins`: a PR cannot carry it, because its diff is empty. Nothing else is
pushed to `next` directly.

### Branch lifecycle

One branch per task, deleted the moment it is merged. Nothing lingers.

```
git fetch --prune --all                 # before starting anything
git switch next && git pull --ff-only
git switch -c fix/whatever              # isolated branch, off next

# ... PR, review, squash merge ...

git switch next && git pull --prune
git branch -d fix/whatever              # local: -d refuses unless merged
git push origin --delete fix/whatever   # only if it still exists remotely
```

`gh pr merge --squash --delete-branch` removes both the local and the remote branch.
Repo-level auto-delete covers merges performed in the web UI, which have no local context.
If a local branch still survives a merge, clean up in bulk:

```bash
git branch --merged next | grep -vE '^\*|^\s*(main|next)$' | xargs -r git branch -d
```

**Never delete `main` or `next`.** They are permanent. `-d` (not `-D`) on everything else
so an unmerged branch is refused rather than silently lost; if `-d` refuses, the branch
holds work that was never merged — investigate it, do not force.

### Agents MAY

- push branches and open PRs against `next`
- push follow-up commits to their own branch, and force-push **their own** branch before
  review starts when rebasing onto `next`
- squash-merge an owned PR into `next` only with recorded owner merge authority and
  the orchestration review/check/protection gates satisfied; default mode is manual

### Agents MUST NOT

- push directly to `next` (except the post-release sync merge) or to `main`, ever
- merge a release PR (`next` → `main`) unless the owner has asked for that release
- delete branches, rewrite reviewed history, or amend pushed commits that carry review
  comments
- use an admin override to bypass a failing check — fix the branch instead
- declare a PR ready without the evidence below

### Before opening a PR

```
npm run check          # must pass — lint, format, unit tests, gates, release notes in sync
npm run build          # must pass — chrome, firefox, edge + bundle budgets
npm run test:extension # when the change touches a view, route or shared component
```

The PR body must state: what changed, why, the exact commands run and their real result,
and anything that was **not** verified. "Tests pass" without output is not evidence.

### Review loop

Reviews land as comments on the same branch — answer with new commits, never a
force-push over reviewed history. Unresolved review threads block the merge on both
`next` and `main` (required conversation resolution), so reply with the fix commit and
resolve the thread.

## 🚨 Guidelines & Rules for AI Agents

1. **Run Verification Commands:** Always run `npm run check` and `npm run build` after making code modifications.
2. **Preserve Compatibility:** Maintain Android (Fenix) compatibility guard checks (`isAndroid()` user-agent detection) before using desktop-only extension APIs (`contextMenus`, `identity.launchWebAuthFlow`).
3. **Keep Manifests Clean:** Never add `apps/browser-extension/manifest.json` or `manifest.edge.json`. Only edit `apps/browser-extension/manifest.chrome.json` and `apps/browser-extension/manifest.firefox.json`; the Edge manifest is generated from Chrome at build time.
4. **Debounced Saves:** Ensure UI edits to playlists trigger the debounced autosave in `storage-service.ts`.
5. **Branch discipline:** all work branches off `next` and PRs target `next`; only a release PR reaches `main`. Never push directly to either long-lived branch (the single exception is the post-release `main` → `next` sync merge) — see _Git Workflow_ above.
6. **Run check before and after every edit.** This is non-negotiable. A failing check means you broke something.

## 🚀 Release Process & Staging Status

All project releases follow [docs/RELEASING.md](docs/RELEASING.md). A release is a PR from `next` to `main`, squash-merged, then tagged `vX.Y.Z` from `main`, after which `main` is merged back into `next` to keep the merge-base current.

### Current Release & Testing State:

- **Chrome Web Store**: Version 1.1.1 pending review.
- **Microsoft Edge Add-ons**: Version 1.1.1 package builds and validates locally; submission is pending a Microsoft Partner Center listing and Product ID. See `docs/EDGE_STORE_SUBMISSION.md`.
- **Firefox AMO (Listed)**: Version 1.1.1 (ID 6620554) pending review.
- **Firefox Unlisted Test Release**:
  - Version `1.2.0.1` (AMO ID `6620940`) signed under unlisted channel for external tester distribution.
  - Local artifact: `dist/firefox/web-ext-artifacts/independent_youtube_playlist_manager-1.2.0.1.xpi`.
  - Testing via link or `about:debugging#/runtime/this-firefox`.
- **Publication Policy**:
  - The AI agent will maintain and prepare all local packages, builds, and metadata.
  - **Do NOT publish to any public channel (including `https://iypm.vercel.app/`) until explicit user confirmation is given.** Opening the release PR is always allowed; merging it into `main` happens only when the owner asks for that release.

## Releases

Every release follows `docs/RELEASING.md`. Short version: bump with
`sync-version.mjs --set`, write the `CHANGELOG.md` section, run `npm run release-notes`
(the in-app modal is generated from the changelog and `npm run check` fails when it is
stale), update `docs/RELEASE_X.Y.Z.md` and the README status block, merge the release PR,
then push an annotated `vX.Y.Z` tag — the release workflow builds the ZIPs and publishes
the GitHub Release with the changelog section as its body.

## Post-Implementation Suggestions

After each implementation, give the user exactly 3 NEW potential improvements or next-step suggestions for this project (professionalism, security, best practices). Must not repeat already-done/suggested items; mention each for reference. See `~/dev/AGENTS.md` § Post-Implementation Suggestions.
