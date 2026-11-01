# Improvement Plan — 2026-11-01

Status: **proposed, awaiting owner approval.** This document sequences the work that is
already in flight plus the four open issues. It does not authorize a release, a merge, a
store submission or a deploy.

Owner constraints that stay in force: merge mode is manual, `main` only receives release
PRs, tests/builds may be executed by the agent, and nothing is published to a public
channel without explicit confirmation.

## 0. Where the repository actually is

Verified on 2026-11-01 with `git`, `gh`, `npm run check` and `openspec list`:

| Thing | State |
| --- | --- |
| `next` | `2835752`, clean, CI green |
| `feat/ui-polish` | `6c03f67`, **ahead 1**, PR **#63** open, all checks green, `MERGEABLE`, no review decision |
| Working tree in `/home/steve/dev/independent-youtube-playlist-manager` | **dirty**: 55 files, +1939/−835 — UI polish, Data Manager explainability, metadata tombstones, pagination, duration labels |
| `npm run check` on that dirty tree | **fails at `contracts:check`** (see 1.1). Lint/format/tests/svelte-check pass (558 tests, 0 Svelte errors) |
| `fix/portal-logo-weight` (`e2223fc`, worktree `/home/steve/dev/iypm-worktrees/portal-logo`) | complete, `npm run check` exit 0, not pushed |
| Open issues | **#10** pagination, **#11** thumbnails on deleted videos, **#13** dark-mode flash, **#14** durations missing after import |
| OpenSpec | `add-encrypted-cross-device-sync` 0/28, `complete-context-menu-acceptance` 0/14 |

Two consequences worth stating plainly:

- Nearly two thousand lines of verified work exist only as uncommitted files. They are one
  `git checkout -- .` away from being lost and are invisible to CI.
- Issue #14's fix is already half-written in that dirty tree (`shared/duration-label.js`,
  the `cacheScrapedMetadata` path), which is why it belongs with Phase 1 and not with a
  fresh investigation.

## 1. Phase 0 — Unblock (do first, before any new feature)

### 1.1 Repair the `contracts:check` failure (S)

**Cause (verified):** `background/capture-import.js` now calls
`window.videoService?.cacheScrapedMetadata(...)`. That call works at runtime —
`background/init.js` aliases `globalThis.window = globalThis` and `background/index.js`
imports `../editor/video-service.js` — but `@ts-check` sees only `Window & typeof globalThis`,
so the checker reports `TS2339: Property 'videoService' does not exist` and refuses the
generated declaration as stale.

This is **type-contract drift, not a runtime bug**. Do not "fix" it by deleting the call.

**Do:**
- Add one typed bridge helper (for example `shared/page-service.js` exporting
  `getPageService(name)` with a single `@type {any}` cast and a comment explaining the
  `init.js` shim), and use it from `capture-import.js` and `background.js`.
- Run `npm run contracts:generate`; the regenerated `capture-import.d.ts` must then match.
- Add a unit test that fakes the bridge and asserts `cacheScrapedMetadata` forwards records.

**Done when:** `npm run check` exits 0 on the working tree, `contracts:check` included, and
the regenerated declaration is committed with no hand edits.

### 1.2 Land the portal logo fix (S)

Branch is finished and green locally. Push `fix/portal-logo-weight`, open the PR against
`next`, and let CI confirm what the local run already showed.

**Done when:** PR open, checks green, `verify-portal-assets` passing in CI.

## 2. Phase 1 — Commit and ship what is already built (M)

The dirty tree holds three separable changes. Split them, in this order, each with its own
commit, so a revert is one commit:

1. `fix(metadata): cache scraped title/channel/duration` — `shared/duration-label.*`,
   `capture-import.js`, `context-menus.js`, enrichment changes (depends on 1.1).
2. `feat(ui): data manager explainability` — `MetadataSourceGuide`, `MetadataScalability`,
   `MetadataUsageEstimate`, `MetadataIssueQueue`, `metadata-engines.ts`,
   `utils/metadata-estimate.ts` + tests.
3. `feat(ui): pagination and editor polish` — `PaginationBar`, `CategoryBadge`, category
   utils, remaining Svelte edits, `Share.svelte` deletion.

Rules: stage explicitly, run `npm run check && npm run build` before each commit, push to
the existing branch so PR #63 carries them, and add the corresponding `[Unreleased]`
bullets (some are already written).

**Done when:** the working tree is clean, PR #63 is updated and green, and no untracked
file remains that only exists on this machine.

## 3. Phase 2 — Close the four open issues with evidence (M)

Each issue needs a reproducible check, not source inspection. A closed issue without a
recorded command or screenshot is not closed.

| Issue | Root cause | Work | Evidence to attach |
| --- | --- | --- | --- |
| **#10** can't reach first/last page | Pagination control hides edge pages and has no Previous/Next buttons | Confirm `PaginationNav` renders first/last/prev/next and stays usable at 320–430 px; add unit tests for 1 page, 2 pages, last page, filtered results | Unit test output + screenshots at 320/390/430 px |
| **#14** no duration badge after import | Import never populated durations; scrape path caches only title/channel | Ensure the scrape cache writes `durationISO`, and that import triggers bounded enrichment (`metadata-completeness`); show the badge from `durationISO` | Before/after screenshot of an imported playlist + the unit test that fails without the write |
| **#13** white flash on dark refresh | Theme applied after the module graph paints | Verify the pre-paint classifier covers the SPA (the popup already has `mode.js`); assert `html` carries the theme class before first paint | Playwright trace showing first paint, plus a real-device spot check. Do not close on code reading |
| **#11** thumbnails vanish when a video is deleted | Only the remote thumbnail URL is stored; archived bytes are opt-in and hard to find | Verify archive-on-save covers deleted videos, surface the opt-in setting in Settings, document the backup round-trip | Settings screenshot, archive record for a known-deleted ID, backup export/import round-trip log |

Order: #14 and #10 first (they are already 80 % built in Phase 1), then #13, then #11
(largest, because it touches storage and the user guide).

## 4. Phase 3 — Quality and debt (S–M each, parallel-safe)

- **Runtime bridge test** for the background↔page service shim; the current failure mode is
  silent `undefined` (the optional-chain makes a missing service look like success).
- **Size debt:** `PlaylistEditor.svelte` (1963) and `Manage.svelte` (1997) are 5× the 350-line
  rule. Split one per session, using the AGENTS.md checklist; delete the matching
  allowlist entry in the same commit.
- **Portal hardening** (already recorded as suggestions): security headers, a page-weight
  assertion in `verify-portal.js`, removal of the unused `Navbar.tsx`.
- **Docs:** USER_GUIDE sections for the Data Manager explainability work and the thumbnail
  archive setting; `docs/INDEX.md` entry for this plan.

## 5. Phase 4 — Encrypted cross-device sync (L, after Phase 0–1)

Start only when the tree is clean and `npm run check` is green, because the first tasks
create new files under `src/services/sync/` and every later task builds on them.

1. **Group 1 (core, no network):** `sync-key`, `key-derivation`, `snapshot-codec`,
   `encryption-service`, `content-selector` — each test-first, each file under 350 lines.
2. **Group 2:** engine with injected fakes (debounce, startup pull, manual, CAS, pre-import
   backup), settings persistence, restore path from the Data Manager.
3. **Group 3:** backend contract + File backend; prove export → wipe → import round-trip.
4. **Groups 4–5:** Supabase BYO and Drive, each behind its own consent gate.
5. **Group 6:** module registry + Plugins screen; API Setup becomes toggleable.

Acceptance for the change stays as written in `openspec/changes/add-encrypted-cross-device-sync/tasks.md`,
including the two manual device passes (7.4, 7.5) that cannot be automated here.

## 6. Phase 5 — Release (owner-gated)

`next` → `main` is one squash PR per release. Decide 1.2.1-patch vs 1.3.0-minor **only
after** Phases 1–2 land, because the context menu and Data Manager are both user-visible
features. Nothing is tagged, uploaded or announced before the owner asks for that release.

## 7. Sequencing rules

1. One branch per phase item; PRs target `next`; squash merges only.
2. Never start a new feature while `npm run check` fails on the tree it will be built on.
3. Every claim in a handoff names the command and its real exit code.
4. Two worktrees maximum in parallel, one writer per worktree, editing lock taken.
5. Keep the portal work and the extension work in separate branches; they touch disjoint
   trees and would otherwise delay each other.

## 8. Suggested order of execution

```
0.1 contracts fix        ─┐
0.2 portal logo PR        ├─ parallel, both small
1.x commit dirty tree    ─┘  (1.x depends on 0.1)
2.1 #14 durations        ─┐
2.2 #10 pagination        ├─ mostly re-verification of Phase 1 work
2.3 #13 dark flash       ─┘
2.4 #11 thumbnails
3.x debt + docs
4.x encrypted sync
5.x release decision
```
