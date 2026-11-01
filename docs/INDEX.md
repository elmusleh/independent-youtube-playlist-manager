# Documentation index

What each document is for, and who it is for. If you are an agent starting a session, read
`../.ai-sync/HANDOFF.md` first — not this file.

## Start here (agents)

| Document                  | Purpose                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `../AGENTS.md`            | Rules, architecture, code standards, git workflow. The authority.                     |
| `../.ai-sync/HANDOFF.md`  | **Current state**: branches, SHAs, what's pending, traps. Verified, not aspirational. |
| `../.ai-sync/PLAN.md`     | What is being built next and in what order.                                           |
| `../.ai-sync/PROGRESS.md` | Open tasks with acceptance criteria.                                                  |
| `../.ai-sync/HISTORY.md`  | Frozen log of past sessions. Reference only, when you need the "why".                 |

## Process

| Document                | Purpose                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `RELEASING.md`          | **The** release runbook: semver, version sync, changelog, tag, store uploads.            |
| `IMPROVEMENT_PLAN.md`   | Sequenced plan for in-flight work, the four open issues, debt and the sync rollout.      |
| `DEPLOYMENT.md`         | Vercel: why there is no root `vercel.json`, the Root Directory setting, `ignoreCommand`. |
| `RELEASE_READINESS.md`  | Pre-release checklist across stores and platforms.                                       |
| `GITHUB_ISSUE_FIXES.md` | Record of specific issue fixes and their verification.                                   |

## Technical reference

[CONTEXT_MENU_PLAN.md](CONTEXT_MENU_PLAN.md) — proposed OneTab-style page menu,
shared capture design, permissions and browser tests; implementation pending.

| Document                                | Purpose                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `PAGE_IMPORT_VERIFICATION.md`           | How the popup scans an arbitrary page, and how to verify it manually.             |
| `RESPONSIVE_UI_PLAN.md`                 | Phased responsive work; phases 1–3 shipped, verification outstanding.             |
| `POPUP_MOBILE_PLAN.md`                  | Popup sizing/instant-open diagnosis and fix; implemented (mode split, SVG icons). |
| `architecture.dot` / `architecture.png` | Rendered architecture graph.                                                      |
| `../packages/build-tools/`              | The guards referenced by `npm run check` — read the file headers.                 |

## Store submissions

| Document                                                      | Purpose                                               |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `EDGE_STORE_SUBMISSION.md`                                    | Edge Add-ons / Partner Center steps and listing copy. |
| `edge-release-metadata.json`, `firefox-release-metadata.json` | Store listing metadata.                               |
| `assets/`                                                     | Store logos and screenshots.                          |

## User-facing

| Document                                                                 | Purpose                                                                                                                                         |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `../README.md`                                                           | What the project is, install, current status.                                                                                                   |
| `USER_GUIDE.md`                                                          | End-user manual, including the Data Manager.                                                                                                    |
| `USAGE_EXAMPLES.md`                                                      | Worked examples.                                                                                                                                |
| `SUPPORT.md`, `PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`, `IMPRESSUM.md` | Legal and support pages.                                                                                                                        |
| `../CHANGELOG.md`                                                        | **Single source of truth** for release notes and GitHub Release bodies. The in-app release-notes file is generated from it — never hand-edited. |

## Per-release records

`RELEASE_1.1.0.md`, `RELEASE_1.1.1.md`, `RELEASE_1.2.0.md` — the note written at each release.
Immutable history; do not update them when cutting a new one.

## Archive

`archive/` holds completed implementation plans (`EDGE_IMPLEMENTATION_PLAN`,
`MODAL_REFACTOR_PLAN`, `THEME_PICKER_FIX_PLAN`). Nothing references them; they are kept for
provenance, not as instructions.

## Rules for adding documentation

1. **One home per fact.** Release steps live in `RELEASING.md` only. Duplicated process docs
   drift, and a drifted process doc is worse than none — `RELEASE_SPEC.md` said "must be on
   `main`" two branches after that stopped being true, and has been deleted.
2. **Don't create a new handoff file.** Update `.ai-sync/HANDOFF.md`; move superseded detail
   into `HISTORY.md`.
3. **State beats narration.** "`next` is 8 commits ahead, nothing user-facing" helps;
   "worked on infrastructure" does not.
4. **Cite commands, not confidence.** If the doc claims something is green, it should name the
   command that proves it.

## Context-menu implementation references

- [Playlist destination terminology](PLAYLIST_TERMINOLOGY.md).
- [Hermes verification handoff](testing/HERMES_CONTEXT_MENU_VERIFICATION.md).
- [Dependency advisory triage](DEPENDENCY_TRIAGE.md).

## Shared AI workflow and worktrees

- [Agent workflow](../.ai-sync/AGENT_WORKFLOW.md): worktree selection, safe snapshots, ownership and evidence.
- [Starting prompts](../.ai-sync/START_HERE.md): implementation/resume and read-only review.
- Blank session templates: [task](../.ai-sync/templates/TASK.md), [review](../.ai-sync/templates/REVIEW.md), [verification](../.ai-sync/templates/VERIFICATION.md), [handoff](../.ai-sync/templates/HANDOFF.md).
- [OpenSpec usage](../openspec/README.md): project/change tracking and checkout-specific setup.

## Parallel implementation coordination

- [Agent orchestration policy](AI_ORCHESTRATION.md): assignments, two-job concurrency, target updates, PR publication and merge gates.
- [Orchestration proposal](../openspec/changes/orchestrate-parallel-implementations/proposal.md): scope and runtime implementation plan.
