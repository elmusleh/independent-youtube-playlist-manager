# Current Plan — IYPM (2026-10-25)

## Authorized next work — GitHub issues and security alerts

Read issues #10/#11/#13/#14 and open Dependabot alerts. Preserve pre-existing
uncommitted layout/workflow changes. Verify #10 pagination; fix partial import
duration enrichment (#14), pre-paint theme initialization (#13), and opt-in local
thumbnail preservation with controls and backup portability (#11). Update vulnerable
dependencies without a framework migration, verify all three dependency trees,
run unit/check/build and browser regression checks, and document each issue and
alert disposition. Commit only this task's changes. No Git push, issue closure,
store resubmission or website deployment as part of this work.

## Project State: **v1.1.1 Submitted to Stores** ✅

| Component                       | Status                                                             |
| ------------------------------- | ------------------------------------------------------------------ |
| **Chrome Web Store**            | v1.1.1 pending review (auto-publish on approval)                   |
| **Firefox AMO (Listed)**        | v1.1.1 unreviewed (ID 6620554)                                     |
| **Firefox AMO (Unlisted Test)** | v1.2.0.1 unreviewed (ID 6620940) — for external testers            |
| **Source Commit**               | `891b343` (design tokens + workflow analysis) + `dff9c9c` (v1.1.1) |
| **Git Tag**                     | `v1.1.1` (annotated, local only)                                   |
| **Git Push**                    | **NOT DONE** — awaiting owner authorization (per AGENTS.md)        |

---

## ✅ Completed Work (Ready for Push)

### Release 1.1.1

- Removed unused `bookmarks` permission (Chrome takedown fix)
- Corrected Firefox data declarations (required: `browsingActivity`, `websiteContent`; optional: `authenticationInfo`, `personallyIdentifyingInfo`, `searchTerms`)
- Added optional account/search consent gates with background request guards
- Updated privacy disclosures for both stores
- All verification suites pass: 120 tests, zero Svelte diagnostics, clean builds, clean web-ext lint

### Design Token System (New)

- Created `apps/browser-extension/playlist-manager/src/css/design-tokens.css` — single source of truth for all responsive, spacing, color, typography, layout tokens
- Updated `main.ts` to import tokens first (before `view-layout.css`, `responsive.css`)
- 14 token categories: colors, typography, spacing, border-radius, breakpoints, layout dimensions, touch targets, z-index, transitions, viewport/safe-area, component-specific, responsive contracts, utilities, print
- Backward compatible via legacy aliases (`--app-bg`, `--yt-blue`, `--primary-color`, etc.)

### Documentation & Workflow

- `.ai-sync/HANDOFF.md` — Current store status + Firefox unlisted test release
- `.ai-sync/PROGRESS.md` — Added "Design Token System & Workflow Analysis" section (8 items)
- `AGENTS.md` — Added "Current Release & Staging Status" section
- `docs/RELEASE_READINESS.md` — Exact store outcomes + SHA-256 hashes
- `~/Notebooks/Projects/iypm/workflow-analysis-2026-W43.md` — Architecture health assessment
- `~/Notebooks/Projects/iypm/phase4-verification-checklist.md` — Phase 4 responsive verification checklist
- `~/Notebooks/Areas/_reference/Research/tailwind4-migration-plan.md` — Research starter for Tailwind 4 migration
- Hermes profile `~/.hermes/profiles/iypm/` with 17 skills + 5 cron jobs (2 active)

---

## 🎯 Next Work (Priority Order)

### P0 — Owner Action Required

- [ ] **Push to GitHub**: `git push origin main --tags` (publishes source, tag, updated privacy policy)

### P1 — Phase 4 Responsive Verification (Manual)

- [ ] Real Firefox Android device testing (Fenix 142+)
- [ ] 200% zoom + desktop 320px equivalent testing
- [ ] Software keyboard interactions, orientation changes, browser toolbar expansion
- [ ] Use `~/Notebooks/Projects/iypm/phase4-verification-checklist.md`
- [ ] Run `npm run check` + `npm run build` after any fixes

### P2 — Tech Debt (Post-Release)

- [ ] Tailwind 4 migration for web portal (eliminate 3 moderate npm advisories)
  - See `~/Notebooks/Areas/_reference/Research/tailwind4-migration-plan.md`
- [ ] Enable paused cron jobs if needed: daily notes analysis, orphan detection, topic clustering

### P3 — Future Enhancements

- [ ] Design token sync between extension (CSS) and portal (Tailwind)
- [ ] Extract shared tokens to `packages/design-tokens/` for both apps

---

## 🔧 Quick Commands for Future Agents

```bash
# ALWAYS RUN FIRST - verify clean baseline
npm run check

# Full production build (extension + portal)
npm run build

# Extension verification (90 route/viewport checks)
npm run test:extension

# Portal dev server
npm run web

# Portal production build
npm run web:build

# Format all code
npm run format

# Lint + fix
npm run lint:fix
```

---

## 📁 Key File Map for Future Agents

| Path                                                                | Purpose                                                                 |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `AGENTS.md`                                                         | **START HERE** — AI agent rules, architecture, workflow, commands       |
| `.ai-sync/HANDOFF.md`                                               | Current state, store status, what's done/pending                        |
| `.ai-sync/PROGRESS.md`                                              | Checklist of completed/pending work                                     |
| `docs/RELEASE_READINESS.md`                                         | Release evidence, hashes, limitations                                   |
| `docs/RELEASE_SPEC.md`                                              | Release workflow (follow exactly)                                       |
| `docs/RESPONSIVE_UI_PLAN.md`                                        | Responsive implementation plan (Phases 1-4)                             |
| `apps/browser-extension/playlist-manager/src/css/design-tokens.css` | **Single source of truth** for all design tokens                        |
| `apps/browser-extension/playlist-manager/src/main.ts`               | Entry point — imports tokens first                                      |
| `packages/build-tools/`                                             | Build scripts (sync-version, build-extension, validate-manifests, etc.) |

---

## ⚠️ Critical Rules (from AGENTS.md)

1. **NEVER `git push`** — Stage, commit, notify user
2. **ALWAYS `npm run check` before AND after edits**
3. **ALWAYS `npm run build` after edits** — verifies `dist/`
4. **No file > 350 lines** — Split using established module pattern
5. **Preserve `CHANGELOG.md`** — User-owned, untracked
6. **Follow `docs/RELEASE_SPEC.md`** for releases

---

## 🤖 Hermes Profile for This Project

```bash
# Switch to IYPM profile (loads 17 skills + cron)
hermes profile switch iypm

# Available workflow commands:
/workflow analyze:notes --project iypm
/workflow review:weekly --project iypm
/workflow suggest:research --domain "Firefox Android testing"
/workflow suggest:research --domain "Tailwind 4 migration"
```

---

_Updated by workflow-analyst skill on 2026-10-25. Next agent: read AGENTS.md first, then this PLAN.md._
