# Session — Data Manager repair queue, pagination, API-key test (2026-11-01)

## Scope

Owner asked for five follow-ups plus a Data Manager design pass:

1. Validate a saved YouTube Data API key with one request.
2. Add a duration-only refresh action.
3. Add unavailable-video filters, origin, and last-checked time.
4. Deep-link origin playlists from unavailable rows.
5. Bulk retry unavailable tombstones.
6. Consolidate the repair actions and issue lists into one connected panel, with
   pagination; keep reference material behind an expander where appropriate.
7. Assess Apify as an optional metadata provider (no integration requested).

## Acceptance criteria

- [x] API Setup has a **Test API Key** button; it is disabled when the key is empty,
      sends one `videos.list` request, and reports invalid/quota/API-disabled errors
      without logging the key.
- [x] **Refresh Durations** refreshes only title+channel entries missing duration.
- [x] Incomplete and Unavailable are tabs in one **Repair Metadata** panel.
- [x] Incomplete and Unavailable lists paginate using the shared `PaginationBar`;
      default 10 rows, page size persisted as `metadataPageSize`.
- [x] Unavailable tab filters by reason and origin playlist; rows show `Checked …`
      and link origin names to `#/playlist?id=…`.
- [x] **Retry all** re-checks the filtered unavailable set with confirmation and
      progress.
- [x] Source facts are merged into expandable engine rows; the separate Source Guide
      and Scalability panels are removed. No roadmap section remains.
- [x] Extraction Engines includes Page cache, Data API and an Apify/hosted-actor
      `FUTURE · PAID` option without presenting a roadmap.
- [x] No auto-delete of playlist entries or tombstones.
- [x] Build, budgets, tests, svelte-check, Chrome/Firefox/Edge ZIPs pass.

## Implementation

- `MetadataIssueQueue.svelte` — tabs, counts, reason/origin filters, pagination,
  `Retry all`, empty states, 10-row default, `metadataPageSize` persistence.
- `MetadataGapList.svelte` — renders a passed page; removed internal show-more.
- `MetadataUnavailableList.svelte` — renders a passed page; added checked-age and
  origin links; removed internal show-more.
- `MetadataManager.svelte` — one Repair Metadata panel; `refreshIds()` shared by
  full/duration refresh; page order stats → usage → repair → engines.
- `MetadataEngineList.svelte` + `metadata-engines.ts` — one source list with
  expandable cost/request/duration/caveat details, page-cache and Data API rows,
  plus an unconnected Apify option; no separate guide.
- `DeveloperSetup.svelte` — `testApiKey()` and Test API Key button.
- `MetadataSourceGuide.svelte` / `MetadataScalability.svelte` — removed. The
  source facts live in the engine rows; roadmap copy is gone.
- `verify-budgets.js` — CSS ceiling 198 KiB after removing the guide/scalability
  styles; the engine details and queue tabs fit within it.

## Verification

- `npm run build` — budgets pass; CSS `200819` bytes / 198 KiB.
- `npm test` — **56 files / 570 tests pass**.
- `svelte-check` — **0 errors** (4 pre-existing warnings).
- `npm run test:extension` — **96 route/viewport checks + 7 interaction groups**; mobile search trigger fix included in `verify-extension.js`.
- Playwright fixtures:
  - 30 gaps + 5 tombstones: Incomplete tab renders 10 rows with page 2; page-size
    change to 10 keeps 10 rows.
  - Unavailable tab: 5 rows, origin link `#/playlist?id=local-a`, playlist filter
    narrows to 2, reason filter yields the empty-state message, Retry all opens the
    confirmation.
  - 390px: no horizontal overflow (`scrollWidth 375 <= innerWidth 390`).
  - API Setup: Test API Key disabled empty, enabled with a fake key, reports Google's
    invalid-key message; health is persisted and shown as the API badge.
  - Unavailable selection: Select all → 5 selected; unchecking one → 4; reason filter
    persists across reload along with the active tab.
  - Engine list: 7 rows, BETA/Official/FUTURE tags, Apify details expand on demand;
    390px has no horizontal overflow.
- Packages rebuilt: Chrome/Firefox/Edge ~523K.

## Apify assessment

Not related to the current free stack. Apify is a server-side actor platform; its
YouTube scrapers can return duration/metadata, but pricing is per result/run (store
listings around $1.75–$2.80 per 1,000 videos on the free plan, with monthly credits),
requires an Apify token, runs asynchronously, and sends IDs/results to a third party.
It is only a possible opt-in paid provider, not a replacement for the free Data API
(roughly 500,000 videos/day). The engine list shows it as `FUTURE · PAID` / not
connected; no integration or roadmap commitment is implied.

## Next

Owner review of the consolidated layout/copy; then commit with the UI-polish branch.
Shipped in PR #63 (squash merge c1a9849) into `next`; all required checks passed.
